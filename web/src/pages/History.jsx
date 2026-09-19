import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header.jsx";
import { api } from "../api.js";

export default function History({ user }) {
  const [stickers, setStickers] = useState([]);
  const [cards, setCards] = useState([]);
  const [selectedSticker, setSelectedSticker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let timer;
    let cancelled = false;

    async function load() {
      try {
        const [data, cardsData] = await Promise.all([
          api("/api/history"),
          api("/api/cards"),
        ]);
        if (cancelled) return;
        setStickers(data.stickers);
        setCards(cardsData.cards || []);
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

        {loading && <p>Đang tải lịch sử...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && stickers.length === 0 && (
          <p className="empty">
            Bạn chưa tạo sticker nào. <Link to="/app">Tạo bộ đầu tiên</Link>
          </p>
        )}

        {!loading && !error && stickers.length > 0 && (
          <div className="card-grid">
            {stickers.map((sticker) => (
              <HistoryCard
                key={sticker.id}
                sticker={sticker}
                card={cards.find((item) => item.id === sticker.cardId)}
                onOpen={() => setSelectedSticker(sticker)}
              />
            ))}
          </div>
        )}
      </section>
      {selectedSticker && (
        <StickerPreviewModal
          sticker={selectedSticker}
          card={cards.find((item) => item.id === selectedSticker.cardId)}
          onClose={() => setSelectedSticker(null)}
        />
      )}
    </main>
  );
}

function HistoryCard({ sticker, card, onOpen }) {
  return (
    <article
      className={`sticker-card ${card?.color || "pink"}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Xem kết quả ${card?.title || sticker.title}`}
    >
      <div className="card-art">
        {sticker.image && <img src={sticker.image} alt={card?.title || sticker.title} />}
        <p className="card-topic">{card?.topic || "Bộ sticker"}</p>
        <div className="card-info">
          <h3>{card?.title || sticker.title}</h3>
          <p className="card-alias">{card?.alias || "Sticker của bạn"}</p>
        </div>
        {sticker.status === "processing" && (
          <div className="history-processing" role="status" aria-live="polite">
            <span className="history-spinner" aria-hidden="true" />
            <span>Đang xử lý...</span>
          </div>
        )}
        {sticker.status === "error" && (
          <div
            className="history-processing history-error-state"
            role="alert"
            title={sticker.errorMessage || "Không tạo được ảnh sticker."}
          >
            <span className="history-error-icon" aria-hidden="true">!</span>
            <span>Có lỗi khi tạo ảnh</span>
          </div>
        )}
      </div>
    </article>
  );
}

function StickerPreviewModal({ sticker, card, onClose }) {
  const hasImage = Boolean(sticker.image);

  return (
    <div
      className="backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="create-card sticker-preview-modal">
        <button className="close" type="button" onClick={onClose} aria-label="Đóng">
          ×
        </button>
        <p className="eyebrow">{card?.topic || "Sticker"}</p>
        <h2>{card?.title || sticker.title}</h2>
        {hasImage ? (
          <img className="sticker-preview-image" src={sticker.image} alt={sticker.title} />
        ) : (
          <div className={`sticker-preview-status ${sticker.status}`}>
            {sticker.status === "processing" ? "Đang xử lý..." : "Có lỗi khi tạo ảnh"}
            {sticker.errorMessage && <small>{sticker.errorMessage}</small>}
          </div>
        )}
        {hasImage && (
          <a className="primary sticker-download-button" href={sticker.image} download>
            Tải ảnh xuống
          </a>
        )}
      </div>
    </div>
  );
}
