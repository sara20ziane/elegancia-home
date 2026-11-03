import type { Page, BrowserContext } from "@playwright/test";

export async function signInSynthetic(page: Page, context: BrowserContext) {
  await context.route("**/*", (route) =>
    ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      "sb-127-auth-token",
      JSON.stringify({
        access_token: "synthetic-admin-token",
        refresh_token: "synthetic-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: {
          id: "cccccccc-1111-4111-8111-111111111111",
          aud: "authenticated",
          role: "authenticated",
          email: "catalog@example.test",
        },
      }),
    );
  });
}
