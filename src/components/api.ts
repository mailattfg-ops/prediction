export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, string>) {
    super(message);
  }
}

/** Browser-side fetch wrapper: JSON in, JSON out, consistent errors (including network failures). */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(0, "NETWORK", "Network error. Please check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; details?: Record<string, string> } };
  if (!res.ok) {
    throw new ApiClientError(res.status, json.error?.code ?? "ERROR", json.error?.message ?? "Something went wrong.", json.error?.details);
  }
  return json as T;
}
