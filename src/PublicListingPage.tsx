import { useEffect, useState } from "react";
import { ArrowLeft, BedDouble, DoorOpen, Home, MapPin, ShieldCheck } from "lucide-react";
import { isPropertyId } from "./lib/publicListing";
import { supabase } from "./lib/supabase";
import type { Property } from "./types";

type ListingState = "loading" | "ready" | "not-found" | "error";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PublicListingPage({ propertyId }: { propertyId: string }) {
  const [listing, setListing] = useState<Property | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [state, setState] = useState<ListingState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadListing() {
      if (!isPropertyId(propertyId)) {
        setState("not-found");
        return;
      }
      if (!supabase) {
        setErrorMessage("Rental details are temporarily unavailable because this site is not connected.");
        setState("error");
        return;
      }
      const client = supabase;

      const { data, error } = await client.from("properties")
        .select("*,property_images(*)")
        .eq("id", propertyId)
        .eq("status", "active")
        .maybeSingle();

      if (!active) return;
      if (error) {
        setErrorMessage("We couldn’t load this rental right now. Please try again later.");
        setState("error");
        return;
      }
      if (!data) {
        setState("not-found");
        return;
      }

      const activeListing = data as Property;
      setListing(activeListing);
      setState("ready");
      const images = [...activeListing.property_images].sort((a, b) => a.sort_order - b.sort_order);
      const results = await Promise.all(images.map(async (image) => {
        try {
          const { data: signedImage, error: signedImageError } = await client.storage
            .from("property-images")
            .createSignedUrl(image.storage_path, 3600);
          return { imageId: image.id, url: signedImage?.signedUrl, error: signedImageError };
        } catch {
          return { imageId: image.id, url: undefined, error: true };
        }
      }));

      if (!active) return;
      setPhotoUrls(Object.fromEntries(results.flatMap(({ imageId, url }) => url ? [[imageId, url]] : [])));
      if (results.some((result) => result.error)) {
        setErrorMessage("Some photos couldn’t be loaded. Please try again later.");
      }
    }

    void loadListing();
    return () => { active = false; };
  }, [propertyId]);

  const orderedImages = listing
    ? [...listing.property_images].sort((a, b) => a.sort_order - b.sort_order)
    : [];

  return (
    <main className="public-listing-page">
      <header className="public-listing-header">
        <a className="brand-lockup public-brand" href="/" aria-label="Kasi Rentals home">
          <span className="brand-mark"><Home size={19} strokeWidth={2.5} /></span>
          <span><strong>kasi<span>rentals</span></strong><small>FIND YOUR PLACE</small></span>
        </a>
        <a className="btn btn-outline public-back-link" href="/"><ArrowLeft size={15} /> Dashboard home</a>
      </header>

      {state === "loading" && <div className="public-message" role="status">Loading rental details…</div>}
      {state === "error" && <div className="public-message public-message-error" role="alert">{errorMessage}</div>}
      {state === "not-found" && (
        <section className="public-message public-not-found" aria-labelledby="public-not-found-title">
          <span className="public-empty-icon"><Home size={22} /></span>
          <h1 id="public-not-found-title">Rental not found</h1>
          <p>This listing may no longer be available or the link may be incorrect.</p>
          <a className="btn btn-primary" href="/">Back to Kasi Rentals</a>
        </section>
      )}
      {state === "ready" && listing && (
        <article className="public-listing-content">
          <div className="public-listing-heading">
            <div>
              <div className="eyebrow">{listing.property_type === "room" ? "ROOM TO RENT" : "ENTIRE HOME"} · AVAILABLE NOW</div>
              <h1>{listing.title}</h1>
              <p className="public-location"><MapPin size={16} />{listing.location}</p>
            </div>
            <div className="public-rent"><b>{formatCurrency(listing.monthly_rent)}</b><span>per month</span></div>
          </div>

          <section className="public-gallery" aria-label="Rental photos">
            {orderedImages.length ? orderedImages.map((image, index) => {
              const url = photoUrls[image.id];
              return url
                ? <img key={image.id} src={url} alt={image.caption || `${listing.title}, photo ${index + 1}`} />
                : <div key={image.id} className="public-photo-pending" role="status">Loading photo {index + 1}…</div>;
            }) : <div className="public-no-photos">No photos have been added to this listing yet.</div>}
          </section>

          <div className="public-details-grid">
            <section className="public-description">
              <h2>About this place</h2>
              <p>{listing.description || "Contact the rental agent for more information about this property."}</p>
            </section>
            <section className="public-facts" aria-label="Rental details">
              <div><BedDouble size={18} /><span><b>{listing.bedrooms}</b> {listing.bedrooms === 1 ? "bedroom" : "bedrooms"}</span></div>
              <div><DoorOpen size={18} /><span><b>{listing.available_rooms}</b> {listing.available_rooms === 1 ? "room" : "rooms"} available</span></div>
            </section>
          </div>
          {errorMessage && <p className="public-photo-error" role="status">{errorMessage}</p>}
          <p className="public-privacy-note"><ShieldCheck size={15} /> Only this published rental and its photos are shown.</p>
        </article>
      )}
    </main>
  );
}
