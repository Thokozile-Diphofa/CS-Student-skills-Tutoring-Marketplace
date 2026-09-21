import Link from "next/link";

export default function Navbar() {
  return (
    <header className="bg-slate-950 text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
            E
          </div>
          <span className="text-xl font-bold tracking-tight">EasyLearning</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
          <Link href="/" className="transition hover:text-white">Home</Link>
          <Link href="/#how-it-works" className="transition hover:text-white">How It Works</Link>
          <Link href="/login" className="transition hover:text-white">Login</Link>
          <Link href="/register" className="transition hover:text-white">Register</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900 sm:inline-flex"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
          >
            Register
          </Link>
        </div>
      </nav>
    </header>
  );
}
