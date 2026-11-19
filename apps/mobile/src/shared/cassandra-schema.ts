import { z } from "zod";
import { insertMessageSchema } from "./schema";

export const cassandraMessageSchema = insertMessageSchema.extend({
  id: z.string(),
  attachments: z.array(z.string()).optional().nullable(),
});

export type CassandraMessage = z.infer<typeof cassandraMessageSchema>;
