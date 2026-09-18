#!/usr/bin/env python3
"""Tạo một bộ sticker từ ảnh tham chiếu bằng Gemini trên Vertex AI.

Đây là phiên bản CLI độc lập dùng để tham khảo cho luồng tạo sticker của web app.
Ví dụ:
  python scripts/create_sticker.py --image /path/to/photo.jpg \
    --outfit "áo sơ mi trắng" --accessories "kính râm" -o sticker.png
"""

from __future__ import annotations

import argparse
import mimetypes
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = "gemini-2.5-flash-image"


def build_prompt(card_prompt: str, outfit: str, accessories: str, expression: str, extra: str) -> str:
    options = "\n".join(
        item
        for item in (
            f"Trang phục: {outfit}" if outfit else "",
            f"Phụ kiện: {accessories}" if accessories else "",
            f"Biểu cảm/vibe: {expression}" if expression else "",
            f"Ý tưởng thêm: {extra}" if extra else "",
        )
    )
    return f"""{card_prompt}

Tạo một bộ sticker tỷ lệ 3:4 gồm đúng 16 sticker của cùng người trong ảnh tham chiếu.
Giữ nguyên khuôn mặt, kiểu tóc, màu da và các đặc điểm nhận diện. Phong cách hoạt hình
hiện đại, dễ thương, đường nét sạch, nền trắng, mỗi sticker có biểu cảm rõ và một câu
thoại tiếng Việt ngắn. Bố cục 4 cột x 4 hàng, các sticker tách biệt, không chồng lấn.

TÙY CHỌN CỦA NGƯỜI DÙNG:
{options or "Giữ phong cách mặc định của bộ sticker."}

Cấm face swap, biến dạng khuôn mặt, watermark, logo, chữ sai hoặc không đọc được."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a sticker sheet from a reference photo.")
    parser.add_argument("--image", type=Path, required=True, help="Ảnh tham chiếu PNG/JPG/WEBP")
    parser.add_argument("--card-prompt", default="Tạo sticker theo chủ đề vui nhộn.")
    parser.add_argument("--outfit", default="")
    parser.add_argument("--accessories", default="")
    parser.add_argument("--expression", default="")
    parser.add_argument("--extra", default="")
    parser.add_argument("-o", "--output", type=Path, default=ROOT / "sticker_output.png")
    parser.add_argument("--model", default=os.getenv("GEMINI_IMAGE_MODEL", DEFAULT_MODEL))
    return parser.parse_args()


def main() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")
    args = parse_args()
    project = os.getenv("GCP_PROJECT_ID")
    if not project:
        raise SystemExit("Thiếu GCP_PROJECT_ID trong .env.local hoặc biến môi trường.")
    if not args.image.is_file():
        raise SystemExit(f"Không tìm thấy ảnh: {args.image}")

    mime_type = mimetypes.guess_type(args.image.name)[0] or "image/jpeg"
    client = genai.Client(
        vertexai=True,
        project=project,
        location=os.getenv("GCP_LOCATION", "us-central1"),
    )
    response = client.models.generate_content(
        model=args.model,
        contents=[
            types.Part.from_bytes(data=args.image.read_bytes(), mime_type=mime_type),
            build_prompt(args.card_prompt, args.outfit, args.accessories, args.expression, args.extra),
        ],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio="3:4", output_mime_type="image/png"),
        ),
    )

    for candidate in response.candidates or []:
        for part in candidate.content.parts if candidate.content else []:
            if part.inline_data and part.inline_data.data:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_bytes(part.inline_data.data)
                print(f"Đã lưu: {args.output.resolve()}")
                return
    raise RuntimeError("Gemini không trả về ảnh sticker.")


if __name__ == "__main__":
    main()
