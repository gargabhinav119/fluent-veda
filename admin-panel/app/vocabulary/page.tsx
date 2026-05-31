"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { authHeaders } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

type VocabWord = {
  word_id: string;
  word: string;
  date: string;
  part_of_speech: string;
};

type FormData = {
  word: string;
  meaning: string;
  example: string;
  part_of_speech: string;
  detailed_explanation: string;
  pronunciation: string;
  synonyms: string;
  date: string;
};

const emptyForm: FormData = {
  word: "",
  meaning: "",
  example: "",
  part_of_speech: "",
  detailed_explanation: "",
  pronunciation: "",
  synonyms: "",
  date: "",
};

export default function VocabularyPage() {
  const router = useRouter();
  const [words, setWords] = useState<VocabWord[]>([]);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    fetchWords(token);
  }, [router]);

  const fetchWords = async (token: string) => {
    setFetching(true);
    try {
      const res = await fetch("/api/admin/vocabulary", {
        headers: authHeaders(token),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setWords(data.words);
    } catch {
      setError("Words load nahi ho sake");
    } finally {
      setFetching(false);
    }
  };

  const handleAdd = async () => {
    setError("");
    setSuccess("");
    const token = getToken();
    if (!token) return router.push("/login");

    setLoading(true);
    try {
      const res = await fetch("/api/admin/vocabulary", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          ...form,
          synonyms: form.synonyms
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Word add nahi ho saka");
        return;
      }

      setSuccess("Word add ho gaya!");
      setForm(emptyForm);
      fetchWords(token);
    } catch {
      setError("Kuch galat ho gaya");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (wordId: string) => {
    const token = getToken();
    if (!token) return router.push("/login");

    try {
      const res = await fetch(`/api/admin/vocabulary/${wordId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) {
        setError("Delete nahi ho saka");
        return;
      }
      setWords((prev) => prev.filter((w) => w.word_id !== wordId));
    } catch {
      setError("Kuch galat ho gaya");
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 max-w-4xl">
        <h2 className="text-xl font-semibold mb-6">Vocabulary</h2>

        {/* Add Word Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Add Word</h3>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["word", "Word"],
                ["meaning", "Meaning"],
                ["example", "Example"],
                ["part_of_speech", "Part of Speech (noun/verb/adj...)"],
                ["detailed_explanation", "Detailed Explanation"],
                ["pronunciation", "Pronunciation"],
                ["synonyms", "Synonyms (comma separated)"],
                ["date", "Date (YYYY-MM-DD)"],
              ] as [keyof FormData, string][]
            ).map(([key, label]) => (
              <div key={key} className={key === "detailed_explanation" || key === "example" ? "col-span-2" : ""}>
                <label className="text-gray-400 text-xs mb-1 block">{label}</label>
                {key === "detailed_explanation" || key === "example" ? (
                  <textarea
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition resize-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition"
                  />
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          {success && <p className="text-green-400 text-sm mt-3">{success}</p>}

          <button
            onClick={handleAdd}
            disabled={loading}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
          >
            {loading ? "Adding..." : "Add Word"}
          </button>
        </div>

        {/* Words List */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-300">All Words</h3>
          </div>
          {fetching ? (
            <p className="text-gray-500 text-sm p-6">Loading...</p>
          ) : words.length === 0 ? (
            <p className="text-gray-500 text-sm p-6">Koi word nahi hai abhi.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left px-6 py-3 font-medium">Word</th>
                  <th className="text-left px-6 py-3 font-medium">Part of Speech</th>
                  <th className="text-left px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {words.map((w) => (
                  <tr key={w.word_id} className="border-b border-gray-800 last:border-0">
                    <td className="px-6 py-3 text-white">{w.word}</td>
                    <td className="px-6 py-3 text-gray-400">{w.part_of_speech}</td>
                    <td className="px-6 py-3 text-gray-400">{w.date}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleDelete(w.word_id)}
                        className="text-red-400 hover:text-red-300 transition text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}