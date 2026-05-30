"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

// ── Types ────────────────────────────────────────────────────────────────────
interface Partner {
  name: string;
  tagline: string;
  gender: string;
  honour: number;
  interested_in: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SUGGESTED_TOPICS = [
  "🌍 Travel experiences",
  "🎬 Favourite movies",
  "📚 Books you love",
  "🍕 Food & cuisines",
  "🎵 Music taste",
  "💼 Career goals",
  "🏋️ Fitness routine",
  "🎮 Video games",
  "📱 Tech & gadgets",
  "🌱 Daily habits",
  "😂 Funny childhood memories",
  "🐾 Pets & animals",
  "🎨 Hobbies & art",
  "✈️ Dream destinations",
  "📺 Web series & shows",
  "🧠 Something you learned recently",
  "💡 A life lesson",
  "🏏 Sports you follow",
];

const DOUBLED_TOPICS = [...SUGGESTED_TOPICS, ...SUGGESTED_TOPICS];

const RULES = [
  "Speak only in English during the call.",
  "Minimum 1 minute conversation is required.",
  "Disconnecting before 1 minute reduces your Honour by 10.",
  "Be respectful and maintain decorum at all times.",
  "No hate speech, offensive language, or harassment.",
];

// ── Standalone sub-components (outside main component to avoid re-creation) ──

const WarningBox = () => (
  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mt-4">
    <p className="text-xs text-yellow-800 leading-relaxed">
      ⚠️ Please maintain decorum. Your partner can give you a negative rating
      which may <strong> ban you from the platform.</strong>
    </p>
  </div>
);

interface RightPanelProps {
  scrollRef: React.RefObject<HTMLDivElement>;
}

const RightPanel = ({ scrollRef }: RightPanelProps) => (
  <div className="flex flex-col flex-1 border rounded-lg p-5 overflow-hidden">
    <div className="mb-4">
      <h2 className="text-lg font-semibold mb-1">Purpose</h2>
      <p className="text-gray-600 text-sm">
        Practice real English conversations with learners from around the world.
        Build confidence, fluency, and make new connections.
      </p>
    </div>

    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-2">Rules</h2>
      <ul className="space-y-2">
        {RULES.map((rule, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-full bg-black text-white text-xs flex items-center justify-center font-bold">
              {i + 1}
            </span>
            {rule}
          </li>
        ))}
      </ul>
    </div>

    <div className="mt-auto">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
        💬 Suggested Topics
      </h2>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-hidden"
        style={{ whiteSpace: "nowrap" }}
      >
        {DOUBLED_TOPICS.map((topic, i) => (
          <span
            key={i}
            className="inline-block flex-shrink-0 bg-gray-100 text-gray-700 text-sm px-4 py-2 rounded-full border border-gray-200"
          >
            {topic}
          </span>
        ))}
      </div>
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InstantConnectPage() {
  const router = useRouter();

  const [status, setStatus] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [callSeconds, setCallSeconds] = useState(0);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [genderFilter, setGenderFilter] = useState<"male" | "female" | "">("");
  const [threeMinMode, setThreeMinMode] = useState(false);
  const [isThreeMinMatch, setIsThreeMinMatch] = useState(false);
  // NEW: loading state for "Connect Now" button
  const [joining, setJoining] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const partnerIdRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const disconnectCallRef = useRef<() => void>(() => {});

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, []);

  // Auto scroll topics — triggers on any status where RightPanel is shown
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (status !== "waiting" && !(status === "matched" && partner) && status !== "summary") return;

    let animFrame: number;
    let pos = 0;
    const speed = 0.6;

    const scroll = () => {
      pos += speed;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      animFrame = requestAnimationFrame(scroll);
    };

    animFrame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animFrame);
  }, [status, partner]);

  const createPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: event.candidate,
            target_id: partnerIdRef.current,
          })
        );
      }
    };

    pc.ontrack = (event) => {
      const audio = remoteAudioRef.current || new Audio();
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      audio.volume = 1.0;
      audio.play().catch(console.error);
      remoteAudioRef.current = audio;
    };

    pcRef.current = pc;
    return pc;
  };

  const flushIceCandidates = async () => {
    if (!pcRef.current) return;
    for (const c of iceCandidateQueueRef.current) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.error("ICE error:", e);
      }
    }
    iceCandidateQueueRef.current = [];
  };

  const setupWsHandlers = (ws: WebSocket) => {
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.status === "matched") {
        partnerIdRef.current = data.partner_id;
        setPartner(data.partner);
        setSessionId(data.session_id);
        setStatus("matched");
        setCallSeconds(0);
        setIsThreeMinMatch(data.three_min_mode ?? false);

        if (data.is_caller) {
          const pc = createPeerConnection();
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(
            JSON.stringify({
              type: "offer",
              offer,
              target_id: data.partner_id,
            })
          );
        }
      }

      if (data.type === "offer") {
        partnerIdRef.current = data.sender_id;
        const pc = createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushIceCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(
          JSON.stringify({
            type: "answer",
            answer,
            target_id: data.sender_id,
          })
        );
      }

      if (data.type === "answer") {
        if (pcRef.current?.signalingState === "have-local-offer") {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          await flushIceCandidates();
        }
      }

      if (data.type === "ice-candidate") {
        if (pcRef.current?.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(
              new RTCIceCandidate(data.candidate)
            );
          } catch (e) {
            console.error("ICE error:", e);
          }
        } else {
          iceCandidateQueueRef.current.push(data.candidate);
        }
      }

      if (data.status === "partner_disconnected") {
        endCall();
      }
    };

    ws.onclose = () => console.log("WS closed");
    ws.onerror = (e) => console.error("WS error:", e);
  };

  const endCall = () => {
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    iceCandidateQueueRef.current = [];
    partnerIdRef.current = "";
    setStatus("summary");
  };

  const cleanup = () => {
    endCall();
    wsRef.current?.close();
    wsRef.current = null;
  };

  // FIX: wrapped in useCallback so disconnectCallRef update doesn't run every render
  const disconnectCall = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch("http://127.0.0.1:8000/instant-connect/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      console.error(e);
    } finally {
      cleanup();
    }
  }, []);

  // Keep ref in sync with latest disconnectCall
  useEffect(() => {
    disconnectCallRef.current = disconnectCall;
  }, [disconnectCall]);

  const joinQueue = async () => {
    setJoining(true); // START loading
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const token = localStorage.getItem("token");

      const profileRes = await fetch("http://127.0.0.1:8000/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileData = await profileRes.json();
      const userId = profileData.user?.user_id;

      if (!userId) {
        alert("Your session has expired. Please log in again.");
        router.push("/login");
        return;
      }

      const user = profileData.user;
      const isProfileComplete =
        user?.name && user?.gender && user?.phone && user?.tagline;
      if (!isProfileComplete) {
        alert(
          "Please complete your profile first. Name, gender, phone, and tagline are required."
        );
        router.push("/profile");
        return;
      }

      await new Promise<void>((resolve) => {
        const ws = new WebSocket(
          `ws://127.0.0.1:8000/ws/${userId}?token=${token}`
        );
        ws.onopen = () => {
          wsRef.current = ws;
          setupWsHandlers(ws);
          resolve();
        };
        ws.onerror = () => resolve();
      });

      const res = await fetch("http://127.0.0.1:8000/instant-connect/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gender_filter: genderFilter,
          three_min_mode: threeMinMode,
        }),
      });

      const data = await res.json();
      setCallSeconds(0);

      if (data.status === "matched") {
        setStatus("matched");
      } else {
        setStatus("waiting");
      }
    } catch (error) {
      console.error(error);
      alert("Microphone access denied or failed to join queue. Please try again.");
    } finally {
      setJoining(false); // STOP loading
    }
  };

  const cancelQueue = async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch("http://127.0.0.1:8000/instant-connect/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      console.error(e);
    } finally {
      cleanup();
      setStatus("idle");
      setSeconds(0);
      setPartner(null);
      setSessionId("");
      // FIX: was missing in original
      setIsThreeMinMatch(false);
    }
  };

  const submitRating = async () => {
    if (selectedRating === null) {
      alert("Please select a rating before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/instant-connect/rate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: sessionId, rating: selectedRating }),
      });
      const data = await res.json();
      console.log(data.message);
    } catch (e) {
      console.error(e);
    } finally {
      setStatus("idle");
      setPartner(null);
      setSessionId("");
      setSelectedRating(null);
      setCallSeconds(0);
      setSeconds(0);
      setSubmitting(false);
      setIsThreeMinMatch(false);
    }
  };

  // Waiting timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "waiting") {
      interval = setInterval(() => setSeconds((p) => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Call timer — 3 min mode mein auto disconnect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "matched" && partner) {
      interval = setInterval(() => {
        setCallSeconds((p) => {
          if (isThreeMinMatch && p + 1 >= 180) {
            disconnectCallRef.current();
            return 180;
          }
          return p + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, partner, isThreeMinMatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const ratings = [
    { value: -2, label: "-2", color: "bg-red-600" },
    { value: -1, label: "-1", color: "bg-red-300" },
    { value: 0, label: "0", color: "bg-gray-300" },
    { value: 1, label: "+1", color: "bg-green-300" },
    { value: 2, label: "+2", color: "bg-green-600" },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <h1 className="text-3xl font-bold mb-4">Instant Connect</h1>

        <div className="flex-1 overflow-hidden">

          {/* ── IDLE ── */}
          {status === "idle" && (
            <div className="border rounded-lg p-6 max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">Purpose</h2>
              <p className="mb-6">Enables real-time interaction with other learners.</p>

              <h2 className="text-xl font-semibold mb-4">Rules</h2>
              <ul className="list-disc ml-6 mb-8">
                <li>Minimum 1 minute conversation required.</li>
                <li>Disconnecting before 1 minute reduces Honour Level by 10.</li>
                <li>Be respectful.</li>
                <li>English only.</li>
              </ul>

              {/* Gender Filter */}
              <div className="mb-6">
                <p className="font-medium mb-3">Connect with:</p>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      setGenderFilter(genderFilter === "male" ? "" : "male")
                    }
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all
                      ${genderFilter === "male" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    {genderFilter === "male" ? "✅" : "⬜"} Male
                  </button>
                  <button
                    onClick={() =>
                      setGenderFilter(genderFilter === "female" ? "" : "female")
                    }
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all
                      ${genderFilter === "female" ? "bg-pink-500 text-white border-pink-500" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    {genderFilter === "female" ? "✅" : "⬜"} Female
                  </button>
                </div>
                {genderFilter && (
                  <p className="text-xs text-gray-400 mt-2">
                    Only {genderFilter} partners will be matched
                  </p>
                )}
              </div>

              {/* 3 Minute Mode */}
              <div
                onClick={() => setThreeMinMode(!threeMinMode)}
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer mb-6 transition-all select-none
                  ${threeMinMode ? "bg-purple-50 border-purple-400" : "bg-gray-50 border-gray-200"}`}
              >
                <div
                  className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all
                  ${threeMinMode ? "bg-purple-600 border-purple-600" : "border-gray-400"}`}
                >
                  {threeMinMode && (
                    <span className="text-white text-xs font-bold">✓</span>
                  )}
                </div>
                <div>
                  <p className={`font-semibold text-sm ${threeMinMode ? "text-purple-700" : "text-gray-700"}`}>
                    🕐 3 Minute Connect — Introvert Mode
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Call automatically ends after 3 minutes. Only matched with
                    others who selected this mode.
                  </p>
                </div>
              </div>

              {/* Connect Now button with loading state */}
              <button
                onClick={joinQueue}
                disabled={joining}
                className="bg-black text-white px-6 py-3 rounded disabled:opacity-60 flex items-center gap-2"
              >
                {joining ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Now"
                )}
              </button>
            </div>
          )}

          {/* ── WAITING ── */}
          {status === "waiting" && (
            <div className="flex gap-6 h-full">
              <div className="flex flex-col justify-between w-80 border rounded-lg p-5">
                <div>
                  <h2 className="text-xl font-semibold mb-3">Searching For Partner...</h2>
                  <p className="text-gray-500 mb-2">
                    {genderFilter
                      ? `Looking for a ${genderFilter} partner...`
                      : "Looking for another learner..."}
                  </p>
                  {threeMinMode && (
                    <p className="text-xs text-purple-600 mb-2">
                      🕐 3 Minute Connect mode is ON
                    </p>
                  )}
                  <p className="text-2xl font-mono mb-6">⏳ {formatTime(seconds)}</p>
                  <button
                    onClick={cancelQueue}
                    className="w-full bg-red-500 text-white px-4 py-2 rounded"
                  >
                    Cancel Search
                  </button>
                </div>
                <WarningBox />
              </div>
              <RightPanel scrollRef={scrollRef} />
            </div>
          )}

          {/* ── CONNECTING ── */}
          {status === "matched" && !partner && (
            <div className="border rounded-lg p-6 max-w-2xl">
              <h2 className="text-xl font-semibold mb-3">Match Found 🎉</h2>
              <p className="text-gray-500 animate-pulse">Connecting...</p>
            </div>
          )}

          {/* ── CALL ACTIVE ── */}
          {status === "matched" && partner && (
            <div className="flex gap-6 h-full">
              <div className="flex flex-col justify-between w-80 border rounded-lg p-5">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Call Active 🎙️</h2>
                    <span
                      className={`text-xl font-mono ${isThreeMinMatch ? "text-purple-600" : "text-green-600"}`}
                    >
                      {isThreeMinMatch
                        ? formatTime(180 - callSeconds)
                        : formatTime(callSeconds)}
                    </span>
                  </div>

                  {isThreeMinMatch && (
                    <div className="bg-purple-50 border border-purple-300 rounded-lg p-3 mb-4">
                      <p className="text-xs text-purple-800 leading-relaxed">
                        🕐 <strong>3 Minute Connect:</strong> This call will
                        automatically end when the timer hits 0:00.
                      </p>
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-4">
                    <p className="text-lg font-bold">{partner.name}</p>
                    <p className="text-gray-500 text-sm">{partner.tagline}</p>
                    <p>
                      👤{" "}
                      {partner.gender
                        ? partner.gender.charAt(0).toUpperCase() +
                          partner.gender.slice(1)
                        : "—"}
                    </p>
                    <p>🏅 Honour: {partner.honour ?? 50}</p>
                    <p>🏷️ {partner.interested_in || "—"}</p>
                  </div>

                  <button
                    onClick={disconnectCall}
                    className="w-full bg-red-500 text-white px-4 py-2 rounded"
                  >
                    Disconnect
                  </button>
                </div>
                <WarningBox />
              </div>
              <RightPanel scrollRef={scrollRef} />
            </div>
          )}

          {/* ── SUMMARY ── */}
          {status === "summary" && (
            <div className="flex gap-6 h-full">
              <div className="flex flex-col justify-between w-80 border rounded-lg p-5">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Call Ended</h2>
                  <p className="text-gray-500 mb-6">
                    Call Duration:{" "}
                    <span className="font-mono font-bold text-black">
                      {formatTime(callSeconds)}
                    </span>
                  </p>
                  <p className="font-semibold mb-3">
                    Rate {partner?.name || "your partner"}:
                  </p>
                  <div className="flex gap-3 mb-6">
                    {ratings.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setSelectedRating(r.value)}
                        className={`w-12 h-12 rounded-full text-white font-bold text-sm ${r.color}
                          ${selectedRating === r.value ? "ring-4 ring-black scale-110" : "opacity-70 hover:opacity-100"}
                          transition-all`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={submitRating}
                    disabled={submitting || selectedRating === null}
                    className="w-full bg-black text-white px-6 py-2 rounded disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit & Continue"}
                  </button>
                </div>
                <WarningBox />
              </div>
              <RightPanel scrollRef={scrollRef} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}