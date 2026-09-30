"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type AccountState = "checking" | "signed-out" | "student" | "tutor" | "unavailable";

export default function BecomeATutorPage() {
  const router = useRouter();
  const [accountState, setAccountState] = useState<AccountState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function checkAccount() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
        if (cancelled) return;
        if (response.status === 401) {
          setAccountState("signed-out");
          return;
        }
        if (!response.ok) {
          setAccountState("unavailable");
          return;
        }
        const data = await response.json();
        setAccountState(data.user?.roles?.includes("TUTOR") ? "tutor" : "student");
      } catch (error) {
        console.error("Account check failed:", error);
        if (!cancelled) setAccountState("unavailable");
      }
    }

    void checkAccount();
    return () => {
      cancelled = true;
    };
  }, []);

  function continueApplication() {
    if (accountState === "signed-out") {
      router.push("/register?intent=tutor");
      return;
    }
    if (accountState === "tutor") {
      router.push("/dashboard/tutor");
      return;
    }
    if (accountState === "student") {
      router.push("/tutor/application");
    }
  }

  const buttonLabel = accountState === "checking"
    ? "Checking account..."
    : accountState === "unavailable"
      ? "Application unavailable"
      : accountState === "tutor"
        ? "View Tutor Dashboard"
        : "Apply to Become a Tutor";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-14 sm:px-8">
        <section className="w-full border-l-4 border-amber-400 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <p className="text-sm font-semibold uppercase text-amber-700">Tutor applications</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Share what you know. Help another student move forward.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            EasyLearning students can apply to tutor subjects they know well. Applications are reviewed before tutor features are enabled.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={continueApplication}
              disabled={accountState === "checking" || accountState === "unavailable"}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {buttonLabel}
            </button>
            {accountState === "signed-out" && (
              <p className="text-sm text-slate-600">Already have an account? <Link className="font-semibold text-amber-700 hover:text-amber-600" href="/login?next=%2Ftutor%2Fapplication">Log in to continue.</Link></p>
            )}
            {accountState === "unavailable" && (
              <p className="text-sm text-red-700" role="alert">We could not check your account. Please reload and try again.</p>
            )}
          </div>
          <p className="mt-6 max-w-2xl text-xs leading-5 text-slate-500">
            Applying does not grant Tutor access. You can continue using your Student account while your application is reviewed.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}