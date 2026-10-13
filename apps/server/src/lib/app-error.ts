/**
 * An expected failure with an HTTP status and a stable, machine-readable code.
 * Thrown by services and middleware; the central error handler turns it into JSON.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
