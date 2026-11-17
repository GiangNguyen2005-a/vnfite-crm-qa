#!/usr/bin/env python3
"""
Tổng hợp tệp kết quả JMeter (.jtl dạng CSV) thành bảng và JSON.

Dùng khi cần số liệu để đưa vào báo cáo mà không mở giao diện JMeter:
    python3 jmeter/tools/summarize-jtl.py jmeter/result.jtl
    python3 jmeter/tools/summarize-jtl.py jmeter/result.jtl --json summary.json

Chỉ dùng thư viện chuẩn. Không phụ thuộc pandas để chạy được trên máy kiểm thử tối giản.
"""
import csv
import json
import statistics
import sys
from collections import Counter, defaultdict


def load(path):
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        return list(csv.DictReader(f))


def analyze(rows):
    elapsed = [int(r["elapsed"]) for r in rows if r.get("elapsed", "").isdigit()]
    ok = sum(1 for r in rows if r.get("success", "").lower() == "true")
    stamps = [int(r["timeStamp"]) for r in rows if r.get("timeStamp", "").isdigit()]
    span = (max(stamps) - min(stamps)) / 1000 if len(stamps) > 1 else 0

    per_label = defaultdict(list)
    for r in rows:
        if r.get("elapsed", "").isdigit():
            per_label[r.get("label", "(không tên)")].append(int(r["elapsed"]))

    def stats(values):
        if not values:
            return {}
        values = sorted(values)
        n = len(values)
        return {
            "n": n,
            "tb": round(statistics.mean(values)),
            "trung_vi": round(statistics.median(values)),
            "min": values[0],
            "max": values[-1],
            "p90": values[max(0, int(n * 0.90) - 1)],
        }

    return {
        "so_yeu_cau": len(rows),
        "thanh_cong": ok,
        "loi": len(rows) - ok,
        "giay": round(span, 1),
        "req_per_s": round(len(rows) / span, 1) if span else None,
        "tat_ca": stats(elapsed),
        "theo_endpoint": {k: stats(v) for k, v in per_label.items()},
        "ma_tra_ve": dict(Counter(r.get("responseCode", "?") for r in rows)),
        "ma_loi": dict(Counter(r.get("responseMessage", "") for r in rows if r.get("success", "").lower() != "true")),
    }


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    path = argv[1]
    rows = load(path)
    if not rows:
        print("Tệp rỗng hoặc không đọc được:", path)
        return 1

    s = analyze(rows)
    print(f"Tệp            : {path}")
    print(f"Số yêu cầu     : {s['so_yeu_cau']}")
    print(f"Thành công/lỗi : {s['thanh_cong']} / {s['loi']}")
    print(f"Thời gian chạy : {s['giay']} giây ({s['req_per_s']} yêu cầu/giây)")
    a = s["tat_ca"]
    print(f"Phản hồi       : tb {a['tb']} ms | trung vị {a['trung_vi']} | min {a['min']} | max {a['max']}")
    print()
    print(f"{'Endpoint':<38}{'n':>6}{'tb':>9}{'trung vị':>10}{'min':>8}{'max':>8}")
    for label, st in sorted(s["theo_endpoint"].items(), key=lambda kv: -kv[1]["tb"]):
        print(f"{label[:37]:<38}{st['n']:>6}{st['tb']:>9}{st['trung_vi']:>10}{st['min']:>8}{st['max']:>8}")

    if "--json" in argv:
        out = argv[argv.index("--json") + 1]
        with open(out, "w", encoding="utf-8") as f:
            json.dump(s, f, ensure_ascii=False, indent=2)
        print("\nĐã ghi", out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
