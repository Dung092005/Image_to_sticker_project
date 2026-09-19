import { useState } from "react";
import { apiUrl } from "../api.js";

export default function Landing() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Stickers riêng của bạn</p>
          <h1>Một tấm ảnh, cả bộ sticker.</h1>
          <p className="hero-lead">
            Chọn một chủ đề, tải ảnh lên và biến cá tính của bạn thành bộ sticker
            để dùng trong mọi cuộc trò chuyện.
          </p>
          <div className="cta-row">
            <button className="primary hero-cta" type="button" onClick={() => setShowLogin(true)}>
              Truy cập ngay
            </button>
          </div>
        </div>

      </section>

      {showLogin && (
        <div className="backdrop">
          <div className="login-card">
            <button className="close" type="button" onClick={() => setShowLogin(false)}>
              ×
            </button>
            <h2>Bắt đầu với StickAI</h2>
            <p className="modal-intro">Đăng nhập nhanh và an toàn bằng tài khoản Google của bạn.</p>
            <a className="google-login-button" href={apiUrl("/api/auth/google?returnTo=/app")}>
              <span className="google-login-icon" aria-hidden="true">G</span>
              Tiếp tục với Google
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
