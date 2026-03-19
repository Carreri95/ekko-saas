import csv
import json
import re
import wave
from pathlib import Path
from typing import Optional

DATASET_DIR = Path(r"C:\SubtitleBot\dataset")
NOVELS_DIR = DATASET_DIR / "novels"
MANIFEST_PATH = DATASET_DIR / "manifest.csv"

DEFAULT_CONFIG = {
    "language": "pt-BR",
    "raw_generated_later": True,
    "raw_generator": "Buzz",
    "asr_backend": "OpenAI Whisper API",
    "asr_task": "transcribe",
    "asr_language": "Portuguese",
    "word_level_timings": False,
    "extract_speech": False,
    "export_format": "srt",
    "temperature": 0.0,
    "initial_prompt": "",
    "ai_translation_enabled": False,
    "ai_translation_model": "",
    "ai_translation_instructions": "",
    "has_manual_text_cleanup": True,
    "has_manual_timing_adjustment": True,
    "style": "vertical_shortform",
    "notes": ""
}


def normalize_name(name: str) -> str:
    return re.sub(r"[\W_]+", "", name.lower())


def find_audio_file(folder: Path) -> Optional[Path]:
    patterns = ["audio.wav", "*.wav", "*.mp3", "*.m4a", "*.flac", "*.aac", "*.ogg"]
    for pattern in patterns:
        matches = sorted(folder.glob(pattern))
        if matches:
            return matches[0]
    return None


def score_srt_file(file_path: Path) -> dict:
    name = normalize_name(file_path.stem)

    bruto_score = 0
    final_score = 0

    if "transcribedon" in name:
        bruto_score += 20
    if "bruto" in name:
        bruto_score += 10
    if "raw" in name:
        bruto_score += 8
    if "buzz" in name:
        bruto_score += 4
    if "output" in name:
        bruto_score += 3

    if "final" in name:
        final_score += 10
    if "limpo" in name:
        final_score += 8
    if "clean" in name:
        final_score += 8
    if "corrigido" in name:
        final_score += 8
    if "revisado" in name:
        final_score += 7
    if "ready" in name:
        final_score += 5

    return {
        "path": file_path,
        "bruto_score": bruto_score,
        "final_score": final_score,
    }


def find_srt_files(folder: Path) -> tuple[Optional[Path], Optional[Path]]:
    srt_files = sorted(folder.glob("*.srt"))

    if not srt_files:
        return None, None

    # padrão ideal do dataset já importado
    bruto_named = folder / "Bruto.srt"
    final_named = folder / "Final.srt"
    if bruto_named.exists() and final_named.exists():
        return bruto_named, final_named

    if len(srt_files) == 1:
        return srt_files[0], None

    scored = [score_srt_file(f) for f in srt_files]

    bruto_candidate = max(scored, key=lambda x: x["bruto_score"])
    final_candidate = max(scored, key=lambda x: x["final_score"])

    bruto = bruto_candidate["path"]
    final = final_candidate["path"]

    if bruto == final:
        remaining = [f for f in srt_files if f != bruto]
        if remaining:
            final = remaining[0]
        else:
            final = None

    if bruto_candidate["bruto_score"] == 0 and final_candidate["final_score"] == 0:
        bruto = srt_files[0]
        final = srt_files[1] if len(srt_files) > 1 else None

    return bruto, final


def parse_srt_entries(content: str) -> list[dict]:
    blocks = re.split(r"\n\s*\n", content.strip(), flags=re.MULTILINE)
    entries = []

    for block in blocks:
        lines = [line.rstrip("\r") for line in block.splitlines() if line.strip()]
        if len(lines) < 3:
            continue

        index_line = lines[0].strip()
        time_line = lines[1].strip()
        text_lines = lines[2:]

        if "-->" not in time_line:
            continue

        try:
            int(index_line)
        except ValueError:
            continue

        start_str, end_str = [x.strip() for x in time_line.split("-->")]
        entries.append({
            "start": start_str,
            "end": end_str,
            "text_lines": text_lines,
        })

    return entries


def timestamp_to_seconds(ts: str) -> float:
    hh, mm, rest = ts.split(":")
    ss, ms = rest.split(",")
    return int(hh) * 3600 + int(mm) * 60 + int(ss) + int(ms) / 1000.0


