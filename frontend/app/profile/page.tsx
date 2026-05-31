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
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

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
    const response = await fetch("http://127.0.0.1:8000/profile", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
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
      setSelectedInterests(data.user.interested_in.split(", "));
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
      (field) => field && field.toString().trim() !== ""
    ).length;
    setCompletion(Math.round((completedFields / 6) * 100));
    setLoading(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    if (phone && (phone.length < 10 || !/^\d+$/.test(phone))) {
      setSaveError("Phone number must be at least 10 digits and only numbers allowed.");
      setSaving(false);
      return;
    }

    if (!gender && !selectedGender) {
      setSaveError("Please select your gender.");
      setSaving(false);
      return;
    }

    const token = localStorage.getItem("token");
    const response = await fetch("http://127.0.0.1:8000/profile", {
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
    });

    const data = await response.json();
    setSaveSuccess("Profile saved successfully.");
    setSaveError("");
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
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: "#FAF3E0" }}
      >
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "#8B5E3C", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "#FAF3E0" }}
    >
      <Sidebar />

      {/* Main content — full height, no outer scroll */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden p-6">

        <h1
          className="text-2xl font-bold mb-4 shrink-0 tracking-wide"
          style={{ fontFamily: "Georgia, serif", color: "#2C1A0E" }}
        >
          Your Profile
        </h1>

        {/* Two-column layout */}
        <div className="flex gap-6 flex-1 min-h-0">

          {/* ── LEFT COLUMN — summary card, fixed, no scroll ── */}
          <div className="w-72 shrink-0 flex flex-col gap-4">

            {/* Avatar + name */}
            <div
              className="rounded-xl p-5 border flex flex-col items-center text-center gap-2"
              style={{ backgroundColor: "#FDF6E3", borderColor: "#C9A97A" }}
            >
              {/* Avatar circle */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2"
                style={{
                  backgroundColor: "#F0E0C0",
                  borderColor: "#C9A97A",
                  color: "#5C3D1E",
                  fontFamily: "Georgia, serif",
                }}
              >
                {name ? name.charAt(0).toUpperCase() : "?"}
              </div>

              <h2
                className="text-lg font-bold leading-tight"
                style={{ fontFamily: "Georgia, serif", color: "#2C1A0E" }}
              >
                {name || "Your Name"}
              </h2>
              <p
                className="text-xs italic"
                style={{ color: "#7A5C3A", fontFamily: "Georgia, serif" }}
              >
                {tagline || "Add a tagline"}
              </p>

              {/* Completion badge */}
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full border mt-1"
                style={{
                  backgroundColor: "#F0E0C0",
                  color: "#5C3D1E",
                  borderColor: "#C9A97A",
                  fontFamily: "Georgia, serif",
                }}
              >
                {completion}% complete
              </span>

              {/* Progress bar */}
              <div
                className="w-full h-1.5 rounded-full mt-1"
                style={{ backgroundColor: "#E8D5B0" }}
              >
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${completion}%`,
                    backgroundColor: "#5C3D1E",
                  }}
                />
              </div>
            </div>

            {/* Info grid */}
            <div
              className="rounded-xl p-5 border flex flex-col gap-3 text-sm"
              style={{
                backgroundColor: "#FDF6E3",
                borderColor: "#C9A97A",
                fontFamily: "Georgia, serif",
                color: "#5C3D1E",
              }}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest" style={{ color: "#9A7A5A" }}>Email</span>
                <span className="break-all">{email || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest" style={{ color: "#9A7A5A" }}>Phone</span>
                <span>{phone || "Not added"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest" style={{ color: "#9A7A5A" }}>Gender</span>
                <span>
                  {gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "Not set"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest" style={{ color: "#9A7A5A" }}>Honour</span>
                <span>{honour}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest" style={{ color: "#9A7A5A" }}>Interests</span>
                <span className="leading-relaxed">{interestedIn || "None selected"}</span>
              </div>
            </div>

            {/* Incomplete banner */}
            {completion < 100 && (
              <div
                className="rounded-xl px-4 py-3 border text-xs leading-relaxed"
                style={{
                  backgroundColor: "#FFF4D6",
                  borderColor: "#C9A97A",
                  color: "#5C3D1E",
                  fontFamily: "Georgia, serif",
                }}
              >
                Complete your profile to unlock all FluentVeda features.
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN — edit form, scrollable inside ── */}
          <div
            className="flex-1 rounded-xl border overflow-y-auto p-6 flex flex-col gap-5"
            style={{
              backgroundColor: "#FDF6E3",
              borderColor: "#C9A97A",
            }}
          >
            <h3
              className="text-base font-semibold shrink-0"
              style={{ fontFamily: "Georgia, serif", color: "#2C1A0E" }}
            >
              Edit Details
            </h3>

            {/* Name + Phone in one row */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label
                  className="block text-xs font-medium mb-1 uppercase tracking-widest"
                  style={{ color: "#9A7A5A", fontFamily: "Georgia, serif" }}
                >
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Your full name"
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: "#FFF8EC",
                    borderColor: "#C9A97A",
                    color: "#2C1A0E",
                    fontFamily: "Georgia, serif",
                  }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label
                  className="block text-xs font-medium mb-1 uppercase tracking-widest"
                  style={{ color: "#9A7A5A", fontFamily: "Georgia, serif" }}
                >
                  Phone
                </label>
                <input
                  type="text"
                  placeholder="10-digit number"
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: "#FFF8EC",
                    borderColor: "#C9A97A",
                    color: "#2C1A0E",
                    fontFamily: "Georgia, serif",
                  }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Email (readonly) */}
            <div>
              <label
                className="block text-xs font-medium mb-1 uppercase tracking-widest"
                style={{ color: "#9A7A5A", fontFamily: "Georgia, serif" }}
              >
                Email
              </label>
              <input
                type="email"
                readOnly
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: "#F0E8D8",
                  borderColor: "#C9A97A",
                  color: "#7A5C3A",
                  fontFamily: "Georgia, serif",
                  cursor: "not-allowed",
                }}
                value={email}
              />
            </div>

            {/* Gender */}
            <div>
              <label
                className="block text-xs font-medium mb-2 uppercase tracking-widest"
                style={{ color: "#9A7A5A", fontFamily: "Georgia, serif" }}
              >
                Gender{" "}
                {gender && (
                  <span className="normal-case ml-1" style={{ color: "#C9A97A" }}>
                    · cannot be changed
                  </span>
                )}
              </label>
              <div className="flex gap-3">
                {["male", "female"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    disabled={!!gender}
                    onClick={() => !gender && setSelectedGender(g)}
                    className="flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors"
                    style={{
                      fontFamily: "Georgia, serif",
                      backgroundColor: selectedGender === g ? "#5C3D1E" : "#FFF8EC",
                      color: selectedGender === g ? "#F5E6C8" : "#5C3D1E",
                      borderColor: "#C9A97A",
                      cursor: gender ? "not-allowed" : "pointer",
                      opacity: gender ? 0.6 : 1,
                    }}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Tagline */}
            <div>
              <label
                className="block text-xs font-medium mb-1 uppercase tracking-widest"
                style={{ color: "#9A7A5A", fontFamily: "Georgia, serif" }}
              >
                Tagline
              </label>
              <textarea
                placeholder="e.g. Aspiring English speaker from Delhi"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                style={{
                  backgroundColor: "#FFF8EC",
                  borderColor: "#C9A97A",
                  color: "#2C1A0E",
                  fontFamily: "Georgia, serif",
                }}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>

            {/* Interests */}
            <div>
              <label
                className="block text-xs font-medium mb-2 uppercase tracking-widest"
                style={{ color: "#9A7A5A", fontFamily: "Georgia, serif" }}
              >
                Interests
              </label>
              <div className="grid grid-cols-3 gap-2">
                {interestsList.map((interest) => {
                  const checked = selectedInterests.includes(interest);
                  return (
                    <label
                      key={interest}
                      className="flex items-center gap-2 text-xs cursor-pointer px-3 py-2 rounded-lg border transition-colors"
                      style={{
                        fontFamily: "Georgia, serif",
                        backgroundColor: checked ? "#5C3D1E" : "#FFF8EC",
                        color: checked ? "#F5E6C8" : "#5C3D1E",
                        borderColor: "#C9A97A",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        className="hidden"
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...selectedInterests, interest]
                            : selectedInterests.filter((i) => i !== interest);
                          setSelectedInterests(updated);
                          setInterestedIn(updated.join(", "));
                        }}
                      />
                      {interest}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full py-3 rounded-lg text-sm font-semibold tracking-wide transition-opacity"
              style={{
                backgroundColor: saving ? "#9A7A5A" : "#5C3D1E",
                color: "#F5E6C8",
                fontFamily: "Georgia, serif",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>

            {saveError && (
              <p className="text-sm" style={{ color: "#A03020", fontFamily: "Georgia, serif" }}>
                {saveError}
              </p>
            )}
            {saveSuccess && (
              <p className="text-sm" style={{ color: "#3A6B35", fontFamily: "Georgia, serif" }}>
                {saveSuccess}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}