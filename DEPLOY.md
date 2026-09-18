# Deploy StickAI: Render (API) + Vercel (FE)

## Thứ tự
1. Push code lên GitHub
2. Deploy **Render** (backend) trước → lấy URL
3. Sửa `vercel.json` (destination) bằng URL Render
4. Deploy **Vercel** (frontend)
5. Cập nhật `APP_ORIGIN` trên Render = URL Vercel

---

## A. Push GitHub

Trong folder `stickai-class`:

```bash
git add .
git commit -m "Add Supabase + Render/Vercel deploy config"
git push origin main
```

Repo hiện tại: `https://github.com/Dung092005/Image_to_sticker_project.git`

---

## B. Deploy Backend trên Render

1. Vào https://dashboard.render.com → **New +** → **Web Service**
2. Connect repo `Image_to_sticker_project` (hoặc repo chứa bạn push)
3. Cấu hình:
   - **Name:** `stickai-api`
   - **Language:** Docker
   - **Dockerfile Path:** `./Dockerfile`
   - **Docker Context:** `.` (root repo = stickai-class)
   - **Instance:** Free
4. **Environment** (Environment Variables):

| Key | Value |
|---|---|
| `DATABASE_URL` | Connection string Supabase (giống `.env.local`) |
| `GCP_PROJECT_ID` | Project GCP của bạn |
| `GCP_LOCATION` | `us-central1` |
| `GEMINI_IMAGE_MODEL` | `gemini-2.5-flash-image` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | **Toàn bộ nội dung** file service account `.json` (1 dòng JSON) |
| `APP_ORIGIN` | Tạm `http://localhost:5173` — sau khi có Vercel sẽ sửa |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `Lax` |
| `NODE_ENV` | `production` |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` |

5. Deploy → chờ build xong
6. Mở `https://<ten-service>.onrender.com/api/health` → phải thấy `{"ok":true,...}`

Copy URL Render, ví dụ: `https://stickai-api.onrender.com`

### Lấy JSON service account GCP
Google Cloud Console → IAM → Service Accounts → Keys → Create key (JSON) → mở file, copy hết vào `GOOGLE_APPLICATION_CREDENTIALS_JSON`.

---

## C. Sửa Vercel rewrite

Mở `vercel.json`, thay:

```json
"destination": "https://REPLACE_WITH_RENDER_URL/api/:path*"
```

thành (ví dụ):

```json
"destination": "https://stickai-api.onrender.com/api/:path*"
```

Commit + push lại.

---

## D. Deploy Frontend trên Vercel

1. Vào https://vercel.com → **Add New** → **Project**
2. Import repo GitHub
3. Settings:
   - **Framework Preset:** Other / Vite
   - **Root Directory:** `.` (root `stickai-class`)
   - Build/Output đã nằm trong `vercel.json`
4. **Không cần** `VITE_API_URL` nếu dùng rewrite `/api` → Render
5. Deploy

Sau khi có URL Vercel (ví dụ `https://stickai-xxx.vercel.app`):

- Vào Render → Environment → sửa  
  `APP_ORIGIN=https://stickai-xxx.vercel.app`  
  (có thể thêm nhiều origin, cách nhau bằng dấu phẩy)
- Save → Render redeploy nhẹ

---

## E. Kiểm tra

1. Mở site Vercel
2. Login: `demo@stickai.local` / `demo123`
3. Xem danh mục stickers (đọc từ Supabase)
4. (Tuỳ) thử generate nếu đã cấu hình GCP đúng

---

## Lỗi hay gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Render sleep (free) lần đầu chậm ~30–60s | Đợi, hoặc ping `/api/health` trước khi demo |
| Login xong vẫn chưa đăng nhập | Kiểm tra `COOKIE_SAMESITE=Lax` + dùng Vercel rewrite (không gọi thẳng Render từ browser) |
| `/api/health` 502 | Xem Render logs; thường sai `DATABASE_URL` |
| Generate lỗi Vertex | Thiếu/sai `GOOGLE_APPLICATION_CREDENTIALS_JSON` hoặc GCP API chưa bật |
| Vercel build fail workspace | Đảm bảo deploy từ root có `package-lock.json` + workspaces |

---

## Chi phí

- Vercel Hobby: free
- Render Free: free (sleep khi idle)
- Supabase Free: đang dùng

Trước giờ thi: mở sẵn tab `/api/health` để Render “thức”.
