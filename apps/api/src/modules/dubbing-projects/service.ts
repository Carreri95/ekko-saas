import AdmZip from "adm-zip";
import { EpisodeStatus } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";
import { getDefaultUserId } from "../../infrastructure/demo-user.js";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DubbingProjectsRepository } from "./repository.js";
import {
  type CharacterCreateData,
  type CharacterPatchData,
  type DubbingProjectCreateData,
  type DubbingProjectPatchData,
  type EpisodePatchData,
} from "./schemas.js";
import { serializeDubbingProject, serializeEpisode, serializeProjectCharacter } from "./mapper.js";
import { CastMembersService } from "../cast-members/service.js";
import { ProjectsService } from "../projects/service.js";
import { TranscriptionJobService } from "../transcription-jobs/transcription-job.service.js";
import { getSubtitleFileSrtExport } from "../subtitle-files/subtitle-file-export.service.js";

const PROJECTS_PAGE_SIZE = 8;

function isWavForEpisodeUpload(params: { mimeType: string; originalFilename: string | null }): boolean {
  const mime = params.mimeType.trim().toLowerCase();
  if (mime === "audio/wav" || mime === "audio/x-wav" || mime === "audio/wave") {
    return true;
  }
  const name = (params.originalFilename ?? "").trim().toLowerCase();
  return name.endsWith(".wav");
}

