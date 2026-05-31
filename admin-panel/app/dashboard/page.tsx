"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h2 className="text-xl font-semibold mb-2">Dashboard</h2>
        <p className="text-gray-400 text-sm">Welcome to FluentVeda Admin.</p>
      </main>
    </div>
  );
}