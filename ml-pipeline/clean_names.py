import os
import re

PATH_OUTPUT = r'C:\SubtitleBot\Output'
PATH_NAMES = r'C:\SubtitleBot\personagens.md'

def load_names(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f.readlines() if line.strip()]

def clean_srts_in_place():
    names = load_names(PATH_NAMES)
    srt_files = [f for f in os.listdir(PATH_OUTPUT) if f.endswith('.srt')]

    if not srt_files:
        print(f"Nenhum arquivo .srt encontrado em {PATH_OUTPUT}")
        return

    total_changes_all_files = 0

    for file_name in srt_files:
        file_path = os.path.join(PATH_OUTPUT, file_name)

        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        content = original_content
        changes_in_this_file = 0

        for name in names:
            parts = name.split()

            if len(parts) >= 2:
                first_name = re.escape(parts[0])
                second_name = re.escape(parts[1])
                correct_name = name

                # evita trocar "Harry Frost" por "Harry Frost Frost"
                pattern = re.compile(
                    rf'\b{first_name}\s+(?!{second_name}\b)[A-ZÀ-ÿa-zà-ÿ]+\b',
                    re.IGNORECASE
                )

                new_content, count = pattern.subn(correct_name, content)

                if new_content != content:
                    changes_in_this_file += count
                    content = new_content
            else:
                pattern = re.compile(rf'\b{re.escape(name)}\b', re.IGNORECASE)
                new_content, count = pattern.subn(name, content)

                if new_content != content:
                    changes_in_this_file += count
                    content = new_content

        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"{file_name}: {changes_in_this_file} alteracoes aplicadas.")
            total_changes_all_files += changes_in_this_file
        else:
            print(f"{file_name}: nenhuma alteracao necessaria.")

    print(f"Finalizado. Total de {total_changes_all_files} correcoes nominais feitas.")

if __name__ == "__main__":
    clean_srts_in_place()