async function convertWavBufferToPcm16(input: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "subtitlebot-epwav-"));
  const inPath = path.join(dir, "input.wav");
  const outPath = path.join(dir, "output.wav");
  try {
    await writeFile(inPath, input);

    const args = [
      "-y",
      "-nostdin",
      "-i",
      inPath,
      "-acodec",
      "pcm_s16le",
      "-ar",
      "48000",
      outPath,
    ];
    const proc = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    const exitCode = await new Promise<number>((resolve, reject) => {
      proc.on("error", reject);
      proc.on("close", (code) => resolve(code ?? 1));
    });
    if (exitCode !== 0) {
      throw new Error(stderr.trim() || "ffmpeg falhou ao converter WAV");
    }
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function roundMoney2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function normalizeMoneyForStorage(n: number): number {
  return roundMoney2(n);
}

function computeProjectMetrics(
  projects: Array<{
    episodeCount: number | null;
    durationMin: number | null;
    value: string | null;
    valueCurrency: "BRL" | "USD";
    status: string;
    deadline: string | null;
  }>,
) {
  const totalEp = projects.reduce((s, p) => s + (p.episodeCount ?? 0), 0);
  const totalMin = projects.reduce((s, p) => s + (p.durationMin ?? 0), 0);
  const totalVal = projects.reduce((s, p) => s + Number(p.value ?? 0), 0);

  const acc: Partial<Record<"BRL" | "USD", number>> = {};
  for (const p of projects) {
    const v = Number(p.value ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    const c = p.valueCurrency ?? "BRL";
    acc[c] = (acc[c] ?? 0) + v;
  }
  const currencyTotals = (Object.entries(acc) as ["BRL" | "USD", number][])
    .map(([currency, total]) => ({
      currency,
      symbol: currency === "BRL" ? "R$" : "$",
      total: roundMoney2(total),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const active = projects.filter((p) => p.status !== "PAUSED" && p.status !== "DONE").length;
  const paused = projects.filter((p) => p.status === "PAUSED").length;
  const late = projects.filter((p) => (p.deadline ? new Date(p.deadline).getTime() < Date.now() : false)).length;

  return {
    totalEp,
    totalMin,
    totalVal,
    currencyTotals,
    active,
    paused,
    late,
    projectCount: projects.length,
  };
}

export class DubbingProjectsService {
  constructor(
    private readonly repo = new DubbingProjectsRepository(),
    private readonly castService = new CastMembersService(),
  ) {}

  async list(params: { status?: string | null; q?: string | null; page?: string | null }) {
    const status = params.status ?? null;
    const q = params.q ?? null;
    const pageRaw = params.page ?? null;
    const pageRequested = Math.max(1, Math.floor(Number(pageRaw) || 1) || 1);

    const where = {
      ...(status ? { status } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { name: { contains: q.trim(), mode: "insensitive" as const } },
              { client: { contains: q.trim(), mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const total = await this.repo.count(where);
    const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
    const page = Math.min(pageRequested, totalPages);
    const skip = (page - 1) * PROJECTS_PAGE_SIZE;

    const [pageRows, metricRows] = await Promise.all([
      this.repo.findMany(where, { skip, take: PROJECTS_PAGE_SIZE }),
      this.repo.findMetricsRows(where),
    ]);

    const metrics = computeProjectMetrics(
      metricRows.map((r) => ({
        episodeCount: r.episodeCount,
        durationMin: r.durationMin,
        value: r.value != null ? r.value.toString() : null,
        valueCurrency: r.valueCurrency,
        status: r.status,
        deadline: r.deadline?.toISOString() ?? null,
      })),
    );

    return {
      projects: pageRows.map(serializeDubbingProject),
      total,
      page,
      pageSize: PROJECTS_PAGE_SIZE,
      metrics,
    };
  }

  async create(input: DubbingProjectCreateData, rawUserId?: unknown) {
    const startDate = new Date(input.startDate);
    const deadline = new Date(input.deadline);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(deadline.getTime())) {
      return { badRequest: { error: "Datas inválidas" } };
    }

    const created = await this.repo.createProjectWithEpisodes(
      {
      name: input.name,
      client: input.client,
      clientId: input.clientId ?? null,
      status: "SPOTTING",
      startDate,
      deadline,
      episodeCount: Math.floor(input.episodes),
      durationMin: Math.floor(input.durationMin),
      language: input.language.trim() ? input.language.trim() : null,
      value: normalizeMoneyForStorage(Number(input.value)),
      valueCurrency: input.valueCurrency ?? "BRL",
      paymentType: input.paymentType ?? "PER_PROJECT",
      notes:
        input.notes !== undefined && input.notes !== null && String(input.notes).trim()
          ? String(input.notes).trim()
          : null,
      userId: typeof rawUserId === "string" && rawUserId.trim() ? rawUserId.trim() : null,
    },
      input.episodes,
    );
    return { project: serializeDubbingProject(created) };
  }

  async getById(id: string) {
    const project = await this.repo.findById(id);
    if (!project) return null;
    return { project: serializeDubbingProject(project) };
  }

  async patch(id: string, input: DubbingProjectPatchData, raw: Record<string, unknown>) {
    const existing = await this.repo.findById(id);
    if (!existing) return { notFound: true as const };

    const startForOrder =
      input.startDate !== undefined
        ? input.startDate === null || input.startDate === ""
          ? null
          : input.startDate
        : existing.startDate
          ? existing.startDate.toISOString().slice(0, 10)
          : null;
    const deadlineForOrder =
      input.deadline !== undefined
        ? input.deadline === null || input.deadline === ""
          ? null
          : input.deadline
        : existing.deadline
          ? existing.deadline.toISOString().slice(0, 10)
          : null;
    if (startForOrder && deadlineForOrder && deadlineForOrder < startForOrder) {
      return { badRequest: { error: "O prazo de entrega não pode ser anterior à data de início" } };
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.client !== undefined) data.client = input.client === "" ? null : input.client;
    if (input.clientId !== undefined) data.clientId = input.clientId;
    if (input.status !== undefined) data.status = input.status;
    if (input.startDate !== undefined) {
      if (input.startDate === null || input.startDate === "") data.startDate = null;
      else {
        const dt = new Date(input.startDate);
        if (Number.isNaN(dt.getTime())) return { badRequest: { error: "startDate inválido" } };
        data.startDate = dt;
      }
    }
    if (input.deadline !== undefined) {
      if (input.deadline === null || input.deadline === "") data.deadline = null;
      else {
        const dt = new Date(input.deadline);
        if (Number.isNaN(dt.getTime())) return { badRequest: { error: "deadline inválido" } };
        data.deadline = dt;
      }
    }
    if (input.episodes !== undefined) data.episodeCount = Math.floor(input.episodes);
    if (input.durationMin !== undefined) data.durationMin = Math.floor(input.durationMin);
    if (input.language !== undefined) data.language = input.language.trim() ? input.language.trim() : null;
    if (input.value !== undefined) data.value = input.value === null ? null : normalizeMoneyForStorage(Number(input.value));
    if (input.valueCurrency !== undefined) data.valueCurrency = input.valueCurrency;
    if (input.paymentType !== undefined) data.paymentType = input.paymentType;
    if (input.notes !== undefined) {
      data.notes =
        input.notes === null || input.notes === "" || !String(input.notes).trim()
          ? null
          : String(input.notes).trim();
    }
    if (raw.userId !== undefined) {
      data.userId = typeof raw.userId === "string" && raw.userId.trim() ? raw.userId.trim() : null;
    }

    if (Object.keys(data).length === 0) {
      return { project: serializeDubbingProject(existing) };
    }

    const statusBefore = existing.status;
    const updated = await this.repo.update(id, data);
    if (input.status !== undefined && input.status !== statusBefore) {
      const rows = await this.repo.findProjectCharacterMemberIds(id);
      const memberIds = [...new Set(rows.map((r) => r.castMemberId).filter((v): v is string => Boolean(v)))];
      if (memberIds.length > 0) {
        await this.castService.syncCastMemberStatus(memberIds);
      }
    }
    return { project: serializeDubbingProject(updated) };
  }

  async remove(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) return { notFound: true as const };
    await this.repo.delete(id);
    return { noContent: true as const };
  }

  async listCharacters(projectId: string) {
    const project = await this.repo.findById(projectId);
    if (!project) return null;
    const characters = await this.repo.findProjectCharacters(projectId);
    return { characters: characters.map(serializeProjectCharacter) };
  }

  async createCharacter(projectId: string, input: CharacterCreateData) {
    const project = await this.repo.findById(projectId);
    if (!project) return { notFound: true as const };
    const created = await this.repo.createProjectCharacter(projectId, {
      name: input.name,
      type: input.type || null,
      voiceType: input.voiceType || null,
      importance: input.importance,
      castMemberId: input.castMemberId ?? null,
      notes: input.notes || null,
    });
    if (input.castMemberId) {
      await this.castService.syncCastMemberStatus([input.castMemberId]);
    }
    return { character: serializeProjectCharacter(created) };
  }

  async patchCharacter(projectId: string, charId: string, input: CharacterPatchData) {
    const existing = await this.repo.findCharacterInProject(projectId, charId);
    if (!existing) return { notFound: true as const };
    const oldMemberId = existing.castMemberId;
    const updated = await this.repo.updateCharacter(charId, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type || null }),
      ...(input.voiceType !== undefined && { voiceType: input.voiceType || null }),
      ...(input.importance !== undefined && { importance: input.importance }),
      ...(input.castMemberId !== undefined && { castMemberId: input.castMemberId }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
    });
    const newMemberId = input.castMemberId !== undefined ? input.castMemberId : existing.castMemberId;
    const affected = [oldMemberId, newMemberId].filter((x): x is string => Boolean(x));
    if (affected.length > 0) {
      await this.castService.syncCastMemberStatus([...new Set(affected)]);
    }
    return { character: serializeProjectCharacter(updated) };
  }

  async listEpisodes(projectId: string) {
    const project = await this.repo.findById(projectId);
    if (!project) return null;
    const rows = await this.repo.findEpisodesByProjectId(projectId);
    return { episodes: rows.map(serializeEpisode) };
  }

  /**
   * Empacota SRTs de episódios DONE (com legenda) num ZIP.
   * Nomes: ep01.srt, ep02.srt, … com padding conforme o total planeado de episódios.
   */
  async exportDoneEpisodesSrtZip(projectId: string): Promise<
    | { notFound: true }
    | { noDoneEpisodes: true }
    | { subtitleReadFailed: { episodeNumber: number } }
    | { ok: { buffer: Buffer; filename: string } }
  > {
    const project = await this.repo.findById(projectId);
    if (!project) return { notFound: true as const };

    const episodeRowCount = await prisma.episode.count({ where: { projectId } });
    const plannedTotal = project.episodeCount ?? episodeRowCount;
    const padWidth = Math.max(2, String(Math.max(plannedTotal, 1)).length);

    const doneEpisodes = await prisma.episode.findMany({
      where: {
        projectId,
        status: EpisodeStatus.DONE,
        subtitleFileId: { not: null },
      },
      orderBy: { number: "asc" },
      select: { number: true, subtitleFileId: true },
    });

    if (doneEpisodes.length === 0) {
      return { noDoneEpisodes: true as const };
    }

    const zip = new AdmZip();
    for (const ep of doneEpisodes) {
      const subtitleFileId = ep.subtitleFileId as string;
      const exp = await getSubtitleFileSrtExport(subtitleFileId);
      if ("notFound" in exp || "badRequest" in exp) {
        return { subtitleReadFailed: { episodeNumber: ep.number } as const };
      }
      const entryName = `ep${String(ep.number).padStart(padWidth, "0")}.srt`;
      zip.addFile(entryName, exp.ok.body);
    }

    const buffer = zip.toBuffer();
    const filename = `projeto-${projectId}-srts.zip`;
    return { ok: { buffer, filename } };
  }

  async patchEpisode(projectId: string, episodeId: string, input: EpisodePatchData) {
    const existing = await this.repo.findEpisodeInProject(projectId, episodeId);
    if (!existing) return { notFound: true as const };
    const parseEditedAt = (raw: string | null) => {
      if (raw === null) return null;
      const dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) return undefined;
      return dt;
    };
    const data: Record<string, unknown> = {};
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === "DONE") {
        if (input.editedAt) {
          const parsed = parseEditedAt(input.editedAt);
          if (parsed === undefined) return { badRequest: { error: "editedAt inválido" } };
          data.editedAt = parsed;
        } else {
          data.editedAt = new Date();
        }
      }
      if (input.status !== "DONE" && input.editedAt !== undefined) {
        const parsed = parseEditedAt(input.editedAt);
        if (parsed === undefined) return { badRequest: { error: "editedAt inválido" } };
        data.editedAt = parsed;
      }
    } else if (input.editedAt !== undefined) {
      const parsed = parseEditedAt(input.editedAt);
      if (parsed === undefined) return { badRequest: { error: "editedAt inválido" } };
      data.editedAt = parsed;
    }
    if (input.title !== undefined) data.title = input.title;
    if (input.subtitleFileId !== undefined) data.subtitleFileId = input.subtitleFileId;
    if (input.audioFileId !== undefined) data.audioFileId = input.audioFileId;
    if (Object.keys(data).length === 0) {
      return { episode: serializeEpisode(existing) };
    }
    const updated = await this.repo.updateEpisode(episodeId, data);
    return { episode: serializeEpisode(updated) };
  }

  async deleteCharacter(projectId: string, charId: string) {
    const existing = await this.repo.findCharacterInProject(projectId, charId);
    if (!existing) return { notFound: true as const };
    const castMemberId = existing.castMemberId;
    await this.repo.deleteCharacter(charId);
    if (castMemberId) {
      await this.castService.syncCastMemberStatus([castMemberId]);
    }
    return { ok: true };
  }

  async uploadEpisodeAudio(
    dubbingId: string,
    epId: string,
    params: { buffer: Buffer; mimeType: string; originalFilename: string | null },
  ) {
    const dub = await prisma.dubbingProject.findUnique({ where: { id: dubbingId } });
    if (!dub) return { notFound: true as const };

    const ep = await prisma.episode.findFirst({
      where: { id: epId, projectId: dubbingId },
    });
    if (!ep) return { notFound: true as const };

    let tpId = ep.transcriptionProjectId;
    if (!tpId) {
      const userId = dub.userId ?? (await getDefaultUserId());
      if (!userId) {
        return {
          badRequest: {
            error:
              "Não há utilizador para criar projeto de transcrição. Com Postgres a correr, execute npm run db:seed na pasta web.",
          } as const,
        };
      }
      const proj = await prisma.project.create({
        data: { name: `${dub.name} · Ep.${ep.number}`, userId },
      });
      tpId = proj.id;
      await prisma.episode.update({
        where: { id: ep.id },
        data: { transcriptionProjectId: tpId },
      });
    }

    const shouldConvertWav = isWavForEpisodeUpload(params);
    let uploadBuffer = params.buffer;
    if (shouldConvertWav) {
      try {
        uploadBuffer = await convertWavBufferToPcm16(params.buffer);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          unprocessable: {
            error: `Falha na conversão WAV para PCM 16-bit: ${msg}`,
          } as const,
        };
      }
    }

    const projectsSvc = new ProjectsService();
    const result = await projectsSvc.postProjectMedia(tpId, {
      ...params,
      buffer: uploadBuffer,
      mimeType: shouldConvertWav ? "audio/wav" : params.mimeType,
    });
    if ("notFound" in result) return result;
    if ("badRequest" in result) return result;

    const subtitleFileId = result.ok.subtitleFileId;
    const updated = await prisma.episode.update({
      where: { id: ep.id },
      data: { audioFileId: subtitleFileId },
    });

    return { episode: serializeEpisode(updated) };
  }

  async startEpisodeTranscription(
    dubbingId: string,
    epId: string,
    body: { language?: string | null },
  ) {
    const ep = await prisma.episode.findFirst({
      where: { id: epId, projectId: dubbingId },
    });
    if (!ep) return { notFound: true as const };

    if (!ep.audioFileId || !ep.transcriptionProjectId) {
      return {
        badRequest: { error: "Episódio sem áudio de transcrição. Faça upload primeiro." } as const,
      };
    }

    const proj = await prisma.project.findUnique({
      where: { id: ep.transcriptionProjectId },
      select: { storageKey: true },
    });
    if (!proj?.storageKey) {
      return { badRequest: { error: "Projeto de transcrição sem média." } as const };
    }

    const tj = new TranscriptionJobService(prisma);
    const job = await tj.createAndEnqueue({
      projectId: ep.transcriptionProjectId,
      subtitleFileId: ep.audioFileId,
      language: body.language ?? null,
    });

    await prisma.episode.update({
      where: { id: ep.id },
      data: { status: EpisodeStatus.TRANSCRIBING },
    });

    const row = await prisma.episode.findUnique({ where: { id: ep.id } });
    return {
      jobId: job.id,
      status: job.status,
      episode: row ? serializeEpisode(row) : undefined,
    };
  }
}
