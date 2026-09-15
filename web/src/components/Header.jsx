import { Link, NavLink } from "react-router-dom";
import { api } from "../api.js";

export default function Header({ user }) {
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <header className="app-header">
      <Link className="logo" to="/app">
        Stick<span>AI</span>
      </Link>
      <nav>
        <NavLink to="/app">Bộ sưu tập</NavLink>
        <NavLink to="/history">Lịch sử</NavLink>
        {user.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="account">
        <span>{user.name}</span>
        <button type="button" onClick={logout}>
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
