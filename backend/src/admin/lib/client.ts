// Tiny fetch helper for custom admin pages — same-origin, cookie-authed.
export async function adminFetch<T = any>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = init || {}
  const res = await fetch(path, {
    credentials: "include",
    headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
    method: rest.method || (json !== undefined ? "POST" : "GET"),
    body: json !== undefined ? JSON.stringify(json) : undefined,
    ...rest,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`)
  }
  return data as T
}

export const handleFor = (name: string) =>
  String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
