"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default function ProfilePage() {

  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interestedIn, setInterestedIn] = useState("");
  const [tagline, setTagline] = useState("");

  const fetchProfile = async () => {

    const token = localStorage.getItem("token");

    const response = await fetch(
      "http://127.0.0.1:8000/profile",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    setName(data.user.name || "");
    setEmail(data.user.email || "");
    setPhone(data.user.phone || "");
    setInterestedIn(data.user.interested_in || "");
    setTagline(data.user.tagline || "");
  };

  const saveProfile = async () => {

    const token = localStorage.getItem("token");

    const response = await fetch(
      "http://127.0.0.1:8000/profile",
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          name,
          phone,
          interested_in: interestedIn,
          tagline,
        }),
      }
    );

    const data = await response.json();

    alert(data.message);
  };

  useEffect(() => {

    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }

    fetchProfile();

  }, []);

  return (
    <div className="flex">

      <Sidebar />

      <div className="p-10 flex-1">

        <h1 className="text-3xl font-bold mb-6">
          Profile
        </h1>

        <div className="flex flex-col gap-4 max-w-lg">

          <input
            type="text"
            placeholder="Name"
            className="border p-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="email"
            className="border p-2 bg-gray-100"
            value={email}
            readOnly
          />

          <input
            type="text"
            placeholder="Phone Number"
            className="border p-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            type="text"
            placeholder="Interested In"
            className="border p-2"
            value={interestedIn}
            onChange={(e) => setInterestedIn(e.target.value)}
          />

          <textarea
            placeholder="Tagline"
            className="border p-2"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />

          <button
            onClick={saveProfile}
            className="bg-black text-white p-3 rounded"
          >
            Save Profile
          </button>

        </div>

      </div>

    </div>
  );
}