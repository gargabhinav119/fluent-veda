"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";

interface Message {
  message_id: string;
  sender_id: string;
  receiver_id?: string;
  text: string;
  sent_at: string;
}

export default function ChatPage() {
  const router = useRouter();
  const params = useSearchParams();
    const partnerId = params.get("userId") ?? "";
    if (!partnerId) router.push("/inbox");
  const partnerName = (params.get("name") ?? "Unknown").slice(0, 50).replace(/[<>]/g, "");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [myId, setMyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wsReady, setWsReady] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Pehle apna user_id fetch karo
    fetch("http://127.0.0.1:8000/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const uid = data.user?.user_id;
        if (!uid) {
          router.push("/login");
          return;
        }
        setMyId(uid);
        initChat(uid, token);
      })
      .catch(() => setError("Failed to load profile."));
  }, []);

  const initChat = async (uid: string, token: string) => {
    // 1. Message history fetch karo
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/chat/history/${partnerId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setError("Not authorized to view this chat.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setError("Could not load messages.");
      setLoading(false);
      return;
    }

    // 2. WebSocket connect karo
    const ws = new WebSocket(
      `ws://127.0.0.1:8000/ws/chat/${uid}?token=${token}`
    );

    ws.onopen = () => {
      setWsReady(true);
      setLoading(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) return;
      // Sirf is conversation ke messages show karo
      if (
        (data.sender_id === uid && data.receiver_id === partnerId) ||
        (data.sender_id === partnerId && data.receiver_id === uid)
      ) {
        setMessages((prev) => [...prev, data]);
      }
    };

    ws.onerror = () => setError("Connection error.");
    ws.onclose = () => setWsReady(false);

    wsRef.current = ws;
  };

  // Naya message aane pe neeche scroll karo
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current || !wsReady) return;
    if (text.length > 500) return;

    wsRef.current.send(
      JSON.stringify({
        receiver_id: partnerId,
        text,
      })
    );
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
            {partnerName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{partnerName}</p>
            <p className="text-xs text-gray-400">
              {wsReady ? "Online" : "Connecting..."}
            </p>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">

          {loading && (
            <div className="flex items-center gap-2 text-gray-400 mt-10 justify-center">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm text-center mt-10">{error}</p>
          )}

          {!loading && !error && messages.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-10">
              No messages yet. Say hi!
            </p>
          )}

          {messages.map((msg) => {
            const isMine = msg.sender_id === myId;
            return (
              <div
                key={msg.message_id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                    isMine
                      ? "bg-black text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-900 rounded-bl-sm"
                  }`}
                >
                  <p>{msg.text}</p>
                  <p className={`text-xs mt-1 ${isMine ? "text-gray-400" : "text-gray-400"}`}>
                    {formatTime(msg.sent_at)}
                  </p>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 items-end flex-shrink-0">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            maxLength={500}
            disabled={!wsReady}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400 disabled:opacity-50 disabled:bg-gray-50"
          />
          <button
            onClick={sendMessage}
            disabled={!wsReady || !input.trim()}
            className="bg-black text-white px-5 py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            Send
          </button>
        </div>

      </div>
    </div>
  );
}