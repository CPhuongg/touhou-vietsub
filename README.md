# 🎧 CPhnggg Vietsub Storage

Kho lưu trữ các bản vietsub nhạc Touhou. Đây là trang tĩnh, chạy trên **GitHub Pages**. Không cần cài đặt hay build gì.

- **Người xem**: mở link GitHub Pages để đọc bài. Không ai khác sửa được.
- **Bạn (người dịch)**: thêm và sửa bài ngay trên trang. Trang ghi thẳng vào thư mục repo trong máy, sau đó bạn `git push` để đăng.

## 1. Đưa lên GitHub (làm 1 lần)

1. Vào <https://github.com/new> và tạo repo **Public**, ví dụ tên `th-vsub`. Không tick tạo README.
2. Trong thư mục `D:\0.Touhou\TH VSub`, chạy:

   ```bash
   git remote add origin https://github.com/<tên-tài-khoản>/th-vsub.git
   git push -u origin main
   ```

3. Trên GitHub, vào **Settings → Pages → Build and deployment** và chọn:
   - Source: **Deploy from a branch**
   - Branch: **main**, thư mục **/ (root)**
   - Bấm Save.
4. Sau khoảng 1 phút, trang có ở `https://<tên-tài-khoản>.github.io/th-vsub/`.

## 2. Thêm / sửa bài

1. Mở trang (bản GitHub Pages hoặc bản chạy trong máy) bằng **Chrome hoặc Edge**.
2. Bấm **✎ Biên tập** ở cuối trang và chọn thư mục `D:\0.Touhou\TH VSub`.
   - Trình duyệt sẽ hỏi quyền chỉnh sửa. Chọn **"Cho phép mỗi lần truy cập"** (Allow on every visit) để lần sau khỏi hỏi lại.
   - Khi đã kết nối, trang đọc dữ liệu trực tiếp từ thư mục, nên bạn thấy ngay bài vừa sửa dù chưa push.
3. Bấm **+ Thêm bài** và nhập:
   - tiêu đề JP / Romaji / VI
   - ảnh bìa: chọn file, kéo thả, hoặc dán bằng `Ctrl+V`
   - **màu chủ đạo** của bài: tự lấy từ ảnh bìa khi bạn thêm ảnh. Bạn cũng có thể bấm một màu gợi ý từ ảnh, chọn trong bảng màu, gõ mã hex, hoặc bấm ô màu lớn để tự chọn. Ô **A** là màu tự động.
   - thông tin bài (Circle, Album, Vocals…)
   - lời bài hát vào 3 ô JP / RM / VI, dòng trống là ngắt đoạn. Phần **Xem trước ghép dòng** báo đỏ những đoạn bị lệch số dòng.

   Bấm **Lưu**, hoặc `Ctrl+S`.
4. Đăng lên GitHub:

   ```bash
   git add -A
   git commit -m "Thêm bài ..."
   git push
   ```

   Thanh thông báo vàng trên trang có nút **Lệnh đăng bài** để copy nhanh các lệnh này. Push xong thì bấm **Đã push** để ẩn nhắc nhở.

## 3. Chạy thử trong máy (không bắt buộc)

```bash
python -m http.server 8000
```

Sau đó mở <http://localhost:8000>. Thêm `?demo` vào cuối link (<http://localhost:8000/?demo>) để xem trang với dữ liệu mẫu. Ở chế độ demo không có gì được ghi ra đĩa.

> Mở thẳng file `index.html` (đường dẫn `file://`) sẽ **không chạy**, vì trình duyệt chặn script. Hãy dùng GitHub Pages hoặc lệnh trên.

## 4. Dữ liệu nằm ở đâu

```
data/
  index.json            danh sách bài (trang chủ dựa vào file này)
  meta.json             màu của từng tag
  posts/<id>.json       mỗi bài 1 file
  media/                ảnh bìa (tự thu nhỏ, lưu WebP), có đưa lên GitHub
  media-private/        file nhạc: CHỈ trong máy, nằm trong .gitignore
```

- **File nhạc không bao giờ lên GitHub**, để tránh phát tán file có bản quyền. Nhạc chỉ phát được khi bạn đang ở chế độ biên tập trên máy mình. Người xem nghe qua link YouTube.
- Bài xoá sẽ vào **Thùng rác** và khôi phục được. Bài trong thùng rác bị ẩn trên trang, nhưng file vẫn nằm trong repo cho đến khi bạn xoá vĩnh viễn.
- **Nhập/Xuất** cho phép xuất toàn bộ bài ra 1 file JSON để backup, hoặc nhập lại từ file đó. Bản thân git cũng là một bản backup.

## 5. Cấu trúc code

```
index.html              khung trang
app/styles.css          giao diện (sáng/tối, tag màu kiểu Notion)
app/js/main.js          khởi động, điều hướng, chế độ đọc/biên tập, nhập/xuất
app/js/source.js        nguồn dữ liệu: HTTP (chỉ đọc) / thư mục máy / demo
app/js/store.js         đọc, ghi bài, thùng rác, tag, tìm kiếm
app/js/lyrics.js        tách đoạn, ghép dòng JP/RM/VI
app/js/markdown.js      Markdown đơn giản cho Other/Comment
app/js/ui.js            modal, toast, ô chọn tag
app/js/views/*.js       trang chủ, bài viết, trình soạn, thùng rác
```
