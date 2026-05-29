"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";

export default function InstantConnectPage() {

  const [status, setStatus] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [partner, setPartner] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const partnerIdRef = useRef<string>("");

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
      console.log("Remote track mila!");
      const audio = remoteAudioRef.current || new Audio();
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      audio.volume = 1.0;
      audio.play().catch(console.error);
      remoteAudioRef.current = audio;
    };

    pc.onconnectionstatechange = () => {
      console.log("PC state:", pc.connectionState);
    };

    pcRef.current = pc;
    return pc;
  };

  const flushIceCandidates = async () => {
    if (!pcRef.current) return;
    for (const c of iceCandidateQueueRef.current) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
        console.log("Queued ICE add hua");
      } catch (e) {
        console.error("Queued ICE error:", e);
      }
    }
    iceCandidateQueueRef.current = [];
  };

  const setupWsHandlers = (ws: WebSocket) => {
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log("WS msg:", data.type || data.status);

      if (data.status === "matched") {
        partnerIdRef.current = data.partner_id;
        setPartner(data.partner);
        setStatus("matched");
        setSeconds(0);

        if (data.is_caller) {
          const pc = createPeerConnection();
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({
            type: "offer",
            offer,
            target_id: data.partner_id,
          }));
          console.log("Offer bheja");
        } else {
          console.log("Receiver — offer ka wait kar raha hun...");
        }
      }

      if (data.type === "offer") {
        console.log("Offer mila, answer bana raha hun...");
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
        console.log("Answer bheja");
      }

      if (data.type === "answer") {
        console.log("Answer mila!");
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
          console.log("ICE queued:", iceCandidateQueueRef.current.length);
        }
      }

      if (data.status === "partner_disconnected") {
        alert("Partner disconnect ho gaya!");
        cleanup();
        setStatus("idle");
        setPartner(null);
        setSeconds(0);
      }
    };

    ws.onclose = () => console.log("WS closed");
    ws.onerror = (e) => console.error("WS error:", e);
  };

  const cleanup = () => {
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    iceCandidateQueueRef.current = [];
    partnerIdRef.current = "";
  };

  const joinQueue = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      console.log("Mic mila!");

      const token = localStorage.getItem("token");
      const userId = JSON.parse(atob(token!.split(".")[1])).user_id;

      await new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${userId}`);
        ws.onopen = () => {
          console.log("WS connected!");
          wsRef.current = ws;
          setupWsHandlers(ws);
          resolve();
        };
        ws.onerror = () => resolve();
      });

      const res = await fetch("http://127.0.0.1:8000/instant-connect/join", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      console.log("Join:", data.status);
      setSeconds(0);

      if (data.status === "matched") {
        setStatus("matched");
        // partner WS se aayega — tab tak "Connecting..." dikhao
      } else {
        setStatus("waiting");
      }

    } catch (error) {
      console.error(error);
      alert("Mic access nahi mila ya queue join nahi hua!");
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
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "waiting") {
      interval = setInterval(() => setSeconds((p) => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 p-10">
        <h1 className="text-3xl font-bold mb-6">Instant Connect</h1>

        <div className="border rounded-lg p-6 max-w-4xl">

          <h2 className="text-xl font-semibold mb-4">Purpose</h2>
          <p className="mb-6">Enables real-time interaction with other learners.</p>

          <h2 className="text-xl font-semibold mb-4">Features</h2>
          <ul className="list-disc ml-6 mb-6">
            <li>Instantly connect with other users</li>
            <li>Quick practice sessions</li>
            <li>Real-time communication</li>
          </ul>

          <h2 className="text-xl font-semibold mb-4">User Value</h2>
          <p className="mb-6">Encourages social learning and spontaneous engagement.</p>

          <h2 className="text-xl font-semibold mb-4">Rules</h2>
          <ul className="list-disc ml-6 mb-8">
            <li>Minimum 1 minute conversation required.</li>
            <li>Disconnecting before 1 minute reduces Honour Level by 10.</li>
            <li>Be respectful.</li>
            <li>English only.</li>
          </ul>

          {status === "idle" && (
            <button
              onClick={joinQueue}
              className="bg-black text-white px-6 py-3 rounded"
            >
              Connect Now
            </button>
          )}

          {status === "waiting" && (
            <div className="border rounded p-5">
              <h2 className="text-xl font-semibold mb-3">Searching For Partner</h2>
              <p className="mb-4">Looking for another learner...</p>
              <p className="mb-4">Waiting Time: {seconds} sec</p>
              <button
                onClick={cancelQueue}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Cancel Search
              </button>
            </div>
          )}

          {/* ✅ Partner aane se pehle — Connecting screen */}
          {status === "matched" && !partner && (
            <div className="border rounded p-5">
              <h2 className="text-xl font-semibold mb-3">Match Found 🎉</h2>
              <p className="text-gray-500 animate-pulse">Connecting...</p>
            </div>
          )}

          {/* ✅ Partner aa gaya — full card dikhao */}
          {status === "matched" && partner && (
            <div className="border rounded p-5">
              <h2 className="text-xl font-semibold mb-4">Match Found 🎉</h2>
              <div className="space-y-3 mb-6">
                <p><strong>Name:</strong> {partner.name}</p>
                <p><strong>Tagline:</strong> {partner.tagline}</p>
                <p><strong>Interests:</strong> {partner.interested_in}</p>
                <p><strong>Email:</strong> {partner.email}</p>
              </div>
              <p className="text-green-600 font-medium mb-4">
                🎙️ Voice call active hai — bol sakte ho!
              </p>
              <button
                onClick={cancelQueue}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Disconnect
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}