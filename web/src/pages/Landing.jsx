import { useState } from "react";
import { apiRaw } from "../api.js";

const STEPS = [
  {
    title: "Chọn chủ đề",
    text: "Mùa hè, cảm xúc hằng ngày hay chuyện đi học đi làm.",
  },
  {
    title: "Tải ảnh của bạn",
    text: "Một ảnh chân dung rõ mặt là đủ, PNG / JPG / WEBP.",
  },
  {
    title: "Nhận bộ sticker",
    text: "Vertex AI vẽ lại khuôn mặt bạn kèm câu thoại tiếng Việt.",
  },
];

export default function Landing() {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("demo@stickai.local");
  const [password, setPassword] = useState("demo123");
  const [message, setMessage] = useState("");

  async function login(event) {
    event.preventDefault();
    setMessage("Đang đăng nhập...");
    try {
      const { response, data } = await apiRaw("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setMessage(data.message || "Đăng nhập thất bại.");
        return;
      }
      // Full reload so App reads the new session cookie cleanly.
      window.location.assign("/app");
    } catch {
      setMessage("Không kết nối được server :3000. Hãy chạy npm run server.");
    }
  }

  return (
    <main className="landing">
      <header className="landing-header">
        <div className="brand">
          Stick<span>AI</span>
        </div>
        <button className="ghost-btn" type="button" onClick={() => setShowLogin(true)}>
          Đăng nhập
        </button>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Stickers riêng của bạn</p>
          <h1>Một tấm ảnh, cả bộ sticker.</h1>
          <p className="hero-lead">
            Chọn một chủ đề, tải ảnh lên và biến cá tính của bạn thành bộ sticker
            để dùng trong mọi cuộc trò chuyện.
          </p>
          <div className="cta-row">
            <button className="primary" type="button" onClick={() => setShowLogin(true)}>
              Truy cập ngay
            </button>
            <a className="ghost-btn" href="#cach-hoat-dong">
              Cách hoạt động
            </a>
          </div>
        </div>

        <div className="hero-visual">
          <img className="hero-image" src="/hero.png" alt="Bộ sticker mẫu của StickAI" />
          <p className="hero-badge">Tạo bằng Vertex AI · Gemini</p>
        </div>
      </section>

      <section className="steps" id="cach-hoat-dong">
        {STEPS.map((step, index) => (
          <article className="step" key={step.title}>
            <div className="step-number">{index + 1}</div>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </section>

      {showLogin && (
        <div className="backdrop">
          <form className="login-card" onSubmit={login}>
            <button className="close" type="button" onClick={() => setShowLogin(false)}>
              ×
            </button>
            <p className="eyebrow">Đăng nhập demo</p>
            <h2>Bắt đầu với StickAI</h2>

            <label>
              Email
              <input
                value={email}
                type="email"
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label>
              Mật khẩu
              <input
                value={password}
                type="password"
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <button className="primary" type="submit">
              Đăng nhập
            </button>

            <p className="form-message">
              {message || "User: demo@stickai.local / demo123"}
            </p>
            <p className="form-message">Admin: admin@stickai.local / admin123</p>
          </form>
        </div>
      )}
    </main>
  );
}
