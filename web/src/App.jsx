import { Component, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { apiRaw } from "./api.js";
import Landing from "./pages/Landing.jsx";
import Collection from "./pages/Collection.jsx";
import History from "./pages/History.jsx";
import Admin from "./pages/Admin.jsx";

class ErrorBox extends Component {
  constructor(props) {
    super(props);
    this.state = { message: "" };
  }

  static getDerivedStateFromError(error) {
    return { message: error.message || String(error) };
  }

  render() {
    if (this.state.message) {
      return (
        <main className="app-page">
          <p className="page-loading error">Lỗi giao diện: {this.state.message}</p>
          <p className="page-loading">
            Mở F12 → Console rồi gửi ảnh lỗi nếu vẫn trắng trang.
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}

function Protected({ user, checking, children }) {
  if (checking) {
    return (
      <main className="app-page">
        <p className="page-loading">Đang kiểm tra đăng nhập...</p>
      </main>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    apiRaw("/api/auth/me")
      .then(({ response, data }) => {
        if (response.ok) setUser(data.user);
        else setUser(null);
      })
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  return (
    <ErrorBox>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/app"
          element={
            <Protected user={user} checking={checking}>
              <Collection user={user} />
            </Protected>
          }
        />
        <Route
          path="/history"
          element={
            <Protected user={user} checking={checking}>
              <History user={user} />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <Protected user={user} checking={checking}>
              <Admin user={user} />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBox>
  );
}
