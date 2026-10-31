import { getSupabase } from "./supabase/client";

/** No direct DELETE: RPC serializes stock restoration and deletion under the existing admin role. */
export async function deleteOrder(id: string, reference: string): Promise<void> {
  const { error } = await getSupabase().rpc("delete_elegancia_order", {
    p_id: id,
    p_reference: reference,
  });
  if (error) throw new Error(error.message);
}
