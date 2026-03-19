import json
from pathlib import Path
from collections import Counter

DATASET_DIR = Path(r"C:\SubtitleBot\dataset")

INPUT_JSONL = DATASET_DIR / "training_pairs_v3.jsonl"

CORE_JSONL = DATASET_DIR / "train_core_v1.jsonl"
EDGE_JSONL = DATASET_DIR / "train_edge_v1.jsonl"
REVIEW_JSONL = DATASET_DIR / "train_review_v1.jsonl"
REPORT_JSON = DATASET_DIR / "split_quality_report_v1.json"

VERY_LONG_DELETE_MIN_CHARS = 70
VERY_LONG_INSERT_MIN_CHARS = 70
VERY_LARGE_TIMING_SHIFT_SEC = 8.0

CORE_OPERATIONS = {
    "keep",
    "retime",
    "split",
    "merge",
    "resegment",
    "rewrite_minor",
}

EDGE_OPERATIONS = {
    "delete_noise",
    "delete_text",
    "insert",
    "rewrite_major",
    "split_rewrite",
    "merge_rewrite",
    "resegment_rewrite",
}


def load_jsonl(path: Path):
    records = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
    return records


def write_jsonl(path: Path, records: list[dict]):
    with path.open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


def text_len(text: str) -> int:
    return len((text or "").strip())


def safe_float(value, default=0.0) -> float:
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def review_reason(record: dict) -> str:
    op = record.get("operation", "")
    raw_text = (record.get("raw_text") or "").strip()
    final_text = (record.get("final_text") or "").strip()

    raw_len = text_len(raw_text)
    final_len = text_len(final_text)

    shift_start = abs(safe_float(record.get("timing_shift_start_sec")))
    shift_end = abs(safe_float(record.get("timing_shift_end_sec")))
    max_shift = max(shift_start, shift_end)

    if op in {"retime", "split", "merge", "resegment"} and max_shift >= VERY_LARGE_TIMING_SHIFT_SEC:
        return "very_large_timing_shift"

    if op == "delete_text" and raw_len >= VERY_LONG_DELETE_MIN_CHARS:
        return "delete_text_very_long_review"

    if op == "insert" and final_len >= VERY_LONG_INSERT_MIN_CHARS:
        return "insert_very_long_review"

    return ""


def classify_record(record: dict) -> tuple[str, str]:
    reason = review_reason(record)
    if reason:
        return "review", reason

    op = record.get("operation", "")

    if op in CORE_OPERATIONS:
        return "core", ""

    if op in EDGE_OPERATIONS:
        return "edge", ""

    return "edge", "unknown_operation_fallback"


def main():
    if not INPUT_JSONL.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {INPUT_JSONL}")

    records = load_jsonl(INPUT_JSONL)
    if not records:
        print("Nenhum registro encontrado no JSONL.")
        return

    core_records = []
    edge_records = []
    review_records = []

    op_counter_core = Counter()
    op_counter_edge = Counter()
    op_counter_review = Counter()
    review_reason_counter = Counter()

    for record in records:
        bucket, reason = classify_record(record)

        enriched = dict(record)
        enriched["quality_bucket"] = bucket
        if reason:
            enriched["quality_reason"] = reason

        if bucket == "core":
            core_records.append(enriched)
            op_counter_core[record.get("operation", "")] += 1
        elif bucket == "edge":
            edge_records.append(enriched)
            op_counter_edge[record.get("operation", "")] += 1
        else:
            review_records.append(enriched)
            op_counter_review[record.get("operation", "")] += 1
            if reason:
                review_reason_counter[reason] += 1

    write_jsonl(CORE_JSONL, core_records)
    write_jsonl(EDGE_JSONL, edge_records)
    write_jsonl(REVIEW_JSONL, review_records)

    total = len(records)

    report = {
        "input_file": str(INPUT_JSONL),
        "input_records": total,
        "output_files": {
            "core": str(CORE_JSONL),
            "edge": str(EDGE_JSONL),
            "review": str(REVIEW_JSONL),
        },
        "bucket_counts": {
            "core": len(core_records),
            "edge": len(edge_records),
            "review": len(review_records),
        },
        "bucket_ratios": {
            "core": round(len(core_records) / total, 4) if total else 0.0,
            "edge": round(len(edge_records) / total, 4) if total else 0.0,
            "review": round(len(review_records) / total, 4) if total else 0.0,
        },
        "operations_by_bucket": {
            "core": dict(sorted(op_counter_core.items())),
            "edge": dict(sorted(op_counter_edge.items())),
            "review": dict(sorted(op_counter_review.items())),
        },
        "review_reasons": dict(sorted(review_reason_counter.items())),
        "rules": {
            "core_operations": sorted(CORE_OPERATIONS),
            "edge_operations": sorted(EDGE_OPERATIONS),
            "very_long_delete_min_chars": VERY_LONG_DELETE_MIN_CHARS,
            "very_long_insert_min_chars": VERY_LONG_INSERT_MIN_CHARS,
            "very_large_timing_shift_sec": VERY_LARGE_TIMING_SHIFT_SEC,
        },
    }

    with REPORT_JSON.open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("Separação concluída.")
    print(f"Entrada: {INPUT_JSONL}")
    print(f"Core:    {CORE_JSONL} ({len(core_records)})")
    print(f"Edge:    {EDGE_JSONL} ({len(edge_records)})")
    print(f"Review:  {REVIEW_JSONL} ({len(review_records)})")
    print(f"Relatório: {REPORT_JSON}")


if __name__ == "__main__":
    main()