import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BedDouble, Bell, Building2, Check,
  ChevronDown, ChevronRight, CircleHelp, DoorOpen, Eye, EyeOff, ExternalLink,
  Filter, Home, ImagePlus, LogOut, Mail, MapPin, Menu, MessageCircle,
  MoreHorizontal, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, Upload, Users, X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { listingPhotoPath, validateListing, type ListingDraft } from "./lib/listings";
import type { Conversation, DashboardNotification, Message, Profile, Property, PropertyImage, UserRole } from "./types";

type ViewName = "overview" | "listings" | "inbox" | "team" | "settings" | "support";
type ListingWithImages = Property;

const blankDraft: ListingDraft = {
  title: "", property_type: "room", description: "", location: "",
  monthly_rent: 2500, bedrooms: 1, available_rooms: 1, status: "draft",
};

const sampleListings: ListingWithImages[] = [
  {
    id: "sample-1", created_by: "sample", title: "Sunny room in a shared home",
    property_type: "room", description: "A bright, secure room with a shared kitchen and a quiet place to call home.",
    location: "Tembisa, Gauteng", monthly_rent: 1800, bedrooms: 4, available_rooms: 2,
    status: "active", created_at: "2026-10-28T08:00:00Z",
    property_images: [{ id: "image-1", property_id: "sample-1", storage_path: "", caption: null, sort_order: 0 }],
  },
  {
    id: "sample-2", created_by: "sample", title: "Family home near the school",
    property_type: "house", description: "A neat three-bedroom home with a fenced yard and off-street parking.",
    location: "Mamelodi East, Pretoria", monthly_rent: 6200, bedrooms: 3, available_rooms: 3,
    status: "active", created_at: "2026-10-25T08:00:00Z", property_images: [],
  },
  {
    id: "sample-3", created_by: "sample", title: "Private bachelor room",
    property_type: "room", description: "Private entrance and bathroom, close to public transport.",
    location: "Soweto, Johannesburg", monthly_rent: 2900, bedrooms: 1, available_rooms: 0,
    status: "rented", created_at: "2026-10-20T08:00:00Z", property_images: [],
  },
];

