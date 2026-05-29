"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

export default function Sidebar() {

  const router = useRouter();

  const handleLogout = () => {

    logout();

    router.push("/login");
  };

  return (
    <div className="w-64 h-screen bg-gray-100 border-r p-5">

      <h1 className="text-2xl font-bold mb-8">
        FluentVeda
      </h1>

      <div className="flex flex-col gap-4">

      <Link href="/dashboard">
        Dashboard
      </Link>

        <Link href="/profile">
          Profile
        </Link>


        <button
          onClick={handleLogout}
          className="text-left text-red-600"
        >
          Logout
        </button>

      </div>

    </div>
  );
}