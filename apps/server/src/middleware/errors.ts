import type { ErrorRequestHandler, RequestHandler } from 'express';

/** Shape of every error response the API sends. */
export interface ErrorResponseBody {
  error: { code: string; message: string };
}

interface ClientHttpError {
  status: number;
  message: string;
  type?: string;
}

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ErrorResponseBody = {
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
};

// Express recognises error middleware by its four parameters, so `next` must stay.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (isClientHttpError(err)) {
    res.status(err.status).json(clientErrorBody(err));
    return;
  }

  // Unexpected failure: full details go to the server log only, never to the client.
  console.error(err);
  const body: ErrorResponseBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  };
  res.status(500).json(body);
};

function clientErrorBody(err: ClientHttpError): ErrorResponseBody {
  switch (err.type) {
    case 'entity.parse.failed':
      return { error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } };
    case 'entity.too.large':
      return { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } };
    default:
      return { error: { code: 'BAD_REQUEST', message: err.message } };
  }
}

/** 4xx errors raised by Express's body parser (http-errors marks them safe to expose). */
function isClientHttpError(err: unknown): err is ClientHttpError {
  if (typeof err !== 'object' || err === null) return false;
  const { status, expose } = err as Record<string, unknown>;
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}
