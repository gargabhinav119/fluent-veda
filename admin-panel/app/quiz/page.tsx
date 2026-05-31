"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { authHeaders } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

type Quiz = {
  quiz_id: string;
  title: string;
  date: string;
  created_at: string;
};

type Question = {
  text: string;
  options: [string, string, string, string];
  correct_answer: string;
  explanation: string;
};

const emptyQuestion = (): Question => ({
  text: "",
  options: ["", "", "", ""],
  correct_answer: "",
  explanation: "",
});

export default function QuizPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [questions, setQuestions] = useState<Question[]>(
    Array.from({ length: 10 }, emptyQuestion)
  );
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
    fetchQuizzes(token);
  }, [router]);

  const fetchQuizzes = async (token: string) => {
    setFetching(true);
    try {
      const res = await fetch("/api/admin/quiz", {
        headers: authHeaders(token),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setQuizzes(data.quizzes);
    } catch {
      setError("Quizzes load nahi ho sake");
    } finally {
      setFetching(false);
    }
  };

  const updateQuestion = (index: number, field: keyof Question, value: string) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const options = [...updated[qIndex].options] as [string, string, string, string];
      options[oIndex] = value;
      updated[qIndex] = { ...updated[qIndex], options };
      return updated;
    });
  };

  const handleAdd = async () => {
    setError("");
    setSuccess("");
    const token = getToken();
    if (!token) return router.push("/login");

    setLoading(true);
    try {
      const res = await fetch("/api/admin/quiz", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ title, date, questions }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Quiz add nahi ho saka");
        return;
      }

      setSuccess("Quiz add ho gaya!");
      setTitle("");
      setDate("");
      setQuestions(Array.from({ length: 10 }, emptyQuestion));
      fetchQuizzes(token);
    } catch {
      setError("Kuch galat ho gaya");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quizId: string) => {
    const token = getToken();
    if (!token) return router.push("/login");

    try {
      const res = await fetch(`/api/admin/quiz/${quizId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) {
        setError("Delete nahi ho saka");
        return;
      }
      setQuizzes((prev) => prev.filter((q) => q.quiz_id !== quizId));
    } catch {
      setError("Kuch galat ho gaya");
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 max-w-4xl">
        <h2 className="text-xl font-semibold mb-6">Quiz</h2>

        {/* Add Quiz Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Add Quiz</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Date (YYYY-MM-DD)</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Questions */}
          <div className="flex flex-col gap-6">
            {questions.map((q, qi) => (
              <div key={qi} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-3 font-medium">Question {qi + 1}</p>

                <div className="mb-3">
                  <label className="text-gray-500 text-xs mb-1 block">Question Text</label>
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(qi, "text", e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {q.options.map((opt, oi) => (
                    <div key={oi}>
                      <label className="text-gray-500 text-xs mb-1 block">Option {oi + 1}</label>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  ))}
                </div>

                <div className="mb-3">
                  <label className="text-gray-500 text-xs mb-1 block">Correct Answer (exact option text)</label>
                  <input
                    type="text"
                    value={q.correct_answer}
                    onChange={(e) => updateQuestion(qi, "correct_answer", e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="text-gray-500 text-xs mb-1 block">Explanation</label>
                  <textarea
                    value={q.explanation}
                    onChange={(e) => updateQuestion(qi, "explanation", e.target.value)}
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition resize-none"
                  />
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
          {success && <p className="text-green-400 text-sm mt-4">{success}</p>}

          <button
            onClick={handleAdd}
            disabled={loading}
            className="mt-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
          >
            {loading ? "Adding..." : "Add Quiz"}
          </button>
        </div>

        {/* Quizzes List */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-300">All Quizzes</h3>
          </div>
          {fetching ? (
            <p className="text-gray-500 text-sm p-6">Loading...</p>
          ) : quizzes.length === 0 ? (
            <p className="text-gray-500 text-sm p-6">Koi quiz nahi hai abhi.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left px-6 py-3 font-medium">Title</th>
                  <th className="text-left px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((q) => (
                  <tr key={q.quiz_id} className="border-b border-gray-800 last:border-0">
                    <td className="px-6 py-3 text-white">{q.title}</td>
                    <td className="px-6 py-3 text-gray-400">{q.date}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleDelete(q.quiz_id)}
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