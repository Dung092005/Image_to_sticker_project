import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataFolder = path.join(here, "..", "data");
const projectFolder = path.join(here, "..");
const uploadsFolder = path.join(here, "uploads");
const generatedFolder = path.join(here, "generated");
const sessionsFile = path.join(dataFolder, "sessions.json");

// Serialize JSON writes so generate + history updates do not clobber each other.
let dataQueue = Promise.resolve();
function withLock(task) {
  const run = dataQueue.then(task, task);
  dataQueue = run.catch(() => undefined);
  return run;
}

async function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const filePath = path.join(projectFolder, name);
    if (!existsSync(filePath)) continue;
    const text = await readFile(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

async function readJson(name) {
  return JSON.parse(await readFile(path.join(dataFolder, name), "utf8"));
}

async function writeJson(name, value) {
  await writeFile(path.join(dataFolder, name), JSON.stringify(value, null, 2), "utf8");
}

async function readSessions() {
  if (!existsSync(sessionsFile)) return {};
  return JSON.parse(await readFile(sessionsFile, "utf8"));
}

async function writeSessions(sessions) {
  await writeFile(sessionsFile, JSON.stringify(sessions, null, 2), "utf8");
}

async function readBody(req) {
  let text = "";
  for await (const chunk of req) text += chunk;
  try {
    return JSON.parse(text || "{}");
  } catch {
    return null;
  }
}

async function readBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, contentType) {
  const boundary = contentType.match(/boundary=(.+)$/)?.[1];
  if (!boundary) return null;
  const parts = buffer.toString("binary").split(`--${boundary}`);
  const fields = {};
  let file = null;

  for (const part of parts) {
    const divider = part.indexOf("\r\n\r\n");
    if (divider < 0) continue;
    const headers = part.slice(0, divider);
    let body = part.slice(divider + 4);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    const name = headers.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    const filename = headers.match(/filename="([^"]*)"/)?.[1];
    if (filename !== undefined) {
      file = {
        name: filename,
        type: headers.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim() || "",
        data: Buffer.from(body, "binary"),
      };
    } else {
      fields[name] = Buffer.from(body, "binary").toString("utf8");
    }
  }
  return { fields, file };
}

function imageType(data) {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function runPython(args) {
  const python =
    process.env.STICKAI_PYTHON ||
    (process.platform === "win32" ? "python" : "python3");
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, {
      cwd: projectFolder,
      env: process.env,
      windowsHide: true,
    });
    let errorText = "";
    child.stderr.on("data", (chunk) => {
      errorText += chunk;
    });
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(errorText || `Python exited with code ${code}.`))
    );
  });
}

async function updateHistoryItem(jobId, patch) {
  return withLock(async () => {
    const history = await readJson("history.json");
    const item = history.find((sticker) => sticker.id === jobId);
    if (!item) return;
    Object.assign(item, patch);
    await writeJson("history.json", history);
  });
}

async function generateSticker(job, card, outfit, image, mimeType) {
  const inputPath = path.join(uploadsFolder, `${job.id}.input`);
  const outputPath = path.join(generatedFolder, `${job.id}.png`);
  try {
    await mkdir(uploadsFolder, { recursive: true });
    await mkdir(generatedFolder, { recursive: true });
    await writeFile(inputPath, image);
    await runPython([
      path.join(projectFolder, "scripts", "generate_image.py"),
      card.prompt,
      "--image",
      inputPath,
      "--mime-type",
      mimeType,
      "--additional-prompt",
      outfit,
      "--output",
      outputPath,
    ]);
    await updateHistoryItem(job.id, {
      status: "completed",
      image: `/api/generated/${job.id}`,
      errorMessage: null,
    });
  } catch (error) {
    const detail = String(error.message || error).slice(0, 500);
    const missingProject = !process.env.GCP_PROJECT_ID;
    await updateHistoryItem(job.id, {
      status: "error",
      errorMessage: missingProject
        ? "Thiếu GCP_PROJECT_ID trong .env.local. Xem README để cấu hình Vertex AI."
        : `Vertex AI không tạo được ảnh: ${detail}`,
    });
    console.error("Generate failed:", detail);
  } finally {
    await unlink(inputPath).catch(() => undefined);
  }
}

function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key]) => key)
  );
}

