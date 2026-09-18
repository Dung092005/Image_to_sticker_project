import { createServer } from "node:http";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureSchema,
  loginWithPassword,
  createSession,
  getUserBySession,
  deleteSession,
  listCards,
  getCard,
  updateCard,
  listUsers,
  listHistoryForUser,
  getGeneratedForUser,
  createGeneratedJob,
  updateGeneratedJob,
  pingDatabase,
  SESSION_MAX_AGE_SECONDS,
} from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectFolder = path.join(here, "..");
const uploadsFolder = path.join(here, "uploads");
const generatedFolder = path.join(here, "generated");

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

function writeGcpCredentialsFromEnv() {
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (!json) return;
  const credPath = path.join(here, "gcp-service-account.json");
  writeFileSync(credPath, json, "utf8");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
}

function allowedOrigins() {
  return (process.env.APP_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function corsHeaders(req) {
  const origin = req.headers.origin || "";
  const allowed = allowedOrigins();
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (allowed.length === 1 && !req.headers.origin) {
    // Same-origin proxy (Vercel rewrite) often has no browser Origin on some requests.
  }
  return headers;
}

function sessionCookie(value, maxAge = SESSION_MAX_AGE_SECONDS) {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production";
  // Default Lax = Vercel rewrite cùng site FE. Đặt COOKIE_SAMESITE=None nếu FE gọi thẳng Render.
  const sameSite = process.env.COOKIE_SAMESITE || "Lax";
  const parts = [
    `stickai_session=${value}`,
    "HttpOnly",
    `SameSite=${sameSite}`,
    "Path=/",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function send(res, status, body, extraHeaders = {}, req = null) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...(req ? corsHeaders(req) : {}),
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
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

async function generateSticker(job, card, outfit, additionalPrompt, image, mimeType) {
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
      additionalPrompt,
      "--output",
      outputPath,
    ]);
    await updateGeneratedJob(job.id, {
      status: "completed",
      image: `/api/generated/${job.id}`,
      errorMessage: null,
    });
  } catch (error) {
    const detail = String(error.message || error).slice(0, 500);
    const missingProject = !process.env.GCP_PROJECT_ID;
    await updateGeneratedJob(job.id, {
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
  return getUserBySession(cookies(req).stickai_session);
}

const port = Number(process.env.PORT || 3000);

await loadEnvFiles();
writeGcpCredentialsFromEnv();
await ensureSchema();
await pingDatabase();

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3000");
  console.log(req.method, url.pathname);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { ok: true, database: "supabase" }, {}, req);
    }

    if (req.method === "GET" && url.pathname === "/api/cards") {
      return send(res, 200, { cards: await listCards() }, {}, req);
    }

    if (req.method === "GET" && url.pathname === "/api/auth/me") {
      const user = await currentUser(req);
      return user
        ? send(res, 200, { user }, {}, req)
        : send(res, 401, { message: "Bạn chưa đăng nhập." }, {}, req);
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readBody(req);
      if (!body) return send(res, 400, { message: "Body JSON không hợp lệ." }, {}, req);
      const user = await loginWithPassword(body.email, body.password);
      if (!user) return send(res, 401, { message: "Email hoặc mật khẩu không đúng." }, {}, req);

      const sessionId = await createSession(user.id);
      return send(
        res,
        200,
        { user },
        { "Set-Cookie": sessionCookie(sessionId) },
        req
      );
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const sessionId = cookies(req).stickai_session;
      if (sessionId) await deleteSession(sessionId);
      return send(
        res,
        200,
        { ok: true },
        { "Set-Cookie": sessionCookie("", 0) },
        req
      );
    }

    if (req.method === "GET" && url.pathname === "/api/history") {
      const user = await currentUser(req);
      if (!user) return send(res, 401, { message: "Vui lòng đăng nhập." }, {}, req);
      return send(res, 200, { stickers: await listHistoryForUser(user.id) }, {}, req);
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/generated/")) {
      const user = await currentUser(req);
      const id = url.pathname.split("/").pop();
      const sticker = user ? await getGeneratedForUser(user.id, id) : null;
      const imagePath = path.join(generatedFolder, `${id}.png`);
      if (!sticker || sticker.status !== "completed" || !existsSync(imagePath)) {
        return send(res, 404, { message: "Không tìm thấy sticker." }, {}, req);
      }
      const image = await readFile(imagePath);
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        ...corsHeaders(req),
      });
      return res.end(image);
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      const user = await currentUser(req);
      if (!user) return send(res, 401, { message: "Vui lòng đăng nhập để tạo sticker." }, {}, req);

      const body = parseMultipart(await readBuffer(req), req.headers["content-type"] || "");
      if (!body?.file || !body.fields.cardId) {
        return send(res, 400, { message: "Cần chọn bộ sticker và tải một ảnh lên." }, {}, req);
      }

      const mimeType = imageType(body.file.data);
      if (!mimeType) {
        return send(res, 400, { message: "Chỉ nhận ảnh PNG, JPG hoặc WEBP hợp lệ." }, {}, req);
      }
      if (body.file.data.length > 10 * 1024 * 1024) {
        return send(res, 400, { message: "Ảnh không được vượt quá 10MB." }, {}, req);
      }

      const outfit = String(body.fields.outfit || "").trim();
      const additionalPrompt = [
        outfit && `Trang phục: ${outfit}`,
        String(body.fields.accessories || "").trim() && `Phụ kiện: ${String(body.fields.accessories).trim()}`,
        String(body.fields.expression || "").trim() && `Biểu cảm/vibe: ${String(body.fields.expression).trim()}`,
        String(body.fields.customPrompt || "").trim() && `Ý tưởng thêm: ${String(body.fields.customPrompt).trim()}`,
      ].filter(Boolean).join("\n");
      if (additionalPrompt.length > 800) {
        return send(res, 400, { message: "Các tùy chọn bổ sung tối đa 800 ký tự." }, {}, req);
      }

      const card = await getCard(body.fields.cardId);
      if (!card) return send(res, 404, { message: "Không tìm thấy bộ sticker." }, {}, req);

      const job = await createGeneratedJob({
        userId: user.id,
        cardId: card.id,
        title: card.title,
        outfit,
      });

      void generateSticker(job, card, outfit, additionalPrompt, body.file.data, mimeType);
      return send(res, 202, { jobId: job.id }, {}, req);
    }

    if (req.method === "GET" && url.pathname === "/api/admin") {
      const user = await currentUser(req);
      if (!user || user.role !== "admin") {
        return send(res, 403, { message: "Bạn không có quyền quản trị." }, {}, req);
      }
      return send(res, 200, {
        users: await listUsers(),
        cards: await listCards(),
      }, {}, req);
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/admin/cards/")) {
      const user = await currentUser(req);
      if (!user || user.role !== "admin") {
        return send(res, 403, { message: "Bạn không có quyền quản trị." }, {}, req);
      }
      const cardId = url.pathname.split("/").pop();
      const body = await readBody(req);
      if (!body) return send(res, 400, { message: "Body JSON không hợp lệ." }, {}, req);

      const updated = await updateCard(cardId, body);
      if (!updated) return send(res, 404, { message: "Không tìm thấy bộ sticker." }, {}, req);
      return send(res, 200, { card: updated }, {}, req);
    }

    return send(res, 404, { message: "Không tìm thấy API này." }, {}, req);
  } catch (error) {
    console.error(error);
    return send(res, 500, { message: "Server gặp lỗi. Xem terminal để biết chi tiết." }, {}, req);
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`StickAI API: http://localhost:${port}`);
  console.log(`Database: Supabase Postgres`);
  console.log(`APP_ORIGIN: ${process.env.APP_ORIGIN || "(default localhost)"}`);
  console.log(`Python: ${process.env.STICKAI_PYTHON || "(default)"}`);
  console.log(`GCP_PROJECT_ID: ${process.env.GCP_PROJECT_ID || "(missing)"}`);
});
