"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "../../components/Footer";
import Navbar from "../../components/Navbar";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
type VerificationState = "CHECKING" | "PAID" | "FAILED" | "TIMEOUT" | "ERROR";

export default function PaymentReturnPage() {
  const [state, setState] = useState<VerificationState>("CHECKING");
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    const sessionRequestId = Number(new URLSearchParams(window.location.search).get("sessionRequestId"));
    if (!Number.isInteger(sessionRequestId) || sessionRequestId < 1) {
      setState("ERROR");
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;

    async function checkPayment() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/payments/session/${sessionRequestId}`, {
          credentials: "include"
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Payment status is unavailable.");
        if (cancelled) return;

        if (data.paymentStatus === "PAID") {
          setState("PAID");
          return;
        }
        if (["FAILED", "DISPUTED", "REFUNDED"].includes(data.paymentStatus)) {
          setState("FAILED");
          return;
        }

        attempts += 1;
        if (attempts >= 20) setState("TIMEOUT");
        else timer = window.setTimeout(() => void checkPayment(), 3000);
      } catch (error) {
        console.error("Payment status check failed:", error);
        if (!cancelled) setState("ERROR");
      }
    }

    void checkPayment();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [refreshCount]);

  const message = {
    CHECKING: "Your payment is being verified.",
    PAID: "Payment confirmed. Your session payment is recorded.",
    FAILED: "Payment was not completed. You can return to your sessions to try again.",
    TIMEOUT: "Your payment is still being verified. Check again shortly.",
    ERROR: "We could not retrieve your payment status. Your return to this page does not mark the payment as paid."
  }[state];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] text-[#241B3B]">
      <Navbar />
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-12 sm:px-8">
        <section className="w-full rounded-xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#6C4CF1]">Sandbox payment</p>
          <h1 className="mt-2 text-2xl font-bold text-[#241B3B]">{state === "PAID" ? "Payment confirmed" : "Payment status"}</h1>
          <p className="mt-3 text-sm leading-6 text-[#625B71]" role={state === "ERROR" ? "alert" : "status"}>{message}</p>
          {state === "TIMEOUT" || state === "ERROR" ? (
            <button
              type="button"
              onClick={() => {
                setState("CHECKING");
                setRefreshCount((count) => count + 1);
              }}
              className="mt-6 rounded-lg border border-[#6C4CF1] px-4 py-2 text-sm font-semibold text-[#6C4CF1] hover:bg-[#6C4CF1]/5"
            >
              Check payment status
            </button>
          ) : null}
          <Link href="/dashboard/student#requests" className="mt-6 block text-sm font-semibold text-[#6C4CF1] hover:underline">
            Return to My Session Requests
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}