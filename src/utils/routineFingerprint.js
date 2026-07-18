/**
 * Stable fingerprint of one batch's routine entries.
 *
 * Used to tell "published" from "published, then edited": the fingerprint is
 * stored when a batch is published and recomputed from the current entries
 * whenever the admin views the routine. Different value ⇒ edited since.
 *
 * Order-independent (entries may be rebuilt in a different order by the
 * editor) and limited to the fields that actually change the schedule.
 */
export function batchFingerprint(entries) {
  const parts = (entries || []).map(e => [
    e.day_of_week,
    e.slot_id,
    e.course_id,
    e.room ?? '',
    e.group ?? '',
    (e.teacher_ids?.length ? [...e.teacher_ids].sort() : [e.teacher_id ?? '']).join('+'),
  ].join('|'));

  parts.sort();
  const joined = parts.join(';');

  // Small, dependency-free 32-bit string hash (FNV-1a).
  let h = 0x811c9dc5;
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${parts.length}-${h.toString(16)}`;
}
