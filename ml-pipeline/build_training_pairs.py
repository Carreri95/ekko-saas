import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

DATASET_DIR = Path(r"C:\SubtitleBot\dataset")
NOVELS_DIR = DATASET_DIR / "novels"
OUTPUT_JSONL = DATASET_DIR / "training_pairs_v2.jsonl"
OUTPUT_CSV = DATASET_DIR / "training_pairs_v2.csv"

MAX_GROUP_SIZE = 3

KEEP_SIMILARITY = 0.985
RETIME_SIMILARITY = 0.975
REWRITE_MINOR_SIMILARITY = 0.90
REWRITE_MAJOR_SIMILARITY = 0.72

MAX_KEEP_SHIFT_SEC = 0.12
MAX_RETIME_SHIFT_SEC = 12.0

NOISE_PATTERNS = [
    r"ha\s*ha\s*ha[!.\?]*",
    r"ha\s*ha[!.\?]*",
    r"haha[!.\?]*",
    r"kkk+[!.\?]*",
    r"rsrs+[!.\?]*",
    r"ops[!.\?]*",
    r"a+h+[!.\?]*",
    r"ah+n*[!.\?]*",
    r"oh[!.\?]*",
    r"eh[!.\?]*",
    r"hmm[!.\?]*",
    r"hum[!.\?]*",
    r"ai[!.\?]*",
    r"au\s*,?\s*au[!.\?]*",
]

CSV_FIELDS = [
    "global_id",
    "novel_id",
    "episode_id",
    "raw_indices",
    "final_indices",
    "raw_start",
    "raw_end",
    "final_start",
    "final_end",
    "raw_start_sec",
    "raw_end_sec",
    "final_start_sec",
    "final_end_sec",
    "raw_text",
    "final_text",
    "similarity",
    "operation",
    "raw_block_count",
    "final_block_count",
    "timing_shift_start_sec",
    "timing_shift_end_sec",
    "style",
    "language",
]


@dataclass
class SRTEntry:
    index: int
    start: str
    end: str
    start_sec: float
    end_sec: float
    text_lines: List[str]

    @property
    def text(self) -> str:
        return normalize_spaces(" ".join(self.text_lines))


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalize_for_similarity(text: str) -> str:
    text = normalize_spaces(text).lower()
    text = re.sub(r"[^\w\sà-ÿ]", "", text, flags=re.IGNORECASE)
    return normalize_spaces(text)


def is_noise_text(text: str) -> bool:
    cleaned = normalize_spaces(text).lower()
    if not cleaned:
        return True

    for pattern in NOISE_PATTERNS:
        if re.fullmatch(pattern, cleaned, flags=re.IGNORECASE):
            return True

    return False


def timestamp_to_seconds(ts: str) -> float:
    hh, mm, rest = ts.split(":")
    ss, ms = rest.split(",")
    return int(hh) * 3600 + int(mm) * 60 + int(ss) + int(ms) / 1000.0


def parse_srt(path: Path) -> List[SRTEntry]:
    content = path.read_text(encoding="utf-8", errors="ignore")
    blocks = re.split(r"\n\s*\n", content.strip(), flags=re.MULTILINE)

    entries: List[SRTEntry] = []

    for block in blocks:
        lines = [line.rstrip("\r") for line in block.splitlines() if line.strip()]
        if len(lines) < 3:
            continue

        idx_line = lines[0].strip()
        time_line = lines[1].strip()
        text_lines = lines[2:]

        if "-->" not in time_line:
            continue

        try:
            index = int(idx_line)
        except ValueError:
            continue

        start_str, end_str = [x.strip() for x in time_line.split("-->")]
        start_sec = timestamp_to_seconds(start_str)
        end_sec = timestamp_to_seconds(end_str)

        entries.append(
            SRTEntry(
                index=index,
                start=start_str,
                end=end_str,
                start_sec=start_sec,
                end_sec=end_sec,
                text_lines=text_lines,
            )
        )

    return entries


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        for j, cb in enumerate(b, start=1):
            insert_cost = cur[j - 1] + 1
            delete_cost = prev[j] + 1
            replace_cost = prev[j - 1] + (ca != cb)
            cur.append(min(insert_cost, delete_cost, replace_cost))
        prev = cur
    return prev[-1]


def similarity(a: str, b: str) -> float:
    aa = normalize_for_similarity(a)
    bb = normalize_for_similarity(b)
    max_len = max(len(aa), len(bb))
    if max_len == 0:
        return 1.0
    dist = levenshtein(aa, bb)
    return 1.0 - (dist / max_len)


def join_entries_text(entries: List[SRTEntry]) -> str:
    return normalize_spaces(" ".join(e.text for e in entries if e.text))


