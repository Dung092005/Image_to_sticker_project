import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import DataTable from "../components/DataTable.jsx";
import { api } from "../api.js";

export default function Admin({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  async function load() {
    try {
      const body = await api("/api/admin");
      setData(body);
      setError("");
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (user.role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  async function saveCard(event) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    try {
      await api(`/api/admin/cards/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editing.title,
          alias: editing.alias,
          description: editing.description,
          prompt: editing.prompt,
        }),
      });
      setSaveMessage("Đã lưu.");
      setEditing(null);
      await load();
    } catch (reason) {
      setSaveMessage(reason.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-page">
      <Header user={user} />
      <section className="content">
        <p className="eyebrow">ADMIN</p>
        <h1>Quản trị StickAI</h1>
        <p className="hint">
          Trang này chỉ xem users và sửa nội dung bộ sticker (title / mô tả / prompt).
        </p>

        {error && <p className="error">{error}</p>}
        {!data && !error && <p>Đang tải dữ liệu...</p>}

        {data && (
          <>
            <div className="stats">
              <div>
                <strong>{data.users.length}</strong>
                <span>Người dùng</span>
              </div>
              <div>
                <strong>{data.cards.length}</strong>
                <span>Bộ stickers</span>
              </div>
            </div>

            <h2>Người dùng</h2>
            <DataTable
              headers={["Tên", "Email", "Role", "Lượt tạo"]}
              rows={data.users.map((item) => [
                item.name,
                item.email,
                item.role,
                item.stickerCreations,
              ])}
            />

            <h2>Bộ stickers</h2>
            <div className="admin-card-list">
              {data.cards.map((card) => (
                <article className="admin-card" key={card.id}>
                  <div>
                    <h3>{card.title}</h3>
                    <p>{card.topic} · {card.alias}</p>
                    <p>{card.description}</p>
                  </div>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setEditing({ ...card });
                      setSaveMessage("");
                    }}
                  >
                    Sửa
                  </button>
                </article>
              ))}
            </div>
          </>
        )}

        {editing && (
          <div className="backdrop">
            <form className="create-card wide" onSubmit={saveCard}>
              <button className="close" type="button" onClick={() => setEditing(null)}>
                ×
              </button>
              <p className="eyebrow">SỬA CARD</p>
              <h2>{editing.id}</h2>
              <label>
                Title
                <input
                  value={editing.title}
                  onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                  required
                />
              </label>
              <label>
                Alias
                <input
                  value={editing.alias}
                  onChange={(event) => setEditing({ ...editing, alias: event.target.value })}
                  required
                />
              </label>
              <label>
                Mô tả
                <textarea
                  rows={3}
                  value={editing.description}
                  onChange={(event) =>
                    setEditing({ ...editing, description: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                Prompt (gửi sang Vertex AI)
                <textarea
                  rows={8}
                  value={editing.prompt}
                  onChange={(event) => setEditing({ ...editing, prompt: event.target.value })}
                  required
                />
              </label>
              {saveMessage && <p className="form-message">{saveMessage}</p>}
              <button className="primary" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
