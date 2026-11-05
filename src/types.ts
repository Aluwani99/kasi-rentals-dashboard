export type UserRole = "agent" | "owner";

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
}

export interface Property {
  id: string;
  created_by: string;
  title: string;
  property_type: "room" | "house";
  description: string;
  location: string;
  monthly_rent: number;
  bedrooms: number;
  available_rooms: number;
  status: "draft" | "active" | "rented";
  created_at: string;
  property_images: PropertyImage[];
}

export interface Conversation {
  id: string;
  phone_number: string;
  selected_location: string | null;
  state: Record<string, unknown>;
  last_message_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string;
  provider_message_id: string | null;
  media_url: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: "whatsapp_inbound";
  title: string;
  body: string;
  related_message_id: string | null;
  read_at: string | null;
  created_at: string;
}
