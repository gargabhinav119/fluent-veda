"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

interface Room {
  room_id: string;
  name: string;
  description: string;
  host_name: string;
  host_id: string;
  participant_count: number;
  max_listeners: number;
  created_at: string;
}

interface MyProfile {
  user_id: string;
  honour: number;
}

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create room modal
  const [showModal, setShowModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const fetchRooms = () => {
    fetch("http://127.0.0.1:8000/rooms", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setRooms(data.rooms ?? []))
      .catch(() => setError("Could not load rooms."));
  };

  useEffect(() => {
    if (!token) { router.push("/login"); return; }

    // Profile + rooms parallel fetch
    Promise.all([
      fetch("http://127.0.0.1:8000/profile", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch("http://127.0.0.1:8000/rooms", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([profileData, roomsData]) => {
        setProfile({
          user_id: profileData.user?.user_id,
          honour: profileData.user?.honour ?? 0,
        });
        setRooms(roomsData.rooms ?? []);
      })
      .catch(() => setError("Could not load data."))
      .finally(() => setLoading(false));

    // Har 10 second mein rooms refresh karo
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!roomName.trim()) { setCreateError("Room name required."); return; }
    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("http://127.0.0.1:8000/rooms/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: roomName.trim(), description: roomDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.detail ?? "Failed to create room."); return; }
      router.push(`/rooms/${data.room_id}`);
    } catch {
      setCreateError("Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (room_id: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/rooms/${room_id}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) router.push(`/rooms/${room_id}`);
    } catch {
      setError("Could not join room.");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Rooms</h1>
            <p className="text-gray-500 text-sm mt-1">
              Join a live discussion or host your own
            </p>
          </div>

          {/* Create button — sirf honour > 70 walo ko */}
          {profile && profile.honour >= 70 && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              + Create Room
            </button>
          )}
          {profile && profile.honour < 70 && (
            <div className="text-xs text-gray-400 text-right">
              <p>Honour: {profile.honour}/70</p>
              <p>Need more honour to host</p>
            </div>
          )}
        </div>

        {/* Rooms grid */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading && (
            <div className="flex items-center gap-3 text-gray-400 mt-10">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading rooms...</span>
            </div>
          )}

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

          {!loading && !error && rooms.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="#9CA3AF" strokeWidth="1.5" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No active rooms</p>
              <p className="text-gray-400 text-sm mt-1">Be the first to start a discussion!</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div
                key={room.room_id}
                className="border border-gray-200 rounded-2xl p-5 hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => handleJoin(room.room_id)}
              >
                {/* Live badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Live
                  </span>
                  <span className="text-xs text-gray-400">
                    {room.participant_count}/{room.max_listeners + 1}
                  </span>
                </div>

                <h3 className="font-semibold text-gray-900 text-base mb-1 truncate group-hover:text-black">
                  {room.name}
                </h3>

                {room.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                    {room.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                    {room.host_name[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-500">
                    Hosted by <span className="font-medium text-gray-700">{room.host_name}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-1">Create a Room</h2>
            <p className="text-gray-500 text-sm mb-5">Start a live group discussion</p>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Room Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                maxLength={60}
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. English Pronunciation Practice"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400"
              />
            </div>

            <div className="mb-5">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                maxLength={200}
                value={roomDesc}
                onChange={(e) => setRoomDesc(e.target.value)}
                placeholder="What will you discuss?"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400 resize-none"
              />
            </div>

            {createError && (
              <p className="text-red-500 text-sm mb-4">{createError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setCreateError(""); setRoomName(""); setRoomDesc(""); }}
                className="flex-1 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 bg-black text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}