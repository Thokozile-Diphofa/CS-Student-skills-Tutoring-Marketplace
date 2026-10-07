import Link from "next/link";
import Footer from "../../components/Footer";
import Navbar from "../../components/Navbar";

export default function PaymentCancelledPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] text-[#241B3B]">
      <Navbar />
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-12 sm:px-8">
        <section className="w-full rounded-xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#FF8A4C]">Sandbox payment</p>
          <h1 className="mt-2 text-2xl font-bold text-[#241B3B]">Payment cancelled</h1>
          <p className="mt-3 text-sm leading-6 text-[#625B71]">Payment was cancelled. No payment has been completed.</p>
          <Link href="/dashboard/student#requests" className="mt-6 block text-sm font-semibold text-[#6C4CF1] hover:underline">
            Return to My Session Requests
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}