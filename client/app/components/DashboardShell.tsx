"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type DashboardRole = "STUDENT" | "TUTOR" | "ADMIN";

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
    { label: "My Session Requests", href: "#requests" },
    { label: "Profile", href: "#profile" }
  ],
  TUTOR: [
    { label: "Dashboard", href: "/dashboard/tutor" },
    { label: "Tutor Profile", href: "#profile" },
    { label: "Tutor Requests", href: "#requests" }
  ],
  ADMIN: [
    { label: "Dashboard", href: "#overview-heading" },
    { label: "Tutor Applications", href: "#applications-heading" },
    { label: "Users", href: "#users-heading" },
    { label: "Approved Tutors", href: "#tutors-heading" }
  ]
} satisfies Record<DashboardRole, { label: string; href: string }[]>;

export default function DashboardShell({ role, activeItem, user, children }: DashboardShellProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const switchRole = role === "TUTOR" ? "STUDENT" : role === "STUDENT" ? "TUTOR" : null;
  const canSwitchDashboard = switchRole !== null && user.roles.includes(switchRole);
  const dashboardHref = role === "ADMIN" ? "/dashboard/admin" : `/dashboard/${role.toLowerCase()}`;

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileMenuOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) console.error("Logout request failed.");
    } catch (error) {
      console.error("Logout request error:", error);
    } finally {
      ["user_roles", "user_email", "user_name"].forEach((key) => localStorage.removeItem(key));
      router.replace(role === "ADMIN" ? "/admin/login" : "/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  function renderSidebarContent(isMobile = false) {
    return (
      <>
        <div className="border-b border-[#CFC4F8]/20 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <Link href={dashboardHref} className="flex min-w-0 items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFD166] text-lg font-black text-[#241B3B]">E</span>
              <span className="truncate text-lg font-bold tracking-tight text-white">EasyLearning</span>
            </Link>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-2.5 py-2 text-sm font-semibold text-[#EDE7FF] hover:bg-white/10"
              >
                Close
              </button>
            )}
          </div>
          <p className="mt-4 text-xs font-bold uppercase text-[#FFD166]">
            {role === "ADMIN" ? "Admin" : role === "TUTOR" ? "Tutor" : "Student"}
          </p>
          <p className="mt-1 truncate text-sm text-[#EDE7FF]">{user.firstName} {user.lastName}</p>
        </div>

        <nav aria-label={`${role.toLowerCase()} dashboard navigation`} className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {navigationByRole[role].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={activeItem === item.label ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm transition ${
                activeItem === item.label
                  ? "bg-[#FFD166]/15 font-semibold text-[#FFD166]"
                  : "text-[#EDE7FF] hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-2 border-t border-[#CFC4F8]/20 p-4">
          {canSwitchDashboard && switchRole && (
            <Link
              href={`/dashboard/${switchRole.toLowerCase()}`}
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg border border-white/20 px-3 py-2.5 text-sm font-semibold text-[#EDE7FF] transition hover:bg-white/10 hover:text-white"
            >
              {switchRole === "STUDENT" ? "Student view" : "Tutor view"}
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full rounded-lg bg-[#6C4CF1] px-3 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-[#5B3FD2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] text-[#241B3B]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#241B3B] text-white shadow-lg lg:flex">
          {renderSidebarContent()}
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close dashboard menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-[#241B3B]/60"
            />
            <aside id="mobile-dashboard-sidebar" className="relative flex h-full w-72 max-w-[85vw] flex-col bg-[#241B3B] text-white shadow-xl">
              {renderSidebarContent(true)}
            </aside>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-[#CFC4F8] bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open dashboard menu"
                aria-controls="mobile-dashboard-sidebar"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-[#CFC4F8] text-[#241B3B] hover:bg-[#F3EEFF] lg:hidden"
              >
                <span className="h-0.5 w-4 bg-current" />
                <span className="h-0.5 w-4 bg-current" />
                <span className="h-0.5 w-4 bg-current" />
              </button>
              <Link href={dashboardHref} className="truncate text-base font-bold text-[#241B3B] lg:hidden">EasyLearning</Link>
              <p className="hidden truncate text-sm font-semibold text-[#625B71] lg:block">{user.firstName} {user.lastName}</p>
            </div>
            <span className="shrink-0 rounded-md bg-[#EDE7FF] px-2.5 py-1.5 text-[11px] font-bold uppercase text-[#6C4CF1] sm:px-3 sm:text-xs">
              {role} Dashboard
            </span>
          </header>

          <main className="mx-auto w-full max-w-7xl min-w-0 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
