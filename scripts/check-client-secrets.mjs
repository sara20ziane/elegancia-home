import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(js|mjs|html|map)$/.test(entry.name)) {
      const text = await readFile(path, "utf8");
      // supabase-js includes the bare "sb_secret_" prefix to reject secret keys
      // in browsers. That validation literal is not a leaked credential.
      if (
        /SUPABASE_SERVICE_ROLE_KEY|sb_secret_[A-Za-z0-9_-]{20,}|"role"\s*:\s*"service_role"/.test(
          text,
        )
      )
        throw new Error(`Server credential marker in public build: ${path}`);
      for (const [jwt] of text.matchAll(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g)) {
        try {
          const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
          if (payload.role === "service_role")
            throw new Error(`Privileged JWT in public build: ${path}`);
        } catch (error) {
          if (error instanceof SyntaxError) continue;
          throw error;
        }
      }
    }
  }
}
await scan(".vercel/output/static");
process.stdout.write("PASS: public build has no service-role credential markers.\n");
