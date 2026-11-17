# Khoá luận VNFITE CRM — mã nguồn kiểm thử

Mã nguồn và dữ liệu đo dùng cho khoá luận **“Xây dựng quy trình kiểm thử cho hệ thống CRM của VNFITE”** (Trường Đại học Thương mại). Repo gồm ba bộ kiểm thử đã chạy thật trên môi trường kiểm thử nội bộ, cùng ảnh và số liệu gốc để đối chiếu với các bảng, hình trong Chương 3.

Không có mã nguồn sản phẩm trong repo này. API và giao diện CRM thuộc hệ thống của VNFITE, chỉ được gọi từ bên ngoài.

## Cấu trúc

```
playwright/     kiểm thử tự động giao diện (phân quyền) — mục 3.7.3
  perm.spec.js          26 ca kiểm thử chức năng phân quyền
  permission.spec.js    ma trận 70 tổ hợp (5 vai trò × 14 màn hình)
  matrix.json           dữ liệu vai trò, màn hình và kỳ vọng
  crm-smoke.spec.js     kiểm thử khói giao diện
  results/              kết quả chạy: 26 ca (20 đạt, 6 không đạt), ảnh biểu đồ
  report/               báo cáo HTML của Playwright
postman/        bộ sưu tập API chỉ đọc — mục 3.7.2
jmeter/         kịch bản hiệu năng 150 người dùng đồng thời — mục 3.7.4
evidence/       ảnh gốc và số đo dùng để vẽ hình trong Chương 3
docs/           ánh xạ tệp sang mục trong khoá luận
```

## Yêu cầu môi trường

- Node.js v24.14.0, `@playwright/test` 1.65.0
- Apache JMeter 5.6.3 (chỉ cần cho bộ hiệu năng)
- API CRM chạy ở `http://127.0.0.1:2345`, giao diện ở `http://127.0.0.1:5173`

## Cách chạy

Kiểm thử phân quyền, chỉ trên Chrome:

```
cd playwright
npm install
npx playwright install chromium
npx playwright test perm.spec.js --project=chrome --reporter=html
```

Ma trận 70 tổ hợp:

```
npx playwright test permission.spec.js --headed
```

Bộ API: mở Postman, nạp `postman/CRM-API-ReadOnly.postman_collection.json`, tạo môi trường từ `postman/env.template.json` rồi điền tài khoản. Bộ sưu tập chỉ gọi các endpoint đọc, không tạo hay sửa dữ liệu.

Bộ hiệu năng:

```
jmeter -n -t jmeter/crm-150-users.jmx -l jmeter/result.jtl -e -o jmeter/html
```

## Thông tin đăng nhập

Repo không chứa tài khoản, token hay chuỗi kết nối. Mọi giá trị cần thiết đặt qua biến môi trường hoặc tệp `postman/env.template.json` do người chạy tự điền. Các tệp `auth.json` (cookie phiên), `qa_perm_tokens.json` (mã truy cập theo vai trò) và `.env` bị loại khỏi kho bằng `.gitignore`.

## Kết quả tham chiếu

| Bộ kiểm thử | Số lượng | Kết quả | Tệp số liệu |
|---|---|---|---|
| Phân quyền giao diện | 26 ca | 20 đạt, 6 không đạt | `playwright/results/chrome_only.json` |
| Ma trận phân quyền | 70 tổ hợp | 5 vai trò × 14 màn hình | `playwright/matrix.json` |
| API chỉ đọc | 11 request, 25 điều kiện | 24 đạt | `postman/` (báo cáo trong Chương 3) |
| Hiệu năng | 5.221 yêu cầu, 150 đồng thời | 0 lỗi, 44,1 req/s | `jmeter/result.jtl` |

Chi tiết ánh xạ sang từng mục, bảng và hình: xem `docs/ANH-XA.md`.
