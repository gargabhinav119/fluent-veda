"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

const API = "http://127.0.0.1:8000";

type VocabWord = {
  word_id: string;
  word: string;
  meaning: string;
  example: string;
  part_of_speech: string;
  detailed_explanation: string | null;
  pronunciation: string;
  synonyms: string[];
  date: string;
  acknowledged: boolean;
};

type VocabResponse = {
  today: VocabWord | null;
  history: VocabWord[];
};

export default function VocabularyPage() {
  const router = useRouter();
  const [data, setData] = useState<VocabResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [acking, setAcking] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    fetchVocabulary(token);
  }, [router]);

  const fetchVocabulary = async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/vocabulary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (wordId: string) => {
    const token = getToken();
    if (!token) return;
    setAcking(wordId);
    try {
      const res = await fetch(`${API}/vocabulary/${wordId}/acknowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            today:
              prev.today?.word_id === wordId
                ? { ...prev.today, acknowledged: true }
                : prev.today,
            history: prev.history.map((w) =>
              w.word_id === wordId ? { ...w, acknowledged: true } : w
            ),
          };
        });
      }
    } finally {
      setAcking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-gray-500">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-6">Vocabulary</h2>

        {data?.today ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-indigo-400 font-medium uppercase tracking-wide">
                Word of the Day
              </span>
              <span className="text-xs text-gray-400">{data.today.date}</span>
            </div>

            <div className="flex items-baseline gap-3 mb-1">
              <h3 className="text-3xl font-bold text-indigo-700">{data.today.word}</h3>
              <span className="text-sm text-indigo-400 italic">{data.today.part_of_speech}</span>
            </div>

            <p className="text-gray-500 text-sm mb-3">{data.today.pronunciation}</p>
            <p className="text-gray-700 mb-3">{data.today.meaning}</p>

            <div className="bg-white rounded-xl p-4 mb-3 border border-indigo-100">
              <p className="text-xs text-gray-400 mb-1">Example</p>
              <p className="text-gray-700 italic text-sm">"{data.today.example}"</p>
            </div>

            {data.today.detailed_explanation && (
              <div className="bg-white rounded-xl p-4 mb-3 border border-indigo-100">
                <p className="text-xs text-gray-400 mb-1">Explanation</p>
                <p className="text-gray-700 text-sm">{data.today.detailed_explanation}</p>
              </div>
            )}

            {data.today.synonyms.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {data.today.synonyms.map((s) => (
                  <span key={s} className="bg-indigo-100 text-indigo-600 text-xs px-3 py-1 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            )}

            {data.today.acknowledged ? (
              <span className="text-green-600 text-sm font-medium">✓ Acknowledged — +2 Honour</span>
            ) : (
              <button
                onClick={() => handleAcknowledge(data.today!.word_id)}
                disabled={acking === data.today.word_id}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
              >
                {acking === data.today.word_id ? "Saving..." : "I learned this word!"}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8">
            <p className="text-gray-500 text-sm">Aaj ka word abhi add nahi hua.</p>
          </div>
        )}

        {data?.history && data.history.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Previous Words</h3>
            <div className="flex flex-col gap-3">
              {data.history.map((w) => (
                <div key={w.word_id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-gray-800">{w.word}</span>
                      <span className="text-xs text-gray-400 italic">{w.part_of_speech}</span>
                    </div>
                    <p className="text-gray-500 text-sm mt-0.5">{w.meaning}</p>
                    <p className="text-gray-400 text-xs mt-1">{w.date}</p>
                  </div>
                  <div className="ml-4">
                    {w.acknowledged ? (
                      <span className="text-green-500 text-xs font-medium">✓ Done</span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledge(w.word_id)}
                        disabled={acking === w.word_id}
                        className="text-indigo-600 hover:text-indigo-500 text-xs font-medium disabled:opacity-50 transition"
                      >
                        {acking === w.word_id ? "..." : "Mark learned"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}