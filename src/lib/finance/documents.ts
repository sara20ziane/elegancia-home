import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertAdmin } from "../server/packers-auth";
import { isTokenShaped } from "../order";
import { renderInvoicePdf } from "./pdf-template";
import type { InvoiceDocument } from "./types";

const PRIVATE = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

function archiveClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Archivage serveur non configuré.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
    },
  });
}

async function publicDocuments(token: string) {
  if (!isTokenShaped(token)) return null;
  const { data, error } = await archiveClient().rpc("finance_public_documents", { p_token: token });
  if (error) throw new Error("Document indisponible.");
  return data as { invoice_id: string; credit_id: string | null } | null;
}

export async function invoiceAvailability(token: string) {
  try {
    const docs = await publicDocuments(token);
    return { invoice: Boolean(docs?.invoice_id), credit: Boolean(docs?.credit_id) };
  } catch {
    return { invoice: false, credit: false };
  }
}

export function pdfHash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function archivedBytes(doc: InvoiceDocument, kind: string): Promise<Uint8Array> {
  const db = archiveClient();
  const bucket = db.storage.from("finance-invoices");
  const path = doc.pdf_path || `${kind}/${doc.id}/document.pdf`;
  let found = await bucket.download(path);
  if (doc.pdf_path && found.error) throw new Error("Archive indisponible.");
  if (!found.data) {
    if (found.error && !/not found/i.test(found.error.message))
      throw new Error("Stockage indisponible.");
    let logo: string | undefined;
    if (doc.payload.issuer.logo_path) {
      const asset = await db.storage
        .from("finance-documents")
        .download(doc.payload.issuer.logo_path);
      if (asset.error || !asset.data || !["image/png", "image/jpeg"].includes(asset.data.type))
        throw new Error("Logo indisponible.");
      logo = `data:${asset.data.type};base64,${Buffer.from(await asset.data.arrayBuffer()).toString("base64")}`;
    }
    const bytes = await renderInvoicePdf(doc.payload, logo);
    // Exactly one immutable object wins. After conflicts/lost responses, read that authoritative file.
    await bucket.upload(path, bytes, {
      upsert: false,
      contentType: "application/pdf",
      cacheControl: "0",
    });
    found = await bucket.download(path);
  }
  if (!found.data) throw new Error("Archive indisponible.");
  const bytes = new Uint8Array(await found.data.arrayBuffer());
  if (bytes.length > 15728640 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new Error("Archive PDF invalide.");
  const hash = pdfHash(bytes);
  if (doc.pdf_sha256 && hash !== doc.pdf_sha256) throw new Error("Intégrité PDF non vérifiée.");
  if (!doc.pdf_path) {
    const saved = await db.rpc("finance_archive_pdf", {
      p_id: doc.id,
      p_kind: kind,
      p_path: path,
      p_hash: hash,
    });
    if (saved.error) throw new Error("Archivage non confirmé.");
  }
  return bytes;
}

export async function financePdfResponse(
  request: Request,
  identity: { id?: string; token?: string },
): Promise<Response> {
  const fail = (status: number) =>
    new Response("Document indisponible.", { status, headers: PRIVATE });
  try {
    const kind = new URL(request.url).searchParams.get("kind") === "credit" ? "credit" : "invoice";
    let id = identity.id;
    let db;
    if (identity.token) {
      const docs = await publicDocuments(identity.token);
      id = kind === "credit" ? docs?.credit_id || undefined : docs?.invoice_id;
      if (!id) return fail(404);
      db = archiveClient();
    } else {
      if (!id || !isTokenShaped(id)) return fail(404);
      const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
      if (!token) return fail(401);
      const auth = await assertAdmin(token);
      if (!auth.supabase) return fail(403);
      db = auth.supabase;
    }
    const result = await db.rpc("finance_document", {
      p_id: id,
      p_kind: kind,
      p_token: identity.token || null,
    });
    if (result.error || !result.data) return fail(404);
    const doc = result.data as InvoiceDocument;
    const bytes = await archivedBytes(doc, kind);
    return new Response(new Uint8Array(bytes).buffer, {
      headers: {
        ...PRIVATE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${kind}-elegancia.pdf"`,
      },
    });
  } catch {
    return fail(503);
  }
}
