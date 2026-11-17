# Ánh xạ tệp sang khoá luận

Mỗi mục dưới đây tương ứng một tiểu mục trong Chương 3. Cột phải là tệp sinh ra số liệu hoặc ảnh đã dùng.

## 3.7.1 Kiểm thử chức năng thủ công

| Nội dung | Tệp / thư mục |
|---|---|
| Ảnh màn hình từng chức năng (khách hàng, gọi điện, hoa hồng, KPI, tổng đài, phân quyền) | `evidence/screenshots/*.png` |
| Số đo thời gian tải trang và số lời gọi API mỗi màn hình | `evidence/results.json` |
| Script dò số đo trên | `evidence/gen_figs.mjs` |
| Ảnh biểu đồ phân bổ ca kiểm thử | `evidence/figures/hinh-3-7-phan-bo-522-ca.png` |

## 3.7.2 Kiểm thử API

| Nội dung | Tệp / thư mục |
|---|---|
| Bộ sưu tập 11 request, 25 điều kiện kiểm tra | `postman/CRM-API-ReadOnly.postman_collection.json` |
| Mẫu biến môi trường (tài khoản tự điền) | `postman/env.template.json` |
| Ảnh giao diện Postman: danh sách request, môi trường, đoạn script kiểm tra | `evidence/figs_postman/*.png` |

## 3.7.3 Kiểm thử tự động giao diện

| Nội dung | Tệp / thư mục |
|---|---|
| 26 ca kiểm thử phân quyền | `playwright/perm.spec.js` |
| Ma trận 70 tổ hợp (5 vai trò × 14 màn hình) | `playwright/permission.spec.js`, `playwright/matrix.json` |
| Kết quả từng ca: vai trò, menu bắt buộc, menu bị rò | `playwright/results/chrome_only.json` |
| Nhật ký chạy từng ca | `playwright/results/perm-results.jsonl` |
| Báo cáo HTML của Playwright | `playwright/report/index.html` |
| Ảnh báo cáo và biểu đồ tỉ lệ đạt | `playwright/results/report-full.png`, `playwright/results/fig-chart.png` |
| Ảnh mã kiểm thử trong trình soạn thảo | `playwright/results/fig-code.png`, `evidence/figs_auto/vs_code_perm.png` |
| Script dò API phân quyền và menu theo vai trò | `playwright/tools/probe-api.js`, `playwright/tools/dump-menu2.js` |
| Kiểm thử khói giao diện | `playwright/crm-smoke.spec.js` |

## 3.7.4 Kiểm thử hiệu năng

| Nội dung | Tệp / thư mục |
|---|---|
| Kịch bản JMeter 150 người dùng đồng thời | `jmeter/crm-150-users.jmx` |
| Kết quả thô 5.221 yêu cầu | `jmeter/result.jtl` |
| Ảnh bảng điều khiển JMeter | `evidence/screenshots/jmeter-dashboard.png` |
| Ảnh mã kịch bản trong trình soạn thảo | `evidence/figures/hinh-3-3-code-jmeter.png` |

## Ghi chú

- Các tệp trong `evidence/figures/` là ảnh đã cắt, không lộ tên người dùng, đường dẫn tuyệt đối hay mã truy cập.
- Bảng 3.53 trong khoá luận lấy số từ `jmeter/result.jtl` và `evidence/results.json`; cách tính nằm trong cùng hai tệp này.
- Repo không chứa tệp cấu hình môi trường thật, không chứa mã truy cập, không chứa dữ liệu khách hàng.
