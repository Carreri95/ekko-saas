import json
import re
from pathlib import Path
from difflib import SequenceMatcher

DATASET_DIR = Path(r"C:\SubtitleBot\dataset")
INPUT_JSONL = DATASET_DIR / "training_pairs_v2.jsonl"
OUTPUT_JSONL = DATASET_DIR / "training_pairs_v3.jsonl"
REPORT_JSON = DATASET_DIR / "reconcile_report_v3.json"

# Janela máxima para procurar inserts/deletes vizinhos do mesmo episódio
MAX_LOOKAHEAD = 6

# Limiares
HIGH_SIMILARITY = 0.92
MEDIUM_SIMILARITY = 0.75
LOOSE_SIMILARITY = 0.60

# Limites de tamanho
MIN_TEXT_LEN = 8


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def normalize_text(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[\"“”'`´]", "", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    return text


def strip_punct(text: str) -> str:
    text = normalize_text(text)
    text = re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def text_len(text: str) -> int:
    return len(normalize_text(text))


def similarity(a: str, b: str) -> float:
    a = normalize_text(a)
    b = normalize_text(b)
    if not a and not b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def loose_similarity(a: str, b: str) -> float:
    a = strip_punct(a)
    b = strip_punct(b)
    if not a and not b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def clone_record(base: dict) -> dict:
    return json.loads(json.dumps(base, ensure_ascii=False))


def merge_indices(records: list[dict], field: str) -> list[int]:
    out = []
    for r in records:
        out.extend(r.get(field, []))
    return out


def concat_text(records: list[dict], field: str) -> str:
    parts = []
    for r in records:
        t = (r.get(field) or "").strip()
        if t:
            parts.append(t)
    return " ".join(parts).strip()


def avg_similarity(records: list[dict]) -> float:
    sims = []
    for r in records:
        try:
            sims.append(float(r.get("similarity") or 0.0))
        except Exception:
            sims.append(0.0)
    if not sims:
        return 0.0
    return round(sum(sims) / len(sims), 4)


def safe_float(value, default=0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def classify_reconciliation(
    delete_record: dict,
    insert_records: list[dict],
) -> tuple[bool, str, float]:
    """
    Decide se 1 delete + N inserts devem virar split/split_rewrite/resegment/etc.
    """
    raw_text = (delete_record.get("raw_text") or "").strip()
    final_text = concat_text(insert_records, "final_text")

    if text_len(raw_text) < MIN_TEXT_LEN or text_len(final_text) < MIN_TEXT_LEN:
        return False, "", 0.0

    sim = similarity(raw_text, final_text)
    sim_loose = loose_similarity(raw_text, final_text)
    best_sim = max(sim, sim_loose)

    raw_blocks = int(delete_record.get("raw_block_count") or len(delete_record.get("raw_indices", [])) or 1)
    final_blocks = sum(int(r.get("final_block_count") or len(r.get("final_indices", [])) or 1) for r in insert_records)

    # Caso clássico: 1 raw virou vários blocos final
    if raw_blocks <= 1 and final_blocks > 1:
        if best_sim >= HIGH_SIMILARITY:
            return True, "split", best_sim
        if best_sim >= MEDIUM_SIMILARITY:
            return True, "split_rewrite", best_sim

    # Caso 1-para-1 mas com mudança de segmentação/editorial
    if raw_blocks <= 1 and final_blocks <= 1:
        if best_sim >= HIGH_SIMILARITY:
            return True, "resegment", best_sim
        if best_sim >= MEDIUM_SIMILARITY:
            return True, "resegment_rewrite", best_sim

    # fallback
    if best_sim >= HIGH_SIMILARITY:
        return True, "resegment", best_sim
    if best_sim >= MEDIUM_SIMILARITY:
        return True, "resegment_rewrite", best_sim

    return False, "", best_sim


def classify_reconciliation_reverse(
    insert_record: dict,
    delete_records: list[dict],
) -> tuple[bool, str, float]:
    """
    Decide se 1 insert + N deletes devem virar merge/merge_rewrite/resegment/etc.
    """
    raw_text = concat_text(delete_records, "raw_text")
    final_text = (insert_record.get("final_text") or "").strip()

    if text_len(raw_text) < MIN_TEXT_LEN or text_len(final_text) < MIN_TEXT_LEN:
        return False, "", 0.0

    sim = similarity(raw_text, final_text)
    sim_loose = loose_similarity(raw_text, final_text)
    best_sim = max(sim, sim_loose)

    raw_blocks = sum(int(r.get("raw_block_count") or len(r.get("raw_indices", [])) or 1) for r in delete_records)
    final_blocks = int(insert_record.get("final_block_count") or len(insert_record.get("final_indices", [])) or 1)

    # vários raws viraram 1 final
    if raw_blocks > 1 and final_blocks <= 1:
        if best_sim >= HIGH_SIMILARITY:
            return True, "merge", best_sim
        if best_sim >= MEDIUM_SIMILARITY:
            return True, "merge_rewrite", best_sim

    if raw_blocks <= 1 and final_blocks <= 1:
        if best_sim >= HIGH_SIMILARITY:
            return True, "resegment", best_sim
        if best_sim >= MEDIUM_SIMILARITY:
            return True, "resegment_rewrite", best_sim

    if best_sim >= HIGH_SIMILARITY:
        return True, "resegment", best_sim
    if best_sim >= MEDIUM_SIMILARITY:
        return True, "resegment_rewrite", best_sim

    return False, "", best_sim


def build_reconciled_record_from_delete(
    delete_record: dict,
    insert_records: list[dict],
    new_operation: str,
    sim_value: float,
) -> dict:
    new_row = clone_record(delete_record)

    new_row["operation"] = new_operation
    new_row["similarity"] = round(sim_value, 4)

    new_row["final_indices"] = merge_indices(insert_records, "final_indices")
    new_row["final_text"] = concat_text(insert_records, "final_text")
    new_row["final_block_count"] = len(new_row["final_indices"]) if new_row["final_indices"] else sum(
        int(r.get("final_block_count") or 0) for r in insert_records
    )

    # timing: pega os extremos disponíveis dos inserts
    start_candidates = []
    end_candidates = []

    for r in insert_records:
        s = r.get("timing_shift_start_sec")
        e = r.get("timing_shift_end_sec")
        if s is not None and s != "":
            start_candidates.append(safe_float(s))
        if e is not None and e != "":
            end_candidates.append(safe_float(e))

    if start_candidates:
        new_row["timing_shift_start_sec"] = min(start_candidates)
    if end_candidates:
        new_row["timing_shift_end_sec"] = max(end_candidates)

    new_row["reconciled_from"] = {
        "pattern": "delete_plus_inserts",
        "source_operations": [delete_record["operation"]] + [r["operation"] for r in insert_records],
        "source_count": 1 + len(insert_records),
    }

    return new_row


def build_reconciled_record_from_insert(
    insert_record: dict,
    delete_records: list[dict],
    new_operation: str,
    sim_value: float,
) -> dict:
    new_row = clone_record(insert_record)

    new_row["operation"] = new_operation
    new_row["similarity"] = round(sim_value, 4)

    new_row["raw_indices"] = merge_indices(delete_records, "raw_indices")
    new_row["raw_text"] = concat_text(delete_records, "raw_text")
    new_row["raw_block_count"] = len(new_row["raw_indices"]) if new_row["raw_indices"] else sum(
        int(r.get("raw_block_count") or 0) for r in delete_records
    )

    start_candidates = []
    end_candidates = []

    for r in delete_records:
        s = r.get("timing_shift_start_sec")
        e = r.get("timing_shift_end_sec")
        if s is not None and s != "":
            start_candidates.append(safe_float(s))
        if e is not None and e != "":
            end_candidates.append(safe_float(e))

    if start_candidates:
        new_row["timing_shift_start_sec"] = min(start_candidates)
    if end_candidates:
        new_row["timing_shift_end_sec"] = max(end_candidates)

    new_row["reconciled_from"] = {
        "pattern": "inserts_plus_delete",
        "source_operations": [r["operation"] for r in delete_records] + [insert_record["operation"]],
        "source_count": len(delete_records) + 1,
    }

    return new_row


def same_episode(a: dict, b: dict) -> bool:
    return a.get("global_id") == b.get("global_id")


def try_reconcile_delete_forward(records: list[dict], i: int, used: set[int]):
    base = records[i]

    if i in used:
        return None

    if base.get("operation") != "delete_text":
        return None

    candidates = []
    for j in range(i + 1, min(i + 1 + MAX_LOOKAHEAD, len(records))):
        if j in used:
            continue
        row = records[j]

        if not same_episode(base, row):
            break

        if row.get("operation") == "insert":
            candidates.append((j, row))
        elif row.get("operation") in {"keep", "retime", "rewrite_minor", "rewrite_major", "split", "merge", "resegment", "split_rewrite", "merge_rewrite", "resegment_rewrite"}:
            break

    if not candidates:
        return None

    # tenta com 1..N inserts consecutivos dentro da janela
    best = None
    for n in range(1, len(candidates) + 1):
        subset_indices = [idx for idx, _ in candidates[:n]]
        subset_rows = [row for _, row in candidates[:n]]

        ok, new_op, sim_value = classify_reconciliation(base, subset_rows)
        if ok:
            if best is None or sim_value > best["sim"]:
                best = {
                    "type": "delete_forward",
                    "consume": [i] + subset_indices,
                    "record": build_reconciled_record_from_delete(base, subset_rows, new_op, sim_value),
                    "sim": sim_value,
                }

    return best


def try_reconcile_insert_forward(records: list[dict], i: int, used: set[int]):
    base = records[i]

    if i in used:
        return None

    if base.get("operation") != "insert":
        return None

    candidates = []
    for j in range(i + 1, min(i + 1 + MAX_LOOKAHEAD, len(records))):
        if j in used:
            continue
        row = records[j]

        if not same_episode(base, row):
            break

        if row.get("operation") == "delete_text":
            candidates.append((j, row))
        elif row.get("operation") in {"keep", "retime", "rewrite_minor", "rewrite_major", "split", "merge", "resegment", "split_rewrite", "merge_rewrite", "resegment_rewrite"}:
            break

    if not candidates:
        return None

    best = None
    for n in range(1, len(candidates) + 1):
        subset_indices = [idx for idx, _ in candidates[:n]]
        subset_rows = [row for _, row in candidates[:n]]

        ok, new_op, sim_value = classify_reconciliation_reverse(base, subset_rows)
        if ok:
            if best is None or sim_value > best["sim"]:
                best = {
                    "type": "insert_forward",
                    "consume": [i] + subset_indices,
                    "record": build_reconciled_record_from_insert(base, subset_rows, new_op, sim_value),
                    "sim": sim_value,
                }

    return best


def reconcile_records(records: list[dict]) -> tuple[list[dict], dict]:
    out = []
    used = set()

    stats = {
        "input_records": len(records),
        "reconciled_groups": 0,
        "consumed_records": 0,
        "generated_records": 0,
        "by_new_operation": {},
    }

    i = 0
    while i < len(records):
        if i in used:
            i += 1
            continue

        candidate_a = try_reconcile_delete_forward(records, i, used)
        candidate_b = try_reconcile_insert_forward(records, i, used)

        best = None
        if candidate_a and candidate_b:
            best = candidate_a if candidate_a["sim"] >= candidate_b["sim"] else candidate_b
        else:
            best = candidate_a or candidate_b

        if best:
            for idx in best["consume"]:
                used.add(idx)

            out.append(best["record"])
            stats["reconciled_groups"] += 1
            stats["consumed_records"] += len(best["consume"])
            stats["generated_records"] += 1

            op = best["record"]["operation"]
            stats["by_new_operation"][op] = stats["by_new_operation"].get(op, 0) + 1
        else:
            used.add(i)
            out.append(records[i])

        i += 1

    stats["output_records"] = len(out)
    return out, stats


def main():
    if not INPUT_JSONL.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {INPUT_JSONL}")

    rows = load_jsonl(INPUT_JSONL)
    if not rows:
        print("Nenhum registro encontrado.")
        return

    reconciled_rows, stats = reconcile_records(rows)

    write_jsonl(OUTPUT_JSONL, reconciled_rows)
    REPORT_JSON.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Reconciliação concluída.")
    print(f"Entrada: {INPUT_JSONL}")
    print(f"Saída:   {OUTPUT_JSONL}")
    print(f"Relatório: {REPORT_JSON}")
    print()
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()