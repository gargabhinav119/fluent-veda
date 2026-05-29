import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50">

      <h1 className="text-5xl font-bold mb-4">
        FluentVeda
      </h1>

      <p className="text-lg text-gray-600 mb-8">
        Practice English with confidence.
      </p>

      <div className="flex gap-4">

        <Link
          href="/login"
          className="bg-black text-white px-6 py-3 rounded"
        >
          Login
        </Link>

        <Link
          href="/signup"
          className="border border-black px-6 py-3 rounded"
        >
          Signup
        </Link>

      </div>

    </main>
  );
}