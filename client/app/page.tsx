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
    <div className="min-h-screen bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] text-[#241B3B]">
      <Navbar />

      <main>
        <section style={{ background: "linear-gradient(135deg, #6C4CF1 0%, #8B5CF6 100%)" }} className="text-white shadow-md">
          <div className="mx-auto max-w-5xl px-6 py-20 text-center md:px-10 lg:py-28">
            <span className="inline-flex rounded-full border border-[#FFD166]/40 bg-[#FFD166]/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#FFD166]">
              Peer tutoring made simple
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-white md:text-5xl">
              Learn Better. Together.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-[#EDE7FF]">
              Connect with student tutors who understand your courses and get the academic support you need.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="rounded-full bg-[#FFD166] px-6 py-3 text-center font-bold text-[#241B3B] shadow-md transition hover:bg-[#ffe08b]"
              >
                Find a Tutor
              </Link>
              <Link
                href="/register"
                className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/20"
              >
                Become a Tutor
              </Link>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 md:px-10">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#241B3B] md:text-4xl">How It Works</h2>
            <p className="mt-4 text-lg text-[#625B71]">A simple way to get support when you need it most.</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-[#CFC4F8] bg-white/80 p-7 shadow-sm backdrop-blur-sm">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#EDE7FF] font-bold text-[#6C4CF1]">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold text-[#241B3B]">{step.title}</h3>
                <p className="mt-3 text-[#625B71]">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-5xl px-6 md:px-10">
            <div className="rounded-3xl border border-[#CFC4F8] bg-white/80 p-8 shadow-sm backdrop-blur-sm md:p-12">
              <h2 className="text-3xl font-bold tracking-tight text-[#241B3B]">Support that fits student life.</h2>
              <p className="mt-4 max-w-2xl text-lg text-[#625B71]">
                EasyLearning connects university students with peer tutors who share the same courses, challenges, and goals.
              </p>
              <div className="mt-8 grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl border border-[#CFC4F8] bg-white p-5 shadow-sm">
                  <p className="text-3xl font-bold text-[#6C4CF1]">1:1</p>
                  <p className="mt-2 text-[#625B71]">Personalized help for your course and study goals.</p>
                </div>
                <div className="rounded-2xl border border-[#CFC4F8] bg-white p-5 shadow-sm">
                  <p className="text-3xl font-bold text-[#FF6B6B]">Peer</p>
                  <p className="mt-2 text-[#625B71]">Friendly tutors who know the pace and pressure of campus life.</p>
                </div>
                <div className="rounded-2xl border border-[#CFC4F8] bg-white p-5 shadow-sm">
                  <p className="text-3xl font-bold text-[#FF8A4C]">Flexible</p>
                  <p className="mt-2 text-[#625B71]">Book tutoring around your schedule and learning needs.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-20 text-center md:px-10">
          <h2 className="text-3xl font-bold tracking-tight text-[#241B3B] md:text-4xl">Ready to get started?</h2>
          <p className="mt-4 text-lg text-[#625B71]">Create your account and connect with the right support for your next course milestone.</p>
          <Link
            href="/register"
            style={{ background: "linear-gradient(90deg, #6C4CF1, #8B5CF6)" }}
            className="mt-8 inline-flex rounded-full px-7 py-3 font-semibold text-white shadow-md transition hover:opacity-95"
          >
            Register today
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
