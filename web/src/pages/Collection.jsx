import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import { api, apiRaw, resolveCardImage } from "../api.js";

const APP_HERO_SLIDES = [
  { image: "/hero-slide.png", alt: "Bộ sticker StickAI với nhân vật áo vàng" },
  { image: "/hero.png", alt: "Bộ sticker mẫu của StickAI" },
];

export default function Collection({ user }) {
  const navigate = useNavigate();
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [activeProcessStep, setActiveProcessStep] = useState(0);
  const heroTouchStartRef = useRef(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const photoInputRef = useRef(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % APP_HERO_SLIDES.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

  function handleHeroTouchStart(event) {
    heroTouchStartRef.current = event.touches[0].clientX;
  }

  function handleHeroTouchEnd(event) {
    if (heroTouchStartRef.current === null) return;
    const distance = event.changedTouches[0].clientX - heroTouchStartRef.current;
    heroTouchStartRef.current = null;
    if (Math.abs(distance) < 45) return;
    setActiveHeroSlide((current) =>
      distance < 0
        ? (current + 1) % APP_HERO_SLIDES.length
        : (current - 1 + APP_HERO_SLIDES.length) % APP_HERO_SLIDES.length,
    );
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveProcessStep((current) => (current + 1) % 4);
    }, 3200);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api("/api/cards")
      .then((data) => setCards(data.cards))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function openCreateModal(card) {
    setSelectedCard(card);
    setPhoto(null);
    setPhotoPreview("");
    setCustomPrompt("");
    setFormMessage("");
  }

  function closeCreateModal() {
    if (submitting) return;
    setSelectedCard(null);
    setPhoto(null);
    setPhotoPreview("");
    setCustomPrompt("");
  }

  function choosePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormMessage("Vui lòng chọn một file ảnh hợp lệ.");
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setFormMessage("");
  }

  async function createSticker(event) {
    event.preventDefault();
    if (!selectedCard || !photo) {
      setFormMessage("Bạn cần tải ảnh lên trước khi tạo sticker.");
      return;
    }

    setSubmitting(true);
    setFormMessage("Đang gửi ảnh và tùy chọn...");
    const body = new FormData();
    body.append("cardId", selectedCard.id);
    body.append("file", photo);
    body.append("customPrompt", customPrompt);

    try {
      const { response, data } = await apiRaw("/api/generate", { method: "POST", body });
      if (!response.ok) throw new Error(data.message || "Không thể tạo sticker.");
      setFormMessage("Đã nhận yêu cầu. Đang chuyển sang Lịch sử...");
      window.setTimeout(() => navigate("/history"), 500);
    } catch (reason) {
      setFormMessage(reason.message || "Không thể tạo sticker.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-page">
      <Header user={user} transparent />

      <section
        className="app-hero-slider"
        onTouchStart={handleHeroTouchStart}
        onTouchEnd={handleHeroTouchEnd}
      >
        {APP_HERO_SLIDES.map((slide, index) => (
          <img
            className={`app-hero-image ${index === activeHeroSlide ? "active" : ""}`}
            src={slide.image}
            alt={slide.alt}
            aria-hidden={index !== activeHeroSlide}
            key={slide.image}
          />
        ))}
        <div className="app-hero-copy">
          <p className="eyebrow">Stickers riêng của bạn</p>
          <h1>Một tấm ảnh, cả bộ sticker.</h1>
          <p>Khám phá các bộ sticker theo phong cách của riêng bạn.</p>
        </div>
        <div className="app-hero-controls">
          <button
            type="button"
            aria-label="Slide trước"
            onClick={() =>
              setActiveHeroSlide(
                (current) => (current - 1 + APP_HERO_SLIDES.length) % APP_HERO_SLIDES.length,
              )
            }
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Slide tiếp theo"
            onClick={() => setActiveHeroSlide((current) => (current + 1) % APP_HERO_SLIDES.length)}
          >
            ›
          </button>
        </div>
        <div className="hero-pagination" aria-label="Chuyển slide">
          {APP_HERO_SLIDES.map((slide, index) => (
            <button
              className={activeHeroSlide === index ? "active" : ""}
              type="button"
              aria-label={`Chuyển đến slide ${index + 1}`}
              aria-current={activeHeroSlide === index ? "true" : undefined}
              onClick={() => setActiveHeroSlide(index)}
              key={slide.image}
            />
          ))}
        </div>
      </section>

      <section className="how-it-works" aria-labelledby="how-it-works-title">
        <div className="how-it-works-inner">
          <p className="eyebrow">Đơn giản và nhanh chóng</p>
          <h2 id="how-it-works-title">Cách tạo sticker</h2>
          <div className="process-grid">
            <article className={`process-card ${activeProcessStep === 0 ? "active" : ""}`}>
              <div
                className="process-card__image"
                style={{ backgroundImage: "url('/step-choose-pack.png')" }}
                aria-hidden="true"
              />
              <div className="process-card__panel">
                <span className="process-card__number">01</span>
                <h3>Chọn bộ</h3>
              </div>
            </article>
            <article className={`process-card ${activeProcessStep === 1 ? "active" : ""}`}>
              <div
                className="process-card__image"
                style={{ backgroundImage: "url('/step-upload-photo.png')" }}
                aria-hidden="true"
              />
              <div className="process-card__panel">
                <span className="process-card__number">02</span>
                <h3>Tải ảnh</h3>
              </div>
            </article>
            <article className={`process-card ${activeProcessStep === 2 ? "active" : ""}`}>
              <div
                className="process-card__image"
                style={{ backgroundImage: "url('/step-receive-stickers.png')" }}
                aria-hidden="true"
              />
              <div className="process-card__panel">
                <span className="process-card__number">03</span>
                <h3>Nhận sticker</h3>
              </div>
            </article>
            <article className={`process-card ${activeProcessStep === 3 ? "active" : ""}`}>
              <div
                className="process-card__image"
                style={{ backgroundImage: "url('/hero-slide.png')" }}
                aria-hidden="true"
              />
              <div className="process-card__panel">
                <span className="process-card__number">04</span>
                <h3>Chia sẻ sticker lên MXH</h3>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="content">
        <p className="eyebrow">Khám phá bộ sưu tập</p>
        <h2>Danh mục stickers</h2>
        {loading && <p>Đang tải bộ sticker...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && (
          <div className="card-grid">
            {cards.map((card) => (
              <article
                className={`sticker-card ${card.color}`}
                key={card.id}
                role="button"
                tabIndex={0}
                onClick={() => openCreateModal(card)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCreateModal(card);
                  }
                }}
                aria-label={`Tạo sticker theo bộ ${card.title}`}
              >
                <div className="card-art">
                  {(card.image || card.imageUrl || card.image_url) && (
                    <img
                      src={resolveCardImage(card.image || card.imageUrl || card.image_url)}
                      alt={card.title}
                    />
                  )}
                  <p className="card-topic">{card.topic}</p>
                  <div className="card-info">
                    <h3>{card.title}</h3>
                    <p className="card-alias">{card.alias}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedCard && (
        <div className="backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeCreateModal();
        }}>
          <form className="create-card wide sticker-create-modal" onSubmit={createSticker}>
            <button className="close" type="button" onClick={closeCreateModal} aria-label="Đóng">
              ×
            </button>
            <p className="eyebrow">Tạo bộ sticker</p>
            <h2>{selectedCard.title}</h2>
            <p className="modal-topic">Chủ đề: {selectedCard.topic}</p>
            <p className="modal-intro">Card này sẽ quyết định chủ đề chính của bộ sticker. Prompt bên dưới chỉ dùng để bổ sung yêu cầu.</p>

            <label className="upload-field">
              Ảnh tham chiếu
              <input
                ref={photoInputRef}
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={choosePhoto}
                required
              />
              <button className="upload-box" type="button" onClick={() => photoInputRef.current?.click()}>
                {photoPreview ? <img src={photoPreview} alt="Ảnh đã chọn" /> : "Chọn ảnh PNG, JPG hoặc WEBP · tối đa 10MB"}
              </button>
            </label>

            <label>
              Prompt tuỳ chọn <small>(không bắt buộc)</small>
              <textarea
                rows={4}
                maxLength={400}
                value={customPrompt}
                placeholder="Ví dụ: thêm tư thế giơ tay chào, giữ nguyên kiểu tóc, dùng màu sắc tươi sáng..."
                onChange={(event) => setCustomPrompt(event.target.value)}
              />
            </label>

            {formMessage && <p className={`form-message ${formMessage.startsWith("Đã nhận") ? "success" : ""}`}>{formMessage}</p>}
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Đang xử lý..." : "Tạo bộ sticker"}
            </button>
          </form>
        </div>
      )}

      <footer className="app-footer">
        <div className="app-footer-inner">
          <p className="app-footer-brand">
            Stick<span>AI</span>
          </p>
          <p className="app-footer-copy">Biến cá tính của bạn thành những bộ sticker riêng.</p>
          <p className="app-footer-meta">© 2025 StickAI</p>
        </div>
      </footer>

    </main>
  );
}
