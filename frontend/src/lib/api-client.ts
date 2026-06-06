/**
 * Typed HTTP client for the DOCYAN backend (`docyan-lde-api` on Fly).
 * - Base URL from NEXT_PUBLIC_API_URL.
 * - JWT in `Authorization: Bearer …` (client reads from the in-memory token set
 *   by the auth provider; server reads from the httpOnly cookie).
 * - Multi-tenant: callers pass tenant/CoDo ids explicitly per the OpenAPI shape.
 *
 * Response types should be imported from `@/types/api` (generated from OpenAPI).
 */
import { API_URL } from "./config";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  /** JSON body — serialized automatically. */
  json?: unknown;
  /** Multipart body (file uploads) — sent as-is; the browser sets the boundary. */
  form?: FormData;
  /** Bearer token override (server-side passes the cookie value). */
  token?: string | null;
  /** Query params. */
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: ApiOptions["query"]): string {
  const url = new URL(path.startsWith("http") ? path : API_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const { json, form, token, query, headers, ...rest } = opts;
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string>),
  };
  // Multipart: NO fijar Content-Type — el browser pone el boundary correcto.
  if (json !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (token) finalHeaders["Authorization"] = `Bearer ${token}`;

  const body: BodyInit | undefined =
    form !== undefined ? form : json !== undefined ? JSON.stringify(json) : undefined;

  const res = await fetch(buildUrl(path, query), {
    ...rest,
    headers: finalHeaders,
    body,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const message =
      (isJson && payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : null) ?? `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, message, payload);
  }
  return payload as T;
}

/** Convenience verbs. */
export const api = {
  get: <T = unknown>(path: string, opts?: ApiOptions) => apiFetch<T>(path, { ...opts, method: "GET" }),
  post: <T = unknown>(path: string, json?: unknown, opts?: ApiOptions) => apiFetch<T>(path, { ...opts, method: "POST", json }),
  postForm: <T = unknown>(path: string, form: FormData, opts?: ApiOptions) => apiFetch<T>(path, { ...opts, method: "POST", form }),
  patch: <T = unknown>(path: string, json?: unknown, opts?: ApiOptions) => apiFetch<T>(path, { ...opts, method: "PATCH", json }),
  del: <T = unknown>(path: string, opts?: ApiOptions) => apiFetch<T>(path, { ...opts, method: "DELETE" }),
};
