import { MediaKind } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";
import { getDefaultUserId } from "../../infrastructure/demo-user.js";
import { isDatabaseConnectionError } from "../../infrastructure/prisma-errors.js";
import { getAudioDurationMsFromBuffer } from "./audio-duration.js";
import { tryReplicateProjectMediaAfterLocalSave } from "./project-media-minio-replication.js";
import { getMediaStorageService } from "./media-storage.service.js";
import { findLatestSubtitleFileForProject } from "./subtitle-file-queries.js";
import { formatSrt } from "./srt/format-srt.js";

type CreateBody = {
  name?: string;
};

export class ProjectsService {
  async create(rawBody: unknown) {
    const body = (rawBody ?? {}) as CreateBody;

    const name = String(body?.name ?? "").trim();
    if (!name) {
      return { badRequest: { error: "name e obrigatorio" } as const };
    }

    try {
      const userId = await getDefaultUserId();
      if (!userId) {
        return {
          serverError: {
            error:
              "Nenhum utilizador demo na base de dados. Com Postgres a correr e DATABASE_URL em web/.env, execute na pasta web: npm run db:seed (ou npm run seed). Cria demo@subtitlestudio.local.",
          } as const,
        };
      }

      const project = await prisma.project.create({
        data: {
          name,
          userId,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      return { created: project };
    } catch (e) {
      if (isDatabaseConnectionError(e)) {
        return {
          serviceUnavailable: {
            error:
              "Base de dados indisponível. Arranque o PostgreSQL (na raiz: docker compose up -d), confirme DATABASE_URL em web/.env e execute npm run db:migrate e npm run db:seed.",
          } as const,
        };
      }
      throw e;
    }
  }

  async getById(projectId: string) {
    if (!projectId) {
      return { badRequest: { error: "projectId obrigatorio" } as const };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        storageKey: true,
        mediaKind: true,
        durationMs: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
      },
    });

    if (!project) {
      return { notFound: { error: "Projeto nao encontrado" } as const };
    }

    const latestFile = await findLatestSubtitleFileForProject(prisma, projectId);

    return {
      ok: {
        ...project,
        subtitleFileId: latestFile?.id ?? null,
      } as const,
    };
  }

  async getCues(projectId: string) {
    if (!projectId) {
      return { badRequest: { error: "projectId obrigatorio" } as const };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return { notFound: { error: "Projeto nao encontrado" } as const };
    }

    const subtitleFile = await findLatestSubtitleFileForProject(prisma, projectId);
    if (!subtitleFile) {
      return {
        noSubtitleFile: {
          error: "Nenhum SubtitleFile para este projeto",
        } as const,
      };
    }

    const cues = await prisma.subtitleCue.findMany({
      where: { subtitleFileId: subtitleFile.id },
      orderBy: { cueIndex: "asc" },
      select: {
        id: true,
        cueIndex: true,
        startMs: true,
        endMs: true,
        text: true,
        transcriptionJobId: true,
      },
    });

    return {
      ok: {
        projectId,
        subtitleFileId: subtitleFile.id,
        cues,
      },
    };
  }

  async exportSrt(projectId: string) {
    if (!projectId) {
      return { badRequest: { error: "projectId obrigatorio" } as const };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      return { notFound: { error: "Projeto nao encontrado" } as const };
    }

    const subtitleFile = await findLatestSubtitleFileForProject(prisma, projectId);
    if (!subtitleFile) {
      return {
        noSubtitleFile: {
          error: "Nenhum SubtitleFile para este projeto",
        } as const,
      };
    }

    const cues = await prisma.subtitleCue.findMany({
      where: { subtitleFileId: subtitleFile.id },
      orderBy: { cueIndex: "asc" },
      select: {
        cueIndex: true,
        startMs: true,
        endMs: true,
        text: true,
      },
    });

    const srt = formatSrt(cues);
    const safeName = project.name.replace(/[^\w\-]+/g, "_").slice(0, 80) || "legendas";

    return {
      ok: {
        body: srt,
        contentDisposition: `attachment; filename="${safeName}.srt"`,
      },
    };
  }

  /**
   * POST /api/projects/:id/media — mesmo comportamento que o handler Next legado.
   * Persistência em disco (sibling `apps/web/public/uploads/media` por defeito).
   */
  async postProjectMedia(
    projectId: string,
    params: {
      buffer: Buffer;
      mimeType: string;
      originalFilename: string | null;
    },
  ) {
    if (!projectId?.trim()) {
      return { badRequest: { error: "projectId obrigatorio" } as const };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return { notFound: { error: "Projeto nao encontrado" } as const };
    }

    const storage = getMediaStorageService();
    let saved: { storageKey: string; sizeBytes: number };
    try {
      saved = await storage.saveFile({
        buffer: params.buffer,
        mimeType: params.mimeType,
        originalFilename: params.originalFilename,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { badRequest: { error: msg } as const };
    }

    const durationMs = await getAudioDurationMsFromBuffer(
      params.buffer,
      params.mimeType,
    );

    await prisma.project.update({
      where: { id: projectId },
      data: {
        storageKey: saved.storageKey,
        mediaKind: MediaKind.audio,
        durationMs: durationMs ?? null,
      },
    });

    const publicPath = `/uploads/media/${saved.storageKey}`;
    const wavFilename = params.originalFilename ?? saved.storageKey;

    const existing = await findLatestSubtitleFileForProject(prisma, projectId);

    let subtitleFileId: string;

    if (existing) {
      const updated = await prisma.subtitleFile.update({
        where: { id: existing.id },
        data: {
          filename: wavFilename,
          wavFilename,
          wavPath: publicPath,
        },
        select: { id: true },
      });
      subtitleFileId = updated.id;
    } else {
      const created = await prisma.subtitleFile.create({
        data: {
          projectId,
          filename: wavFilename,
          wavFilename,
          wavPath: publicPath,
        },
        select: { id: true },
      });
      subtitleFileId = created.id;
    }

    await tryReplicateProjectMediaAfterLocalSave({
      projectId,
      subtitleFileId,
      storageKey: saved.storageKey,
      sizeBytes: saved.sizeBytes,
      mimeType: params.mimeType,
      originalFilename: wavFilename,
      buffer: params.buffer,
    });

    return {
      ok: {
        storageKey: saved.storageKey,
        sizeBytes: saved.sizeBytes,
        durationMs,
        subtitleFileId,
        publicPath,
      } as const,
    };
  }
}
