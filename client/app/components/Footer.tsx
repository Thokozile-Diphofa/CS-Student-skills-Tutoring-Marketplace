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
      </div>
    </footer>
  );
}
