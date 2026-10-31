import { StrictMode, act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderTest } from "../../scripts/testing/react-render";
import type { Database } from "./supabase/types";
import { subscribeToAdminOrders } from "./admin-order-events";
import { useAdminOrderAlerts } from "./use-admin-order-alerts";

const { getSupabase, success } = vi.hoisted(() => ({ getSupabase: vi.fn(), success: vi.fn() }));
vi.mock("./supabase/client", () => ({ getSupabase }));
vi.mock("sonner", () => ({ toast: { success } }));

function transport() {
  let insert: (payload: { new: Record<string, unknown> }) => void = () => {};
  let state: (status: string) => void = () => {};
  const on = vi.fn(
    (
      _kind: string,
      _filter: unknown,
      handler: (payload: { new: Record<string, unknown> }) => void,
    ) => {
      insert = handler;
      return channel;
    },
  );
  const subscribe = vi.fn((handler: (status: string) => void) => {
    state = handler;
    return channel;
  });
  const channel = { on, subscribe };
  const client = { channel: vi.fn(() => channel), removeChannel: vi.fn().mockResolvedValue("ok") };
  return {
    client: client as unknown as SupabaseClient<Database>,
    channel,
    emit: (row: Record<string, unknown>) => insert({ new: row }),
    state: (value: string) => state(value),
  };
}
function Harness({ play }: { play: () => void }) {
  return <span>{useAdminOrderAlerts(play)}</span>;
}
afterEach(() => vi.clearAllMocks());

describe("admin order subscription", () => {
  it("creates only one live subscription under StrictMode and cleans up on unmount", async () => {
    const live = transport();
    getSupabase.mockReturnValue(live.client);
    const queryClient = new QueryClient();
    const invalidation = vi.spyOn(queryClient, "invalidateQueries");
    const play = vi.fn();
    const node = (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <Harness play={play} />
        </QueryClientProvider>
      </StrictMode>
    );
    const view = await renderTest(node);
    expect(live.client.channel).toHaveBeenCalledTimes(1);
    expect(live.channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders" },
      expect.any(Function),
    );
    await view.rerender(node);
    expect(live.client.channel).toHaveBeenCalledTimes(1);
    await act(async () => {
      live.emit({ id: "1", public_token: "ref", customer_name: "never logged" });
    });
    expect(success).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    for (const key of ["admin_orders", "admin_orders_count", "admin_analytics"]) {
      expect(invalidation).toHaveBeenCalledWith({ queryKey: [key] });
    }
    await act(async () => {
      live.state("SUBSCRIBED");
      live.emit({ id: "1" });
    });
    expect(success).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(live.client.removeChannel).toHaveBeenCalledTimes(1);
    live.emit({ id: "2" });
    expect(success).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });
  it("survives unavailable Realtime and state changes", async () => {
    const live = transport();
    getSupabase.mockReturnValue(live.client);
    const queryClient = new QueryClient();
    const view = await renderTest(
      <QueryClientProvider client={queryClient}>
        <Harness play={() => {}} />
      </QueryClientProvider>,
    );
    await act(async () => {
      live.state("CHANNEL_ERROR");
    });
    expect(view.container).toHaveTextContent("unavailable");
    await act(async () => {
      live.state("SUBSCRIBED");
    });
    expect(view.container).toHaveTextContent("connected");
    await view.unmount();
    queryClient.clear();
  });
  it("does not deliver customer fields and ignores late/duplicate events", () => {
    const live = transport();
    const receive = vi.fn();
    const stop = subscribeToAdminOrders(live.client, new Set(), receive, vi.fn(), vi.fn());
    live.emit({ id: "1", public_token: "public", phone: "private", address: "private" });
    live.emit({ id: "1" });
    live.emit({});
    expect(receive).toHaveBeenCalledExactlyOnceWith({ id: "1", reference: "public" });
    stop();
    live.emit({ id: "2" });
    expect(receive).toHaveBeenCalledTimes(1);
  });
  it("cleans up even if subscribe throws and removal fails", () => {
    const onState = vi.fn();
    const removeChannel = vi.fn().mockRejectedValue(new Error("offline"));
    const channel = {
      on: () => channel,
      subscribe: () => {
        throw new Error("offline");
      },
    };
    const client = {
      channel: () => channel as unknown as RealtimeChannel,
      removeChannel,
    } as unknown as SupabaseClient<Database>;
    const stop = subscribeToAdminOrders(client, new Set(), vi.fn(), onState, vi.fn());
    expect(onState).toHaveBeenCalledWith("unavailable");
    expect(stop).not.toThrow();
  });
});
