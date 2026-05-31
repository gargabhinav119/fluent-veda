"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

const API = "http://127.0.0.1:8000";

type Article = {
  article_id: string;
  title: string;
  category: string;
  difficulty: string;
  read_time_minutes: number;
  acknowledged: boolean;
  created_at: string;
};

type ArticleFull = Article & {
  content: string;
};

const CATEGORIES = ["all", "tenses", "articles", "prepositions", "punctuation", "other"];
const DIFFICULTIES = ["all", "beginner", "intermediate", "advanced"];

const difficultyColor: Record<string, string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-red-100 text-red-700",
};

export default function GrammarPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [selected, setSelected] = useState<ArticleFull | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/login"); return; }
    fetchArticles(token);
  }, [router, category, difficulty]);

  const fetchArticles = async (token: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (difficulty !== "all") params.set("difficulty", difficulty);

      const res = await fetch(`${API}/grammar?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setArticles(data.articles ?? []);
    } finally {
      setLoading(false);
    }
  };

  const openArticle = async (articleId: string) => {
    const token = getToken();
    if (!token) return;
    setLoadingArticle(true);
    try {
      const res = await fetch(`${API}/grammar/${articleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSelected(data);
    } finally {
      setLoadingArticle(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selected) return;
    const token = getToken();
    if (!token) return;
    setAcking(true);
    try {
      const res = await fetch(`${API}/grammar/${selected.article_id}/acknowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSelected({ ...selected, acknowledged: true });
        setArticles((prev) =>
          prev.map((a) =>
            a.article_id === selected.article_id ? { ...a, acknowledged: true } : a
          )
        );
      }
    } finally {
      setAcking(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* Article detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selected.title}</h2>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 capitalize">
                      {selected.category}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${difficultyColor[selected.difficulty]}`}>
                      {selected.difficulty}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {selected.read_time_minutes} min read
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4"
                >
                  ×
                </button>
              </div>

              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                {selected.content}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                {selected.acknowledged ? (
                  <span className="text-green-600 text-sm font-medium">✓ Acknowledged — +1 Honour</span>
                ) : (
                  <button
                    onClick={handleAcknowledge}
                    disabled={acking}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
                  >
                    {acking ? "Saving..." : "Mark as read — +1 Honour"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-8 max-w-4xl">
        <h2 className="text-2xl font-bold mb-2">Grammar</h2>
        <p className="text-gray-500 text-sm mb-6">Read articles and earn Honour points.</p>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap mb-6">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-indigo-400 transition"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c === "all" ? "All categories" : c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-indigo-400 transition"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d === "all" ? "All levels" : d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Articles grid */}
        {loading ? (
          <div className="flex items-center gap-3 text-gray-400 mt-10">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading articles...</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="mt-16 text-center text-gray-400">
            <p className="text-4xl mb-4">📖</p>
            <p className="font-medium text-gray-500">No articles found</p>
            <p className="text-sm mt-1">Try changing the filters above</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {articles.map((a) => (
              <button
                key={a.article_id}
                onClick={() => openArticle(a.article_id)}
                disabled={loadingArticle}
                className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 group-hover:text-indigo-700 transition leading-snug">
                    {a.title}
                  </h3>
                  {a.acknowledged && (
                    <span className="text-green-500 text-xs font-medium ml-2 flex-shrink-0">✓</span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 capitalize">
                    {a.category}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${difficultyColor[a.difficulty]}`}>
                    {a.difficulty}
                  </span>
                  <span className="text-xs text-gray-400">{a.read_time_minutes} min</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}