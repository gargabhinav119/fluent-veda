"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

interface CallRecord {
  session_id: string;
  partner_id: string;
  partner_name: string;
  partner_gender: string;
  partner_tagline: string;
  started_at: string | null;
  duration_seconds: number;
  my_rating: number | null;
  three_min_mode: boolean;
  disconnect_reason: string;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function formatTime(isoString: string | null): { date: string; time: string } {
  if (!isoString) return { date: "—", time: "—" };
  const d = new Date(isoString);
  const date = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return { date, time };
}

function groupByDate(records: CallRecord[]): { label: string; items: CallRecord[] }[] {
  const map = new Map<string, CallRecord[]>();
  for (const r of records) {
    const key = r.started_at
      ? new Date(r.started_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Unknown date";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
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
    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${bg}`}>
      {initials || "?"}
    </div>
  );
}

function RatingBadge({ rating }: { rating: number | null }) {
  if (rating === null)
    return <span className="text-xs text-gray-400 italic">Not rated</span>;
  const colors: Record<string, string> = {
    "2":  "bg-green-100 text-green-800",
    "1":  "bg-green-50 text-green-700",
    "0":  "bg-gray-100 text-gray-600",
    "-1": "bg-red-50 text-red-600",
    "-2": "bg-red-100 text-red-700",
  };
  const label = rating > 0 ? `+${rating}` : `${rating}`;
  const cls = colors[String(rating)] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

export default function CallHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetch("http://127.0.0.1:8000/call-history", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setError("Could not load call history."))
      .finally(() => setLoading(false));
  }, []);

  const grouped = groupByDate(history);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">

        <div className="px-8 pt-8 pb-4 border-b border-gray-100 flex-shrink-0">
          <h1 className="text-2xl font-bold">Call History</h1>
          <p className="text-gray-500 text-sm mt-1">Your past Instant Connect conversations</p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">

          {loading && (
            <div className="flex items-center gap-3 text-gray-400 mt-10">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}

          {error && <p className="mt-10 text-red-500 text-sm">{error}</p>}

          {!loading && !error && history.length === 0 && (
            <div className="mt-16 text-center text-gray-400">
              <p className="text-4xl mb-4">📞</p>
              <p className="font-medium text-gray-500">No calls yet</p>
              <p className="text-sm mt-1">Start a conversation from Instant Connect</p>
              <button
                onClick={() => router.push("/instant-connect")}
                className="mt-5 bg-black text-white px-5 py-2 rounded text-sm"
              >
                Go to Instant Connect
              </button>
            </div>
          )}

          {!loading && !error && grouped.map(({ label, items }) => (
            <div key={label} className="mb-8">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                {label}
              </p>
                <div className="grid grid-cols-3 gap-4">
                {items.map((record) => {
                  const { time } = formatTime(record.started_at);
                  const duration = formatDuration(record.duration_seconds);
                  const shortDrop = record.duration_seconds < 60;
                  return (
                    <button
                      key={record.session_id}
                      onClick={() =>
                        router.push(
                          `/chat?userId=${record.partner_id}&name=${encodeURIComponent(record.partner_name)}`
                        )
                      }
                      className="w-full text-left border border-gray-200 rounded-xl px-5 py-4 hover:bg-gray-50 hover:border-gray-300 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <AvatarCircle name={record.partner_name} gender={record.partner_gender} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-gray-900 truncate">
                              {record.partner_name}
                            </span>
                            {record.three_min_mode && (
                              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full flex-shrink-0">
                                3 min
                              </span>
                            )}
                            {shortDrop && (
                              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full flex-shrink-0">
                                Early drop
                              </span>
                            )}
                          </div>
                          {record.partner_tagline && (
                            <p className="text-xs text-gray-400 truncate">{record.partner_tagline}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className="text-xs text-gray-500">{time}</span>
                          <span className="text-sm font-mono font-medium text-gray-700">{duration}</span>
                          <RatingBadge rating={record.my_rating} />
                        </div>
                        <div className="ml-2 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}