async function currentUser(req) {
  const sessionId = cookies(req).stickai_session;
  if (!sessionId) return null;
  const sessions = await readSessions();
  const userId = sessions[sessionId];
  if (!userId) return null;
  const users = await readJson("users.json");
  return users.find((user) => user.id === userId) || null;
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

const port = Number(process.env.PORT || 3000);

await loadEnvFiles();

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3000");
  console.log(req.method, url.pathname);

  try {
    if (req.method === "GET" && url.pathname === "/api/cards") {
      return send(res, 200, { cards: await readJson("cards.json") });
    }

    if (req.method === "GET" && url.pathname === "/api/auth/me") {
      const user = await currentUser(req);
      return user
        ? send(res, 200, { user: publicUser(user) })
        : send(res, 401, { message: "Bạn chưa đăng nhập." });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readBody(req);
      if (!body) return send(res, 400, { message: "Body JSON không hợp lệ." });
      const users = await readJson("users.json");
      const user = users.find(
        (item) =>
          item.email === String(body.email || "").trim().toLowerCase() &&
          item.password === body.password
      );
      if (!user) return send(res, 401, { message: "Email hoặc mật khẩu không đúng." });

      const sessionId = randomUUID();
      await withLock(async () => {
        const sessions = await readSessions();
        sessions[sessionId] = user.id;
        await writeSessions(sessions);
      });

      // Cookie only stores a random session id. The server maps it to a user.
      return send(
        res,
        200,
        { user: publicUser(user) },
        {
          "Set-Cookie": `stickai_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
        }
      );
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const sessionId = cookies(req).stickai_session;
      if (sessionId) {
        await withLock(async () => {
          const sessions = await readSessions();
          delete sessions[sessionId];
          await writeSessions(sessions);
        });
      }
      return send(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie": "stickai_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        }
      );
    }

    if (req.method === "GET" && url.pathname === "/api/history") {
      const user = await currentUser(req);
      if (!user) return send(res, 401, { message: "Vui lòng đăng nhập." });
      const history = await readJson("history.json");
      return send(res, 200, {
        stickers: history.filter((sticker) => sticker.userId === user.id).reverse(),
      });
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/generated/")) {
      const user = await currentUser(req);
      const id = url.pathname.split("/").pop();
      const history = await readJson("history.json");
      const sticker = history.find(
        (item) => item.id === id && item.userId === user?.id && item.status === "completed"
      );
      const imagePath = path.join(generatedFolder, `${id}.png`);
      if (!sticker || !existsSync(imagePath)) {
        return send(res, 404, { message: "Không tìm thấy sticker." });
      }
      const image = await readFile(imagePath);
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      });
      return res.end(image);
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      const user = await currentUser(req);
      if (!user) return send(res, 401, { message: "Vui lòng đăng nhập để tạo sticker." });

      const body = parseMultipart(await readBuffer(req), req.headers["content-type"] || "");
      if (!body?.file || !body.fields.cardId) {
        return send(res, 400, { message: "Cần chọn bộ sticker và tải một ảnh lên." });
      }

      const mimeType = imageType(body.file.data);
      if (!mimeType) {
        return send(res, 400, { message: "Chỉ nhận ảnh PNG, JPG hoặc WEBP hợp lệ." });
      }
      if (body.file.data.length > 10 * 1024 * 1024) {
        return send(res, 400, { message: "Ảnh không được vượt quá 10MB." });
      }

      const outfit = String(body.fields.outfit || "").trim();
      if (outfit.length > 160) {
        return send(res, 400, { message: "Trang phục tối đa 160 ký tự." });
      }

      const cards = await readJson("cards.json");
      const card = cards.find((item) => item.id === body.fields.cardId);
      if (!card) return send(res, 404, { message: "Không tìm thấy bộ sticker." });

      const job = {
        id: randomUUID(),
        userId: user.id,
        cardId: card.id,
        title: card.title,
        outfit,
        status: "processing",
        image: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
      };

      await withLock(async () => {
        const history = await readJson("history.json");
        history.push(job);
        await writeJson("history.json", history);
      });

      // Keep Vertex AI outside Node: spawn the Python script as a worker.
      void generateSticker(job, card, outfit, body.file.data, mimeType);
      return send(res, 202, { jobId: job.id });
    }

    if (req.method === "GET" && url.pathname === "/api/admin") {
      const user = await currentUser(req);
      if (!user || user.role !== "admin") {
        return send(res, 403, { message: "Bạn không có quyền quản trị." });
      }
      const users = await readJson("users.json");
      const history = await readJson("history.json");
      const safeUsers = users.map((item) => ({
        ...publicUser(item),
        stickerCreations: history.filter(
          (sticker) => sticker.userId === item.id && sticker.status === "completed"
        ).length,
      }));
      return send(res, 200, {
        users: safeUsers,
        cards: await readJson("cards.json"),
      });
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/admin/cards/")) {
      const user = await currentUser(req);
      if (!user || user.role !== "admin") {
        return send(res, 403, { message: "Bạn không có quyền quản trị." });
      }
      const cardId = url.pathname.split("/").pop();
      const body = await readBody(req);
      if (!body) return send(res, 400, { message: "Body JSON không hợp lệ." });

      const updated = await withLock(async () => {
        const cards = await readJson("cards.json");
        const card = cards.find((item) => item.id === cardId);
        if (!card) return null;
        card.title = String(body.title || card.title).trim();
        card.alias = String(body.alias || card.alias).trim();
        card.description = String(body.description || card.description).trim();
        card.prompt = String(body.prompt || card.prompt).trim();
        await writeJson("cards.json", cards);
        return card;
      });

      if (!updated) return send(res, 404, { message: "Không tìm thấy bộ sticker." });
      return send(res, 200, { card: updated });
    }

    return send(res, 404, { message: "Không tìm thấy API này." });
  } catch (error) {
    console.error(error);
    return send(res, 500, { message: "Server gặp lỗi. Xem terminal để biết chi tiết." });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`StickAI API: http://localhost:${port}`);
  console.log(`Python: ${process.env.STICKAI_PYTHON || "(default)"}`);
  console.log(`GCP_PROJECT_ID: ${process.env.GCP_PROJECT_ID || "(missing)"}`);
});
