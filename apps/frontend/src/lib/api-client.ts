import { apiUrl } from "./api-url.ts";

/** One invalid request field, as the API reports it with VALIDATION_ERROR. */
export interface FieldIssue {
  path: string;
  message: string;
}

/**
 * A failed API call. `code` is the API's own error code (INVALID_CREDENTIALS,
 * VALIDATION_ERROR, ...) or, when no API error body arrived, one of:
 * NETWORK_ERROR (no response; `status` is 0), SERVER_UNAVAILABLE (502/503/504 without
 * an API body, e.g. while Render restarts) or UNEXPECTED_RESPONSE.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: FieldIssue[];

  constructor(status: number, code: string, message: string, details: FieldIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  /** Serialised as JSON. */
  body?: unknown;
  /** Access token from signup or login, sent as a Bearer token. */
  token?: string;
  /** Lets the caller cancel, e.g. when the component that asked unmounts. */
  signal?: AbortSignal;
}

/**
 * Calls the Express API and resolves to the parsed JSON body, typed by the caller to
 * match the API's response shape. Every failure rejects with an ApiError, except a
 * cancellation through `signal`, which rejects with the browser's AbortError.
 */
export async function apiRequest<T>(
  endpoint: string,
  { method = "GET", body, token, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  let text: string;
  try {
    response = await fetch(apiUrl(endpoint), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    text = await response.text();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again.");
  }

  const payload = parseJson(text);

  if (response.ok) {
    if (payload === undefined) {
      throw new ApiError(response.status, "UNEXPECTED_RESPONSE", "The server sent a response the app could not read.");
    }
    // The API's response shapes are mirrored in the caller's type, not re-validated here.
    return payload as T;
  }

  if (isApiErrorBody(payload)) {
    const { code, message, details } = payload.error;
    throw new ApiError(response.status, code, message, Array.isArray(details) ? details.filter(isFieldIssue) : []);
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new ApiError(
      response.status,
      "SERVER_UNAVAILABLE",
      "The server is starting up or unavailable. Please try again in a minute.",
    );
  }
  throw new ApiError(
    response.status,
    "UNEXPECTED_RESPONSE",
    `The server returned an unexpected error (HTTP ${response.status}).`,
  );
}

/**
 * Validation messages keyed by field path ("email", "milestones.0.views"), keeping the
 * first message for each field. Empty for errors other than VALIDATION_ERROR.
 */
export function fieldErrors(error: ApiError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { path, message } of error.details) {
    errors[path] ??= message;
  }
  return errors;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const { error } = value;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

function isFieldIssue(value: unknown): value is FieldIssue {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    typeof value.path === "string" &&
    "message" in value &&
    typeof value.message === "string"
  );
}
