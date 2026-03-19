import os
import re
from pathlib import Path
from typing import List, Tuple, Dict

BASE_DIR = Path(r"C:\SubtitleBot")
INPUT_DIR = BASE_DIR / "Output"
OUTPUT_DIR = BASE_DIR / "Limpo"
LOG_DIR = BASE_DIR / "logs"
NAMES_FILE = BASE_DIR / "personagens.md"
PREPROCESS_SCRIPT = BASE_DIR / "clean_names.py"

MAX_CHARS_PER_LINE = 35
MAX_LINES_PER_BLOCK = 2
MAX_TOTAL_CHARS_BEFORE_SPLIT = 72
MIN_SPLIT_DURATION = 1.2

# Merge de blocos curtos
MAX_MERGE_TOTAL_CHARS = 45
MAX_MERGE_GAP_SECONDS = 1.2

ONOMATOPEIA_PATTERNS = [
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
]

WEAK_WORDS = {
    "a", "o", "as", "os", "de", "da", "do", "das", "dos",
    "e", "ou", "em", "um", "uma", "pra", "pro", "na", "no",
    "nas", "nos", "que", "se", "com", "por", "para"
}

# Palavras que normalmente funcionam melhor sozinhas, sem merge
MERGE_BLOCKER_STARTS = {
    "exato",
    "isso",
    "sim",
    "nao",
    "não",
    "certo",
    "ok",
    "tá",
    "ta",
    "beleza",
    "relaxa",
    "obrigado",
    "obrigada",
}


def load_names(path: Path) -> List[str]:
    if not path.exists():
        raise FileNotFoundError(f"Arquivo de nomes nao encontrado: {path}")
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        names.append(line)
    return names


def run_preprocess() -> None:
    if not PREPROCESS_SCRIPT.exists():
        raise FileNotFoundError(f"Script nao encontrado: {PREPROCESS_SCRIPT}")
    exit_code = os.system(f'python "{PREPROCESS_SCRIPT}"')
    if exit_code != 0:
        raise RuntimeError("Falha ao executar clean_names.py")


def parse_srt(content: str) -> List[Dict]:
    blocks = re.split(r"\n\s*\n", content.strip(), flags=re.MULTILINE)
    entries = []

    for block in blocks:
        lines = [line.rstrip("\r") for line in block.splitlines() if line.strip() != ""]
        if len(lines) < 3:
            continue

        index_line = lines[0].strip()
        time_line = lines[1].strip()
        text_lines = lines[2:]

        if "-->" not in time_line:
            continue

        try:
            index = int(index_line)
        except ValueError:
            continue

        start_str, end_str = [part.strip() for part in time_line.split("-->")]
        entries.append(
            {
                "index": index,
                "start": start_str,
                "end": end_str,
                "text_lines": text_lines,
            }
        )
    return entries


def format_srt(entries: List[Dict]) -> str:
    output = []
    for i, entry in enumerate(entries, start=1):
        output.append(str(i))
        output.append(f"{entry['start']} --> {entry['end']}")
        output.extend(entry["text_lines"])
        output.append("")
    return "\n".join(output).strip() + "\n"


def timestamp_to_seconds(ts: str) -> float:
    hh, mm, rest = ts.split(":")
    ss, ms = rest.split(",")
    return int(hh) * 3600 + int(mm) * 60 + int(ss) + int(ms) / 1000.0


