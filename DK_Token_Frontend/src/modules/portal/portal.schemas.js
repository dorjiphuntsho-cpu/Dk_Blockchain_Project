import { z } from 'zod';

export const portalLoginSchema = z.object({
  cid: z.string().trim().regex(/^\d{11}$/, 'CID must be 11 digits'),
  mpin: z.string().trim().regex(/^\d{4,6}$/, 'DK Bank MPIN must be 4 to 6 digits'),
});
