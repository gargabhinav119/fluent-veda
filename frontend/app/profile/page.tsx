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
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [gender, setGender] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [honour, setHonour] = useState(50);

  const [completion, setCompletion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const interestsList = [
    "English Speaking",
    "Public Speaking",
    "Interviews",
    "Movies",
    "Business English",
    "IELTS",
    "TOEFL",
    "Vocabulary",
    "Grammar",
    "Communication Skills",
    "Group Discussions",
  ];

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
    setGender(data.user.gender || "");
    setSelectedGender(data.user.gender || "");
    setHonour(data.user.honour ?? 50);

    if (data.user.interested_in) {
      setSelectedInterests(
        data.user.interested_in.split(", ")
      );
    }

    const fields = [
      data.user.name,
      data.user.email,
      data.user.phone,
      data.user.interested_in,
      data.user.tagline,
      data.user.gender,
    ];

    const completedFields = fields.filter(
      (field) =>
        field &&
        field.toString().trim() !== ""
    ).length;

    setCompletion(
      Math.round(
        (completedFields / 6) * 100
      )
    );

    setLoading(false);
  };

  const saveProfile = async () => {

    setSaving(true);

    if (phone && phone.length < 10) {
      alert("Phone number must be at least 10 digits");
      setSaving(false);
      return;
    }

    if (!gender && !selectedGender) {
      alert("Please select your gender.");
      setSaving(false);
      return;
    }

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
          gender: selectedGender,
        }),
      }
    );

    const data = await response.json();

    alert(data.message);

    await fetchProfile();

    setSaving(false);
  };

  useEffect(() => {

    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }

    fetchProfile();

  }, []);

  if (loading) {
    return (
      <div className="p-10">
        Loading Profile...
      </div>
    );
  }

  return (
    <div className="flex">

      <Sidebar />

      <div className="p-10 flex-1">

        <h1 className="text-3xl font-bold mb-6">
          Profile
        </h1>

        <div className="max-w-lg">

          <div className="bg-white border rounded-lg p-5 mb-6 shadow-sm">

            <div className="flex justify-between items-center">

              <h2 className="text-2xl font-bold">
                {name || "Your Name"}
              </h2>

              <span className="bg-green-100 text-green-700 px-3 py-1 rounded">
                {completion}%
              </span>

            </div>

            <p className="text-gray-600 mt-1">
              {tagline || "Add a tagline"}
            </p>

            <div className="mt-4 space-y-2">

              <p>📧 {email}</p>
              <p>📞 {phone || "Add phone number"}</p>
              <p>🏅 Honour: {honour}</p>
              <p>
                👤{" "}
                {gender
                  ? gender.charAt(0).toUpperCase() + gender.slice(1)
                  : "Select gender"}
              </p>
              <p>🏷️ {interestedIn || "Select your interests"}</p>

            </div>

          </div>

          <div className="mb-6">

            <p className="font-semibold mb-2">
              Profile Completion
            </p>

            <div className="w-full bg-gray-200 h-4 rounded">
              <div
                className="bg-green-500 h-4 rounded"
                style={{ width: `${completion}%` }}
              />
            </div>

            <p className="mt-2 font-medium">
              {completion}% Complete
            </p>

          </div>

          {completion < 100 && (
            <div className="bg-yellow-100 border border-yellow-400 p-4 rounded mb-6">
              <p className="font-semibold">⚠ Complete your profile</p>
              <p className="mt-2 text-sm">
                Fill all profile fields to unlock future FluentVeda features
                like Speaking Rooms, AI Coach and Challenges.
              </p>
            </div>
          )}

          {completion < 100 && (
            <div className="border rounded p-4 mb-6">
              <p className="font-semibold mb-3">Locked Features</p>
              <ul className="space-y-2">
                <li>🔒 Speaking Rooms</li>
                <li>🔒 AI Coach</li>
                <li>🔒 Daily Challenges</li>
                <li>🔒 Vocabulary Practice</li>
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-4">

            <input
              type="text"
              placeholder="Name"
              className="border p-2 rounded"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              type="email"
              className="border p-2 rounded bg-gray-100"
              value={email}
              readOnly
            />

            <input
              type="text"
              placeholder="Phone Number"
              className="border p-2 rounded"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            {/* Gender */}
            <div>

              <p className="font-medium mb-2">
                Gender{" "}
                {gender && (
                  <span className="text-xs text-gray-500 ml-1">
                    🔒 cannot be changed
                  </span>
                )}
              </p>

              <div className="flex gap-3">

                <button
                  type="button"
                  disabled={!!gender}
                  onClick={() => !gender && setSelectedGender("male")}
                  className={`flex-1 py-2 px-4 rounded border text-sm font-medium
                    ${selectedGender === "male"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300"
                    }
                    ${gender ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  👨 Male
                </button>

                <button
                  type="button"
                  disabled={!!gender}
                  onClick={() => !gender && setSelectedGender("female")}
                  className={`flex-1 py-2 px-4 rounded border text-sm font-medium
                    ${selectedGender === "female"
                      ? "bg-pink-500 text-white border-pink-500"
                      : "bg-white text-gray-700 border-gray-300"
                    }
                    ${gender ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  👩 Female
                </button>

              </div>

              {gender && (
                <p className="text-xs text-gray-400 mt-1">
                  Gender cannot be changed after saving.
                </p>
              )}

            </div>

            {/* Interests */}
            <div>

              <p className="font-medium mb-2">Interests</p>

              <div className="grid grid-cols-2 gap-2">
                {interestsList.map((interest) => (
                  <label key={interest} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedInterests.includes(interest)}
                      onChange={(e) => {
                        let updatedInterests;
                        if (e.target.checked) {
                          updatedInterests = [...selectedInterests, interest];
                        } else {
                          updatedInterests = selectedInterests.filter(
                            (item) => item !== interest
                          );
                        }
                        setSelectedInterests(updatedInterests);
                        setInterestedIn(updatedInterests.join(", "));
                      }}
                    />
                    {interest}
                  </label>
                ))}
              </div>

            </div>

            <textarea
              placeholder="Tagline"
              className="border p-2 rounded"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />

            <button
              onClick={saveProfile}
              disabled={saving}
              className="bg-black text-white p-3 rounded"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}