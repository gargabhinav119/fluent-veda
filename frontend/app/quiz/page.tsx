"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

const API = "http://127.0.0.1:8000";

type Question = {
  question_id: string;
  text: string;
  options: string[];
  correct_answer?: string;
  explanation?: string;
  user_answer?: string;
  correct?: boolean;
};

type QuizData = {
  quiz_id: string;
  title: string;
  already_attempted: boolean;
  questions: Question[];
  score?: number;
  passed?: boolean;
  honour_awarded?: boolean;
};

export default function QuizPage() {
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/login"); return; }
    fetchQuiz(token);
  }, [router]);

  const fetchQuiz = async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/quiz/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (data.quiz === null) {
        setQuiz(null);
      } else {
        setQuiz(data);
        if (data.already_attempted) setResult(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    const token = getToken();
    if (!token) return;

    // Check all 10 answered
    if (Object.keys(answers).length < quiz.questions.length) {
      setError("Sabhi 10 questions ka jawab do pehle.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const answersArray = quiz.questions.map((q) => answers[q.question_id] ?? "");
      const res = await fetch(`${API}/quiz/today/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers: answersArray }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Submit nahi ho saka.");
        return;
      }
      setResult(data);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="flex items-center gap-3 text-gray-400 mt-10">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading quiz...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-2">Daily Quiz</h2>
        <p className="text-gray-500 text-sm mb-6">Score 8/10 or more to earn +2 Honour.</p>

        {/* No quiz today */}
        {!quiz && !loading && (
          <div className="mt-16 text-center text-gray-400">
            <p className="text-4xl mb-4">📭</p>
            <p className="font-medium text-gray-500">Aaj ka quiz abhi available nahi hai</p>
            <p className="text-sm mt-1">Kal wapas aao!</p>
          </div>
        )}

        {/* Results view */}
        {quiz && result && (
          <div>
            {/* Score card */}
            <div className={`rounded-2xl p-6 mb-8 ${result.passed ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className="text-sm font-medium text-gray-500 mb-1">{quiz.title}</p>
              <div className="flex items-center gap-4">
                <span className={`text-5xl font-bold ${result.passed ? "text-green-700" : "text-red-600"}`}>
                  {result.score}/10
                </span>
                <div>
                  <p className={`font-semibold text-lg ${result.passed ? "text-green-700" : "text-red-600"}`}>
                    {result.passed ? "🎉 Passed!" : "😔 Better luck tomorrow"}
                  </p>
                  {result.honour_awarded && (
                    <p className="text-green-600 text-sm mt-0.5">+2 Honour earned</p>
                  )}
                </div>
              </div>
            </div>

            {/* Answer review */}
            <div className="flex flex-col gap-5">
              {result.questions.map((q, i) => (
                <div key={q.question_id} className={`rounded-xl border p-5 ${q.correct ? "border-green-200 bg-green-50/40" : "border-red-200 bg-red-50/40"}`}>
                  <p className="text-xs text-gray-400 mb-1">Question {i + 1}</p>
                  <p className="font-medium text-gray-800 mb-3">{q.text}</p>
                  <div className="flex flex-col gap-2 mb-3">
                    {q.options.map((opt) => {
                      const isCorrect = opt === q.correct_answer;
                      const isUserAnswer = opt === q.user_answer;
                      return (
                        <div
                          key={opt}
                          className={`px-4 py-2 rounded-lg text-sm border ${
                            isCorrect
                              ? "bg-green-100 border-green-300 text-green-800 font-medium"
                              : isUserAnswer && !isCorrect
                              ? "bg-red-100 border-red-300 text-red-700 line-through"
                              : "bg-white border-gray-200 text-gray-600"
                          }`}
                        >
                          {opt}
                          {isCorrect && " ✓"}
                          {isUserAnswer && !isCorrect && " ✗"}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-400 mb-0.5">Explanation</p>
                      <p className="text-sm text-gray-700">{q.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quiz attempt view */}
        {quiz && !result && (
          <div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3 mb-6 flex items-center justify-between">
              <p className="text-sm font-medium text-indigo-700">{quiz.title}</p>
              <p className="text-xs text-indigo-400">
                {Object.keys(answers).length}/10 answered
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {quiz.questions.map((q, i) => (
                <div key={q.question_id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="text-xs text-gray-400 mb-1">Question {i + 1} of 10</p>
                  <p className="font-medium text-gray-800 mb-4">{q.text}</p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${
                          answers[q.question_id] === opt
                            ? "bg-indigo-50 border-indigo-400 text-indigo-800"
                            : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.question_id}
                          value={opt}
                          checked={answers[q.question_id] === opt}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [q.question_id]: opt }))
                          }
                          className="accent-indigo-600"
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium transition"
            >
              {submitting ? "Submitting..." : "Submit Quiz"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}