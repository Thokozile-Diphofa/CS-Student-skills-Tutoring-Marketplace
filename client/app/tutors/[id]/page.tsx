"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Tutor {
  id: number;
  firstName: string;
  lastName: string;
  university: string;
  email: string;
  headline: string;
  bio: string;
  hourlyRate: number;
  subjects: string[];
  roles: string[];
}

export default function TutorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const tutorId = resolvedParams.id;

  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTutorProfile() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/tutors/${tutorId}`, {
          method: "GET",
          credentials: "include"
        });

        if (response.status === 404) {
          setError("Tutor profile not found or user is not a tutor.");
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load tutor profile.");
        }

        const data = await response.json();
        setTutor(data.tutor || null);
      } catch (error: unknown) {
        console.error("Error fetching tutor profile:", error);
        setError("Unable to connect to server. Please check backend connection.");
      } finally {
        setLoading(false);
      }
    }

    if (tutorId) {
      fetchTutorProfile();
    }
  }, [tutorId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <div>
        <Navbar />

        <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">
          <div className="mb-6">
            <Link
              href="/tutors"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              ← Back to Tutor Search
            </Link>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="h-16 w-16 rounded-full bg-slate-200"></div>
              <div className="mt-4 h-6 w-1/3 rounded bg-slate-200"></div>
              <div className="mt-2 h-4 w-1/4 rounded bg-slate-200"></div>
              <div className="mt-8 h-20 w-full rounded bg-slate-200"></div>
            </div>
          )}

          {/* Error / 404 State */}
          {error && !loading && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-xl">
                ⚠️
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900">Profile Not Found</h2>
              <p className="mt-1 text-sm text-red-600">{error}</p>
              <Link
                href="/tutors"
                className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Return to Tutors List
              </Link>
            </div>
          )}

          {/* Profile Loaded */}
          {!loading && !error && tutor && (
            <div className="grid gap-8 md:grid-cols-3">
              {/* Left Column Profile Card */}
              <div className="md:col-span-2 space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 font-black text-slate-950 text-2xl">
                        {tutor.firstName[0]}
                        {tutor.lastName[0]}
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                          {tutor.firstName} {tutor.lastName}
                        </h1>
                        <p className="text-sm font-semibold text-slate-500">{tutor.university}</p>
                      </div>
                    </div>

                    <span className="inline-self-start rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                      VERIFIED PEER TUTOR
                    </span>
                  </div>

                  <div className="mt-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-600">Headline</h2>
                    <p className="mt-1 text-base font-semibold text-slate-900">{tutor.headline}</p>
                  </div>

                  <div className="mt-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-600">About Me</h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">{tutor.bio}</p>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-600">Subjects Taught</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tutor.subjects.map((sub) => (
                        <span
                          key={sub}
                          className="rounded-lg bg-amber-100/80 border border-amber-300/40 px-3 py-1 text-xs font-semibold text-amber-900"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column Booking Card Placeholder */}
              <div className="md:col-span-1">
                <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="border-b border-slate-100 pb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rate & Pricing</p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-amber-600">R{tutor.hourlyRate.toFixed(0)}</span>
                      <span className="text-sm font-normal text-slate-500">/ hour</span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4 text-xs text-slate-600">
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span>University:</span>
                      <strong className="text-slate-900">{tutor.university}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span>Status:</span>
                      <strong className="text-emerald-600">Active Peer Tutor</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span>Sessions:</span>
                      <strong className="text-slate-900">1-on-1 Peer Tutoring</strong>
                    </div>
                  </div>

                  {/* Non-functional Placeholder Request Session Button */}
                  <div className="mt-8">
                    <button
                      disabled
                      className="w-full rounded-xl bg-slate-200 py-3 text-sm font-semibold text-slate-500 cursor-not-allowed"
                    >
                      Request Session (Coming 30 Sept)
                    </button>
                    <p className="mt-2 text-[11px] text-center text-slate-400">
                      Session booking feature is scheduled for Wednesday, 30 September.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
