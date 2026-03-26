import { z } from "zod";

export const acceptInviteBodySchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  password: z.string().min(8).max(200),
});
