"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { authHeaders } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

type Article = {
  article_id: string;
  title: string;
  category: string;
  difficulty: string;
  published: boolean;
  created_at: string;
};

type FormData = {
  title: string;
  content: string;
  category: string;
  difficulty: string;
  read_time_minutes: string;
  published: boolean;
};

const emptyForm: FormData = {
  title: "",
  content: "",
  category: "tenses",
  difficulty: "beginner",
  read_time_minutes: "5",
  published: true,
};

export default function GrammarPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
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
    fetchArticles(token);
  }, [router]);

  const fetchArticles = async (token: string) => {
    setFetching(true);
    try {
      const res = await fetch("/api/admin/grammar", {
        headers: authHeaders(token),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setArticles(data.articles);
    } catch {
      setError("Articles load nahi ho sake");
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
      const res = await fetch("/api/admin/grammar", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          ...form,
          read_time_minutes: parseInt(form.read_time_minutes),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Article add nahi ho saka");
        return;
      }

      setSuccess("Article add ho gaya!");
      setForm(emptyForm);
      fetchArticles(token);
    } catch {
      setError("Kuch galat ho gaya");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (articleId: string) => {
    const token = getToken();
    if (!token) return router.push("/login");

    try {
      const res = await fetch(`/api/admin/grammar/${articleId}/toggle`, {
        method: "PATCH",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Toggle nahi ho saka");
        return;
      }
      setArticles((prev) =>
        prev.map((a) =>
          a.article_id === articleId ? { ...a, published: data.published } : a
        )
      );
    } catch {
      setError("Kuch galat ho gaya");
    }
  };

  const handleDelete = async (articleId: string) => {
    const token = getToken();
    if (!token) return router.push("/login");

    try {
      const res = await fetch(`/api/admin/grammar/${articleId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) {
        setError("Delete nahi ho saka");
        return;
      }
      setArticles((prev) => prev.filter((a) => a.article_id !== articleId));
    } catch {
      setError("Kuch galat ho gaya");
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 max-w-4xl">
        <h2 className="text-xl font-semibold mb-6">Grammar</h2>

        {/* Add Article Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Add Article</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-1 block">Content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition"
                >
                  <option value="tenses">Tenses</option>
                  <option value="articles">Articles</option>
                  <option value="prepositions">Prepositions</option>
                  <option value="punctuation">Punctuation</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">Read Time (minutes)</label>
                <input
                  type="number"
                  value={form.read_time_minutes}
                  onChange={(e) => setForm({ ...form, read_time_minutes: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="accent-indigo-500"
              />
              <label htmlFor="published" className="text-gray-400 text-sm">
                Publish immediately
              </label>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          {success && <p className="text-green-400 text-sm mt-3">{success}</p>}

          <button
            onClick={handleAdd}
            disabled={loading}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
          >
            {loading ? "Adding..." : "Add Article"}
          </button>
        </div>

        {/* Articles List */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-300">All Articles</h3>
          </div>
          {fetching ? (
            <p className="text-gray-500 text-sm p-6">Loading...</p>
          ) : articles.length === 0 ? (
            <p className="text-gray-500 text-sm p-6">Koi article nahi hai abhi.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left px-6 py-3 font-medium">Title</th>
                  <th className="text-left px-6 py-3 font-medium">Category</th>
                  <th className="text-left px-6 py-3 font-medium">Difficulty</th>
                  <th className="text-left px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.article_id} className="border-b border-gray-800 last:border-0">
                    <td className="px-6 py-3 text-white">{a.title}</td>
                    <td className="px-6 py-3 text-gray-400 capitalize">{a.category}</td>
                    <td className="px-6 py-3 text-gray-400 capitalize">{a.difficulty}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          a.published
                            ? "bg-green-900 text-green-400"
                            : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {a.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right flex gap-3 justify-end">
                      <button
                        onClick={() => handleToggle(a.article_id)}
                        className="text-indigo-400 hover:text-indigo-300 transition text-xs"
                      >
                        {a.published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => handleDelete(a.article_id)}
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