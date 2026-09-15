import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header.jsx";
import { api } from "../api.js";

export default function History({ user }) {
  const [stickers, setStickers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let timer;
    let cancelled = false;

    async function load() {
      try {
        const data = await api("/api/history");
        if (cancelled) return;
        setStickers(data.stickers);
        setError("");

        // Keep polling while any job is still processing (202 flow).
        if (data.stickers.some((item) => item.status === "processing")) {
          timer = setTimeout(load, 2500);
        }
      } catch (reason) {
        if (!cancelled) setError(reason.message || "Không tải được lịch sử.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <main className="app-page">
      <Header user={user} />
      <section className="content">
        <p className="eyebrow">Lịch sử</p>
        <h1>Lịch sử stickers</h1>
        <p className="section-lead">Các bộ sticker bạn đã tạo bằng ảnh của mình.</p>

        {loading && <p>Đang tải lịch sử...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && stickers.length === 0 && (
          <p className="empty">
            Bạn chưa tạo sticker nào. <Link to="/app">Tạo bộ đầu tiên</Link>
          </p>
        )}

        {!loading && !error && stickers.length > 0 && (
          <div className="history-grid">
            {stickers.map((sticker) => (
              <article className="history-card" key={sticker.id}>
                {sticker.image ? (
                  <img src={sticker.image} alt={sticker.title} />
                ) : (
                  <div className="history-placeholder">
                    {sticker.status === "processing" ? "Đang tạo..." : "Có lỗi"}
                  </div>
                )}
                <h3>{sticker.title}</h3>
                <p className={`status ${sticker.status}`}>
                  {sticker.status === "completed"
                    ? "Đã tạo"
                    : sticker.status === "processing"
                      ? "Đang xử lý"
                      : "Có lỗi"}
                </p>
                {sticker.outfit && (
                  <p className="history-meta">Trang phục: {sticker.outfit}</p>
                )}
                {sticker.errorMessage && (
                  <p className="error small-error">{sticker.errorMessage}</p>
                )}
                {sticker.image && (
                  <a className="download" href={sticker.image} download>
                    Tải xuống ↓
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
