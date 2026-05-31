"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

interface Participant {
  user_id: string;
  user_name: string;
  role: "host" | "speaker" | "listener";
  handRaised?: boolean;
  speaking?: boolean;
}

interface ChatMessage {
  message_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  sent_at: string;
}

function AvatarCircle({
  name,
  role,
  speaking,
}: {
  name: string;
  role: string;
  speaking?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  const ringColor =
    role === "host"
      ? "ring-black"
      : role === "speaker"
      ? "ring-green-500"
      : "ring-gray-200";

  return (
    <div
      className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-gray-100 text-gray-700 ring-2 ${ringColor} ${
        speaking ? "ring-4 ring-green-400 animate-pulse" : ""
      }`}
    >
      {initials || "?"}
    </div>
  );
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.room_id as string;

  const [myId, setMyId] = useState("");
  const [myRole, setMyRole] = useState<"host" | "speaker" | "listener">("listener");
  const [roomName, setRoomName] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [handRaised, setHandRaised] = useState(false);
  const [isChatBanned, setIsChatBanned] = useState(false);
  const [chatBannedUsers, setChatBannedUsers] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState("");
  const [roomEnded, setRoomEnded] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ── Mic helpers ───────────────────────────────────────────────────────────

  const enableMic = useCallback(async () => {
    const client = agoraClientRef.current;
    if (!client) return;

    await client.setClientRole("host");

    if (!localAudioTrackRef.current) {
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localAudioTrackRef.current = audioTrack;
      await client.publish(audioTrack);
    } else {
      const track = localAudioTrackRef.current;
      if (!track.enabled) {
        await track.setEnabled(true);
      }
      try {
        await client.publish(track);
      } catch {
        // Already published
      }
    }
  }, []);

  const disableMic = useCallback(async () => {
    const client = agoraClientRef.current;
    const track = localAudioTrackRef.current;
    if (!client || !track) return;

    try {
      await client.unpublish(track);
    } catch {
      // Already unpublished
    }
    await track.setEnabled(false);
    await client.setClientRole("audience");
  }, []);

  // ── Agora init ────────────────────────────────────────────────────────────

  const initAgora = useCallback(async (
    role: string,
    agoraToken: string,
    appId: string,
    channel: string,
    uid: number
  ) => {
    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    agoraClientRef.current = client;

    await client.setClientRole(
      role === "host" || role === "speaker" ? "host" : "audience"
    );

    await client.join(appId, channel, agoraToken, uid);

if (role === "host" || role === "speaker") {
      try {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localAudioTrackRef.current = audioTrack;
        await client.publish(audioTrack);
      } catch (err) {
        console.warn("Mic permission denied:", err);
        // Mic nahi mila — room mein rehna chahiye
      }
    }
    client.on("user-published", async (remoteUser, mediaType) => {
      await client.subscribe(remoteUser, mediaType);
      if (mediaType === "audio") {
        remoteUser.audioTrack?.play();
      }
    });

    client.on("user-unpublished", (remoteUser) => {
      remoteUser.audioTrack?.stop();
    });
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const cleanupAgora = useCallback(async () => {
    const client = agoraClientRef.current;
    const track = localAudioTrackRef.current;

    if (track) {
      try { await client?.unpublish(track); } catch { }
      track.close();
      localAudioTrackRef.current = null;
    }

    if (client) {
      try { await client.leave(); } catch { }
      agoraClientRef.current = null;
    }
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId) return;

    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    const init = async () => {
      // 1. Profile fetch
      const profileRes = await fetch("http://127.0.0.1:8000/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!profileRes.ok) throw new Error("Profile fetch failed");
      const profileData = await profileRes.json();
      const uid = profileData.user?.user_id;
      if (!uid) throw new Error("No user ID");
      setMyId(uid);

      // 2. Join room
      const joinRes = await fetch(`http://127.0.0.1:8000/rooms/${roomId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!joinRes.ok) {
        const err = await joinRes.json();
        throw new Error(err.detail ?? "Failed to join room");
      }

      // 3. Room details
      const roomRes = await fetch(`http://127.0.0.1:8000/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!roomRes.ok) throw new Error("Room not found");
      const roomData = await roomRes.json();
      setRoomName(roomData.name);
      setParticipants(roomData.participants);
      const me = roomData.participants.find((p: Participant) => p.user_id === uid);
      if (me) setMyRole(me.role);

      // 4. Chat history
      try {
        const histRes = await fetch(
          `http://127.0.0.1:8000/rooms/${roomId}/history`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (histRes.ok) {
          const histData = await histRes.json();
          setMessages(histData.messages ?? []);
        }
      } catch { }

      // 5. Agora token
      const agoraRes = await fetch(
        `http://127.0.0.1:8000/rooms/${roomId}/agora-token`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!agoraRes.ok) throw new Error("Agora token fetch failed");
      const agoraData = await agoraRes.json();

      // 6. Agora init — agoraData.uid use karo
      await initAgora(
        me?.role ?? "listener",
        agoraData.token,
        agoraData.app_id,
        agoraData.channel,
        agoraData.uid
      );

      // 7. WebSocket
      const ws = new WebSocket(
        `ws://127.0.0.1:8000/ws/rooms/${roomId}/${uid}?token=${token}`
      );
      wsRef.current = ws;

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "user_joined":
            setParticipants((prev) => {
              if (prev.find((p) => p.user_id === data.user_id)) return prev;
              return [...prev, {
                user_id: data.user_id,
                user_name: data.user_name,
                role: data.role,
              }];
            });
            break;

          case "user_left":
            setParticipants((prev) =>
              prev.filter((p) => p.user_id !== data.user_id)
            );
            break;

          case "role_changed":
            setParticipants((prev) =>
              prev.map((p) =>
                p.user_id === data.user_id
                  ? { ...p, role: data.new_role, handRaised: false }
                  : p
              )
            );
            if (data.user_id === uid) {
              setMyRole(data.new_role);
              setHandRaised(false);
              if (data.new_role === "speaker") await enableMic();
              if (data.new_role === "listener") await disableMic();
            }
            break;

          case "hand_raised":
            setParticipants((prev) =>
              prev.map((p) =>
                p.user_id === data.user_id ? { ...p, handRaised: true } : p
              )
            );
            break;

          case "chat":
            setMessages((prev) => [...prev, data]);
            break;

case "room_ended":
            setRoomEnded(true);
            await cleanupAgora();
            setTimeout(() => router.push("/rooms"), 3000);
            break;

          case "you_are_chat_banned":
            setIsChatBanned(true);
            break;

          case "you_are_chat_unbanned":
            setIsChatBanned(false);
            break;

          case "chat_blocked":
            // Silently ignore — input already disabled
            break;

          case "participant_chat_banned":
            setChatBannedUsers((prev) => new Set([...prev, data.user_id]));
            break;

          case "participant_chat_unbanned":
            setChatBannedUsers((prev) => {
              const next = new Set(prev);
              next.delete(data.user_id);
              return next;
            });
            break;
                  }
      };

      ws.onopen = () => setLoading(false);
      ws.onerror = () => {
        setInitError("WebSocket connection failed. Please refresh.");
        setLoading(false);
      };
    };

    init().catch((err) => {
      console.error("Room init error:", err);
      setInitError(err.message ?? "Failed to load room.");
      setLoading(false);
    });

    return () => {
      wsRef.current?.close();
      cleanupAgora();
    };
  }, [roomId]);

  // Auto scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const sendWs = (data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendWs({ type: "chat", text });
    setChatInput("");
  };

  const raiseHand = () => {
    if (handRaised) return;
    sendWs({ type: "hand_raise" });
    setHandRaised(true);
  };

  const promoteUser = (userId: string) => {
    sendWs({ type: "promote", user_id: userId });
  };

  const leaveRoom = async () => {
    const token = localStorage.getItem("token");
    wsRef.current?.close();
    await cleanupAgora();
    await fetch(`http://127.0.0.1:8000/rooms/${roomId}/leave`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    router.push("/rooms");
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const speakers = participants.filter(
    (p) => p.role === "host" || p.role === "speaker"
  );
  const listeners = participants.filter((p) => p.role === "listener");
  const handRaisers = participants.filter((p) => p.handRaised);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  // ── Render states ─────────────────────────────────────────────────────────

  if (roomEnded) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-800">Room has ended</p>
          <p className="text-gray-500 text-sm mt-2">Redirecting you to Rooms...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-3">{initError}</p>
          <button
            onClick={() => router.push("/rooms")}
            className="text-sm bg-black text-white px-5 py-2 rounded-xl"
          >
            Back to Rooms
          </button>
        </div>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{roomName}</h1>
            <p className="text-xs text-gray-400">{participants.length} participants</p>
          </div>
          <button
            onClick={leaveRoom}
            className="text-sm text-red-500 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
          >
            {myRole === "host" ? "End Room" : "Leave"}
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">

          {/* Left: Participants */}
          <div className="flex-1 flex flex-col overflow-y-auto px-6 py-5 gap-6">

            {/* Speakers */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                🎙️ Speakers ({speakers.length})
              </p>
              <div className="flex flex-col gap-2">
                {speakers.map((p) => (
                  <div key={p.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <AvatarCircle name={p.user_name} role={p.role} speaking={p.speaking} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.user_name}</p>
                      <p className="text-xs text-gray-400 capitalize">{p.role}</p>
                    </div>
                    {p.role === "host" && (
                      <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full">Host</span>
                    )}
                    {p.role === "speaker" && p.user_id === myId && (
                      <button
                        onClick={async () => {
                          sendWs({ type: "demote_self" });
                          await disableMic();
                        }}
                        className="text-xs text-gray-500 border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        🎧 Back to Listener
                      </button>
                    )}
{myRole === "host" && p.role === "speaker" && p.user_id !== myId && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => sendWs({ type: "force_demote", user_id: p.user_id })}
                          className="text-xs text-red-500 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Demote
                        </button>
                        <button
                          onClick={() => sendWs({
                            type: chatBannedUsers.has(p.user_id) ? "chat_unban" : "chat_ban",
                            user_id: p.user_id
                          })}
                          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                            chatBannedUsers.has(p.user_id)
                              ? "text-green-600 border-green-200 hover:bg-green-50"
                              : "text-orange-500 border-orange-200 hover:bg-orange-50"
                          }`}
                        >
                          {chatBannedUsers.has(p.user_id) ? "Unban Chat" : "Mute Chat"}
                        </button>
                      </div>
                    )}
                                      </div>
                ))}
              </div>
            </div>

            {/* Listeners */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                🎧 Listeners ({listeners.length})
              </p>
              <div className="flex flex-col gap-2">
                {listeners.length === 0 && (
                  <p className="text-xs text-gray-400">No listeners yet</p>
                )}
                {listeners.map((p) => (
                  <div key={p.user_id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <AvatarCircle name={p.user_name} role={p.role} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.user_name}</p>
                      {p.handRaised && (
                        <p className="text-xs text-amber-500 font-medium">✋ Hand raised</p>
                      )}
                    </div>
                    {p.user_id === myId && myRole === "listener" && (
                      <button
                        onClick={raiseHand}
                        disabled={handRaised}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          handRaised
                            ? "bg-amber-100 text-amber-600 cursor-default"
                            : "bg-gray-100 hover:bg-amber-100 hover:text-amber-600 text-gray-600"
                        }`}
                      >
                        {handRaised ? "✋ Raised" : "✋ Raise Hand"}
                      </button>
                    )}
{myRole === "host" && (
                      <div className="flex gap-1">
                        {p.handRaised && (
                          <button
                            onClick={() => promoteUser(p.user_id)}
                            className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Accept
                          </button>
                        )}
                        <button
                          onClick={() => sendWs({
                            type: chatBannedUsers.has(p.user_id) ? "chat_unban" : "chat_ban",
                            user_id: p.user_id
                          })}
                          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                            chatBannedUsers.has(p.user_id)
                              ? "text-green-600 border-green-200 hover:bg-green-50"
                              : "text-orange-500 border-orange-200 hover:bg-orange-50"
                          }`}
                        >
                          {chatBannedUsers.has(p.user_id) ? "Unban Chat" : "Mute Chat"}
                        </button>
                      </div>
                    )}
                                      </div>
                ))}
              </div>
            </div>

            {/* Host: hand raise requests */}
            {myRole === "host" && handRaisers.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">
                  ✋ Hand Raise Requests ({handRaisers.length})
                </p>
                <div className="flex flex-col gap-2">
                  {handRaisers.map((p) => (
                    <div key={p.user_id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-800">{p.user_name}</span>
                      <button
                        onClick={() => promoteUser(p.user_id)}
                        className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Make Speaker
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Chat */}
          <div className="w-80 flex flex-col border-l border-gray-100 flex-shrink-0">
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm font-semibold text-gray-700">💬 Room Chat</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {messages.length === 0 && (
                <p className="text-xs text-gray-400 text-center mt-6">No messages yet. Say hi!</p>
              )}
              {messages.map((msg) => {
                const isMine = msg.sender_id === myId;
                return (
                  <div key={msg.message_id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                    {!isMine && (
                      <p className="text-xs text-gray-400 mb-0.5 px-1">{msg.sender_name}</p>
                    )}
                    <div className={`max-w-[90%] px-3 py-2 rounded-2xl text-sm ${
                      isMine ? "bg-black text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"
                    }`}>
                      <p>{msg.text}</p>
                      <p className="text-xs mt-0.5 opacity-50">{formatTime(msg.sent_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
{isChatBanned ? (
                <div className="flex-1 text-center text-xs text-red-400 py-2">
                  🚫 You are muted from chat by the host
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                    placeholder="Type a message..."
                    maxLength={500}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-gray-50"
                  />
                  <button
                    onClick={sendChat}
                    disabled={!chatInput.trim()}
                    className="bg-black text-white px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-gray-800 transition-colors"
                  >
                    →
                  </button>
                </>
              )}
                          </div>
          </div>
        </div>
      </div>
    </div>
  );
}