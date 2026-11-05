# ARPG Planner

Trang tra cứu meta cho **Path of Exile** và **Torchlight: Infinite**, chạy miễn phí trên **GitHub Pages**. Dữ liệu được **GitHub Actions** cập nhật tự động.

| Trang | Nội dung | Nguồn | Tần suất |
|---|---|---|---|
| Mùa giải | Tên mùa, patch, ngày, cơ chế mới, buff/nerf | PoE: poe.ninja + web · TLI: web, AI tóm tắt | Mỗi ngày |
| Build Starter | Build xếp hạng, link guide, hướng dẫn chi tiết cho top 5 | Web (tier list) + AI | Mỗi ngày |
| Farm | Lộ trình farm Starter → Mid → Endgame | Web + AI (PoE kèm giá poe.ninja) | Mỗi ngày |
| Item Trend | Món tăng giá / giao dịch nhiều / giá trị cao | PoE: poe.ninja, không cần AI · TLI: web + AI | PoE 3 giờ · TLI mỗi ngày |
| Trạng thái | Lần chạy gần nhất, mục nào lỗi | `docs/data/meta.json` | — |

## Đưa lên GitHub (làm 1 lần)

### 1. Tạo repo và push

Tạo repo mới trên https://github.com/new (ví dụ `arpg-planner`, chọn **Public**, không tick thêm README). Trong thư mục dự án, chạy:

```bash
git init
git add .
git commit -m "ARPG Planner"
git branch -M main
git remote add origin https://github.com/<tên-bạn>/arpg-planner.git
git push -u origin main
```

> GitHub Pages miễn phí cần repo **Public**. Repo Private cần gói GitHub Pro.

### 2. Thêm AI key miễn phí

Lấy key Gemini miễn phí tại https://aistudio.google.com → **Get API key**.

Trong repo: **Settings → Secrets and variables → Actions → New repository secret**

- Name: `GEMINI_API_KEY`
- Secret: dán key vào

Key nằm trong GitHub Secret nên không xuất hiện trên trang web công khai.

<details>
<summary>Dùng Groq / OpenRouter thay cho Gemini</summary>

- Secret `OPENAI_API_KEY`: key của Groq hoặc OpenRouter.
- Tab **Variables**: thêm `AI_PROVIDER` = `openai`, `OPENAI_BASE_URL` = `https://api.groq.com/openai/v1` (hoặc `https://openrouter.ai/api/v1`), `OPENAI_MODEL` = tên model miễn phí.
- Nếu Groq báo vượt giới hạn token, giảm `ai.maxContextChars` trong `config.json` xuống khoảng 15000.
</details>

### 3. Bật GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions**

### 4. Chạy lần đầu

**Actions → Update data → Run workflow → Run**. Khoảng 3–8 phút sau, trang có tại:

```
https://<tên-bạn>.github.io/arpg-planner/
```

Nếu Actions hỏi bật workflow, bấm **I understand… enable them**.

## Cập nhật

- **Tự động:** giá PoE mỗi 3 giờ; nội dung còn lại mỗi ngày lúc ~05:40 sáng giờ Việt Nam.
- **Ngay lập tức:** bấm **Cập nhật ngay** trên trang, GitHub mở workflow, bấm **Run workflow**. Chọn `prices` để chỉ lấy giá (nhanh), `meta` để chỉ cập nhật nội dung AI, `all` cho tất cả.
- GitHub tự tắt lịch chạy nếu repo không có hoạt động trong 60 ngày. Khi đó vào Actions bấm bật lại.

## Chạy trên máy (tuỳ chọn)

Cần Node.js 18+.

```bash
# Xem trước trang: http://localhost:5178
node scripts/preview.js

# Cập nhật dữ liệu trên máy (key đặt qua biến môi trường)
set GEMINI_API_KEY=AIza...        # Windows CMD
node scripts/update.js            # hoặc --scope prices / --scope meta
```

Hoặc tạo `config.local.json` (đã nằm trong `.gitignore`, không bị push):

```json
{ "ai": { "gemini": { "apiKey": "AIza..." } } }
```

## Tuỳ chỉnh (`config.json`)

- `poe.categories`: loại item lấy từ poe.ninja (Currency, Fragment, Scarab, Essence, DivinationCard, Omen, AllflameEmber, …).
- `sources`: URL tier list/guide bạn tin tưởng cho từng game, AI sẽ luôn đọc các trang này.
- `guidesTopN`, `guidesMaxAgeDays`: số build được viết hướng dẫn chi tiết và bao lâu thì viết lại.
- `prompts/system-prompt.txt`: prompt dùng để viết hướng dẫn build. Sửa file này để đổi cấu trúc.

## Cách AI tra cứu

1. Tìm web qua DuckDuckGo (dự phòng Bing), không cần key, và đọc thêm các URL trong `sources`.
2. Tải nội dung trang, gửi cho AI miễn phí, yêu cầu chỉ dùng thông tin trong nguồn.
3. Link guide AI trả về được đối chiếu với nội dung trang; link không có trong nguồn bị loại.

## Khi có lỗi

Xem trang **Trạng thái** hoặc log trong tab Actions.

- **Bỏ qua: chưa có AI key**: chưa thêm secret `GEMINI_API_KEY`.
- **Không tải được trang nguồn nào**: công cụ tìm kiếm có thể chặn máy chủ GitHub. Thêm URL nguồn cố định vào `config.json → sources`.
- **HTTP 403/429 từ poe.ninja**: điền `contact` trong `config.json` (poe.ninja khuyến nghị) và thử lại sau.
- **Gemini 429**: hết quota free trong ngày, workflow tự thử model tiếp theo; quota reset lúc nửa đêm giờ Pacific.
