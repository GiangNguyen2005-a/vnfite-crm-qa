#!/usr/bin/env python3
"""Đọc tệp .jtl của crm-breaking-point.jmx và tìm điểm gãy.

Cách dùng:
    python3 tools/breakpoint_report.py result-breaking.jtl
    python3 tools/breakpoint_report.py result-breaking.jtl --steps 150,170,190,210,230,250,270,290,300

Mỗi bậc trong TC_68 giữ 2 phút, nên bộ đếm chia tệp theo cửa sổ 120 giây kể từ
mẫu đầu tiên. Với mỗi bậc, báo cáo in: số người khai báo, số người quan sát được
(trung vị cột allThreads), số yêu cầu, thời gian phản hồi trung bình, mốc 95%,
tỷ lệ lỗi và kết luận Đạt/Không đạt theo ngưỡng của khoá luận (95% <= 3 giây,
lỗi <= 5%). Bậc đầu tiên không đạt là điểm gãy.

Mốc 95% ở đây là công cụ đo, không dùng chữ "phân vị" trong văn khoá luận.
"""

import argparse
import csv
import json
import os
import statistics
import sys

STEP_SECONDS = 120
THRESHOLD_MS = 3000
THRESHOLD_ERR = 0.05
DEFAULT_STEPS = [150, 170, 190, 210, 230, 250, 270, 290, 300]


def percentile_95(values):
    """Giá trị mà 95% số mẫu nằm dưới nó (nội suy tuyến tính)."""
    if not values:
        return 0.0
    data = sorted(values)
    if len(data) == 1:
        return float(data[0])
    pos = 0.95 * (len(data) - 1)
    low = int(pos)
    high = min(low + 1, len(data) - 1)
    frac = pos - low
    return float(data[low] + (data[high] - data[low]) * frac)


def load_rows(path):
    rows = []
    with open(path, newline="", encoding="utf-8", errors="replace") as fh:
        for row in csv.DictReader(fh):
            try:
                rows.append(
                    {
                        "ts": int(row["timeStamp"]),
                        "elapsed": float(row["elapsed"]),
                        "label": row.get("label", ""),
                        "success": str(row.get("success", "")).lower() == "true",
                        "code": row.get("responseCode", ""),
                        "threads": int(row.get("allThreads") or 0),
                    }
                )
            except (KeyError, TypeError, ValueError):
                continue
    rows.sort(key=lambda r: r["ts"])
    return rows


def summarize(rows, steps):
    if not rows:
        return []
    t0 = rows[0]["ts"]
    buckets = {}
    for r in rows:
        idx = int((r["ts"] - t0) // (STEP_SECONDS * 1000))
        buckets.setdefault(idx, []).append(r)

    out = []
    for idx in sorted(buckets):
        group = buckets[idx]
        latencies = [r["elapsed"] for r in group]
        errors = sum(1 for r in group if not r["success"])
        err_rate = errors / len(group)
        p95 = percentile_95(latencies)
        nominal = steps[idx] if idx < len(steps) else None
        observed = int(statistics.median([r["threads"] for r in group])) if group else 0
        ok = p95 <= THRESHOLD_MS and err_rate <= THRESHOLD_ERR
        out.append(
            {
                "bac": idx + 1,
                "phut_bat_dau": idx * STEP_SECONDS // 60,
                "nguoi_khai_bao": nominal,
                "nguoi_quan_sat": observed,
                "so_yeu_cau": len(group),
                "trung_binh_ms": round(sum(latencies) / len(latencies)),
                "moc_95_ms": round(p95),
                "ty_le_loi": round(err_rate * 100, 2),
                "ket_luan": "Dat" if ok else "Khong dat",
            }
        )
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("jtl")
    ap.add_argument("--steps", default=",".join(str(s) for s in DEFAULT_STEPS))
    ap.add_argument("--json", default=None, help="ghi kết quả ra tệp JSON")
    args = ap.parse_args()

    steps = [int(x) for x in args.steps.split(",") if x.strip()]
    rows = load_rows(args.jtl)
    table = summarize(rows, steps)
    if not table:
        print("Tệp .jtl không có mẫu nào.")
        return 2

    breakpoint = next((r for r in table if r["ket_luan"] == "Khong dat"), None)

    print(f"Tệp: {os.path.basename(args.jtl)} — {len(rows)} yêu cầu")
    print()
    print("| Bậc | Phút | Người (khai báo) | Người (quan sát) | Yêu cầu | TB (ms) | 95% dưới (ms) | Lỗi | Kết luận |")
    print("|---|---|---|---|---|---|---|---|---|")
    for r in table:
        print(
            f"| {r['bac']} | {r['phut_bat_dau']} | {r['nguoi_khai_bao']} | {r['nguoi_quan_sat']} | "
            f"{r['so_yeu_cau']} | {r['trung_binh_ms']} | {r['moc_95_ms']} | {r['ty_le_loi']}% | {r['ket_luan']} |"
        )
    print()
    if breakpoint:
        print(
            f"Điểm gãy: bậc {breakpoint['bac']} — {breakpoint['nguoi_khai_bao']} người "
            f"(quan sát {breakpoint['nguoi_quan_sat']}), 95% dưới {breakpoint['moc_95_ms']} ms, "
            f"lỗi {breakpoint['ty_le_loi']}%."
        )
    else:
        print("Không bậc nào vượt ngưỡng: hệ thống chịu được toàn bộ dải tải đã chạy.")

    if args.json:
        payload = {"tep": args.jtl, "so_yeu_cau": len(rows), "cac_bac": table, "diem_gay": breakpoint}
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
        print(f"Đã ghi {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
