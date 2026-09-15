import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import { api, apiRaw } from "../api.js";

const CARD_EMOJI = {
  orange: "🏖️",
  pink: "💕",
  blue: "📚",
};

export default function Collection({ user }) {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [outfit, setOutfit] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api("/api/cards")
      .then((data) => setCards(data.cards))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  async function generate(event) {
    event.preventDefault();
    if (!file) {
      setMessage("Vui lòng chọn ảnh trước khi tạo.");
      return;
    }

    setCreating(true);
    setMessage("");

    const formData = new FormData();
    formData.append("cardId", selected.id);
    formData.append("image", file);
    formData.append("outfit", outfit);

    try {
      const { response, data } = await apiRaw("/api/generate", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(data.message || "Không thể tạo sticker.");
      }
      // 202 Accepted: job is queued. History page will poll until done.
      navigate("/history");
    } catch (reason) {
      setMessage(reason.message || "Không thể tạo sticker.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="app-page">
      <Header user={user} />

      <section className="app-hero">
        <div>
          <p className="eyebrow">Bộ sưu tập</p>
          <h1>Chọn sticker mang dấu ấn của bạn</h1>
          <p>Tải ảnh khuôn mặt rõ, chọn phong cách và thêm trang phục nếu muốn.</p>
        </div>
        <div className="mini-sheet">
          😊 💬
          <br />
          ✨ 🎨
        </div>
      </section>

      <section className="content">
        <h2>Danh mục stickers</h2>
        {loading && <p>Đang tải bộ sticker...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && (
          <div className="card-grid">
            {cards.map((card) => (
              <article className={`sticker-card ${card.color}`} key={card.id}>
                <div className="card-art">{CARD_EMOJI[card.color] || "🎨"}</div>
                <p className="card-topic">{card.topic}</p>
                <h3>{card.title}</h3>
                <p className="card-alias">{card.alias}</p>
                <p className="card-desc">{card.description}</p>
                <button
                  className="primary"
                  type="button"
                  onClick={() => {
                    setSelected(card);
                    setFile(null);
                    setOutfit("");
                    setMessage("");
                  }}
                >
                  Tạo bộ sticker
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div className="backdrop">
          <form className="create-card" onSubmit={generate}>
            <button className="close" type="button" onClick={() => setSelected(null)}>
              ×
            </button>
            <p className="eyebrow">{selected.topic}</p>
            <h2>{selected.title}</h2>
            <p className="hint">{selected.description}</p>

            <label>
              Ảnh của bạn
              <input
                required
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>

            <label>
              <span>
                Trang phục <small>(tuỳ chọn)</small>
              </span>
              <input
                maxLength={160}
                value={outfit}
                placeholder="Ví dụ: áo sơ mi trắng"
                onChange={(event) => setOutfit(event.target.value)}
              />
            </label>

            {message && <p className="error">{message}</p>}

            <button className="primary" disabled={creating}>
              {creating ? "Đang tạo..." : "Tạo sticker"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