const sampleConversations: Conversation[] = [
  { id: "chat-1", phone_number: "+27 72 481 2036", assigned_to: "demo", selected_location: "Tembisa", state: {}, last_message_at: new Date().toISOString() },
  { id: "chat-2", phone_number: "+27 83 105 7724", assigned_to: null, selected_location: "Mamelodi", state: {}, last_message_at: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
  { id: "chat-3", phone_number: "+27 61 992 4810", assigned_to: null, selected_location: "Soweto", state: {}, last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
];

const sampleTeam: Profile[] = [
  { id: "demo", display_name: "Thandi Mokoena", role: "agent", desktop_notifications_enabled: true },
  { id: "demo-owner", display_name: "Lerato Khumalo", role: "owner", desktop_notifications_enabled: false },
];

const sampleNotifications: DashboardNotification[] = [
  { id: "note-1", user_id: "demo", conversation_id: "chat-1", message_id: "message-3", title: "New WhatsApp enquiry", body: "+27 72 481 2036: That sounds perfect, please send the photos 🙏", created_at: new Date(Date.now() - 1000 * 60 * 4).toISOString(), read_at: null },
];

const sampleMessages: Message[] = [
  { id: "message-1", conversation_id: "chat-1", direction: "inbound", body: "Hi, do you have any rooms available in Tembisa for under R2,000?", provider_message_id: null, media_url: null, created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
  { id: "message-2", conversation_id: "chat-1", direction: "outbound", body: "Sawubona! Yes, we have 2 rooms available from R1,800/month. Would you like to see photos?", provider_message_id: null, media_url: null, created_at: new Date(Date.now() - 1000 * 60 * 17).toISOString() },
  { id: "message-3", conversation_id: "chat-1", direction: "inbound", body: "That sounds perfect, please send the photos 🙏", provider_message_id: null, media_url: null, created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: "message-4", conversation_id: "chat-2", direction: "inbound", body: "Looking for a family house around Mamelodi, 3 bedrooms.", provider_message_id: null, media_url: null, created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
  { id: "message-5", conversation_id: "chat-3", direction: "inbound", body: "How much is the private room?", provider_message_id: null, media_url: null, created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
];

function initials(name?: string | null) {
  return (name || "Kasi").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short" }).format(new Date(value));
}

function usePhotoUrl(storagePath?: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    setUrl(undefined);
    if (storagePath && supabase) {
      supabase.storage.from("property-images").createSignedUrl(storagePath, 3600)
        .then(({ data, error: signedUrlError }) => {
          if (active && !signedUrlError) setUrl(data.signedUrl);
        });
    }
    return () => { active = false; };
  }, [storagePath]);
  return url;
}

function App() {
  const [session, setSession] = useState<{ user: { id: string; email?: string } } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<ViewName>("overview");
  const [listings, setListings] = useState<ListingWithImages[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [demoAlerts, setDemoAlerts] = useState(sampleNotifications);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ListingWithImages | null>(null);
  const [demoMode, setDemoMode] = useState(!isSupabaseConfigured);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const notificationIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    setError("");
    const [profileResult, propertiesResult, conversationsResult, teamResult, notificationResult] = await Promise.all([
      supabase.from("profiles").select("id,role,display_name,desktop_notifications_enabled").eq("id", session.user.id).maybeSingle(),
      supabase.from("properties").select("*,property_images(*)").order("created_at", { ascending: false }),
      supabase.from("conversations").select("*").order("last_message_at", { ascending: false }),
      supabase.from("profiles").select("id,role,display_name,desktop_notifications_enabled").order("display_name"),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    const resultError = profileResult.error || propertiesResult.error || conversationsResult.error || teamResult.error || notificationResult.error;
    if (resultError) setError(resultError.message);
    if (profileResult.data) setProfile(profileResult.data as Profile);
    if (teamResult.data) setTeam(teamResult.data as Profile[]);
    if (notificationResult.data) {
      const currentNotifications = notificationResult.data as DashboardNotification[];
      notificationIds.current = new Set(currentNotifications.map((item) => item.id));
      setNotifications(currentNotifications);
    }
    if (propertiesResult.data) setListings(propertiesResult.data as ListingWithImages[]);
    if (conversationsResult.data) {
      const chats = conversationsResult.data as Conversation[];
      setConversations(chats);
      setSelectedConversation((current) => current && chats.some((chat) => chat.id === current) ? current : chats[0]?.id ?? null);
      if (chats.length) {
        const messagesResult = await supabase.from("messages").select("*")
          .in("conversation_id", chats.map((chat) => chat.id)).order("created_at");
        if (messagesResult.error) setError(messagesResult.error.message);
        else setMessages((messagesResult.data || []) as Message[]);
      } else {
        setMessages([]);
      }
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session ? { user: { id: data.session.user.id, email: data.session.user.email } } : null);
        setAuthLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession ? { user: { id: currentSession.user.id, email: currentSession.user.email } } : null);
      if (!currentSession) setProfile(null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  useEffect(() => {
    if (!session || !supabase) return;
    const client = supabase;
    let active = true;
    const timer = window.setInterval(async () => {
      const [chatsResult, alertsResult, teamResult] = await Promise.all([
        client.from("conversations").select("*").order("last_message_at", { ascending: false }),
        client.from("notifications").select("*").order("created_at", { ascending: false }).limit(30),
        client.from("profiles").select("id,role,display_name,desktop_notifications_enabled").order("display_name"),
      ]);
      if (!active) return;
      if (chatsResult.error || alertsResult.error || teamResult.error) {
        setError(chatsResult.error?.message || alertsResult.error?.message || teamResult.error?.message || "Could not refresh the workspace.");
        return;
      }
      const currentChats = (chatsResult.data || []) as Conversation[];
      setConversations(currentChats);
      if (teamResult.data) setTeam(teamResult.data as Profile[]);
      const currentNotifications = (alertsResult.data || []) as DashboardNotification[];
      const addedNotifications = currentNotifications.filter((item) => !notificationIds.current.has(item.id));
      notificationIds.current = new Set(currentNotifications.map((item) => item.id));
      setNotifications(currentNotifications);
      if (addedNotifications.length && profile?.desktop_notifications_enabled && "Notification" in window && Notification.permission === "granted") {
        addedNotifications.forEach((item) => new Notification(item.title, { body: item.body }));
      }
      setSelectedConversation((current) => current && currentChats.some((chat) => chat.id === current)
        ? current : currentChats[0]?.id ?? null);
      if (!currentChats.length) {
        setMessages([]);
        return;
      }
      const { data: latestMessages, error: messageError } = await client.from("messages")
        .select("*").in("conversation_id", currentChats.map((chat) => chat.id)).order("created_at");
      if (!active) return;
      if (messageError) setError(messageError.message);
      else setMessages((latestMessages || []) as Message[]);
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [profile?.desktop_notifications_enabled, session]);

  const isDemo = demoMode;
  const visibleListings = isDemo ? sampleListings : listings;
  const visibleConversations = isDemo ? sampleConversations : conversations;
  const visibleMessages = isDemo ? sampleMessages : messages;
  const visibleTeam = isDemo ? sampleTeam : team;
  const visibleNotifications = isDemo ? demoAlerts : notifications;
  const activeChat = visibleConversations.find((chat) => chat.id === selectedConversation) || visibleConversations[0] || null;
  const chatMessages = activeChat ? visibleMessages.filter((message) => message.conversation_id === activeChat.id) : [];
  const filteredListings = useMemo(() => visibleListings.filter((item) =>
    `${item.title} ${item.location} ${item.property_type}`.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === "all" || item.status === statusFilter),
  ), [search, statusFilter, visibleListings]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3800);
  }

  function newListing() {
    setEditing(null);
    setEditorOpen(true);
  }

  async function assignConversation(conversationId: string, agentId: string) {
    if (isDemo || !supabase) {
      showNotice("Demo mode — connect Supabase to save conversation assignments.");
      return;
    }
    const { error: assignmentError } = await supabase.from("conversations")
      .update({ assigned_to: agentId || null }).eq("id", conversationId);
    if (assignmentError) setError(assignmentError.message);
    else {
      showNotice(agentId ? "Conversation assigned. The agent will be notified of the latest request." : "Conversation unassigned.");
      await refresh();
    }
  }

  async function markNotificationRead(notification: DashboardNotification) {
    if (isDemo) {
      setDemoAlerts((current) => current.map((item) =>
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
      ));
    } else if (supabase && !notification.read_at) {
      const { error: readError } = await supabase.from("notifications")
        .update({ read_at: new Date().toISOString() }).eq("id", notification.id);
      if (readError) setError(readError.message);
      else {
        setNotifications((current) => current.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
        ));
      }
    }
    setSelectedConversation(notification.conversation_id);
    setView("inbox");
    setNotificationOpen(false);
  }

  async function setDesktopNotifications(enabled: boolean) {
    if (isDemo || !supabase || !session) {
      showNotice("Demo mode — connect Supabase to save notification settings.");
      return;
    }
    if (enabled && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (enabled && (!("Notification" in window) || Notification.permission !== "granted")) {
      showNotice("Allow notifications in your browser settings, then try again.");
      return;
    }
    const { error: preferenceError } = await supabase.from("profiles")
      .update({ desktop_notifications_enabled: enabled }).eq("id", session.user.id);
    if (preferenceError) setError(preferenceError.message);
    else setProfile((current) => current ? { ...current, desktop_notifications_enabled: enabled } : current);
  }

  async function inviteAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || isDemo) {
      showNotice("Connect Supabase to invite a teammate.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const { error: inviteError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { display_name: name, role: "agent" },
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (inviteError) setError(inviteError.message);
    else {
      setInviteOpen(false);
      showNotice(`A sign-in link was sent to ${email}.`);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session || isDemo) {
      showNotice("Demo mode — connect Supabase to save profile settings.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("display_name") || "").trim();
    const { error: profileError } = await supabase.from("profiles").update({ display_name: displayName })
      .eq("id", session.user.id);
    if (profileError) setError(profileError.message);
    else {
      setProfile((current) => current ? { ...current, display_name: displayName } : current);
      showNotice("Profile settings saved.");
    }
  }

  async function saveListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDemo || !supabase || !session) {
      setEditorOpen(false);
      showNotice("Demo mode — connect Supabase to save real listings.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const draft: ListingDraft = {
      title: String(formData.get("title") || ""),
      property_type: formData.get("property_type") === "house" ? "house" : "room",
      description: String(formData.get("description") || ""),
      location: String(formData.get("location") || ""),
      monthly_rent: Number(formData.get("monthly_rent")),
      bedrooms: Number(formData.get("bedrooms")),
      available_rooms: Number(formData.get("available_rooms")),
      status: formData.get("status") === "active" ? "active" : "draft",
    };
    const validationError = validateListing(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    const files = (formData.getAll("photos") as File[]).filter((file) => file.size > 0);
    const invalidFile = files.find((file) => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024);
    if (invalidFile) {
      setError(`${invalidFile.name} must be an image smaller than 10 MB.`);
      return;
    }
    setLoading(true);
    setError("");
    let propertyId = editing?.id;
    if (editing) {
      const { error: updateError } = await supabase.from("properties").update(draft).eq("id", editing.id);
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase.from("properties")
        .insert({ ...draft, created_by: session.user.id }).select("id").single();
      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }
      propertyId = data.id;
    }
    if (editing) {
      const removedIds = String(formData.get("removed_images") || "").split(",").filter(Boolean);
      const removedImages = editing.property_images.filter((image) => removedIds.includes(image.id));
      if (removedImages.length) {
        const { error: storageError } = await supabase.storage.from("property-images")
          .remove(removedImages.map((image) => image.storage_path));
        if (storageError) {
          setError(`Listing saved, but photos could not be removed: ${storageError.message}`);
          setLoading(false);
          await refresh();
          return;
        }
        const { error: imageDeleteError } = await supabase.from("property_images")
          .delete().in("id", removedImages.map((image) => image.id));
        if (imageDeleteError) {
          setError(`Photos were removed from storage, but their listing records could not be removed: ${imageDeleteError.message}`);
          setLoading(false);
          await refresh();
          return;
        }
      }
    }
    for (const [index, file] of files.entries()) {
      const path = listingPhotoPath(propertyId!, file.name);
      const { error: uploadError } = await supabase.storage.from("property-images").upload(path, file, { contentType: file.type });
      if (uploadError) {
        setError(`Could not upload ${file.name}: ${uploadError.message}`);
        setLoading(false);
        return;
      }
      const { error: imageError } = await supabase.from("property_images")
        .insert({ property_id: propertyId, storage_path: path, sort_order: (editing?.property_images.length || 0) + index });
      if (imageError) {
        setError(`Photo uploaded but its listing record could not be saved: ${imageError.message}`);
        setLoading(false);
        return;
      }
    }
    setEditorOpen(false);
    setLoading(false);
    showNotice(editing ? "Listing updated." : "Your listing is saved.");
    await refresh();
  }

  async function deleteListing(property: ListingWithImages) {
    if (isDemo || !supabase) {
      showNotice("Demo mode — connect Supabase to manage real listings.");
      return;
    }
    if (!window.confirm(`Delete “${property.title}”? This also removes its photos.`)) return;
    setLoading(true);
    const paths = property.property_images.map((image) => image.storage_path);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("property-images").remove(paths);
      if (storageError) {
        setError(storageError.message);
        setLoading(false);
        return;
      }
    }
    const { error: deleteError } = await supabase.from("properties").delete().eq("id", property.id);
    if (deleteError) setError(deleteError.message);
    else showNotice("Listing deleted.");
    setLoading(false);
    await refresh();
  }

  async function updateStatus(property: ListingWithImages, status: ListingWithImages["status"]) {
    if (isDemo || !supabase) {
      showNotice("Demo mode — connect Supabase to publish listings.");
      return;
    }
    const { error: updateError } = await supabase.from("properties").update({ status }).eq("id", property.id);
    if (updateError) setError(updateError.message);
    else showNotice(status === "active" ? "Listing published." : "Listing moved to draft.");
    await refresh();
  }

  if (authLoading) return <div className="loading-screen"><span className="brand-mark"><Home size={21} /></span><span>Opening your workspace…</span></div>;

  if ((!isDemo && !session) || authOpen) {
    return <AuthScreen configured={isSupabaseConfigured} onDemo={() => { setDemoMode(true); setAuthOpen(false); }} />;
  }

  const appProfile = profile || { id: "demo", role: "agent" as UserRole, display_name: "Thandi Mokoena" };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Home size={19} strokeWidth={2.5} /></div>
          <div><strong>kasi<span>rentals</span></strong><small>PROPERTY DESK</small></div>
          <button className="icon-btn mobile-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <button className="workspace-switch"><span className="workspace-icon"><Building2 size={16} /></span><span><b>My workspace</b><small>{appProfile.role === "owner" ? "Property owner" : "Rental agent"}</small></span><ChevronDown size={15} /></button>
        <div className="side-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <NavButton active={view === "overview"} icon={<Home size={18} />} label="Overview" onClick={() => { setView("overview"); setSidebarOpen(false); }} />
          <NavButton active={view === "listings"} icon={<Building2 size={18} />} label="My listings" count={visibleListings.length} onClick={() => { setView("listings"); setSidebarOpen(false); }} />
          <NavButton active={view === "inbox"} icon={<MessageCircle size={18} />} label="WhatsApp inbox" count={visibleConversations.length} onClick={() => { setView("inbox"); setSidebarOpen(false); }} />
        </nav>
        <div className="side-label side-label-spaced">MANAGE</div>
        <nav className="main-nav">
          <NavButton active={view === "team"} icon={<Users size={18} />} label="My team" count={visibleTeam.length} onClick={() => { setView("team"); setSidebarOpen(false); }} />
          <NavButton active={view === "settings"} icon={<Settings2 size={18} />} label="Settings" onClick={() => { setView("settings"); setSidebarOpen(false); }} />
        </nav>
        <div className="sidebar-spacer" />
        <div className="whatsapp-card">
          <span className="wa-glyph"><MessageCircle size={18} /></span>
          <div><b>Always in the loop</b><p>Your WhatsApp inbox is ready for every new enquiry.</p></div>
          <ArrowRight size={15} />
        </div>
        <NavButton active={view === "support"} icon={<CircleHelp size={18} />} label="Help & support" onClick={() => { setView("support"); setSidebarOpen(false); }} />
        <div className="profile-footer">
          <div className="avatar">{initials(appProfile.display_name)}</div>
          <div className="profile-meta"><b>{appProfile.display_name || "Your profile"}</b><small>{session?.user.email || "Demo workspace"}</small></div>
          <button className="icon-btn logout-btn" aria-label={session ? "Sign out" : "Exit demo"} onClick={async () => {
            if (session && supabase) await supabase.auth.signOut();
            setSession(null); setProfile(null); setDemoMode(!isSupabaseConfigured);
          }}>{session ? <LogOut size={17} /> : <ChevronDown size={17} />}</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-btn mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><b>{view === "overview" ? "Overview" : view === "listings" ? "My listings" : view === "inbox" ? "WhatsApp inbox" : view === "team" ? "My team" : view === "settings" ? "Settings" : "Help & support"}</b></div>
          <div className="topbar-actions">
            {isDemo && <span className="demo-pill"><span /> DEMO DATA</span>}
            <button className={`icon-btn notification-btn ${notificationOpen ? "active" : ""}`} aria-label="Notifications" onClick={() => setNotificationOpen((current) => !current)}><Bell size={18} />{visibleNotifications.some((item) => !item.read_at) && <i />}</button>
            {!session && <button className="btn btn-outline signin-button" onClick={() => setAuthOpen(true)}>Sign in</button>}
            <div className="topbar-avatar">{initials(appProfile.display_name)}</div>
          </div>
          {notificationOpen && <NotificationPanel notifications={visibleNotifications} onSelect={markNotificationRead} onClose={() => setNotificationOpen(false)} />}
        </header>
        {(error || notice) && <div className={`feedback-banner ${error ? "error" : "success"}`} role="status">{error ? <CircleHelp size={17} /> : <Check size={17} />}{error || notice}{error && <button className="icon-btn" onClick={() => setError("")}><X size={16} /></button>}</div>}
        {view === "overview" && <Overview listings={visibleListings} conversations={visibleConversations} messages={visibleMessages} onNewListing={newListing} onListings={() => setView("listings")} onInbox={() => setView("inbox")} />}
        {view === "listings" && <ListingsView listings={filteredListings} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onCreate={newListing} onEdit={(item) => { setEditing(item); setEditorOpen(true); }} onDelete={deleteListing} onStatus={updateStatus} loading={loading} />}
        {view === "inbox" && <InboxView conversations={visibleConversations} messages={visibleMessages} activeChat={activeChat} chatMessages={chatMessages} selected={selectedConversation} onSelect={setSelectedConversation} agents={visibleTeam.filter((member) => member.role === "agent")} onAssign={assignConversation} />}
        {view === "team" && <TeamView team={visibleTeam} currentUserId={session?.user.id || "demo"} onInvite={() => setInviteOpen(true)} />}
        {view === "settings" && <SettingsView profile={appProfile} email={session?.user.email || "Demo workspace"} onSave={saveProfile} onNotificationChange={setDesktopNotifications} />}
        {view === "support" && <SupportView onInbox={() => setView("inbox")} />}
      </main>
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      {editorOpen && <ListingEditor key={editing?.id || "new"} listing={editing} saving={loading} onClose={() => setEditorOpen(false)} onSave={saveListing} />}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvite={inviteAgent} />}
    </div>
  );
}

function NavButton({ active, icon, label, count, onClick }: { active: boolean; icon: React.ReactNode; label: string; count?: number; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <span className={`nav-count ${active ? "selected" : ""}`}>{count}</span>}</button>;
}

function Overview({ listings, conversations, messages, onNewListing, onListings, onInbox }: {
  listings: ListingWithImages[]; conversations: Conversation[]; messages: Message[];
  onNewListing: () => void; onListings: () => void; onInbox: () => void;
}) {
  const active = listings.filter((item) => item.status === "active").length;
  const available = listings.reduce((count, item) => count + item.available_rooms, 0);
  const inbound = messages.filter((message) => message.direction === "inbound").length;
  return (
    <div className="page-wrap">
      <div className="welcome-row">
        <div><div className="eyebrow"><Sparkles size={14} /> YOUR RENTAL HQ</div><h1>Good morning, Thandi <span>✦</span></h1><p>Here’s what’s happening with your rentals today.</p></div>
        <button className="btn btn-primary" onClick={onNewListing}><Plus size={17} /> Add a listing</button>
      </div>
      <section className="hero-panel">
        <div className="hero-copy"><span className="hero-kicker">GROW YOUR RENTAL BUSINESS</span><h2>Good homes.<br /><em>Good people.</em><br />That’s the whole point.</h2><p>Keep your rooms up to date and let WhatsApp do the welcoming.</p><button className="btn btn-light" onClick={onNewListing}>Add your next listing <ArrowRight size={16} /></button></div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun-disc" /><div className="art-hill hill-back" /><div className="art-hill hill-front" />
          <div className="art-home"><div className="art-roof" /><div className="art-wall"><div className="art-window" /><div className="art-door" /></div></div>
          <div className="floating-note"><span className="note-icon"><MessageCircle size={16} /></span><div><b>New enquiry</b><small>Ready when you are</small></div><i /></div>
          <div className="star-star">✳</div>
        </div>
        <div className="hero-index">01 <span>/ 03</span></div>
      </section>
      <div className="section-heading"><div><h2>Your overview</h2><p>A little snapshot of your rental world.</p></div><button className="text-button" onClick={onListings}>View all listings <ArrowRight size={15} /></button></div>
      <div className="stat-grid">
        <StatCard icon={<Building2 size={18} />} label="Total listings" value={listings.length.toString()} note={`${active} currently published`} tone="sage" />
        <StatCard icon={<DoorOpen size={18} />} label="Rooms available" value={available.toString()} note="Ready for their next tenant" tone="cream" />
        <StatCard icon={<MessageCircle size={18} />} label="WhatsApp chats" value={conversations.length.toString()} note={`${inbound} incoming messages`} tone="lavender" />
        <StatCard icon={<ArrowUpRight size={18} />} label="Avg. monthly rent" value={formatCurrency(listings.length ? Math.round(listings.reduce((sum, item) => sum + item.monthly_rent, 0) / listings.length) : 0)} note="Across all your properties" tone="peach" />
      </div>
      <div className="overview-lower">
        <section className="content-card listing-summary">
          <div className="card-heading"><div><h3>Recently added</h3><p>Your latest rental listings</p></div><button className="icon-btn" aria-label="More listing options"><MoreHorizontal size={19} /></button></div>
          <div className="recent-list">
            {listings.slice(0, 3).map((listing) => <RecentListing key={listing.id} listing={listing} />)}
            {!listings.length && <EmptyState title="No listings yet" text="Add your first room or house to get started." action="Add a listing" onClick={onNewListing} />}
          </div>
          {listings.length > 0 && <button className="card-footer-link" onClick={onListings}>See all properties <ArrowRight size={15} /></button>}
        </section>
        <section className="content-card inbox-summary">
          <div className="card-heading"><div><h3>WhatsApp inbox <span className="live-tag"><i /> LIVE</span></h3><p>Recent chats from potential tenants</p></div><button className="round-arrow" aria-label="Open inbox" onClick={onInbox}><ArrowRight size={16} /></button></div>
          <div className="conversation-preview-list">
            {conversations.slice(0, 3).map((conversation, index) => {
              const latest = messages.filter((message) => message.conversation_id === conversation.id).at(-1);
              return <button className="conversation-preview" key={conversation.id} onClick={onInbox}>
                <div className={`chat-avatar chat-avatar-${index % 3}`}>{initials(conversation.phone_number.replace(/\D/g, "").slice(-4))}</div>
                <div className="chat-preview-copy"><b>{conversation.phone_number}</b><span>{latest?.body || "New conversation"}</span></div>
                <small>{timeAgo(conversation.last_message_at)}</small>
              </button>;
            })}
            {!conversations.length && <EmptyState title="All quiet for now" text="New WhatsApp enquiries will show up here." />}
          </div>
          <button className="card-footer-link" onClick={onInbox}>Go to inbox <ArrowRight size={15} /></button>
        </section>
      </div>
      <div className="footer-note"><ShieldCheck size={14} /> Your listings, your rules. You’re in control of what renters see.</div>
    </div>
  );
}

function StatCard({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><b className="stat-value">{value}</b><span className="stat-note">{note}</span><ArrowUpRight className="stat-arrow" size={16} /></article>;
}

function RecentListing({ listing }: { listing: ListingWithImages }) {
  const image = listing.property_images[0];
  const url = usePhotoUrl(image?.storage_path);
  return <div className="recent-listing">
    {url ? <img className="listing-thumb" src={url} alt="" /> : <div className={`listing-thumb listing-thumb-${listing.property_type}`}><Home size={21} /></div>}
    <div className="recent-listing-info"><b>{listing.title}</b><span><MapPin size={12} />{listing.location}</span></div>
    <div className="recent-listing-price"><b>{formatCurrency(listing.monthly_rent)}</b><small>/ month</small></div>
    <StatusBadge status={listing.status} />
  </div>;
}

function StatusBadge({ status }: { status: ListingWithImages["status"] }) {
  return <span className={`status-badge ${status}`}><i />{status === "active" ? "Published" : status === "rented" ? "Rented" : "Draft"}</span>;
}

function EmptyState({ title, text, action, onClick }: { title: string; text: string; action?: string; onClick?: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><Home size={19} /></div><b>{title}</b><p>{text}</p>{action && <button className="text-button" onClick={onClick}>{action} <ArrowRight size={14} /></button>}</div>;
}

function ListingsView({ listings, search, setSearch, statusFilter, setStatusFilter, onCreate, onEdit, onDelete, onStatus, loading }: {
  listings: ListingWithImages[]; search: string; setSearch: (value: string) => void;
  statusFilter: string; setStatusFilter: (value: string) => void; onCreate: () => void;
  onEdit: (listing: ListingWithImages) => void; onDelete: (listing: ListingWithImages) => void;
  onStatus: (listing: ListingWithImages, status: ListingWithImages["status"]) => void; loading: boolean;
}) {
  return <div className="page-wrap listings-page">
    <div className="page-heading-row"><div><div className="eyebrow">YOUR PROPERTIES</div><h1>My listings</h1><p>Every room and home, all in one place.</p></div><button className="btn btn-primary" onClick={onCreate}><Plus size={17} /> Add a listing</button></div>
    <div className="listings-toolbar"><div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or location" /><kbd>⌘ K</kbd></div><label className="filter-control"><SlidersHorizontal size={15} /><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Published</option><option value="draft">Draft</option><option value="rented">Rented</option></select><ChevronDown size={13} /></label><div className="results-count">{listings.length} {listings.length === 1 ? "property" : "properties"}</div></div>
    {loading && <div className="inline-loading">Saving your changes…</div>}
    {listings.length ? <div className="listing-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} onEdit={() => onEdit(listing)} onDelete={() => onDelete(listing)} onStatus={(status) => onStatus(listing, status)} />)}</div> : <div className="content-card listings-empty"><EmptyState title="No properties found" text={search ? "Try another search, or clear the search box." : "Your next great tenant starts with a listing."} action={search ? undefined : "Add a listing"} onClick={onCreate} /></div>}
    <div className="listing-disclaimer"><ShieldCheck size={14} /> Only active listings are shared with the WhatsApp assistant.</div>
  </div>;
}

function ListingCard({ listing, onEdit, onDelete, onStatus }: {
  listing: ListingWithImages; onEdit: () => void; onDelete: () => void;
  onStatus: (status: ListingWithImages["status"]) => void;
}) {
  const image = listing.property_images[0];
  const imageUrl = usePhotoUrl(image?.storage_path);
  return <article className="property-card">
    <div className="property-cover">
      {imageUrl ? <img src={imageUrl} alt={image?.caption || listing.title} /> : <div className={`cover-placeholder cover-${listing.property_type}`}><span className="cover-sun" /><div className="cover-house"><span /><i /></div><div className="cover-hill" /><small>{listing.property_type === "room" ? "ROOM TO GROW" : "A PLACE TO CALL HOME"}</small></div>}
      <StatusBadge status={listing.status} />
      <button className="property-more icon-btn" aria-label="Listing actions" onClick={onEdit}><MoreHorizontal size={19} /></button>
      {listing.property_images.length > 0 && <span className="photo-count"><ImagePlus size={12} />{listing.property_images.length}</span>}
    </div>
    <div className="property-body">
      <div className="property-type-label">{listing.property_type === "room" ? "ROOM TO RENT" : "ENTIRE HOME"} <span>·</span> {listing.location.split(",")[0]}</div>
      <h3>{listing.title}</h3>
      <div className="property-location"><MapPin size={14} /> {listing.location}</div>
      <div className="property-features"><span><BedDouble size={15} />{listing.bedrooms} {listing.bedrooms === 1 ? "bedroom" : "bedrooms"}</span><span><DoorOpen size={15} />{listing.available_rooms} available</span></div>
      <div className="property-card-bottom"><div><b>{formatCurrency(listing.monthly_rent)}</b><span> / month</span></div><div className="property-actions"><button title="Edit listing" onClick={onEdit}>Edit</button>{listing.status === "active" ? <><button title="Mark as rented" onClick={() => onStatus("rented")}><Check size={15} /></button><button title="Move to draft" onClick={() => onStatus("draft")}><EyeOff size={15} /></button></> : listing.status === "rented" ? <button title="Mark active" onClick={() => onStatus("active")}><Eye size={15} /></button> : <button title="Publish listing" onClick={() => onStatus("active")}><Eye size={15} /></button>}<button title="Delete listing" className="delete-action" onClick={onDelete}><X size={15} /></button></div></div>
    </div>
  </article>;
}

function InboxView({ conversations, messages, activeChat, chatMessages, selected, onSelect, agents, onAssign }: {
  conversations: Conversation[]; messages: Message[]; activeChat: Conversation | null;
  chatMessages: Message[]; selected: string | null; onSelect: (id: string) => void;
  agents: Profile[]; onAssign: (conversationId: string, agentId: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const filteredChats = conversations.filter((chat) => chat.phone_number.includes(filter) || (chat.selected_location || "").toLowerCase().includes(filter.toLowerCase()));
  return <div className="page-wrap inbox-page">
    <div className="page-heading-row inbox-heading"><div><div className="eyebrow">TENANT CONVERSATIONS</div><h1>WhatsApp inbox</h1><p>See what people are looking for and how the assistant replied.</p></div><span className="inbox-live-label"><i /> UPDATES EVERY 15 SEC</span></div>
    <div className="inbox-layout content-card">
      <section className="chat-list-panel">
        <div className="chat-list-heading"><div><h3>Conversations <span>{conversations.length}</span></h3><small>Sorted by most recent</small></div><button className="icon-btn" aria-label="Conversation filters"><Filter size={17} /></button></div>
        <div className="chat-search"><Search size={15} /><input placeholder="Search chats..." value={filter} onChange={(event) => setFilter(event.target.value)} /></div>
        <div className="chat-list">
          {filteredChats.map((chat, index) => {
            const latest = messages.filter((message) => message.conversation_id === chat.id).at(-1);
            return <button key={chat.id} className={`chat-list-item ${(selected || activeChat?.id) === chat.id ? "selected" : ""}`} onClick={() => onSelect(chat.id)}>
              <div className={`chat-avatar chat-avatar-${index % 3}`}>{initials(chat.phone_number.replace(/\D/g, "").slice(-4))}</div>
              <div className="chat-list-copy"><div><b>{chat.phone_number}</b><time>{timeAgo(chat.last_message_at)}</time></div><p>{latest?.body || "Conversation started"}</p><span className="location-chip"><MapPin size={10} />{chat.selected_location || "Location not set"}</span></div>
            </button>;
          })}
          {!filteredChats.length && <div className="chat-empty">No conversations yet.</div>}
        </div>
      </section>
      <section className="chat-detail">
        {activeChat ? <>
          <div className="chat-detail-head"><div className="chat-avatar chat-avatar-0">{initials(activeChat.phone_number.replace(/\D/g, "").slice(-4))}</div><div className="detail-person"><b>{activeChat.phone_number}</b><span><i /> WhatsApp · {activeChat.selected_location || "Location not set"}</span></div><label className="assign-control"><Users size={14} /><select aria-label="Assign conversation to an agent" value={activeChat.assigned_to || ""} onChange={(event) => onAssign(activeChat.id, event.target.value)}><option value="">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.display_name || "Agent"}</option>)}</select><ChevronDown size={12} /></label><button className="btn btn-outline" onClick={() => window.open(`https://wa.me/${activeChat.phone_number.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}><MessageCircle size={15} /> Open WhatsApp</button></div>
          <div className="chat-date-line"><span />Today<span /></div>
          <div className="message-stream">
            {chatMessages.map((message) => <div key={message.id} className={`message-row ${message.direction}`}>
              {message.direction === "outbound" && <div className="bot-mini"><Sparkles size={12} /></div>}
              <div className="message-bubble"><p>{message.body}</p>{message.media_url && <a href={message.media_url} target="_blank" rel="noreferrer">View shared image <ArrowUpRight size={12} /></a>}<small>{new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))}{message.direction === "outbound" && <Check size={12} />}</small></div>
              {message.direction === "inbound" && <div className="human-mini">{initials(activeChat.phone_number.replace(/\D/g, "").slice(-4))}</div>}
            </div>)}
            {!chatMessages.length && <div className="chat-empty">Messages for this conversation will appear here.</div>}
          </div>
          <div className="chat-readonly-note"><ShieldCheck size={15} /><span>The assistant is handling replies. This view is for monitoring conversations.</span></div>
        </> : <div className="no-chat-selected"><MessageCircle size={24} /><b>Select a conversation</b><p>Choose a chat to view its messages.</p></div>}
      </section>
    </div>
    <div className="inbox-footnote"><ArrowDownLeft size={14} /> {messages.filter((message) => message.direction === "inbound").length} incoming messages <span>·</span> <ArrowUpRight size={14} /> {messages.filter((message) => message.direction === "outbound").length} assistant replies</div>
  </div>;
}

function ListingEditor({ listing, saving, onClose, onSave }: {
  listing: ListingWithImages | null; saving: boolean; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const initial = listing || blankDraft;
  function previewFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    setPreviewImages(files.map((file) => URL.createObjectURL(file)));
  }
  useEffect(() => () => previewImages.forEach((url) => URL.revokeObjectURL(url)), [previewImages]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="listing-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-header"><div><div className="eyebrow">{listing ? "MAKE IT JUST RIGHT" : "A NEW PLACE TO CALL HOME"}</div><h2 id="modal-title">{listing ? "Edit your listing" : "Add a listing"}</h2><p>Share the details renters really want to know.</p></div><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={20} /></button></div>
      <form onSubmit={onSave}>
        <input type="hidden" name="removed_images" value={removedImages.join(",")} />
        <div className="form-grid">
          <label className="field full"><span>Listing title</span><input name="title" defaultValue={initial.title} placeholder="e.g. Sunny room near the taxi rank" required maxLength={100} /></label>
          <label className="field"><span>What are you listing?</span><select name="property_type" defaultValue={initial.property_type}><option value="room">Room to rent</option><option value="house">Entire house</option></select></label>
          <label className="field"><span>Location</span><span className="input-with-icon"><MapPin size={15} /><input name="location" defaultValue={initial.location} placeholder="e.g. Tembisa, Gauteng" required maxLength={140} /></span></label>
          <label className="field"><span>Monthly rent (R)</span><input name="monthly_rent" type="number" min="1" step="50" defaultValue={initial.monthly_rent} required /></label>
          <label className="field"><span>Bedrooms</span><input name="bedrooms" type="number" min="1" max="30" defaultValue={initial.bedrooms} required /></label>
          <label className="field"><span>Rooms available</span><input name="available_rooms" type="number" min="0" max="30" defaultValue={initial.available_rooms} required /></label>
          <label className="field"><span>Listing status</span><select name="status" defaultValue={initial.status}><option value="draft">Keep as draft</option><option value="active">Publish listing</option><option value="rented">Mark as rented</option></select></label>
          <label className="field full"><span>Description <small>Optional</small></span><textarea name="description" rows={3} defaultValue={initial.description} maxLength={1000} placeholder="Tell people about the space, nearby transport, utilities or house rules..." /></label>
          <div className="field full"><span>Photos <small>Show renters what makes it feel like home</small></span>
            <label className="upload-zone"><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={previewFiles} /><span className="upload-icon"><Upload size={19} /></span><b>Add photos or <u>browse files</u></b><small>JPG, PNG or WebP · Up to 10 MB each</small></label>
            {(previewImages.length > 0 || listing?.property_images.length) && <div className="photo-preview-grid">{previewImages.map((url) => <img src={url} key={url} alt="Selected photo preview" />)}{listing?.property_images.filter((image) => !removedImages.includes(image.id)).map((image) => <ExistingPhoto key={image.id} image={image} onRemove={() => setRemovedImages((current) => [...current, image.id])} />)}</div>}
          </div>
        </div>
        <div className="modal-footer"><span><ShieldCheck size={14} /> You can edit or unpublish this anytime.</span><div><button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : <><Check size={16} /> {listing ? "Save changes" : "Save listing"}</>}</button></div></div>
      </form>
    </section>
  </div>;
}

function ExistingPhoto({ image, onRemove }: { image: PropertyImage; onRemove: () => void }) {
  const url = usePhotoUrl(image.storage_path);
  return url ? <div className="photo-thumb"><img src={url} alt={image.caption || "Property"} /><button type="button" aria-label="Remove photo" onClick={onRemove}><X size={12} /></button></div> : null;
}

function NotificationPanel({ notifications, onSelect, onClose }: {
  notifications: DashboardNotification[];
  onSelect: (notification: DashboardNotification) => void;
  onClose: () => void;
}) {
  return <section className="notification-panel" aria-label="Notifications">
    <div className="notification-panel-head"><div><b>Notifications</b><small>WhatsApp requests assigned to you</small></div><button className="icon-btn" aria-label="Close notifications" onClick={onClose}><X size={16} /></button></div>
    <div className="notification-items">
      {notifications.map((item) => <button key={item.id} className={`notification-item ${item.read_at ? "" : "unread"}`} onClick={() => onSelect(item)}>
        <span className="notification-item-icon"><MessageCircle size={15} /></span><span className="notification-item-copy"><b>{item.title}</b><span>{item.body}</span><small>{timeAgo(item.created_at)}</small></span>{!item.read_at && <i />}
      </button>)}
      {!notifications.length && <div className="notification-empty"><Bell size={19} /><b>You’re all caught up</b><span>Requests assigned to you will appear here.</span></div>}
    </div>
    <button className="notification-footer" onClick={() => { onClose(); }}>Notifications are private to your account</button>
  </section>;
}

function TeamView({ team, currentUserId, onInvite }: { team: Profile[]; currentUserId: string; onInvite: () => void }) {
  return <div className="page-wrap management-page">
    <div className="page-heading-row"><div><div className="eyebrow">YOUR PEOPLE</div><h1>My team</h1><p>Keep your team in sync and make sure every enquiry has an owner.</p></div><button className="btn btn-primary" onClick={onInvite}><Plus size={16} /> Invite an agent</button></div>
    <div className="team-banner"><div className="team-banner-icon"><Users size={20} /></div><div><b>Better together</b><p>Invite a teammate to help manage enquiries. They’ll get a secure sign-in link by email.</p></div><span className="team-count">{team.length} {team.length === 1 ? "member" : "members"}</span></div>
    <section className="content-card team-table">
      <div className="management-card-heading"><div><h2>Team members</h2><p>People with access to this rentals workspace.</p></div><span className="table-caption">DIRECTORY</span></div>
      <div className="team-table-head"><span>MEMBER</span><span>ROLE</span><span>DESKTOP ALERTS</span><span>STATUS</span></div>
      {team.map((member, index) => <div className="team-row" key={member.id}>
        <div className={`team-avatar team-avatar-${index % 4}`}>{initials(member.display_name)}</div>
        <div className="team-person"><b>{member.display_name || "New team member"}{member.id === currentUserId && <span className="you-tag">YOU</span>}</b><small>{member.role === "owner" ? "Property owner" : "Rental agent"}</small></div>
        <span className={`role-chip ${member.role}`}>{member.role === "owner" ? "Owner" : "Agent"}</span>
        <span className="member-alert-state">{member.desktop_notifications_enabled ? <><i className="online-dot" /> Enabled</> : <span>Off</span>}</span>
        <span className="member-status"><i /> Active</span>
      </div>)}
      {!team.length && <EmptyState title="Your team starts here" text="Invite the agents who will look after your enquiries." action="Invite an agent" onClick={onInvite} />}
    </section>
    <div className="team-security-note"><ShieldCheck size={15} /> Each agent sees their own alerts. Conversation access is shared with signed-in dashboard members.</div>
  </div>;
}

function SettingsView({ profile, email, onSave, onNotificationChange }: {
  profile: Profile; email: string; onSave: (event: FormEvent<HTMLFormElement>) => void;
  onNotificationChange: (enabled: boolean) => void;
}) {
  const [resetSent, setResetSent] = useState(false);
  async function sendPasswordReset() {
    if (!supabase || email === "Demo workspace") return;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
    if (resetError) return;
    setResetSent(true);
  }
  return <div className="page-wrap management-page">
    <div className="page-heading-row"><div><div className="eyebrow">MAKE IT YOURS</div><h1>Settings</h1><p>Manage your account and how you hear about new enquiries.</p></div><span className="settings-badge"><Settings2 size={15} /> WORKSPACE SETTINGS</span></div>
    <div className="settings-layout">
      <div className="settings-main">
        <section className="content-card settings-card">
          <div className="management-card-heading"><div><h2>Your profile</h2><p>How you show up to your team.</p></div><div className="settings-profile-avatar">{initials(profile.display_name)}</div></div>
          <form className="settings-form" onSubmit={onSave}>
            <label className="field"><span>Display name</span><input name="display_name" defaultValue={profile.display_name} placeholder="Your name" required maxLength={80} /></label>
            <label className="field"><span>Email address</span><input value={email} readOnly aria-readonly="true" /></label>
            <label className="field"><span>Account role</span><input value={profile.role === "owner" ? "Property owner" : "Rental agent"} readOnly aria-readonly="true" /></label>
            <div className="settings-actions"><span>Profile updates are only visible to signed-in team members.</span><button className="btn btn-primary" type="submit"><Check size={15} /> Save changes</button></div>
          </form>
        </section>
        <section className="content-card settings-card alert-settings">
          <div className="management-card-heading"><div><h2>Notifications</h2><p>Choose when this device should alert you.</p></div><div className="notification-setting-icon"><Bell size={18} /></div></div>
          <label className="preference-row"><span className="preference-icon"><MessageCircle size={17} /></span><span className="preference-copy"><b>WhatsApp enquiry alerts</b><small>Get a browser notification when a new message is assigned to you.</small></span><input type="checkbox" checked={Boolean(profile.desktop_notifications_enabled)} onChange={(event) => onNotificationChange(event.target.checked)} /></label>
          <p className="permission-hint">Browser alerts require permission for this site and work while the dashboard is open.</p>
        </section>
        <section className="content-card settings-card">
          <div className="management-card-heading"><div><h2>Password & sign-in</h2><p>Keep your account protected.</p></div><div className="secure-icon"><ShieldCheck size={18} /></div></div>
          <div className="password-reset-row"><div><b>Password reset</b><small>{resetSent ? "Reset link sent — check your inbox." : "We’ll email you a secure password reset link."}</small></div><button className="btn btn-outline" onClick={() => void sendPasswordReset()} disabled={email === "Demo workspace"}>Send reset link <ArrowRight size={14} /></button></div>
        </section>
      </div>
      <aside className="settings-aside">
        <div className="settings-tip"><Sparkles size={17} /><b>A little heads-up goes a long way.</b><p>Enable browser alerts to see new WhatsApp requests even while you’re working in another tab.</p></div>
        <div className="content-card workspace-info"><span className="workspace-icon"><Home size={17} /></span><b>Kasi Rentals workspace</b><small>Shared rental team</small><span className="workspace-info-line" /><small>Property listings: visible to your account</small><small>WhatsApp alerts: private to each agent</small></div>
      </aside>
    </div>
  </div>;
}

function SupportView({ onInbox }: { onInbox: () => void }) {
  return <div className="page-wrap management-page">
    <div className="page-heading-row"><div><div className="eyebrow">WE’RE HERE TO HELP</div><h1>Help & support</h1><p>Quick answers for the everyday things.</p></div><a className="btn btn-primary" href="mailto:hello@kasirentals.co.za?subject=Kasi%20Rentals%20support"><Mail size={16} /> Contact support</a></div>
    <div className="support-highlight"><div className="support-highlight-icon"><CircleHelp size={22} /></div><div><span>NEED A HAND?</span><h2>Real people, ready to help.</h2><p>Send us a note and tell us what you’re trying to do. We’ll get back to you as soon as we can.</p><a href="mailto:hello@kasirentals.co.za?subject=Kasi%20Rentals%20support">hello@kasirentals.co.za <ExternalLink size={13} /></a></div><div className="support-doodle">✳</div></div>
    <div className="support-grid">
      <section className="content-card support-faq"><div className="management-card-heading"><div><h2>Frequently asked</h2><p>A few helpful things to know.</p></div></div>
        <details><summary>How do I publish a room or house? <ChevronDown size={15} /></summary><p>Open My listings, choose Add a listing, add your location, price and room count, then choose Publish listing. Only published listings are shown to the WhatsApp assistant.</p></details>
        <details><summary>How do I get WhatsApp enquiry alerts? <ChevronDown size={15} /></summary><p>Assign a conversation to your agent in the WhatsApp inbox. Turn on browser alerts in Settings and allow notifications when your browser asks.</p></details>
        <details><summary>Can I reply to WhatsApp chats here? <ChevronDown size={15} /></summary><p>This dashboard is for monitoring. The assistant sends replies through WhatsApp. Open a chat in WhatsApp if you need to continue the conversation yourself.</p></details>
        <details><summary>How do I add an agent to my team? <ChevronDown size={15} /></summary><p>Go to My team and send the agent a secure sign-in link by email. They can then sign in to the dashboard.</p></details>
      </section>
      <aside className="support-side-stack">
        <button className="content-card support-action-card" onClick={onInbox}><span className="support-action-icon"><MessageCircle size={18} /></span><span><b>Check your inbox</b><small>Review a WhatsApp request</small></span><ArrowRight size={16} /></button>
        <a className="content-card support-action-card" href="mailto:hello@kasirentals.co.za?subject=Kasi%20Rentals%20support"><span className="support-action-icon peach"><Mail size={18} /></span><span><b>Email our team</b><small>hello@kasirentals.co.za</small></span><ArrowRight size={16} /></a>
        <div className="support-safety-note"><ShieldCheck size={16} /><span><b>Your account stays yours.</b><br />We’ll never ask you to share your password or a WhatsApp verification code.</span></div>
      </aside>
    </div>
  </div>;
}

function InviteModal({ onClose, onInvite }: { onClose: () => void; onInvite: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="invite-modal content-card" role="dialog" aria-modal="true" aria-labelledby="invite-title">
      <div className="modal-header"><div><div className="eyebrow">GROW YOUR TEAM</div><h2 id="invite-title">Invite an agent</h2><p>We’ll send them a secure sign-in link.</p></div><button className="icon-btn" aria-label="Close invite" onClick={onClose}><X size={19} /></button></div>
      <form className="invite-form" onSubmit={onInvite}><label className="field"><span>Agent name</span><input name="name" required maxLength={80} placeholder="e.g. Naledi Dlamini" /></label><label className="field"><span>Email address</span><input type="email" name="email" required placeholder="agent@example.com" /></label><div className="invite-role-note"><Users size={15} /> They’ll join as a rental agent.</div><div className="modal-footer"><span><ShieldCheck size={14} /> No password is shared by email.</span><div><button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit"><Mail size={14} /> Send invite</button></div></div></form>
    </section>
  </div>;
}

function AuthScreen({ onDemo, configured }: { onDemo: () => void; configured: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<UserRole>("agent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Sign in is not connected yet. Configure Supabase to enable accounts.");
      return;
    }
    setBusy(true); setError("");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email"));
    const password = String(values.get("password"));
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: values.get("name"), role } } });
    if (result.error) setError(result.error.message);
    else if (mode === "signup" && !result.data.session) setError("Check your email to confirm your account, then sign in.");
    setBusy(false);
  }
  return <div className="auth-page">
    <aside className="auth-aside"><div className="brand-lockup auth-brand"><div className="brand-mark"><Home size={19} strokeWidth={2.5} /></div><div><strong>kasi<span>rentals</span></strong><small>PROPERTY DESK</small></div></div><div className="auth-art"><span>MADE FOR THE WAY WE LIVE</span><h2>Good homes.<br /><em>Good people.</em></h2><p>A little more heart in the rental process. A lot less admin on your plate.</p><div className="auth-illustration"><div className="auth-sun" /><div className="auth-house"><div /><span /></div><div className="auth-hill" /></div></div><small className="auth-copyright">© 2026 Kasi Rentals · Made for our communities</small></aside>
    <main className="auth-main"><div className="auth-form-wrap"><div className="eyebrow">WELCOME TO YOUR RENTAL HQ</div><h1>{mode === "signin" ? "Good to have you back." : "Let’s get you set up."}</h1><p>{mode === "signin" ? "Sign in to pick up right where you left off." : "Create your account and start sharing your listings."}</p>
      <div className="auth-tabs"><button className={mode === "signin" ? "selected" : ""} onClick={() => setMode("signin")}>Sign in</button><button className={mode === "signup" ? "selected" : ""} onClick={() => setMode("signup")}>Create account</button></div>
      <form onSubmit={submit} className="auth-form">
        {!configured && <div className="auth-error"><CircleHelp size={15} />Account sign-in needs a Supabase project. You can still explore the demo below.</div>}
        {mode === "signup" && <><label className="field"><span>Your name</span><input name="name" placeholder="e.g. Thandi Mokoena" required /></label><div className="role-picker"><span>I’m joining as a...</span><div><button type="button" className={role === "agent" ? "selected" : ""} onClick={() => setRole("agent")}><Users size={15} /> Rental agent</button><button type="button" className={role === "owner" ? "selected" : ""} onClick={() => setRole("owner")}><Home size={15} /> Property owner</button></div></div></>}
        <label className="field"><span>Email address</span><input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
        <label className="field"><span>Password</span><span className="input-with-icon password-input"><input name="password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} required /><button type="button" className="icon-btn" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
        {error && <div className="auth-error"><CircleHelp size={15} />{error}</div>}
        <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? "One moment…" : <>{mode === "signin" ? "Sign in to your workspace" : "Create my account"} <ArrowRight size={16} /></>}</button>
      </form>
      <div className="auth-secure"><ShieldCheck size={14} /> Your details stay safe and secure.</div>
      <button className="demo-link" onClick={onDemo}>Just looking around? Explore the demo <ArrowRight size={14} /></button>
    </div></main>
  </div>;
}

export default App;
