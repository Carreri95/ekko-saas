import csv
import json
from pathlib import Path
from collections import defaultdict, Counter

DATASET_DIR = Path(r"C:\SubtitleBot\dataset")
PAIRS_JSONL = DATASET_DIR / "training_pairs_v3.jsonl"

AUDIT_DIR = DATASET_DIR / "audit"
SUMMARY_CSV = AUDIT_DIR / "audit_summary_by_episode.csv"
REVIEW_CSV = AUDIT_DIR / "audit_review_pairs.csv"
NOVEL_SUMMARY_CSV = AUDIT_DIR / "audit_summary_by_novel.csv"

VERY_LONG_DELETE_MIN_CHARS = 70
VERY_LONG_INSERT_MIN_CHARS = 70
VERY_LARGE_TIMING_SHIFT_SEC = 8.0


def load_jsonl(path: Path):
    records = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
    return records


def text_len(text: str) -> int:
    return len((text or "").strip())


def _safe_float(value, default=0.0) -> float:
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

    shift_start = abs(_safe_float(record.get("timing_shift_start_sec")))
    shift_end = abs(_safe_float(record.get("timing_shift_end_sec")))
    max_shift = max(shift_start, shift_end)

    if op in {"retime", "split", "merge", "resegment"} and max_shift >= VERY_LARGE_TIMING_SHIFT_SEC:
        return "very_large_timing_shift"

    if op == "delete_text" and raw_len >= VERY_LONG_DELETE_MIN_CHARS:
        return "delete_text_very_long_review"

    if op == "insert" and final_len >= VERY_LONG_INSERT_MIN_CHARS:
        return "insert_very_long_review"

    return ""


def is_review(record: dict) -> tuple[bool, str]:
    reason = review_reason(record)
    return bool(reason), reason


def safe_div(a: int, b: int) -> float:
    if b == 0:
        return 0.0
    return round(a / b, 4)


def main():
    if not PAIRS_JSONL.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {PAIRS_JSONL}")

    AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    records = load_jsonl(PAIRS_JSONL)
    if not records:
        print("Nenhum registro encontrado no JSONL.")
        return

    by_episode = defaultdict(list)
    by_novel = defaultdict(list)
    review_rows = []

    for r in records:
        global_id = r["global_id"]
        novel_id = r["novel_id"]

        by_episode[global_id].append(r)
        by_novel[novel_id].append(r)

        review, reason = is_review(r)
        if review:
            row = {
                "reason": reason,
                "global_id": r.get("global_id"),
                "novel_id": r.get("novel_id"),
                "episode_id": r.get("episode_id"),
                "operation": r.get("operation"),
                "similarity": r.get("similarity"),
                "raw_block_count": r.get("raw_block_count"),
                "final_block_count": r.get("final_block_count"),
                "raw_indices": json.dumps(r.get("raw_indices", []), ensure_ascii=False),
                "final_indices": json.dumps(r.get("final_indices", []), ensure_ascii=False),
                "raw_text": r.get("raw_text"),
                "final_text": r.get("final_text"),
                "timing_shift_start_sec": r.get("timing_shift_start_sec"),
                "timing_shift_end_sec": r.get("timing_shift_end_sec"),
            }
            review_rows.append(row)

    episode_rows = []
    for global_id, items in sorted(by_episode.items()):
        novel_id = items[0]["novel_id"]
        episode_id = items[0]["episode_id"]

        counts = Counter(x["operation"] for x in items)
        total = len(items)

        keep_like = (
            counts["keep"]
            + counts["retime"]
            + counts["split"]
            + counts["merge"]
            + counts["resegment"]
        )

        review_count = 0
        for x in items:
            review, _ = is_review(x)
            if review:
                review_count += 1

        row = {
            "global_id": global_id,
            "novel_id": novel_id,
            "episode_id": episode_id,
            "total_pairs": total,
            "keep": counts["keep"],
            "retime": counts["retime"],
            "split": counts["split"],
            "merge": counts["merge"],
            "resegment": counts["resegment"],
            "delete_noise": counts["delete_noise"],
            "delete_text": counts["delete_text"],
            "insert": counts["insert"],
            "rewrite_minor": counts["rewrite_minor"],
            "rewrite_major": counts["rewrite_major"],
            "split_rewrite": counts["split_rewrite"],
            "merge_rewrite": counts["merge_rewrite"],
            "resegment_rewrite": counts["resegment_rewrite"],
            "keep_like_ratio": safe_div(keep_like, total),
            "delete_text_ratio": safe_div(counts["delete_text"], total),
            "insert_ratio": safe_div(counts["insert"], total),
            "review_pairs": review_count,
            "review_ratio": safe_div(review_count, total),
        }
        episode_rows.append(row)

    novel_rows = []
    for novel_id, items in sorted(by_novel.items()):
        counts = Counter(x["operation"] for x in items)
        total = len(items)

        keep_like = (
            counts["keep"]
            + counts["retime"]
            + counts["split"]
            + counts["merge"]
            + counts["resegment"]
        )

        review_count = 0
        for x in items:
            review, _ = is_review(x)
            if review:
                review_count += 1

        row = {
            "novel_id": novel_id,
            "total_pairs": total,
            "keep": counts["keep"],
            "retime": counts["retime"],
            "split": counts["split"],
            "merge": counts["merge"],
            "resegment": counts["resegment"],
            "delete_noise": counts["delete_noise"],
            "delete_text": counts["delete_text"],
            "insert": counts["insert"],
            "rewrite_minor": counts["rewrite_minor"],
            "rewrite_major": counts["rewrite_major"],
            "split_rewrite": counts["split_rewrite"],
            "merge_rewrite": counts["merge_rewrite"],
            "resegment_rewrite": counts["resegment_rewrite"],
            "keep_like_ratio": safe_div(keep_like, total),
            "delete_text_ratio": safe_div(counts["delete_text"], total),
            "insert_ratio": safe_div(counts["insert"], total),
            "review_pairs": review_count,
            "review_ratio": safe_div(review_count, total),
        }
        novel_rows.append(row)

    if episode_rows:
        with SUMMARY_CSV.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=list(episode_rows[0].keys()))
            writer.writeheader()
            writer.writerows(episode_rows)

    if novel_rows:
        with NOVEL_SUMMARY_CSV.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=list(novel_rows[0].keys()))
            writer.writeheader()
            writer.writerows(novel_rows)

    if review_rows:
        with REVIEW_CSV.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=list(review_rows[0].keys()))
            writer.writeheader()
            writer.writerows(review_rows)

    print(f"Registros lidos: {len(records)}")
    print(f"Resumo por episódio: {SUMMARY_CSV}")
    print(f"Resumo por novela:   {NOVEL_SUMMARY_CSV}")
    print(f"Casos para review:   {REVIEW_CSV}")
    print(f"Total para review:   {len(review_rows)}")


if __name__ == "__main__":
    main()