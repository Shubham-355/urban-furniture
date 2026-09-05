export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details);
export const unauthorized = (message = 'Not authenticated') => new HttpError(401, message);
export const forbidden = (message = 'You are not allowed to perform this action') =>
  new HttpError(403, message);
export const notFound = (message = 'Record not found') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
