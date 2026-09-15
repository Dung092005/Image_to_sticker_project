# StickAI — bản dễ thuyết trình

StickAI tạo một bộ sticker từ ảnh người dùng. Bản này giữ sản phẩm gốc nhưng dùng đúng kiến thức lớp: **React + Vite + React Router**, **Node `http`**, REST API, JSON file, và script Python gọi Vertex AI.

## Chạy project

Yêu cầu: Node.js 20+ và Python 3 (nếu muốn tạo ảnh thật).

```bash
cd stickai-class
npm install
npm run server
```

Terminal thứ hai:

```bash
cd stickai-class
npm run web
```

Mở http://localhost:5173  

Vite proxy `/api` → Node `:3000`, nên React chỉ gọi `fetch("/api/...")`.

### Tài khoản demo

| Role | Email | Password |
| --- | --- | --- |
| User | `demo@stickai.local` | `demo123` |
| Admin | `admin@stickai.local` | `admin123` |

## Kiến trúc

```text
React (Vite :5173) --fetch /api--> Vite proxy --> Node server (:3000)
                                                      |
                                               data/*.json
                                               (users, cards, history, sessions)
                                                      |
                                               spawn Python
                                                      |
                                               Vertex AI / Gemini
```

### Frontend (`web/src`)

- `main.jsx` — `BrowserRouter` (class 5)
- `App.jsx` — `Routes` / `Route` / bảo vệ trang cần login
- `pages/` — Landing, Collection, History, Admin (một file một trang)
- `components/` — Header, DataTable
- `api.js` — `fetch` + `credentials: "include"` để gửi session cookie

### Backend (`server/server.js`)

Route ladder giống bài Pho Thin: **method + path**.  
`send()` luôn đặt status + JSON + `res.end()` một lần.

Session lưu trong `data/sessions.json` (restart server không mất login).

## API contract

| Method + path | Status | Ý nghĩa |
| --- | --- | --- |
| `POST /api/auth/login` | 200 / 401 | Tạo session cookie |
| `POST /api/auth/logout` | 200 | Xoá session |
| `GET /api/auth/me` | 200 / 401 | User hiện tại |
| `GET /api/cards` | 200 | Danh sách bộ sticker |
| `POST /api/generate` | 202 / 4xx | Nhận job tạo ảnh |
| `GET /api/history` | 200 / 401 | Lịch sử của user |
| `GET /api/generated/:id` | 200 / 404 | Ảnh PNG (chỉ owner) |
| `GET /api/admin` | 200 / 403 | Users + cards |
| `PUT /api/admin/cards/:id` | 200 / 403 | Admin sửa card |

## Vertex AI

File `.env.local` (đã có mẫu / có thể copy từ `.env.example`):

```bash
GCP_PROJECT_ID=project-3b0c96e7-a43e-4f65-8bd
GCP_LOCATION=us-central1
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
STICKAI_PYTHON=C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe
```

```bash
pip install -r scripts/requirements.txt
```

Cần Google Application Default Credentials (`gcloud auth application-default login`).  
`scripts/generate_image.py` lấy từ dự án gốc (có `build_prompt` 16 sticker). Node chỉ spawn Python.

Nếu thiếu env/credentials: History hiện `error` + message rõ, không treo im.

## Nếu thầy hỏi

**Session cookie?** Cookie chỉ giữ mã ngẫu nhiên; server map sang user. Frontend không tự phong admin.

**Sao check lại trên server?** Browser có thể bị bỏ qua bằng curl. Server mới tin được.

**Vite proxy?** `:5173` và `:3000` khác origin. Proxy cho phép gọi `/api` khi dev, tránh CORS.

**Sao JSON không Postgres?** Đủ demo, nhìn được file, giải thích được. Nhiều user ghi đồng thời / dữ liệu lớn mới cần DB.

**Sao có Python?** SDK Vertex + prompt gốc nằm ở Python. Node = web API; Python = AI worker.

**202 là gì?** Job đã nhận, ảnh chưa xong. History poll tới `completed` / `error`.

**React Router?** Đổi URL không reload trang; `Link` / `NavLink` / `Routes` như class 5. Login/logout dùng reload nhẹ để đọc lại cookie cho chắc.
