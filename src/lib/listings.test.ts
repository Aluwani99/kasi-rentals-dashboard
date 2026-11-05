import { describe, expect, it } from "vitest";
import { listingPhotoPath, validateListing, type ListingDraft } from "./listings";

const validDraft: ListingDraft = {
  title: "Cosy room near the taxi rank",
  property_type: "room",
  description: "Secure room with shared kitchen.",
  location: "Tembisa",
  monthly_rent: 2500,
  bedrooms: 3,
  available_rooms: 1,
  status: "draft",
};

describe("validateListing", () => {
  it("accepts a complete room listing", () => {
    expect(validateListing(validDraft)).toBeNull();
  });

  it("requires a positive rent and a valid room count", () => {
    expect(validateListing({ ...validDraft, monthly_rent: 0 })).toContain("rent");
    expect(validateListing({ ...validDraft, available_rooms: 4 })).toContain("Available rooms");
  });
});

describe("listingPhotoPath", () => {
  it("places each sanitized photo in its property folder", () => {
    const path = listingPhotoPath("property-123", "front door photo.jpg");
    expect(path.startsWith("property-123/")).toBe(true);
    expect(path.endsWith("-front-door-photo.jpg")).toBe(true);
  });
});
