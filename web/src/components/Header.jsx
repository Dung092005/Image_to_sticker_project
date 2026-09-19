import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { api } from "../api.js";

export default function Header({ user, transparent = false }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    if (!transparent) return undefined;

    function handleScroll() {
      setHasScrolled(window.scrollY > 8);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [transparent]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <header
      className={`app-header ${transparent ? "transparent" : ""} ${
        transparent && !hasScrolled ? "at-top" : ""
      }`}
    >
      <div className="mobile-header-controls">
        <button
          className="mobile-icon-button"
          type="button"
          aria-label="Mở menu"
          aria-expanded={showSidebar}
          onClick={() => setShowSidebar((visible) => !visible)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link className="logo mobile-logo" to="/app">
          Stick<span>AI</span>
        </Link>
        <button
          className="mobile-icon-button"
          type="button"
          aria-label="Tìm kiếm"
          aria-expanded={showSearch}
          onClick={() => setShowSearch((visible) => !visible)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
        </button>
      </div>
      {showSearch && (
        <div className="mobile-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input type="search" placeholder="Tìm kiếm sticker..." autoFocus />
        </div>
      )}
      <Link className="logo" to="/app">
        Stick<span>AI</span>
      </Link>
      <nav>
        <NavLink to="/app">Bộ sưu tập</NavLink>
        <NavLink to="/history">Lịch sử</NavLink>
        {user.role === "admin" && <NavLink to="/admin/users">Admin</NavLink>}
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
      {showSidebar && (
        <>
          <button
            className="sidebar-backdrop"
            type="button"
            aria-label="Đóng menu"
            onClick={() => setShowSidebar(false)}
          />
          <aside className="mobile-sidebar" aria-label="Menu điều hướng">
            <div className="mobile-sidebar-header">
              <span>Menu</span>
              <button
                className="mobile-sidebar-close"
                type="button"
                aria-label="Đóng menu"
                onClick={() => setShowSidebar(false)}
              >
                ×
              </button>
            </div>
            <nav className="mobile-sidebar-nav">
              <NavLink to="/app" onClick={() => setShowSidebar(false)}>
                Bộ sưu tập
              </NavLink>
              <NavLink to="/history" onClick={() => setShowSidebar(false)}>
                Lịch sử
              </NavLink>
              {user.role === "admin" && (
                  <NavLink to="/admin/users" onClick={() => setShowSidebar(false)}>
                  Admin
                </NavLink>
              )}
            </nav>
            <div className="mobile-user-card">
              <div className="mobile-user-avatar">
                {user.name?.trim().charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <button type="button" onClick={logout}>
                Đăng xuất
              </button>
            </div>
          </aside>
        </>
      )}
    </header>
  );
}
