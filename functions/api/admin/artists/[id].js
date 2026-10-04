// POST /api/admin/artists/:id  { action: "approve" | "reject" | "suspend" | "reset", note? }
import { methods, json, readJson, requireBinding, ApiError } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/admin.js';
import { cleanText } from '../../../_lib/validate.js';

const ACTIONS = { approve: 'approved', reject: 'rejected', suspend: 'suspended', reset: 'pending' };

export const onRequest = methods({
  POST: async (ctx) => {
    await requireAdmin(ctx);
    const db = requireBinding(ctx.env, 'DB');
    const body = await readJson(ctx.request);
    const status = ACTIONS[body.action];
    if (!status) throw new ApiError(400, 'validation', 'Unknown action.');
    const note = cleanText(body.note, { max: 300, multiline: true, label: 'Note' });
    if (!note.ok) throw new ApiError(400, 'validation', note.error);
    const id = String(ctx.params.id || '');
    const now = new Date().toISOString();
    const res = await db
      .prepare('UPDATE artists SET status = ?1, status_note = ?2, updated_at = ?3 WHERE id = ?4')
      .bind(status, status === 'approved' ? '' : note.value, now, id)
      .run();
    if (!res.meta || res.meta.changes !== 1) throw new ApiError(404, 'not_found', 'Artist not found.');
    await db.prepare('INSERT INTO admin_log (action, target, note, created_at) VALUES (?1, ?2, ?3, ?4)').bind(body.action, 'artist:' + id, note.value, now).run();
    return json({ ok: true, status });
  },
});
