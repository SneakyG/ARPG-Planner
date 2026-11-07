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
mkdir .github\workflows
move update.yml .github\workflows\update.yml
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
- `trust`: danh sách trang uy tín cho link farm. Mặc định đã có sẵn, không cần thêm. Muốn đổi thì thêm vào `config.json`:

```json
"trust": {
  "poe": ["pathofexile.com", "poewiki.net", "poedb.tw", "poe.ninja", "maxroll.gg", "mobalytics.gg", "poe-vault.com"],
  "tli": ["torchlight.xd.com", "maxroll.gg", "mobalytics.gg"],
  "blocked": ["mmoexp.com", "mmogah.com", "u4gm.com", "timesaver.gg"]
}
```

## Livestream Twitch (trang Mùa giải)

Trang Mùa giải có khung xem stream đông người xem nhất của game đang chọn, và lưới thumbnail các kênh đang live (bấm để đổi kênh).

**Cài đặt (1 lần):**

1. Tài khoản Twitch cần bật xác thực 2 bước (Settings → Security and Privacy → Two-Factor Authentication).
2. Vào https://dev.twitch.tv/console → **Register Your Application**:
   - Name: tên bất kỳ, ví dụ `arpg-planner-<tên-bạn>`
   - OAuth Redirect URLs: `http://localhost`
   - Category: `Website Integration`, Client Type: `Confidential`
3. Bấm **Manage** → chép **Client ID**, bấm **New Secret** → chép **Client Secret**.
4. Trong repo: **Settings → Secrets and variables → Actions** → thêm 2 secret `TWITCH_CLIENT_ID` và `TWITCH_CLIENT_SECRET`.
5. **Actions → Update data → Run workflow**, chọn `live`.

**Tuân thủ điều khoản Twitch:**

- Video chỉ phát qua player chính thức của Twitch, kích thước tối thiểu 400×300, không che player, khai báo `parent` là domain của trang. Màn hình hẹp hơn thì chỉ hiện ảnh và link sang Twitch.
- Danh sách live được lấy mỗi ~30 phút trong lúc deploy, ghi thẳng vào trang và **không commit vào git** (`docs/data/live.json` nằm trong `.gitignore`). Twitch chỉ cho lưu tạm dữ liệu API tối đa 24 giờ; trang tự ẩn dữ liệu cũ hơn 24 giờ.
- Thumbnail tải trực tiếp từ máy chủ Twitch, không sao chép.
- YouTube: chỉ có link tìm live trên YouTube, không dùng YouTube Data API (API này đòi chính sách quyền riêng tư và hiển thị thương hiệu theo quy chuẩn riêng).

## Pet → Build (Torchlight: Infinite)

Chọn 3 Battle Pactspirit, trang xếp hạng build phù hợp trong mùa hiện tại (tick "Tìm cả mùa cũ" để tìm rộng hơn).

- Danh sách Pactspirit (tên, nhóm, độ hiếm, ảnh) lấy từ https://tlidb.com/en/Pactspirit mỗi ngày, không cần AI.
- Mỗi build TLI có nhãn loại sát thương (attack, spell, persistent, summon, fire, cold, lightning, erosion) và danh sách Pactspirit mà guide khuyên dùng (nếu có), do AI trích từ nguồn khi cập nhật build.
- Cách chấm: pet được guide khuyên dùng +5 · cùng nhóm với loại sát thương của build +3 · Survival/Elixir +1 · khác loại −1.
- Link có dạng `#/tli/pets/Tên 1~Tên 2~Tên 3`, gửi cho bạn bè là mở đúng bộ pet đó.

## Build theo mùa

Build được lưu theo từng mùa. Khi mùa mới bắt đầu, lần cập nhật kế tiếp tạo danh sách mới, còn danh sách mùa cũ được giữ lại. Trên trang Build Starter: chọn mùa ở ô thứ hai (hoặc "Tất cả mùa") và gõ tên build/class/hero vào ô tìm kiếm. Mỗi thẻ build có nhãn mùa.

## Link ở trang Farm

- **Điểm farm**: map/khu vực cụ thể. Nhãn `NGUỒN` nghĩa là link lấy từ trang uy tín; nhãn `TRA WIKI` mở trang tra cứu (poewiki.net cho PoE, Maxroll cho TLI).
- **Link tham khảo**: chỉ giữ link vừa xuất hiện trong trang nguồn, vừa thuộc danh sách uy tín. Trang bán currency/boost bị loại.
- **Cây Atlas Passive / Setup**: mỗi kiểu farm có link cây atlas (poeplanner.com, pathofexile.com…) lấy từ nguồn uy tín, mặc định có trang *Atlas Passive Skill Tree Strategies* của PoE Vault. Kiểu farm nào chưa có cây thì có link tìm video atlas tree trên YouTube.
- **Ảnh xem trước**: GitHub Actions mở từng link cây atlas bằng trình duyệt ẩn và chụp màn hình, lưu ở `docs/data/img/`. Mỗi link chỉ chụp 1 lần; link YouTube dùng thumbnail của video. Link chụp lỗi sẽ thử lại sau 1 ngày. Chụp lại từ đầu: xoá `docs/data/img/index.json`.

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
