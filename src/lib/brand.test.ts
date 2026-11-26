import { describe, expect, it } from "vitest";
import { rebrandStoreCopy } from "./brand";

describe("rebrandStoreCopy", () => {
  it("updates the brand in editorial content without changing the surrounding text", () => {
    expect(rebrandStoreCopy("Offre ELEGANCIA HOME : 2 parures = Stop Desk offert")).toBe(
      "Offre Cotonia Home : 2 parures = Stop Desk offert",
    );
    expect(rebrandStoreCopy("أهلا بيك في Elegancia")).toBe("أهلا بيك في Cotonia Home");
    expect(rebrandStoreCopy(null)).toBeNull();
  });
});
