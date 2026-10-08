"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "../../components/Footer";
import Navbar from "../../components/Navbar";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface PaymentReceipt {
  receiptNumber: string;
  paymentDate: string | null;
  studentName: string;
  studentEmail: string;
  tutorName: string;
  subject: string;
  sessionDate: string | null;
  amount: string;
  currency: string;
  paymentStatus: "PAID";
  paymentReference: string | null;
}

function formatReceiptDate(value: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not provided"
    : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(date);
}

function formatAmount(amount: string, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} ${amount}`;
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(value);
}

export default function PaymentReceiptPage() {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const sessionRequestId = Number(new URLSearchParams(window.location.search).get("sessionRequestId"));

    fetch(`${API_BASE_URL}/api/payments/receipt/${sessionRequestId}`, { credentials: "include" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to load this receipt.");
        return data.receipt as PaymentReceipt;
      })
      .then((data) => {
        if (!cancelled) setReceipt(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Unable to load this receipt.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] text-[#241B3B] print:bg-white">
      <div className="print:hidden"><Navbar /></div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-10 sm:px-8 print:py-0">
        <section className="w-full rounded-xl border border-[#CFC4F8] bg-white/90 p-6 shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#625B71]" role="status">Loading receipt...</p>
          ) : errorMessage || !receipt ? (
            <div className="py-8 text-center">
              <h1 className="text-xl font-bold">Receipt unavailable</h1>
              <p className="mt-3 text-sm text-[#625B71]" role="alert">{errorMessage || "This payment receipt could not be found."}</p>
              <Link href="/dashboard/student#requests" className="mt-5 inline-block text-sm font-semibold text-[#6C4CF1] hover:underline print:hidden">
                Return to My Session Requests
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#CFC4F8] pb-5">
                <div>
                  <p className="text-xl font-bold text-[#241B3B]">EasyLearning</p>
                  <p className="mt-1 text-sm text-[#625B71]">Tutoring Marketplace</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold uppercase tracking-wide text-[#6C4CF1]">Payment Receipt</p>
                  <p className="mt-1 text-sm font-semibold">{receipt.receiptNumber}</p>
                </div>
              </div>

              <p className="mt-5 text-sm text-[#625B71]">Payment date: <span className="font-medium text-[#241B3B]">{formatReceiptDate(receipt.paymentDate)}</span></p>

              <dl className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Student</dt><dd className="mt-1 font-semibold">{receipt.studentName}</dd><dd className="mt-1 break-all text-sm text-[#625B71]">{receipt.studentEmail}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Tutor</dt><dd className="mt-1 font-semibold">{receipt.tutorName}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Subject / module</dt><dd className="mt-1 font-semibold">{receipt.subject}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Session date</dt><dd className="mt-1 font-semibold">{formatReceiptDate(receipt.sessionDate)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Amount paid</dt><dd className="mt-1 text-xl font-bold">{formatAmount(receipt.amount, receipt.currency)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-[#625B71]">Payment status</dt><dd className="mt-1 font-semibold text-[#15803D]">{receipt.paymentStatus}</dd></div>
                {receipt.paymentReference && <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-[#625B71]">Payment reference</dt><dd className="mt-1 break-all font-mono text-sm">{receipt.paymentReference}</dd></div>}
              </dl>

              <p className="mt-8 border-t border-[#CFC4F8] pt-5 text-sm text-[#625B71]">Thank you for using EasyLearning.</p>
              <div className="mt-6 flex flex-wrap gap-3 print:hidden">
                <button type="button" onClick={() => window.print()} className="rounded-lg bg-[#6C4CF1] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5B3FD2]">
                  Print / Save as PDF
                </button>
                <Link href="/dashboard/student#requests" className="rounded-lg border border-[#CFC4F8] px-4 py-2.5 text-sm font-semibold text-[#241B3B] hover:bg-[#F3EEFF]">
                  Return to My Session Requests
                </Link>
              </div>
            </>
          )}
        </section>
      </main>
      <div className="print:hidden"><Footer /></div>
    </div>
  );
}