def group_time_bounds(entries: List[SRTEntry]) -> Tuple[Optional[str], Optional[str], Optional[float], Optional[float]]:
    if not entries:
        return None, None, None, None
    return (
        entries[0].start,
        entries[-1].end,
        entries[0].start_sec,
        entries[-1].end_sec,
    )


def classify_operation(
    raw_group: List[SRTEntry],
    final_group: List[SRTEntry],
    sim: float,
) -> str:
    raw_count = len(raw_group)
    final_count = len(final_group)

    raw_text = join_entries_text(raw_group)

    if raw_count > 0 and final_count == 0:
        return "delete_noise" if is_noise_text(raw_text) else "delete_text"

    if raw_count == 0 and final_count > 0:
        return "insert"

    raw_start = raw_group[0].start_sec
    raw_end = raw_group[-1].end_sec
    final_start = final_group[0].start_sec
    final_end = final_group[-1].end_sec

    start_shift = final_start - raw_start
    end_shift = final_end - raw_end
    max_shift = max(abs(start_shift), abs(end_shift))

    if raw_count == 1 and final_count == 1:
        if sim >= KEEP_SIMILARITY and max_shift <= MAX_KEEP_SHIFT_SEC:
            return "keep"
        if sim >= RETIME_SIMILARITY and max_shift <= MAX_RETIME_SHIFT_SEC:
            return "retime"
        if sim >= REWRITE_MINOR_SIMILARITY:
            return "rewrite_minor"
        if sim >= REWRITE_MAJOR_SIMILARITY:
            return "rewrite_major"
        return "rewrite_major"

    if raw_count == 1 and final_count > 1:
        if sim >= REWRITE_MINOR_SIMILARITY:
            return "split"
        return "split_rewrite"

    if raw_count > 1 and final_count == 1:
        if sim >= REWRITE_MINOR_SIMILARITY:
            return "merge"
        return "merge_rewrite"

    if sim >= REWRITE_MINOR_SIMILARITY:
        return "resegment"

    if sim >= REWRITE_MAJOR_SIMILARITY:
        return "resegment_rewrite"

    return "rewrite_major"


def candidate_score(raw_group: List[SRTEntry], final_group: List[SRTEntry]) -> float:
    raw_text = join_entries_text(raw_group)
    final_text = join_entries_text(final_group)

    sim = similarity(raw_text, final_text)

    raw_count = len(raw_group)
    final_count = len(final_group)

    if raw_count == 0 and final_count > 0:
        return -10.0 - (final_count * 0.2)

    if raw_count > 0 and final_count == 0:
        if is_noise_text(raw_text):
            return 0.72 - (raw_count - 1) * 0.05
        return 0.35 - (raw_count - 1) * 0.08

    raw_start = raw_group[0].start_sec
    raw_end = raw_group[-1].end_sec
    final_start = final_group[0].start_sec
    final_end = final_group[-1].end_sec

    start_shift = abs(final_start - raw_start)
    end_shift = abs(final_end - raw_end)
    max_shift = max(start_shift, end_shift)

    size_penalty = ((raw_count - 1) + (final_count - 1)) * 0.06
    large_group_penalty = max(0, raw_count + final_count - 2) * 0.04
    timing_penalty = min(max_shift / 25.0, 0.40)

    shape_bonus = 0.0
    if raw_count == 1 and final_count == 1:
        shape_bonus += 0.12
    elif (raw_count, final_count) in {(1, 2), (2, 1)}:
        shape_bonus += 0.06
    elif (raw_count, final_count) == (2, 2):
        shape_bonus += 0.03

    if raw_count > 0 and final_count == 0 and is_noise_text(raw_text):
        shape_bonus += 0.08

    return sim + shape_bonus - size_penalty - large_group_penalty - timing_penalty


def best_local_match(
    raw_entries: List[SRTEntry],
    final_entries: List[SRTEntry],
    i: int,
    j: int,
) -> Tuple[int, int, float]:
    best_choice = (1, 1, -999.0)

    for raw_n in range(0, MAX_GROUP_SIZE + 1):
        for final_n in range(0, MAX_GROUP_SIZE + 1):
            if raw_n == 0 and final_n == 0:
                continue

            if raw_n == 0 and final_n > 1:
                continue
            if final_n == 0 and raw_n > 1:
                continue

            if i + raw_n > len(raw_entries):
                continue
            if j + final_n > len(final_entries):
                continue

            raw_group = raw_entries[i:i + raw_n]
            final_group = final_entries[j:j + final_n]

            score = candidate_score(raw_group, final_group)

            if score > best_choice[2]:
                best_choice = (raw_n, final_n, score)
            elif abs(score - best_choice[2]) < 1e-9:
                old_size = best_choice[0] + best_choice[1]
                new_size = raw_n + final_n
                if new_size < old_size:
                    best_choice = (raw_n, final_n, score)

    return best_choice