def seconds_to_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    hh = int(seconds // 3600)
    mm = int((seconds % 3600) // 60)
    ss = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms == 1000:
        ss += 1
        ms = 0
    if ss == 60:
        mm += 1
        ss = 0
    if mm == 60:
        hh += 1
        mm = 0
    return f"{hh:02d}:{mm:02d}:{ss:02d},{ms:03d}"


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalize_for_compare(text: str) -> str:
    text = normalize_spaces(text).lower()
    text = re.sub(r"[^\w\sà-ÿ]", "", text, flags=re.IGNORECASE)
    return normalize_spaces(text)


def is_pure_onomatopeia(text: str) -> bool:
    cleaned = normalize_spaces(text).lower()
    if not cleaned:
        return False

    for pattern in ONOMATOPEIA_PATTERNS:
        if re.fullmatch(pattern, cleaned, flags=re.IGNORECASE):
            return True

    return False


def levenshtein(a: str, b: str) -> int:
    a = a.lower()
    b = b.lower()
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
    dist = levenshtein(a, b)
    max_len = max(len(a), len(b))
    if max_len == 0:
        return 1.0
    return 1.0 - (dist / max_len)


def maybe_correct_name_tokens(text: str, names: List[str]) -> str:
    tokens = re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE)
    if not tokens:
        return text

    corrected = []
    i = 0

    while i < len(tokens):
        tok = tokens[i]

        if re.fullmatch(r"\w+", tok, flags=re.UNICODE) and tok[0].isupper():
            best_name = None
            best_score = 0.0

            for full_name in names:
                parts = full_name.split()
                first = parts[0]
                score = similarity(tok, first)
                if score > best_score:
                    best_score = score
                    best_name = full_name

            if best_name and best_score >= 0.88:
                parts = best_name.split()

                if len(parts) >= 2 and i + 1 < len(tokens):
                    next_tok = tokens[i + 1]
                    if re.fullmatch(r"\w+", next_tok, flags=re.UNICODE):
                        if tok.lower() == parts[0].lower() and next_tok.lower() == parts[1].lower():
                            corrected.append(tok)
                            corrected.append(next_tok)
                            i += 2
                            continue

                corrected.append(best_name)
                i += 1
                continue

        corrected.append(tok)
        i += 1

    out = ""
    for j, tok in enumerate(corrected):
        if j == 0:
            out += tok
        elif re.fullmatch(r"[.,!?;:)\]]", tok):
            out += tok
        elif corrected[j - 1] in {"(", "[", '"', "'"}:
            out += tok
        else:
            out += " " + tok

    return out


def choose_break_index(words: List[str]) -> int:
    if len(words) < 2:
        return 1

    total_len = len(" ".join(words))
    target = total_len / 2
    best_idx = len(words) // 2
    best_score = float("inf")

    for i in range(1, len(words)):
        left = " ".join(words[:i])
        right = " ".join(words[i:])

        left_score = abs(len(left) - target)
        right_score = abs(len(right) - target)

        penalty = 0

        if words[i - 1].lower() in WEAK_WORDS:
            penalty += 10

        if len(left.split()) <= 1 or len(right.split()) <= 1:
            penalty += 25

        if len(left) < 10 or len(right) < 10:
            penalty += 12

        score = left_score + right_score + penalty
        if score < best_score:
            best_score = score
            best_idx = i

    return best_idx


def break_text_into_lines(text: str, max_chars: int = MAX_CHARS_PER_LINE) -> List[str]:
    text = normalize_spaces(text)
    words = text.split()
    if not words:
        return [""]

    if len(text) <= max_chars:
        return [text]

    lines = []
    current = []

    for word in words:
        tentative = " ".join(current + [word])
        if len(tentative) <= max_chars:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]

    if current:
        lines.append(" ".join(current))

    if len(lines) == 2:
        left_words = lines[0].split()
        right_words = lines[1].split()
        all_words = left_words + right_words
        idx = choose_break_index(all_words)
        return [" ".join(all_words[:idx]), " ".join(all_words[idx:])]

    return [l for l in lines if l.strip()]


def needs_split(text: str) -> bool:
    return len(text) > MAX_TOTAL_CHARS_BEFORE_SPLIT


def split_text_for_two_blocks(text: str) -> Tuple[str, str]:
    words = text.split()
    if len(words) < 2:
        return text, ""

    idx = choose_break_index(words)
    return " ".join(words[:idx]), " ".join(words[idx:])


def collapse_consecutive_duplicates(entries: List[Dict], stats: Dict) -> List[Dict]:
    result = []
    i = 0

    while i < len(entries):
        current_text = normalize_for_compare(" ".join(entries[i]["text_lines"]))
        j = i + 1
        while j < len(entries):
            next_text = normalize_for_compare(" ".join(entries[j]["text_lines"]))
            if next_text == current_text and current_text:
                j += 1
            else:
                break

        run_len = j - i
        if current_text and run_len >= 5:
            result.append(entries[i])
            stats["duplicate_groups_collapsed"] += 1
            stats["duplicate_blocks_removed"] += (run_len - 1)
        else:
            result.extend(entries[i:j])

        i = j

    return result


