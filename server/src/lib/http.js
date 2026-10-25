export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);

/** Parses req[part] with a zod schema, replacing it with the parsed value or throwing 400. */
export function validate(schema, part = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(new HttpError(400, details[0]?.message || 'Invalid request', details));
    }
    // Express 5 makes req.query a getter, so store parsed values separately.
    req.valid = { ...req.valid, [part]: result.data };
    next();
  };
}

export function errorHandler(err, _req, res, _next) {
  if (err.type === 'entity.parse.failed') err = new HttpError(400, 'Malformed JSON body');
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
