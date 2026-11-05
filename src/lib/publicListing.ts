const propertyIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPropertyId(value: string): boolean {
  return propertyIdPattern.test(value);
}

export function publicListingUrl(propertyId: string, origin: string): string {
  const url = new URL("/", origin);
  url.searchParams.set("property", propertyId);
  return url.toString();
}