def get_srt_stats(srt_path: Optional[Path]) -> dict:
    if not srt_path or not srt_path.exists():
        return {
            "exists": False,
            "blocks": 0,
            "first_start": None,
            "last_end": None,
            "timeline_duration_sec": 0.0,
            "text_char_count": 0,
            "text_line_count": 0,
        }

    content = srt_path.read_text(encoding="utf-8", errors="replace")
    entries = parse_srt_entries(content)

    if not entries:
        return {
            "exists": True,
            "blocks": 0,
            "first_start": None,
            "last_end": None,
            "timeline_duration_sec": 0.0,
            "text_char_count": 0,
            "text_line_count": 0,
        }

    first_start = entries[0]["start"]
    last_end = entries[-1]["end"]
    text_lines = []
    for entry in entries:
        text_lines.extend(entry["text_lines"])

    text_char_count = len("\n".join(text_lines))
    text_line_count = len(text_lines)

    return {
        "exists": True,
        "blocks": len(entries),
        "first_start": first_start,
        "last_end": last_end,
        "timeline_duration_sec": round(
            max(0.0, timestamp_to_seconds(last_end) - timestamp_to_seconds(first_start)),
            3
        ),
        "text_char_count": text_char_count,
        "text_line_count": text_line_count,
    }


def get_wav_duration_seconds(audio_path: Optional[Path]) -> Optional[float]:
    if not audio_path or not audio_path.exists():
        return None

    if audio_path.suffix.lower() != ".wav":
        return None

    try:
        with wave.open(str(audio_path), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate <= 0:
                return None
            return round(frames / float(rate), 3)
    except Exception:
        return None


def build_status(audio_path: Optional[Path], bruto_path: Optional[Path], final_path: Optional[Path]) -> tuple[str, list[str]]:
    missing = []

    if not audio_path:
        missing.append("audio")
    if not bruto_path:
        missing.append("bruto_srt")
    if not final_path:
        missing.append("final_srt")

    if not missing:
        return "complete", []

    if len(missing) == 3:
        return "empty", missing

    return "incomplete", missing


def build_meta(novel_id: str, folder: Path) -> dict:
    audio_path = find_audio_file(folder)
    bruto_path, final_path = find_srt_files(folder)

    audio_duration_sec = get_wav_duration_seconds(audio_path)
    bruto_stats = get_srt_stats(bruto_path)
    final_stats = get_srt_stats(final_path)
    status, missing_files = build_status(audio_path, bruto_path, final_path)

    meta = {
        "id": folder.name,
        "title": folder.name,
        "novel_id": novel_id,
        "global_id": f"{novel_id}__{folder.name}",
        "paths": {
            "audio_filename": audio_path.name if audio_path else None,
            "raw_srt_filename": bruto_path.name if bruto_path else None,
            "final_srt_filename": final_path.name if final_path else None,
        },
        "status": status,
        "missing_files": missing_files,
        "audio": {
            "exists": bool(audio_path),
            "filename": audio_path.name if audio_path else None,
            "extension": audio_path.suffix.lower() if audio_path else None,
            "duration_sec": audio_duration_sec,
        },
        "raw_srt": {
            "filename": bruto_path.name if bruto_path else None,
            **bruto_stats,
        },
        "final_srt": {
            "filename": final_path.name if final_path else None,
            **final_stats,
        },
        "pipeline": DEFAULT_CONFIG.copy(),
    }

    return meta


def write_meta_json(folder: Path, meta: dict) -> None:
    meta_path = folder / "meta.json"
    meta_path.write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def build_manifest_row(folder: Path, meta: dict) -> dict:
    return {
        "global_id": meta["global_id"],
        "novel_id": meta["novel_id"],
        "episode_id": meta["id"],
        "title": meta["title"],
        "episode_folder": str(folder),
        "status": meta["status"],
        "missing_files": "|".join(meta["missing_files"]),
        "audio_filename": meta["paths"]["audio_filename"] or "",
        "raw_srt_filename": meta["paths"]["raw_srt_filename"] or "",
        "final_srt_filename": meta["paths"]["final_srt_filename"] or "",
        "audio_exists": meta["audio"]["exists"],
        "audio_extension": meta["audio"]["extension"] or "",
        "audio_duration_sec": meta["audio"]["duration_sec"] if meta["audio"]["duration_sec"] is not None else "",
        "raw_srt_exists": meta["raw_srt"]["exists"],
        "raw_srt_blocks": meta["raw_srt"]["blocks"],
        "raw_srt_first_start": meta["raw_srt"]["first_start"] or "",
        "raw_srt_last_end": meta["raw_srt"]["last_end"] or "",
        "raw_srt_timeline_duration_sec": meta["raw_srt"]["timeline_duration_sec"],
        "raw_srt_text_char_count": meta["raw_srt"]["text_char_count"],
        "raw_srt_text_line_count": meta["raw_srt"]["text_line_count"],
        "final_srt_exists": meta["final_srt"]["exists"],
        "final_srt_blocks": meta["final_srt"]["blocks"],
        "final_srt_first_start": meta["final_srt"]["first_start"] or "",
        "final_srt_last_end": meta["final_srt"]["last_end"] or "",
        "final_srt_timeline_duration_sec": meta["final_srt"]["timeline_duration_sec"],
        "final_srt_text_char_count": meta["final_srt"]["text_char_count"],
        "final_srt_text_line_count": meta["final_srt"]["text_line_count"],
        "language": meta["pipeline"]["language"],
        "raw_generated_later": meta["pipeline"]["raw_generated_later"],
        "raw_generator": meta["pipeline"]["raw_generator"],
        "asr_backend": meta["pipeline"]["asr_backend"],
        "asr_task": meta["pipeline"]["asr_task"],
        "asr_language": meta["pipeline"]["asr_language"],
        "word_level_timings": meta["pipeline"]["word_level_timings"],
        "extract_speech": meta["pipeline"]["extract_speech"],
        "export_format": meta["pipeline"]["export_format"],
        "temperature": meta["pipeline"]["temperature"],
        "initial_prompt": meta["pipeline"]["initial_prompt"],
        "ai_translation_enabled": meta["pipeline"]["ai_translation_enabled"],
        "ai_translation_model": meta["pipeline"]["ai_translation_model"],
        "ai_translation_instructions": meta["pipeline"]["ai_translation_instructions"],
        "has_manual_text_cleanup": meta["pipeline"]["has_manual_text_cleanup"],
        "has_manual_timing_adjustment": meta["pipeline"]["has_manual_timing_adjustment"],
        "style": meta["pipeline"]["style"],
        "notes": meta["pipeline"]["notes"],
    }


def write_manifest(rows: list[dict]) -> None:
    if not rows:
        print("Nenhum episódio encontrado.")
        return

    fieldnames = list(rows[0].keys())

    with MANIFEST_PATH.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def iter_episode_folders():
    if not NOVELS_DIR.exists():
        raise FileNotFoundError(f"Pasta não encontrada: {NOVELS_DIR}")

    for novel_dir in sorted([p for p in NOVELS_DIR.iterdir() if p.is_dir()]):
        novel_id = novel_dir.name
        for episode_dir in sorted([p for p in novel_dir.iterdir() if p.is_dir()]):
            yield novel_id, episode_dir


def main():
    rows = []
    episode_items = list(iter_episode_folders())

    if not episode_items:
        print("Nenhuma pasta de episódio encontrada dentro de dataset\\novels.")
        return

    print(f"Encontrados {len(episode_items)} episódio(s).")

    for novel_id, folder in episode_items:
        meta = build_meta(novel_id, folder)
        write_meta_json(folder, meta)
        row = build_manifest_row(folder, meta)
        rows.append(row)

        print(
            f"OK: {novel_id}/{folder.name} | "
            f"status={meta['status']} | "
            f"audio={meta['paths']['audio_filename']} | "
            f"bruto={meta['paths']['raw_srt_filename']} | "
            f"final={meta['paths']['final_srt_filename']}"
        )

    write_manifest(rows)
    print(f"\nManifest gerado em: {MANIFEST_PATH}")
    print("Concluído.")


if __name__ == "__main__":
    main()