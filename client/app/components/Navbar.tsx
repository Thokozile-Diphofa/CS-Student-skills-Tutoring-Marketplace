"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type NavigationItem = {
  label: string;
  href: string;
};

const publicNavigation: NavigationItem[] = [
  { label: "Home", href: "/" },
  { label: "Find Tutors", href: "/tutors" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Become a Tutor", href: "/become-a-tutor" },
  { label: "Login", href: "/login" },
  { label: "Register", href: "/register" }
];

export default function Navbar() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [roles, setRoles] = useState<string[]>([]);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadNavigationState() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
        if (!response.ok) {
          if (!cancelled) setAuthStatus("signed-out");
          return;
        }

        const data = await response.json();
        const userRoles: string[] = Array.isArray(data.user?.roles) ? data.user.roles : [];
        if (cancelled) return;
        setRoles(userRoles);
        setAuthStatus("signed-in");

        if (userRoles.includes("ADMIN") || userRoles.includes("TUTOR") || !userRoles.includes("STUDENT")) return;

        const applicationResponse = await fetch(`${API_BASE_URL}/api/tutor-applications/me`, { credentials: "include" });
        if (!applicationResponse.ok) return;
        const applicationData = await applicationResponse.json();
        if (!cancelled && applicationData.application?.submittedAt) {
          setApplicationStatus(applicationData.application.status || null);
        }
      } catch {
        if (!cancelled) setAuthStatus("signed-out");
      }
    }

    void loadNavigationState();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) throw new Error("Logout request failed.");

      ["user_roles", "user_email", "user_name"].forEach((key) => localStorage.removeItem(key));
      setRoles([]);
      setAuthStatus("signed-out");
      setApplicationStatus(null);
      router.replace("/");
      router.refresh();
    } catch {
      setLogoutError("Logout failed. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  let navigation = publicNavigation;
  if (authStatus === "signed-in") {
    if (roles.includes("ADMIN")) {
      navigation = [
        { label: "Home", href: "/" },
        { label: "Admin Dashboard", href: "/dashboard/admin" }
      ];
    } else if (roles.includes("TUTOR")) {
      navigation = [
        { label: "Home", href: "/" },
        { label: "Find Tutors", href: "/tutors" },
        { label: "Tutor Dashboard", href: "/dashboard/tutor" }
      ];
    } else if (roles.includes("STUDENT") && applicationStatus === "PENDING") {
      navigation = [
        { label: "Home", href: "/" },
        { label: "Find Tutors", href: "/tutors" },
        { label: "Tutor Application", href: "/tutor/application" },
        { label: "Student Dashboard", href: "/dashboard/student" }
      ];
    } else {
      navigation = [
        { label: "Home", href: "/" },
        { label: "Find Tutors", href: "/tutors" },
        { label: "Become a Tutor", href: "/become-a-tutor" },
        { label: "Student Dashboard", href: "/dashboard/student" }
      ];
    }
  }

  return (
    <header className="border-b border-slate-900 bg-slate-950 text-white">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">E</span>
          <span className="text-xl font-bold tracking-tight">EasyLearning</span>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm font-medium text-slate-300 sm:gap-x-6">
          {authStatus !== "loading" && navigation.map((item) => (
            <Link key={item.label} href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ))}
          {authStatus === "signed-in" && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="font-semibold text-white transition hover:text-amber-300 disabled:opacity-60"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          )}
        </div>
        {logoutError && <p role="alert" className="w-full text-right text-sm text-red-300">{logoutError}</p>}
      </nav>
    </header>
  );
}
