import { createServerFn } from "@tanstack/react-start";
import type {
  PackersActionResult,
  PackersConnectionResult,
  PackersRateSyncResult,
  PackersStopDeskResult,
} from "./packers-server";

export const createPackersParcel = createServerFn({ method: "POST" })
  .validator((input: { orderId: string; accessToken: string }) => input)
  .handler(async ({ data }): Promise<PackersActionResult> => {
    const { runCreatePackersParcel } = await import("./packers-server");
    return runCreatePackersParcel(data);
  });

export const validatePackersParcel = createServerFn({ method: "POST" })
  .validator((input: { orderId: string; accessToken: string; askCollection?: boolean }) => input)
  .handler(async ({ data }): Promise<PackersActionResult> => {
    const { runValidatePackersParcel } = await import("./packers-server");
    return runValidatePackersParcel(data);
  });

export const syncPackersRates = createServerFn({ method: "POST" })
  .validator((input: { accessToken: string }) => input)
  .handler(async ({ data }): Promise<PackersRateSyncResult> => {
    const { runSyncPackersRates } = await import("./packers-server");
    return runSyncPackersRates(data);
  });

export const listPackersStopDeskCommunes = createServerFn({ method: "GET" })
  .validator((input: { wilaya: string }) => input)
  .handler(async ({ data }): Promise<PackersStopDeskResult> => {
    const { runListPackersStopDeskCommunes } = await import("./packers-server");
    return runListPackersStopDeskCommunes(data.wilaya);
  });

export const testPackersConnection = createServerFn({ method: "GET" }).handler(
  async (): Promise<PackersConnectionResult> => {
    const { runPackersConnectionTest } = await import("./packers-server");
    return runPackersConnectionTest();
  },
);
