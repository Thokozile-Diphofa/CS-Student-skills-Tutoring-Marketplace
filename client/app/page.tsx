import Link from "next/link";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

const steps = [
  {
    title: "Find a Tutor",
    description: "Browse student tutors by subject, course level, and availability.",
  },
  {
    title: "Request a Session",
    description: "Send a short message describing what you need help with and when.",
  },
  {
    title: "Start Learning",
    description: "Meet, study, and build confidence with a peer who understands your course.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main>
        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-5xl px-6 py-20 text-center md:px-10 lg:py-28">
            <span className="inline-flex rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Peer tutoring made simple
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-white md:text-5xl">
              Learn Better. Together.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Connect with student tutors who understand your courses and get the academic support you need.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="rounded-full bg-amber-400 px-6 py-3 text-center font-semibold text-slate-900 transition hover:bg-amber-300"
              >
                Find a Tutor
              </Link>
              <Link
                href="/register"
                className="rounded-full border border-slate-600 bg-slate-900 px-6 py-3 text-center font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
              >
                Become a Tutor
              </Link>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 md:px-10">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">How It Works</h2>
            <p className="mt-4 text-lg text-slate-600">A simple way to get support when you need it most.</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-3 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-5xl px-6 md:px-10">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 md:p-12">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Support that fits student life.</h2>
              <p className="mt-4 max-w-2xl text-lg text-slate-600">
                EasyLearning connects university students with peer tutors who share the same courses, challenges, and goals.
              </p>
              <div className="mt-8 grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <p className="text-3xl font-bold text-slate-900">1:1</p>
                  <p className="mt-2 text-slate-600">Personalized help for your course and study goals.</p>
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <p className="text-3xl font-bold text-slate-900">Peer</p>
                  <p className="mt-2 text-slate-600">Friendly tutors who know the pace and pressure of campus life.</p>
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <p className="text-3xl font-bold text-slate-900">Flexible</p>
                  <p className="mt-2 text-slate-600">Book tutoring around your schedule and learning needs.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-20 text-center md:px-10">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Ready to get started?</h2>
          <p className="mt-4 text-lg text-slate-600">Create your account and connect with the right support for your next course milestone.</p>
          <Link
            href="/register"
            className="mt-8 inline-flex rounded-full bg-amber-400 px-7 py-3 font-semibold text-slate-900 transition hover:bg-amber-300"
          >
            Register today
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
