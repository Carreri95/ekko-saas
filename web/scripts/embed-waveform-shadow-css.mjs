import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, "../app/subtitle-file-edit/waveform-cue-shadow.css");
const outPath = path.join(__dirname, "../app/subtitle-file-edit/waveformCueShadowStyles.ts");

const c = fs.readFileSync(cssPath, "utf8");
const esc = c.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const ts = `const STYLE_ID = "subtitlebot-waveform-cue-shadow-styles";

export const WAVEFORM_CUE_SHADOW_CSS = \`${esc}\`;

export function injectWaveformCueShadowStyles(root: Node): void {
  if (!(root instanceof ShadowRoot)) return;
  if (root.querySelector("#" + STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = WAVEFORM_CUE_SHADOW_CSS;
  root.insertBefore(el, root.firstChild);
}
`;

fs.writeFileSync(outPath, ts, "utf8");
console.log("wrote", outPath);
