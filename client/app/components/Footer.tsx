import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[#6C4CF1]/20 bg-[#241B3B] text-[#EDE7FF]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 text-sm text-[#EDE7FF] md:flex-row md:items-center md:justify-between md:px-10">
        <div>
          <p className="text-lg font-bold text-[#FFD166]">EasyLearning</p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Link href="/" className="transition hover:text-[#FFD166]">About</Link>
          <Link href="/" className="transition hover:text-[#FFD166]">Contact</Link>
          <Link href="/" className="transition hover:text-[#FFD166]">Privacy</Link>
          <Link href="/" className="transition hover:text-[#FFD166]">Terms</Link>
        </div>
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[#FFD166] transition hover:text-white [&::-webkit-details-marker]:hidden">
            Quick Links
            <span aria-hidden="true" className="h-2 w-2 rotate-45 border-b border-r border-current transition group-open:-rotate-[135deg]" />
          </summary>
          <div className="absolute bottom-full right-0 z-10 mb-2 min-w-40 rounded-lg border border-white/15 bg-[#241B3B] p-2 shadow-lg">
            <Link href="/admin/login" className="block rounded-md px-3 py-2 transition hover:bg-white/10 hover:text-[#FFD166]">Admin Login</Link>
          </div>
        </details>
      </div>
    </footer>
  );
}
