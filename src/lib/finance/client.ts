import { getSupabase } from "../supabase/client";
import { financeAction } from "./actions";
import type { FinanceOperation, FinanceRow } from "./types";

async function financeToken() {
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) throw new Error("Session administrateur requise.");
  return data.session.access_token;
}

export async function callFinance(operation: FinanceOperation, input: FinanceRow = {}) {
  const result = await financeAction({
    data: { accessToken: await financeToken(), operation, input },
  });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export async function downloadFinanceDocument(id: string, kind = "invoice") {
  const response = await fetch(
    `/api/finance/${encodeURIComponent(id)}/pdf?kind=${encodeURIComponent(kind)}`,
    {
      headers: { Authorization: `Bearer ${await financeToken()}` },
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error("PDF indisponible. L’émission est conservée ; réessayez le téléchargement.");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${kind}-elegancia.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function uploadFinanceFile(file: File, brand = false) {
  const allowed = brand
    ? ["image/png", "image/jpeg"]
    : ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error("Fichier invalide (8 Mo maximum).");
  const path = `${brand ? "brand" : "receipts"}/${crypto.randomUUID()}/${crypto.randomUUID()}`;
  const { error } = await getSupabase()
    .storage.from("finance-documents")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}
