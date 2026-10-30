import { createServerFn } from "@tanstack/react-start";
import type { PackersActionResult, PackersConnectionResult } from "./packers-server";

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

export const testPackersConnection = createServerFn({ method: "GET" }).handler(
  async (): Promise<PackersConnectionResult> => {
    const { runPackersConnectionTest } = await import("./packers-server");
    return runPackersConnectionTest();
  },
);
