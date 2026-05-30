"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

interface InboxItem {
  partner_id: string;
  partner_name: string;
  partner_gender: string;
  partner_tagline: string;
  last_message: string | null;
  last_message_at: string | null;
  last_message_mine: boolean;
  unread_count: number;
}

function AvatarCircle({ name, gender }: { name: string; gender: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  const bg =
    gender === "female"
      ? "bg-pink-100 text-pink-700"
      : gender === "male"
      ? "bg-blue-100 text-blue-700"
      : "bg-gray-100 text-gray-600";
  return (
    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${bg}`}>
      {initials || "?"}
    </div>
  );
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0)
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-IN", { weekday: "short" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function InboxPage() {
  const router = useRouter();
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [filtered, setFiltered] = useState<InboxItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    fetch("http://127.0.0.1:8000/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const uid = data.user?.user_id;
        if (!uid) { router.push("/login"); return; }

        // WebSocket — uid yahan available hai
        const ws = new WebSocket(`ws://127.0.0.1:8000/ws/chat/${uid}?token=${token}`);
        ws.onmessage = () => {
          fetch("http://127.0.0.1:8000/chat/inbox", {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json())
            .then((d) => setInbox(d?.inbox ?? []));
        };
        wsRef.current = ws;

        // Inbox fetch
        return fetch("http://127.0.0.1:8000/chat/inbox", {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((r) => r?.json())
      .then((data) => {
        setInbox(data?.inbox ?? []);
        setFiltered(data?.inbox ?? []);
      })
      .catch(() => setError("Could not load inbox."))
      .finally(() => setLoading(false));

    return () => { wsRef.current?.close(); };
  }, []);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) { setFiltered(inbox); return; }
    setFiltered(
      inbox.filter(
        (item) =>
          item.partner_name.toLowerCase().includes(q) ||
          item.partner_tagline.toLowerCase().includes(q)
      )
    );
  }, [search, inbox]);

  const openChat = (item: InboxItem) => {
    router.push(`/chat?userId=${item.partner_id}&name=${encodeURIComponent(item.partner_name)}`);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8 pt-8 pb-4 border-b border-gray-100 flex-shrink-0">
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-gray-500 text-sm mt-1">Your conversations with past call partners</p>
          <div className="mt-4 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or tagline..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-gray-50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-3 text-gray-400 mt-10 px-8">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}

          {error && <p className="text-red-500 text-sm px-8 mt-10">{error}</p>}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No conversations yet</p>
              <p className="text-gray-400 text-sm mt-1">
                {search ? "No results found." : "Complete a call to start chatting."}
              </p>
            </div>
          )}

          {!loading && filtered.map((item) => (
            <button
              key={item.partner_id}
              onClick={() => openChat(item)}
              className="w-full flex items-center gap-4 px-8 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left"
            >
              <div className="relative">
                <AvatarCircle name={item.partner_name} gender={item.partner_gender} />
                {item.unread_count > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white text-xs rounded-full flex items-center justify-center font-semibold">
                    {item.unread_count > 9 ? "9+" : item.unread_count}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-semibold text-gray-900 text-sm truncate">{item.partner_name}</p>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatTime(item.last_message_at)}</span>
                </div>
                <p className="text-xs text-gray-400 truncate mb-1">{item.partner_tagline || "No tagline"}</p>
                <p className={`text-sm truncate ${item.unread_count > 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                  {item.last_message
                    ? `${item.last_message_mine ? "You: " : ""}${item.last_message}`
                    : "No messages yet"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}