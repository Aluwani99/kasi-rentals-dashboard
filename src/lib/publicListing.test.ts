import { describe, expect, it } from "vitest";
import { isPropertyId, publicListingUrl } from "./publicListing";

describe("public listing links", () => {
  it("creates a link that identifies only the selected property", () => {
    expect(publicListingUrl("ac36a58e-b880-45d0-b5f1-b52bf8c49c38", "https://rentals.example"))
      .toBe("https://rentals.example/?property=ac36a58e-b880-45d0-b5f1-b52bf8c49c38");
  });

  it("accepts UUID property ids and rejects malformed values", () => {
    expect(isPropertyId("ac36a58e-b880-45d0-b5f1-b52bf8c49c38")).toBe(true);
    expect(isPropertyId("not-a-property-id")).toBe(false);
  });
});
