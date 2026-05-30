"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function InstantConnectPage() {

  const router = useRouter();

  const [status, setStatus] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [callSeconds, setCallSeconds] = useState(0);
  const [partner, setPartner] = useState<any>(null);
  const [sessionId, setSessionId] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [genderFilter, setGenderFilter] = useState<"male" | "female" | "">("");

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const partnerIdRef = useRef<string>("");

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, []);

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
        wsRef.current.send(JSON.stringify({
          type: "ice-candidate",
          candidate: event.candidate,
          target_id: partnerIdRef.current,
        }));
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

        if (data.is_caller) {
          const pc = createPeerConnection();
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({
            type: "offer",
            offer,
            target_id: data.partner_id,
          }));
        }
      }

      if (data.type === "offer") {
        partnerIdRef.current = data.sender_id;
        const pc = createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushIceCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({
          type: "answer",
          answer,
          target_id: data.sender_id,
        }));
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

  const joinQueue = async () => {
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
  alert("Session expire ho gayi, dobara login karo!");
  router.push("/login");
  return;
}

// Profile complete check
const user = profileData.user;
const isProfileComplete =
  user?.name && user?.gender && user?.phone && user?.tagline;

if (!isProfileComplete) {
  alert("Pehle apna profile complete karo! Name, gender, phone aur tagline zaroori hai.");
  router.push("/profile");
  return;
}

      await new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${userId}?token=${token}`);
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
      alert("Mic access nahi mila ya queue join nahi hua!");
    }
  };

  const disconnectCall = async () => {
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
    }
  };

  const submitRating = async () => {
    if (selectedRating === null) {
      alert("Please select a rating");
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
        body: JSON.stringify({
          session_id: sessionId,
          rating: selectedRating,
        }),
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

  // Call timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "matched" && partner) {
      interval = setInterval(() => setCallSeconds((p) => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [status, partner]);

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
    { value: 0,  label: "0",  color: "bg-gray-300" },
    { value: 1,  label: "+1", color: "bg-green-300" },
    { value: 2,  label: "+2", color: "bg-green-600" },
  ];

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 p-10">
        <h1 className="text-3xl font-bold mb-6">Instant Connect</h1>

        <div className="border rounded-lg p-6 max-w-2xl">

          {/* ── IDLE ── */}
          {status === "idle" && (
            <>
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
                      ${genderFilter === "male"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300"
                      }
                    `}
                  >
                    {genderFilter === "male" ? "✅" : "⬜"} Male
                  </button>

                  <button
                    onClick={() =>
                      setGenderFilter(genderFilter === "female" ? "" : "female")
                    }
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all
                      ${genderFilter === "female"
                        ? "bg-pink-500 text-white border-pink-500"
                        : "bg-white text-gray-700 border-gray-300"
                      }
                    `}
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

              <button
                onClick={joinQueue}
                className="bg-black text-white px-6 py-3 rounded"
              >
                Connect Now
              </button>
            </>
          )}

          {/* ── WAITING ── */}
          {status === "waiting" && (
            <div>
              <h2 className="text-xl font-semibold mb-3">
                Searching For Partner...
              </h2>
              <p className="text-gray-500 mb-2">
                {genderFilter
                  ? `Connecting with ${genderFilter}...`
                  : "Looking for another learner..."}
              </p>
              <p className="text-2xl font-mono mb-6">
                ⏳ {formatTime(seconds)}
              </p>
              <button
                onClick={cancelQueue}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Cancel Search
              </button>
            </div>
          )}

          {/* ── CONNECTING ── */}
          {status === "matched" && !partner && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Match Found 🎉</h2>
              <p className="text-gray-500 animate-pulse">Connecting...</p>
            </div>
          )}

          {/* ── CALL ACTIVE ── */}
          {status === "matched" && partner && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Call Active 🎙️</h2>
                <span className="text-2xl font-mono text-green-600">
                  {formatTime(callSeconds)}
                </span>
              </div>

              <div className="border rounded-lg p-4 mb-6 space-y-2">
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
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* ── SUMMARY ── */}
          {status === "summary" && (
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
                    className={`w-12 h-12 rounded-full text-white font-bold text-sm
                      ${r.color}
                      ${selectedRating === r.value
                        ? "ring-4 ring-black scale-110"
                        : "opacity-70 hover:opacity-100"
                      }
                      transition-all
                    `}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <button
                onClick={submitRating}
                disabled={submitting || selectedRating === null}
                className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit & Continue"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}