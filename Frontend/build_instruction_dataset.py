import json
from pathlib import Path

DATASET_DIR = Path(r"C:\SubtitleBot\dataset")

INPUT_JSONL = DATASET_DIR / "train_core_v1.jsonl"
OUTPUT_JSONL = DATASET_DIR / "train_core_instructions_v1.jsonl"

SYSTEM_PROMPT = """Você é um especialista em reconciliação de legendas.
Sua tarefa é comparar uma legenda bruta gerada automaticamente com a legenda final aprovada pelo cliente.

Objetivos:
1. Identificar a operação correta entre bruto e final.
2. Preservar falas legítimas.
3. Corrigir apenas o necessário.
4. Entender quando houve apenas ajuste de tempo, divisão, fusão, resegmentação ou reescrita.
5. Não inventar texto novo sem evidência no exemplo final.
6. Não apagar conteúdo válido sem motivo.

Responda sempre em JSON válido com as chaves:
- operation
- final_text
- timing_action
- notes
"""

VALID_OPERATIONS = {
    "keep",
    "retime",
    "split",
    "merge",
    "resegment",
    "delete_noise",
    "delete_text",
    "insert",
    "rewrite_minor",
    "rewrite_major",
    "split_rewrite",
    "merge_rewrite",
    "resegment_rewrite",
}


def load_jsonl(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def save_jsonl(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def safe_str(value):
    if value is None:
        return ""
    return str(value)


def build_timing_action(record: dict) -> str:
    op = record.get("operation", "")
    start_shift = record.get("timing_shift_start_sec")
    end_shift = record.get("timing_shift_end_sec")

    if op == "retime":
        return "adjust_timing_only"
    if op in {"split", "split_rewrite"}:
        return "split_timing"
    if op in {"merge", "merge_rewrite"}:
        return "merge_timing"
    if op in {"resegment", "resegment_rewrite"}:
        return "resegment_timing"
    if op in {"keep", "rewrite_minor", "rewrite_major"}:
        if start_shift or end_shift:
            return "text_or_structure_with_possible_timing_change"
        return "keep_or_text_change_without_relevant_timing_change"
    if op == "insert":
        return "create_new_subtitle_timing"
    if op in {"delete_text", "delete_noise"}:
        return "remove_subtitle_timing"
    return "unknown"


def build_notes(record: dict) -> str:
    notes = []

    raw_count = record.get("raw_block_count")
    final_count = record.get("final_block_count")
    sim = record.get("similarity")

    if raw_count is not None and final_count is not None:
        notes.append(f"raw_blocks={raw_count}")
        notes.append(f"final_blocks={final_count}")

    if sim is not None:
        notes.append(f"similarity={sim}")

    raw_indices = record.get("raw_indices")
    final_indices = record.get("final_indices")

    if raw_indices:
        notes.append(f"raw_indices={raw_indices}")
    if final_indices:
        notes.append(f"final_indices={final_indices}")

    return "; ".join(notes)


def build_user_prompt(record: dict) -> str:
    global_id = safe_str(record.get("global_id"))
    novel_id = safe_str(record.get("novel_id"))
    episode_id = safe_str(record.get("episode_id"))

    raw_text = safe_str(record.get("raw_text")).strip()
    final_text = safe_str(record.get("final_text")).strip()

    raw_block_count = record.get("raw_block_count")
    final_block_count = record.get("final_block_count")
    similarity = record.get("similarity")
    start_shift = record.get("timing_shift_start_sec")
    end_shift = record.get("timing_shift_end_sec")
    raw_indices = record.get("raw_indices")
    final_indices = record.get("final_indices")

    prompt = f"""Analise o par de legendas abaixo e produza a transformação correta.

Contexto:
- global_id: {global_id}
- novel_id: {novel_id}
- episode_id: {episode_id}
- raw_block_count: {raw_block_count}
- final_block_count: {final_block_count}
- similarity: {similarity}
- timing_shift_start_sec: {start_shift}
- timing_shift_end_sec: {end_shift}
- raw_indices: {raw_indices}
- final_indices: {final_indices}

Legenda bruta:
{raw_text if raw_text else "[vazio]"}

Legenda final aprovada:
{final_text if final_text else "[vazio]"}

Retorne apenas JSON válido.
"""
    return prompt


def build_assistant_output(record: dict) -> dict:
    operation = safe_str(record.get("operation")).strip()
    final_text = safe_str(record.get("final_text")).strip()

    if operation not in VALID_OPERATIONS:
        raise ValueError(f"Operação inválida encontrada: {operation}")

    return {
        "operation": operation,
        "final_text": final_text,
        "timing_action": build_timing_action(record),
        "notes": build_notes(record),
    }


def convert_record(record: dict) -> dict:
    user_prompt = build_user_prompt(record)
    assistant_output = build_assistant_output(record)

    return {
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": user_prompt
            },
            {
                "role": "assistant",
                "content": json.dumps(assistant_output, ensure_ascii=False)
            }
        ],
        "metadata": {
            "global_id": record.get("global_id"),
            "novel_id": record.get("novel_id"),
            "episode_id": record.get("episode_id"),
            "operation": record.get("operation"),
        }
    }


def main():
    if not INPUT_JSONL.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {INPUT_JSONL}")

    records = load_jsonl(INPUT_JSONL)
    if not records:
        print("Nenhum registro encontrado.")
        return

    converted = []
    op_counts = {}

    for record in records:
        item = convert_record(record)
        converted.append(item)

        op = record.get("operation", "unknown")
        op_counts[op] = op_counts.get(op, 0) + 1

    save_jsonl(OUTPUT_JSONL, converted)

    print(f"Entrada: {INPUT_JSONL}")
    print(f"Saída:   {OUTPUT_JSONL}")
    print(f"Total convertido: {len(converted)}")
    print("")
    print("Distribuição por operação:")
    for op, count in sorted(op_counts.items()):
        print(f"  {op}: {count}")


if __name__ == "__main__":
    main()