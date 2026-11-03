/** Existing connected suites write orders. Never infer permission from a configured key. */
export default function requireTestProject() {
  const project = process.env.E2E_TEST_PROJECT_REF;
  const supabase = process.env.VITE_SUPABASE_URL;
  const target = process.env.E2E_BASE_URL;
  if (process.env.E2E_ALLOW_WRITES !== "true" || !project || !supabase)
    throw new Error(
      "Connected E2E requires E2E_ALLOW_WRITES=true and E2E_TEST_PROJECT_REF for a disposable Supabase Test project. Use npm run test:e2e:ci for isolated tests.",
    );
  if (new URL(supabase).hostname !== `${project}.supabase.co`)
    throw new Error("Supabase URL does not match the explicitly selected Test project.");
  if (project === "zlceykczkkuzqnwtxmeh")
    throw new Error("The Elegancia Production Supabase project is forbidden in connected E2E.");
  if (target && new URL(target).hostname === "elegancia-home.vercel.app")
    throw new Error("Connected E2E must never target the Production storefront.");
}
