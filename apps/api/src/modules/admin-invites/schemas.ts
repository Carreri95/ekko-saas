import { z } from "zod";

export const createInviteBodySchema = z.object({
  email: z.string().trim().min(1).email(),
});
