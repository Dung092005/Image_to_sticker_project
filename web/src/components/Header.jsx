import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { api } from "../api.js";

export default function Header({ user, transparent = false }) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <header className={`app-header ${transparent ? "transparent" : ""}`}>
      <Link className="logo" to="/app">
        Stick<span>AI</span>
      </Link>
      <nav>
        <NavLink to="/app">Bộ sưu tập</NavLink>
        <NavLink to="/history">Lịch sử</NavLink>
        {user.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="account">
        <button
          className="avatar-button"
          type="button"
          aria-label="Mở thông tin người dùng"
          aria-expanded={showUserMenu}
          onClick={() => setShowUserMenu((visible) => !visible)}
        >
          {user.name?.trim().charAt(0).toUpperCase() || "U"}
        </button>
        {showUserMenu && (
          <div className="user-menu">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <button type="button" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
