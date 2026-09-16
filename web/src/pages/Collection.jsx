import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import { api } from "../api.js";

const APP_HERO_SLIDES = [
  { image: "/hero-slide.png", alt: "Bộ sticker StickAI với nhân vật áo vàng" },
  { image: "/hero.png", alt: "Bộ sticker mẫu của StickAI" },
];

export default function Collection({ user }) {
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % APP_HERO_SLIDES.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api("/api/cards")
      .then((data) => setCards(data.cards))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="app-page">
      <Header user={user} transparent />

      <section className="app-hero-slider">
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
          <div className="app-hero-dots">
            {APP_HERO_SLIDES.map((slide, index) => (
              <button
                className={index === activeHeroSlide ? "active" : ""}
                type="button"
                aria-label={`Chuyển đến slide ${index + 1}`}
                aria-current={index === activeHeroSlide ? "true" : undefined}
                onClick={() => setActiveHeroSlide(index)}
                key={slide.image}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Slide tiếp theo"
            onClick={() => setActiveHeroSlide((current) => (current + 1) % APP_HERO_SLIDES.length)}
          >
            ›
          </button>
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
                <div className="card-art">
                  {(card.image || card.imageUrl || card.image_url) && (
                    <img
                      src={card.image || card.imageUrl || card.image_url}
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

    </main>
  );
}