def make_pair_record(
    novel_id: str,
    episode_id: str,
    raw_group: List[SRTEntry],
    final_group: List[SRTEntry],
) -> dict:
    raw_text = join_entries_text(raw_group)
    final_text = join_entries_text(final_group)
    sim = similarity(raw_text, final_text) if raw_group and final_group else 0.0

    operation = classify_operation(raw_group, final_group, sim)

    raw_start, raw_end, raw_start_sec, raw_end_sec = group_time_bounds(raw_group)
    final_start, final_end, final_start_sec, final_end_sec = group_time_bounds(final_group)

    timing_shift_start_sec = None
    timing_shift_end_sec = None
    if raw_start_sec is not None and final_start_sec is not None:
        timing_shift_start_sec = round(final_start_sec - raw_start_sec, 3)
    if raw_end_sec is not None and final_end_sec is not None:
        timing_shift_end_sec = round(final_end_sec - raw_end_sec, 3)

    return {
        "global_id": f"{novel_id}__{episode_id}",
        "novel_id": novel_id,
        "episode_id": episode_id,
        "raw_indices": [e.index for e in raw_group],
        "final_indices": [e.index for e in final_group],
        "raw_start": raw_start,
        "raw_end": raw_end,
        "final_start": final_start,
        "final_end": final_end,
        "raw_start_sec": raw_start_sec,
        "raw_end_sec": raw_end_sec,
        "final_start_sec": final_start_sec,
        "final_end_sec": final_end_sec,
        "raw_text": raw_text,
        "final_text": final_text,
        "similarity": round(sim, 4),
        "operation": operation,
        "raw_block_count": len(raw_group),
        "final_block_count": len(final_group),
        "timing_shift_start_sec": timing_shift_start_sec,
        "timing_shift_end_sec": timing_shift_end_sec,
        "style": "vertical_shortform",
        "language": "pt-BR",
    }


def align_episode(novel_id: str, episode_dir: Path) -> List[dict]:
    episode_id = episode_dir.name
    raw_path = episode_dir / "Bruto.srt"
    final_path = episode_dir / "Final.srt"

    if not raw_path.exists() or not final_path.exists():
        return []

    raw_entries = parse_srt(raw_path)
    final_entries = parse_srt(final_path)

    results: List[dict] = []

    i = 0
    j = 0

    while i < len(raw_entries) or j < len(final_entries):
        raw_n, final_n, _score = best_local_match(raw_entries, final_entries, i, j)

        raw_group = raw_entries[i:i + raw_n]
        final_group = final_entries[j:j + final_n]

        rec = make_pair_record(novel_id, episode_id, raw_group, final_group)
        results.append(rec)

        i += raw_n
        j += final_n

    return results


def iter_episode_dirs():
    if not NOVELS_DIR.exists():
        raise FileNotFoundError(f"Pasta nao encontrada: {NOVELS_DIR}")

    for novel_dir in sorted([p for p in NOVELS_DIR.iterdir() if p.is_dir()]):
        novel_id = novel_dir.name
        for episode_dir in sorted([p for p in novel_dir.iterdir() if p.is_dir()]):
            yield novel_id, episode_dir


def write_jsonl(records: List[dict], path: Path) -> None:
    with path.open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


def write_csv(records: List[dict], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for record in records:
            row = record.copy()
            row["raw_indices"] = json.dumps(row["raw_indices"], ensure_ascii=False)
            row["final_indices"] = json.dumps(row["final_indices"], ensure_ascii=False)
            writer.writerow(row)


def summarize(records: List[dict]) -> None:
    counts = {}
    novels = set()
    episodes = set()

    for r in records:
        op = r["operation"]
        counts[op] = counts.get(op, 0) + 1
        novels.add(r["novel_id"])
        episodes.add(r["global_id"])

    print(f"\nNovelas cobertas: {len(novels)}")
    print(f"Episódios cobertos: {len(episodes)}")

    print("\nResumo das operações:")
    for op in sorted(counts):
        print(f"  {op}: {counts[op]}")

    large_groups = [
        r for r in records
        if r["raw_block_count"] > 2 or r["final_block_count"] > 2
    ]
    print(f"\nPares com grupo > 2 blocos: {len(large_groups)}")


def main():
    episode_items = list(iter_episode_dirs())
    if not episode_items:
        print("Nenhum episodio encontrado dentro de dataset\\novels.")
        return

    all_records: List[dict] = []

    for novel_id, episode_dir in episode_items:
        records = align_episode(novel_id, episode_dir)
        all_records.extend(records)
        print(f"OK: {novel_id}/{episode_dir.name} -> {len(records)} pares")

    write_jsonl(all_records, OUTPUT_JSONL)
    write_csv(all_records, OUTPUT_CSV)

    print(f"\nJSONL salvo em: {OUTPUT_JSONL}")
    print(f"CSV salvo em:   {OUTPUT_CSV}")

    summarize(all_records)


if __name__ == "__main__":
    main()