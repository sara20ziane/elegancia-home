/** Private routes and URL parameters must never be sent to a traffic provider. */
export function analyticsUrl(url: string): string | null {
  const parsed = new URL(url);
  if (/^\/(admin|login|setup|order|track|api)(\/|$)/.test(parsed.pathname)) return null;
  return parsed.origin + parsed.pathname;
}
