import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import ffmpegStatic from "ffmpeg-static";

const execFileAsync = promisify(execFile);

const FFMPEG_EXE = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

/** Limite rígido da API OpenAI `audio/transcriptions`. */
export const OPENAI_WHISPER_MAX_BYTES = 25 * 1024 * 1024;

/** Margem por segmento para não encostar ao limite. */
const SAFE_CHUNK_BYTES = 24 * 1024 * 1024;

/** Mono 16 kHz, voz — ficheiros WAV de estúdio reduzem bastante. */
const SPEECH_MP3_BITRATE_K = 64;

export type WhisperAudioPart = {
  buffer: Buffer;
  fileName: string;
  /** Segundos a somar aos timestamps dos segmentos (partes seguintes). */
  timeOffsetSec: number;
};

/**
 * O import de `ffmpeg-static` pode devolver um caminho virtual (`\\ROOT\\...`)
 * que não existe no disco — tentamos primeiro caminhos reais sob `node_modules`.
 */
function ffmpegPath(): string {
  const fromEnv = process.env.FFMPEG_BIN?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }

  const candidates: string[] = [
    join(process.cwd(), "node_modules", "ffmpeg-static", FFMPEG_EXE),
    join(process.cwd(), "..", "web", "node_modules", "ffmpeg-static", FFMPEG_EXE),
    join(process.cwd(), "..", "..", "node_modules", "ffmpeg-static", FFMPEG_EXE),
    join(process.cwd(), "web", "node_modules", "ffmpeg-static", FFMPEG_EXE),
  ];
  const ffmpegBin = ffmpegStatic as unknown as string | null | undefined;
  const fromPkg = ffmpegBin && ffmpegBin.trim() !== "" ? ffmpegBin.trim() : "";
  if (fromPkg) {
    candidates.push(fromPkg);
  }

  for (const c of candidates) {
    if (existsSync(c)) {
      return c;
    }
  }

  throw new Error(
    "ffmpeg não encontrado. Corra `npm install` em `apps/worker` (ou `apps/web`), ou instale o ffmpeg no sistema e defina FFMPEG_BIN com o caminho completo do executável.",
  );
}

function parseDurationFromFfmpegStderr(stderr: string): number {
  const m = /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/.exec(stderr);
  if (!m) {
    throw new Error("Não foi possível ler a duração do áudio (ffmpeg).");
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = Number(m[3]);
  const cs = Number(m[4]);
  return h * 3600 + min * 60 + s + cs / 100;
}

async function mediaDurationSec(ffmpeg: string, inputPath: string): Promise<number> {
  const { stderr } = await execFileAsync(ffmpeg, ["-hide_banner", "-i", inputPath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return parseDurationFromFfmpegStderr(stderr);
}

/**
 * Prepara um ou mais buffers ≤ 25 MB para a API Whisper:
 * - ficheiros pequenos: envio direto;
 * - WAV/AIFF pesados: transcodificação para MP3 mono 64 kbps (voz);
 * - ainda acima do limite: divisão temporal com remontagem de timestamps no adapter.
 */
export async function buildWhisperAudioParts(
  absolutePath: string,
): Promise<WhisperAudioPart[]> {
  const originalName = basename(absolutePath);
  const raw = await readFile(absolutePath);

  if (raw.length <= OPENAI_WHISPER_MAX_BYTES) {
    return [{ buffer: raw, fileName: originalName, timeOffsetSec: 0 }];
  }

  const ffmpeg = ffmpegPath();
  const tmpDir = await mkdtemp(join(tmpdir(), "subtitlebot-whisper-"));
  const tmpMp3 = join(tmpDir, "prep.mp3");

  try {
    await execFileAsync(
      ffmpeg,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        absolutePath,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "libmp3lame",
        "-b:a",
        `${SPEECH_MP3_BITRATE_K}k`,
        tmpMp3,
      ],
      { maxBuffer: 50 * 1024 * 1024 },
    );

    const mp3Buf = await readFile(tmpMp3);
    const baseName = originalName.replace(/\.[^.]+$/, "") || "audio";
    const mp3Name = `${baseName}.mp3`;

    if (mp3Buf.length <= OPENAI_WHISPER_MAX_BYTES) {
      return [{ buffer: mp3Buf, fileName: mp3Name, timeOffsetSec: 0 }];
    }

    const duration = await mediaDurationSec(ffmpeg, tmpMp3);
    const bytesPerSec = (SPEECH_MP3_BITRATE_K * 1000) / 8;
    const maxChunkSec = Math.max(30, Math.floor((SAFE_CHUNK_BYTES * 0.92) / bytesPerSec));
    const numChunks = Math.max(1, Math.ceil(duration / maxChunkSec));

    const parts: WhisperAudioPart[] = [];
    for (let i = 0; i < numChunks; i++) {
      const start = i * maxChunkSec;
      const dur = Math.min(maxChunkSec, Math.max(0, duration - start));
      if (dur < 0.05) break;

      const segPath = join(tmpDir, `seg_${i}.mp3`);
      await execFileAsync(
        ffmpeg,
        [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          tmpMp3,
          "-ss",
          String(start),
          "-t",
          String(dur),
          "-ac",
          "1",
          "-ar",
          "16000",
          "-c:a",
          "libmp3lame",
          "-b:a",
          `${SPEECH_MP3_BITRATE_K}k`,
          segPath,
        ],
        { maxBuffer: 50 * 1024 * 1024 },
      );

      const b = await readFile(segPath);
      if (b.length > OPENAI_WHISPER_MAX_BYTES) {
        throw new Error(
          "Segmento de áudio excede ainda o limite de 25 MB da API OpenAI. Tente reduzir a duração ou a qualidade na origem.",
        );
      }
      parts.push({
        buffer: b,
        fileName: `part_${i + 1}_${mp3Name}`,
        timeOffsetSec: start,
      });
    }

    if (parts.length === 0) {
      throw new Error("Não foi possível dividir o áudio para transcrição.");
    }

    return parts;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
