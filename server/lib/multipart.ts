// Small replacement for multer (which needs Node streams that Workers do not fully have). Same limits, same req.files / req.body shape.
// Works on Node 20+ and on Cloudflare Workers because it uses the standard Request/Response formData() parser.
import type { Request, Response, NextFunction } from "express";

export type UploadedFile = { fieldname: string; originalname: string; mimetype: string; size: number; buffer: Buffer };
const LIMITS = { fileSize: 6 * 1024 * 1024, files: 12, fields: 40, parts: 60, fieldSize: 64 * 1024 };
const limit = (code: string) => Object.assign(new Error(code), { code });

export const upload = {
  any: () => async (req: Request, res: Response, next: NextFunction) => {
    const ct = String(req.headers["content-type"] ?? "");
    if (!/^multipart\/form-data/i.test(ct)) return next();
    try {
      const chunks: Buffer[] = []; let total = 0; const maxTotal = LIMITS.fileSize * LIMITS.files + LIMITS.parts * 1024;
      for await (const c of req) { const b = Buffer.isBuffer(c) ? c : Buffer.from(c); total += b.length; if (total > maxTotal) throw limit("LIMIT_FILE_SIZE"); chunks.push(b); }
      const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": ct } }).formData();
      const body: Record<string, string | string[]> = {}; const files: UploadedFile[] = []; let parts = 0, fields = 0;
      for (const [name, v] of form.entries()) {
        if (++parts > LIMITS.parts) throw limit("LIMIT_PART_COUNT");
        if (typeof v === "string") {
          if (++fields > LIMITS.fields) throw limit("LIMIT_FIELD_COUNT");
          if (v.length > LIMITS.fieldSize) throw limit("LIMIT_FIELD_VALUE");
          const prev = body[name]; body[name] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
        } else {
          if (files.length >= LIMITS.files) throw limit("LIMIT_FILE_COUNT");
          if (v.size > LIMITS.fileSize) throw limit("LIMIT_FILE_SIZE");
          files.push({ fieldname: name, originalname: v.name, mimetype: v.type, size: v.size, buffer: Buffer.from(await v.arrayBuffer()) });
        }
      }
      (req as Request & { files?: UploadedFile[] }).files = files; req.body = body; next();
    } catch (e) { next(e); }
  },
};
