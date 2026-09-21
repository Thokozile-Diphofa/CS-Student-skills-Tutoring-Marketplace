import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 text-sm text-slate-600 md:flex-row md:items-center md:justify-between md:px-10">
        <div>
          <p className="text-lg font-bold text-slate-900">EasyLearning</p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Link href="/" className="hover:text-slate-900">About</Link>
          <Link href="/" className="hover:text-slate-900">Contact</Link>
          <Link href="/" className="hover:text-slate-900">Privacy</Link>
          <Link href="/" className="hover:text-slate-900">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
