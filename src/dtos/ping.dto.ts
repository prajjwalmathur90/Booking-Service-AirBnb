import z from "zod";

export const pingValidateSchema = z.object({
  message: z.string().default("ok"),
});

export type PingValidateDTO = z.infer<typeof pingValidateSchema>;
