import { useEffect, useState } from "react";
import { Navigate, NavLink } from "react-router-dom";
import Header from "../components/Header.jsx";
import DataTable from "../components/DataTable.jsx";
import { api, resolveCardImage } from "../api.js";

export function useAdminData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const body = await api("/api/admin");
      setData(body);
      setError("");
    } catch (reason) {
      setError(reason.message || "Không tải được dữ liệu quản trị.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { data, error, reload: load };
}

function AdminShell({ user, eyebrow, title, description, children }) {
  if (user.role !== "admin") return <Navigate to="/app" replace />;

  return (
    <main className="app-page">
      <Header user={user} />
      <section className="content">
        <p className="eyebrow">{eyebrow || "Admin"}</p>
        <h1>{title}</h1>
        {description && <p className="section-lead">{description}</p>}
        <nav className="admin-tabs" aria-label="Điều hướng quản trị">
          <NavLink to="/admin/users">Users</NavLink>
          <NavLink to="/admin/stickers">Stickers</NavLink>
        </nav>
        {children}
      </section>
    </main>
  );
}

function AdminState({ data, error, children }) {
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Đang tải dữ liệu...</p>;
  return children(data);
}

export function AdminUsers({ user }) {
  const { data, error, reload } = useAdminData();
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [userMessage, setUserMessage] = useState("");

  async function saveUser(event) {
    event.preventDefault();
    setSaving(true);
    setUserMessage("");
    try {
      await api(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingUser.name,
          email: editingUser.email,
          role: editingUser.role,
        }),
      });
      setEditingUser(null);
      await reload();
    } catch (reason) {
      setUserMessage(reason.message || "Không thể lưu user.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(item) {
    if (String(item.id) === String(user.id)) return;
    if (!window.confirm(`Xoá tài khoản ${item.email}?`)) return;
    try {
      await api(`/api/admin/users/${item.id}`, { method: "DELETE" });
      await reload();
    } catch (reason) {
      setUserMessage(reason.message || "Không thể xoá user.");
    }
  }

  return (
    <AdminShell
      user={user}
      title="Users"
      description="Danh sách tài khoản và số lượt tạo sticker."
    >
      <AdminState data={data} error={error}>
        {(body) => (
          <DataTable
            headers={["Tên", "Email", "Role", "Lượt tạo"]}
            actions={(row) => (
              <div className="table-action-group">
                <button
                  type="button"
                  className="table-action"
                  onClick={() => {
                    setEditingUser({ ...row.user });
                    setUserMessage("");
                  }}
                >
                  Sửa
                </button>
                <button
                  type="button"
                  className="table-action danger"
                  disabled={String(row.user.id) === String(user.id)}
                  onClick={() => removeUser(row.user)}
                >
                  Xoá
                </button>
              </div>
            )}
            rows={body.users.map((item) => ({
              key: item.id || item.email,
              user: item,
              cells: [item.name, item.email, item.role, item.stickerCreations],
            }))}
          />
        )}
      </AdminState>
      {userMessage && <p className="error admin-user-message">{userMessage}</p>}
      {editingUser && (
        <div className="backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setEditingUser(null);
        }}>
          <form className="create-card user-detail-card" onSubmit={saveUser}>
            <button className="close" type="button" onClick={() => setEditingUser(null)}>
              ×
            </button>
            <p className="eyebrow">Sửa user</p>
            <h2>{editingUser.name}</h2>
            <label>
              Tên
              <input
                value={editingUser.name}
                onChange={(event) => setEditingUser({ ...editingUser, name: event.target.value })}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={editingUser.email}
                onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value })}
                required
              />
            </label>
            <label>
              Role
              <select
                value={editingUser.role}
                onChange={(event) => setEditingUser({ ...editingUser, role: event.target.value })}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {userMessage && <p className="form-message">{userMessage}</p>}
            <button className="primary" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </form>
        </div>
      )}
    </AdminShell>
  );
}

