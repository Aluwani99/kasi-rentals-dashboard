export type PropertyStatus = "draft" | "active" | "rented";
export type PropertyType = "room" | "house";

export interface ListingDraft {
  title: string;
  property_type: PropertyType;
  description: string;
  location: string;
  monthly_rent: number;
  bedrooms: number;
  available_rooms: number;
  status: PropertyStatus;
}

export function validateListing(draft: ListingDraft): string | null {
  if (!draft.title.trim()) return "Add a listing title.";
  if (!draft.location.trim()) return "Add a location.";
  if (!Number.isFinite(draft.monthly_rent) || draft.monthly_rent <= 0) {
    return "Monthly rent must be greater than zero.";
  }
  if (!Number.isInteger(draft.bedrooms) || draft.bedrooms < 1) {
    return "Bedrooms must be at least one.";
  }
  if (
    !Number.isInteger(draft.available_rooms) ||
    draft.available_rooms < 0 ||
    draft.available_rooms > draft.bedrooms
  ) {
    return "Available rooms must be between zero and the bedroom count.";
  }
  return null;
}

export function listingPhotoPath(propertyId: string, fileName: string): string {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${propertyId}/${crypto.randomUUID()}-${safeName || "photo"}`;
}
