/**
 * Every routine endpoint works inside exactly one academic semester.
 * The id arrives as ?semesterId= on reads and in the JSON body on writes.
 *
 * Missing it is a 400 rather than a fallback to "the current semester":
 * a silent default is how data from one semester ends up written into
 * another, which is precisely what per-semester scoping exists to prevent.
 */
export function getSemesterId(req) {
  return req.query.semesterId || req.body?.semesterId || null;
}

export function requireSemester(req, res, next) {
  const semesterId = getSemesterId(req);
  if (!semesterId) {
    return res.status(400).json({
      success: false,
      error: 'semesterId is required — routine data is scoped to one academic semester.',
    });
  }
  req.semesterId = semesterId;
  next();
}
