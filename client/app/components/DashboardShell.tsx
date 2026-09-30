"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type DashboardRole = "STUDENT" | "TUTOR";

interface DashboardUser {
  firstName: string;
  lastName: string;
  roles: string[];
}

interface DashboardShellProps {
  role: DashboardRole;
  activeItem: string;
  user: DashboardUser;
  children: React.ReactNode;
}

const navigationByRole = {
  STUDENT: [
    { label: "Dashboard", href: "/dashboard/student" },
    { label: "Find Tutors", href: "/tutors" },
    { label: "My Requests", href: "#requests" },
    { label: "Profile", href: "#profile" }
  ],
  TUTOR: [
    { label: "Dashboard", href: "/dashboard/tutor" },
    { label: "My Profile", href: "#profile" },
    { label: "Session Requests", href: "#requests" }
  ]
} satisfies Record<DashboardRole, { label: string; href: string }[]>;

export default function DashboardShell({ role, activeItem, user, children }: DashboardShellProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const isTutor = role === "TUTOR";
  const canSwitchDashboard = user.roles.includes(isTutor ? "STUDENT" : "TUTOR");

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) {
        console.error("Logout request failed.");
      }
    } catch (error) {
      console.error("Logout request error:", error);
    } finally {
      ["user_roles", "user_email", "user_name"].forEach((key) => localStorage.removeItem(key));
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href={isTutor ? "/dashboard/tutor" : "/dashboard/student"} className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
              E
            </span>
            <span className="text-xl font-bold tracking-tight">EasyLearning</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className={`hidden rounded-full border px-3 py-1 text-xs font-bold sm:inline-flex ${
              isTutor
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-amber-400/30 bg-amber-400/10 text-amber-300"
            }`}>
              {isTutor ? "TUTOR DASHBOARD" : "STUDENT DASHBOARD"}
            </span>
            {canSwitchDashboard && (
              <Link
                href={isTutor ? "/dashboard/student" : "/dashboard/tutor"}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              >
                {isTutor ? "Student view" : "Tutor view"}
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900 disabled:opacity-60"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>

        <nav aria-label={`${role.toLowerCase()} dashboard navigation`} className="border-t border-slate-800">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-7">
            {navigationByRole[role].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={activeItem === item.label ? "page" : undefined}
                className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition ${
                  activeItem === item.label
                    ? "border-amber-400 text-amber-300"
                    : "border-transparent text-slate-300 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}