import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { getMaxFileSizeBytes } from "./modules/projects/media-env.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerStorageHealthRoutes } from "./routes/health-storage.js";
import { registerClientRoutes } from "./modules/clients/routes.js";
import { registerCastMemberAvailabilityRoutes } from "./modules/cast-member-availability/routes.js";
import { registerCastMemberRoutes } from "./modules/cast-members/routes.js";
import { registerDubbingProjectRoutes } from "./modules/dubbing-projects/routes.js";
import { registerProjectRoutes } from "./modules/projects/routes.js";
import { registerSubtitleFileRoutes } from "./modules/subtitle-files/routes.js";
import { registerTranscriptionJobRoutes } from "./modules/transcription-jobs/routes.js";
import { registerBatchJobRoutes } from "./modules/batch-jobs/routes.js";
import { registerCueRoutes } from "./modules/cues/routes.js";
import { registerAdminInviteRoutes } from "./modules/admin-invites/routes.js";
import { registerInviteAcceptRoutes } from "./modules/invite-accept/routes.js";
import { registerUserRoutes } from "./modules/users/routes.js";
import { registerRecordingSessionRoutes } from "./modules/recording-sessions/routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  await app.register(cookie);
  await app.register(multipart, {
    limits: {
      fileSize: getMaxFileSizeBytes(),
    },
  });

  void registerHealthRoutes(app);
  void registerStorageHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerInviteAcceptRoutes(app);
  await registerUserRoutes(app);
  await registerAdminInviteRoutes(app);
  void registerClientRoutes(app);
  void registerCastMemberRoutes(app);
  void registerCastMemberAvailabilityRoutes(app);
  void registerDubbingProjectRoutes(app);
  void registerRecordingSessionRoutes(app);
  await registerProjectRoutes(app);
  await registerSubtitleFileRoutes(app);
  await registerTranscriptionJobRoutes(app);
  await registerBatchJobRoutes(app);
  await registerCueRoutes(app);

  return app;
}
