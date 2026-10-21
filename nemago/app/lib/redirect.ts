// Only allow redirects to paths on this site ("/driver"), never to another
// site ("//evil.com" or "https://evil.com").
export function safeNext(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
