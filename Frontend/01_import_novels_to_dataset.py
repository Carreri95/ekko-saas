import re
import shutil
from pathlib import Path
from collections import defaultdict

IMPORTS_DIR = Path(r"C:\SubtitleBot\imports")
DATASET_DIR = Path(r"C:\SubtitleBot\dataset\novels")

AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".m4a", ".aac", ".ogg"}

OVERWRITE = False
MOVE_FILES = False


def normalize_text(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[^a-z0-9_]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text


def extract_episode_number(text: str):
    text = text.lower()

    patterns = [
        r"(?:episode|ep|episodio|episódio|capitulo|capítulo|cap)[\s_\-]*0*(\d+)",
        r"\b0*(\d+)\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return int(match.group(1))

    return None


def is_audio_file(path: Path) -> bool:
    return path.suffix.lower() in AUDIO_EXTENSIONS


def is_buzz_raw_srt(path: Path) -> bool:
    return path.suffix.lower() == ".srt" and "transcribed on" in path.name.lower()


def is_srt_file(path: Path) -> bool:
    return path.suffix.lower() == ".srt"


def choose_best_final_srt(candidates):
    if not candidates:
        return None

    priority_keywords = ["final", "limpo", "clean"]

    scored = []
    for path in candidates:
        name = path.name.lower()
        score = 0
        for kw in priority_keywords:
            if kw in name:
                score += 1
        scored.append((score, path))

    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]


def copy_or_move(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)

    if dst.exists():
        if not OVERWRITE:
            print(f"[SKIP] Já existe: {dst}")
            return
        dst.unlink()

    if MOVE_FILES:
        shutil.move(str(src), str(dst))
    else:
        shutil.copy2(src, dst)


def process_novel_folder(novel_folder: Path):
    novel_id = normalize_text(novel_folder.name)
    print(f"\n==============================")
    print(f"Processando novela: {novel_folder.name} -> {novel_id}")

    all_files = [p for p in novel_folder.rglob("*") if p.is_file()]

    if not all_files:
        print("[SKIP] Pasta vazia.")
        return

    episodes = defaultdict(lambda: {
        "audio": [],
        "raw_srt": [],
        "final_srt": [],
        "unknown": []
    })

    unknown_global = []

    for file_path in all_files:
        episode_number = extract_episode_number(file_path.name)

        if episode_number is None:
            unknown_global.append(file_path)
            continue

        if is_audio_file(file_path):
            episodes[episode_number]["audio"].append(file_path)
        elif is_buzz_raw_srt(file_path):
            episodes[episode_number]["raw_srt"].append(file_path)
        elif is_srt_file(file_path):
            episodes[episode_number]["final_srt"].append(file_path)
        else:
            episodes[episode_number]["unknown"].append(file_path)

    if not episodes:
        print("[ERRO] Nenhum episódio identificado.")
        if unknown_global:
            print("Arquivos sem número de episódio:")
            for p in unknown_global:
                print(f" - {p}")
        return

    success_count = 0
    error_count = 0

    for episode_number in sorted(episodes.keys()):
        episode_data = episodes[episode_number]

        audio_candidates = episode_data["audio"]
        raw_candidates = episode_data["raw_srt"]
        final_candidates = episode_data["final_srt"]

        episode_id = f"episode_{episode_number:04d}"
        dest_dir = DATASET_DIR / novel_id / episode_id

        audio_file = audio_candidates[0] if len(audio_candidates) == 1 else None
        raw_file = raw_candidates[0] if len(raw_candidates) == 1 else None
        final_file = choose_best_final_srt(final_candidates) if final_candidates else None

        errors = []

        if len(audio_candidates) == 0:
            errors.append("áudio não encontrado")
        elif len(audio_candidates) > 1:
            errors.append(f"múltiplos áudios ({len(audio_candidates)})")

        if len(raw_candidates) == 0:
            errors.append("Bruto do Buzz não encontrado")
        elif len(raw_candidates) > 1:
            errors.append(f"múltiplos Brutos do Buzz ({len(raw_candidates)})")

        if len(final_candidates) == 0:
            errors.append("Final.srt não encontrado")

        if errors:
            error_count += 1
            print(f"[ERRO] {novel_id}/{episode_id}: " + "; ".join(errors))

            if audio_candidates:
                print("   Áudios:")
                for p in audio_candidates:
                    print(f"      - {p}")

            if raw_candidates:
                print("   Brutos:")
                for p in raw_candidates:
                    print(f"      - {p}")

            if final_candidates:
                print("   Finais:")
                for p in final_candidates:
                    print(f"      - {p}")

            continue

        audio_dest = dest_dir / f"audio{audio_file.suffix.lower()}"
        raw_dest = dest_dir / "Bruto.srt"
        final_dest = dest_dir / "Final.srt"

        copy_or_move(audio_file, audio_dest)
        copy_or_move(raw_file, raw_dest)
        copy_or_move(final_file, final_dest)

        success_count += 1
        print(f"[OK] {novel_id}/{episode_id}")

    print("\nResumo:")
    print(f" - Episódios importados: {success_count}")
    print(f" - Episódios com erro: {error_count}")
    print(f" - Arquivos sem número identificado: {len(unknown_global)}")

    if unknown_global:
        print("Arquivos ignorados:")
        for p in unknown_global:
            print(f" - {p}")


def main():
    if not IMPORTS_DIR.exists():
        raise FileNotFoundError(f"Pasta de imports não encontrada: {IMPORTS_DIR}")

    DATASET_DIR.mkdir(parents=True, exist_ok=True)

    novel_folders = [p for p in IMPORTS_DIR.iterdir() if p.is_dir()]
    if not novel_folders:
        print("Nenhuma novela encontrada em imports.")
        return

    for novel_folder in sorted(novel_folders):
        process_novel_folder(novel_folder)

    print("\nConcluído.")


if __name__ == "__main__":
    main()