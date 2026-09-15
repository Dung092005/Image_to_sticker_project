import { useState } from "react";
import { apiRaw } from "../api.js";

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
        <strong>
          Stick<span>AI</span>
        </strong>
        <button type="button" onClick={() => setShowLogin(true)}>
          Đăng nhập
        </button>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">STICKERS RIÊNG CỦA BẠN</p>
          <h1>
            Một tấm ảnh.
            <br />
            Cả bộ sticker.
          </h1>
          <p>
            Chọn một chủ đề, tải ảnh lên và biến cá tính của bạn thành sticker để
            trò chuyện.
          </p>
          <button className="primary" type="button" onClick={() => setShowLogin(true)}>
            Truy cập ngay ↗
          </button>
        </div>
        <img className="hero-image" src="/hero.png" alt="Minh hoạ StickAI" />
      </section>

      {showLogin && (
        <div className="backdrop">
          <form className="login-card" onSubmit={login}>
            <button className="close" type="button" onClick={() => setShowLogin(false)}>
              ×
            </button>
            <p className="eyebrow">ĐĂNG NHẬP DEMO</p>
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
            <p className="form-message">{message || "User: demo@stickai.local / demo123"}</p>
            <p className="form-message">Admin: admin@stickai.local / admin123</p>
          </form>
        </div>
      )}
    </main>
  );
}