export function AdminStickers({ user }) {
  const { data, error, reload } = useAdminData();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  async function saveCard(event) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    try {
      await api(editing.isNew ? "/api/admin/cards" : `/api/admin/cards/${editing.id}`, {
        method: editing.isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          title: editing.title,
          alias: editing.alias,
          description: editing.description,
          topic: editing.topic,
          image: editing.image,
          prompt: editing.prompt,
        }),
      });
      setEditing(null);
      await reload();
    } catch (reason) {
      setSaveMessage(reason.message || "Không thể lưu thay đổi.");
    } finally {
      setSaving(false);
    }
  }

  function chooseCardImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSaveMessage("Vui lòng chọn file ảnh hợp lệ.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveMessage("Ảnh danh mục không được vượt quá 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditing((current) => ({ ...current, image: reader.result }));
      setSaveMessage("");
    };
    reader.readAsDataURL(file);
  }

  async function removeCard(card) {
    if (!window.confirm(`Xoá bộ sticker “${card.title}”?`)) return;
    try {
      await api(`/api/admin/cards/${card.id}`, { method: "DELETE" });
      await reload();
    } catch (reason) {
      setSaveMessage(reason.message || "Không thể xoá bộ sticker.");
    }
  }

  return (
    <AdminShell
      user={user}
      title="Stickers"
      description="Quản lý tên, mô tả và prompt của các bộ sticker."
    >
      <div className="admin-toolbar">
        <button
          type="button"
          className="primary"
          onClick={() => {
            setEditing({
              isNew: true,
              id: "",
              title: "",
              alias: "",
              topic: "Dễ Thương",
              image: "/sticker-hero-illustrated.png",
              description: "",
              prompt: "",
            });
            setSaveMessage("");
          }}
        >
          + Thêm sticker
        </button>
      </div>
      <AdminState data={data} error={error}>
        {(body) => (
          <DataTable
            headers={["Ảnh", "Tên", "Chủ đề", "Alias", "Mô tả"]}
            actions={(row) => (
              <div className="table-action-group">
                <button
                  type="button"
                  className="table-action"
                  onClick={() => {
                    setEditing({ ...row.card });
                    setSaveMessage("");
                  }}
                >
                  Sửa
                </button>
                <button
                  type="button"
                  className="table-action danger"
                  onClick={() => removeCard(row.card)}
                >
                  Xoá
                </button>
              </div>
            )}
            rows={body.cards.map((card) => ({
              key: card.id,
              card,
              cells: [
                <img className="table-image-preview" src={resolveCardImage(card.image)} alt={card.title} />,
                card.title,
                card.topic,
                card.alias,
                card.description,
              ],
            }))}
          />
        )}
      </AdminState>

      {editing && (
        <div className="backdrop">
          <form className="create-card wide" onSubmit={saveCard}>
            <button className="close" type="button" onClick={() => setEditing(null)}>
              ×
            </button>
            <p className="eyebrow">{editing.isNew ? "Thêm bộ sticker" : "Sửa bộ sticker"}</p>
            <h2>{editing.title || "Bộ sticker mới"}</h2>
            {editing.isNew && (
              <label>
                ID bộ sticker
                <input
                  value={editing.id}
                  placeholder="ví dụ: pet-moments"
                  onChange={(event) => setEditing({ ...editing, id: event.target.value })}
                  required
                />
              </label>
            )}
            <label>
              Tên bộ sticker
              <input
                value={editing.title}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                required
              />
            </label>
            <label>
              Chủ đề
              <input
                value={editing.topic || ""}
                onChange={(event) => setEditing({ ...editing, topic: event.target.value })}
                required
              />
            </label>
            <label>
              Ảnh danh mục (URL hoặc đường dẫn public)
              <input
                value={editing.image || ""}
                placeholder="/sticker-hero-illustrated.png"
                onChange={(event) => setEditing({ ...editing, image: event.target.value })}
                required
              />
              <span className="image-upload-or">Hoặc tải ảnh từ máy</span>
              <input type="file" accept="image/*" onChange={chooseCardImage} />
              {editing.image && (
                <img
                  className="admin-image-preview"
                  src={resolveCardImage(editing.image)}
                  alt="Xem trước ảnh danh mục"
                />
              )}
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
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
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
    </AdminShell>
  );
}

export default function Admin() {
  return <Navigate to="/admin/users" replace />;
}
