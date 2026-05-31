"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/grammar", label: "Grammar" },
  { href: "/quiz", label: "Quiz" },
  { href: "/instant-connect", label: "Instant Connect" },
  { href: "/call-history", label: "Call History" },
  { href: "/inbox", label: "Inbox" },
  { href: "/rooms", label: "Rooms" },
  { href: "/profile", label: "Profile" },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div
      className="w-64 h-screen flex flex-col p-6 border-r"
      style={{
        backgroundColor: "#2C1A0E",
        borderColor: "#5C3D1E",
      }}
    >
      {/* Logo */}
      <div className="mb-10">
        <h1
          className="text-2xl font-bold tracking-widest uppercase"
          style={{ color: "#F5E6C8", fontFamily: "Georgia, serif" }}
        >
          FluentVeda
        </h1>
        <div
          className="mt-2 h-px w-full"
          style={{ backgroundColor: "#5C3D1E" }}
        />
      </div>

      {/* Nav Links */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded text-sm tracking-wide transition-colors"
              style={{
                fontFamily: "Georgia, serif",
                color: isActive ? "#2C1A0E" : "#C9A97A",
                backgroundColor: isActive ? "#C9A97A" : "transparent",
                fontWeight: isActive ? "600" : "400",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div
        className="pt-4 mt-4 border-t"
        style={{ borderColor: "#5C3D1E" }}
      >
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded text-sm tracking-wide transition-colors"
          style={{
            fontFamily: "Georgia, serif",
            color: "#C0614A",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}