def first_word(text: str) -> str:
    match = re.search(r"\b([\wà-ÿ]+)\b", text.lower(), flags=re.IGNORECASE)
    return match.group(1) if match else ""


def lower_first_char(text: str) -> str:
    if not text:
        return text
    return text[0].lower() + text[1:]


def should_merge_entries(current_text: str, next_text: str, gap: float) -> bool:
    current_text = normalize_spaces(current_text)
    next_text = normalize_spaces(next_text)

    if not current_text or not next_text:
        return False

    if is_pure_onomatopeia(current_text) or is_pure_onomatopeia(next_text):
        return False

    if gap > MAX_MERGE_GAP_SECONDS:
        return False

    if len(current_text) > 22 or len(next_text) > 22:
        return False

    if (len(current_text) + len(next_text) + 2) > MAX_MERGE_TOTAL_CHARS:
        return False

    next_first = first_word(next_text)
    if next_first in MERGE_BLOCKER_STARTS:
        return False

    # Se a primeira fala termina com ponto final ou reticências, tende a ser ideia fechada.
    # Não juntar.
    if current_text.endswith(".") or current_text.endswith("..."):
        return False

    # Casos bons:
    # - exclamação + frase curta complementar
    # - pergunta + resposta complementar curta
    # Exemplos:
    #   "Que palhaço!" + "Uma piada!"
    #   "E ele?" + "Quem é?"
    if current_text.endswith(("!", "?")):
        return True

    # Se não termina com pontuação forte, também pode ser continuação
    if not current_text.endswith((".", "!", "?", "...")):
        return True

    return False


def try_merge_short_entries(entries: List[Dict], stats: Dict) -> List[Dict]:
    """
    Junta blocos curtos consecutivos de forma conservadora:
    ex. 'Que palhaço!' + 'Uma piada!' -> 'Que palhaço, uma piada!'
    """
    if not entries:
        return entries

    merged = []
    i = 0

    while i < len(entries):
        current = entries[i]
        current_text = normalize_spaces(" ".join(current["text_lines"]))

        if i + 1 >= len(entries):
            merged.append(current)
            break

        nxt = entries[i + 1]
        next_text = normalize_spaces(" ".join(nxt["text_lines"]))

        cur_end = timestamp_to_seconds(current["end"])
        next_start = timestamp_to_seconds(nxt["start"])
        gap = max(0.0, next_start - cur_end)

        if should_merge_entries(current_text, next_text, gap):
            if current_text.endswith(("!", "?", ".")):
                joined_text = f"{current_text[:-1]}, {lower_first_char(next_text)}"
            else:
                joined_text = f"{current_text}, {lower_first_char(next_text)}"

            merged.append(
                {
                    "start": current["start"],
                    "end": nxt["end"],
                    "text_lines": [normalize_spaces(joined_text)],
                }
            )
            stats["merged_blocks"] += 1
            i += 2
            continue

        merged.append(current)
        i += 1

    return merged


def preprocess_entries(entries: List[Dict], stats: Dict) -> List[Dict]:
    filtered = []
    for entry in entries:
        text = normalize_spaces(" ".join(entry["text_lines"]))
        if is_pure_onomatopeia(text):
            stats["onomatopoeias_removed"] += 1
            continue
        filtered.append(entry)

    filtered = collapse_consecutive_duplicates(filtered, stats)
    filtered = try_merge_short_entries(filtered, stats)
    return filtered


