export function inferProjectNameFromFiles(files: File[]): string {
  const firstPath =
    files[0] && "webkitRelativePath" in files[0]
      ? String((files[0] as File & { webkitRelativePath?: string }).webkitRelativePath ?? "")
      : "";
  const topDir = firstPath.split("/")[0]?.trim();
  if (topDir) return topDir;
  return `Projeto local ${new Date().toISOString().slice(0, 10)}`;
}