def process_entry(entry: Dict, names: List[str], stats: Dict) -> List[Dict]:
    text = normalize_spaces(" ".join(entry["text_lines"]))
    corrected_text = maybe_correct_name_tokens(text, names)
    if corrected_text != text:
        stats["context_name_corrections"] += 1
    text = corrected_text

    start_sec = timestamp_to_seconds(entry["start"])
    end_sec = timestamp_to_seconds(entry["end"])
    duration = max(0.0, end_sec - start_sec)

    lines = break_text_into_lines(text)
    if len(lines) <= 2 and not needs_split(text):
        if lines != entry["text_lines"]:
            stats["line_break_adjustments"] += 1
        return [
            {
                "start": entry["start"],
                "end": entry["end"],
                "text_lines": lines,
            }
        ]

    if duration >= MIN_SPLIT_DURATION * 2:
        left_text, right_text = split_text_for_two_blocks(text)
        if right_text.strip():
            total_len = max(1, len(left_text) + len(right_text))
            left_ratio = len(left_text) / total_len
            split_sec = start_sec + duration * left_ratio

            if split_sec - start_sec < MIN_SPLIT_DURATION:
                split_sec = start_sec + MIN_SPLIT_DURATION
            if end_sec - split_sec < MIN_SPLIT_DURATION:
                split_sec = end_sec - MIN_SPLIT_DURATION

            left_lines = break_text_into_lines(left_text)[:2]
            right_lines = break_text_into_lines(right_text)[:2]

            stats["split_blocks"] += 1

            return [
                {
                    "start": seconds_to_timestamp(start_sec),
                    "end": seconds_to_timestamp(split_sec),
                    "text_lines": left_lines,
                },
                {
                    "start": seconds_to_timestamp(split_sec),
                    "end": seconds_to_timestamp(end_sec),
                    "text_lines": right_lines,
                },
            ]

    all_text = normalize_spaces(text)
    words = all_text.split()
    idx = choose_break_index(words)
    forced_lines = [" ".join(words[:idx]), " ".join(words[idx:])]
    stats["line_break_adjustments"] += 1
    return [
        {
            "start": entry["start"],
            "end": entry["end"],
            "text_lines": forced_lines[:2],
        }
    ]


def write_log(log_path: Path, input_name: str, stats: Dict) -> None:
    lines = [
        f"Arquivo: {input_name}",
        f"Onomatopeias removidas: {stats['onomatopoeias_removed']}",
        f"Grupos de repeticao colapsados: {stats['duplicate_groups_collapsed']}",
        f"Blocos duplicados removidos: {stats['duplicate_blocks_removed']}",
        f"Merges feitos: {stats['merged_blocks']}",
        f"Splits feitos: {stats['split_blocks']}",
        f"Ajustes de quebra de linha: {stats['line_break_adjustments']}",
        f"Correcoes de nome por contexto: {stats['context_name_corrections']}",
    ]
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def process_srt_file(input_path: Path, output_path: Path, names: List[str]) -> Dict:
    stats = {
        "onomatopoeias_removed": 0,
        "duplicate_groups_collapsed": 0,
        "duplicate_blocks_removed": 0,
        "merged_blocks": 0,
        "split_blocks": 0,
        "line_break_adjustments": 0,
        "context_name_corrections": 0,
    }

    content = input_path.read_text(encoding="utf-8")
    entries = parse_srt(content)
    entries = preprocess_entries(entries, stats)

    new_entries = []
    for entry in entries:
        processed_blocks = process_entry(entry, names, stats)
        new_entries.extend(processed_blocks)

    output_path.write_text(format_srt(new_entries), encoding="utf-8")

    log_path = LOG_DIR / f"{input_path.stem}.log"
    write_log(log_path, input_path.name, stats)

    return stats


def main():
    if not INPUT_DIR.exists():
        raise FileNotFoundError(f"Pasta de entrada nao encontrada: {INPUT_DIR}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    print("Etapa 1: rodando clean_names.py")
    run_preprocess()

    print("Etapa 2: carregando personagens.md")
    names = load_names(NAMES_FILE)

    srt_files = sorted(INPUT_DIR.glob("*.srt"))
    if not srt_files:
        print(f"Nenhum .srt encontrado em {INPUT_DIR}")
        return

    print(f"Etapa 3: processando {len(srt_files)} arquivo(s)")
    for srt_file in srt_files:
        output_file = OUTPUT_DIR / srt_file.name
        stats = process_srt_file(srt_file, output_file, names)
        print(f"OK: {srt_file.name} -> {output_file}")
        print(
            f"   removidos={stats['onomatopoeias_removed']} "
            f"merges={stats['merged_blocks']} "
            f"splits={stats['split_blocks']} "
            f"quebras={stats['line_break_adjustments']}"
        )

    print("Concluido.")


if __name__ == "__main__":
    main()