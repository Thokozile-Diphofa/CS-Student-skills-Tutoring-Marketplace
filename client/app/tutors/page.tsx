"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

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

const SUBJECT_OPTIONS = ["All", "Computer Science", "Mathematics", "Data Structures", "Statistics", "Physics"];
const UNIVERSITY_OPTIONS = ["All", "TUT", "Wits", "UCT", "Stellenbosch", "UP"];

export default function TutorsSearchPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedUniversity, setSelectedUniversity] = useState("All");

  const fetchTutors = useEffectEvent(async () => {
    setLoading(true);
    setError("");

    try {
      const queryParams = new URLSearchParams();
      if (searchTerm.trim()) queryParams.append("search", searchTerm.trim());
      if (selectedSubject !== "All") queryParams.append("subject", selectedSubject);
      if (selectedUniversity !== "All") queryParams.append("university", selectedUniversity);

      const response = await fetch(`${API_BASE_URL}/api/tutors?${queryParams.toString()}`, {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to load tutors from database.");
      }

      const data = await response.json();
      setTutors(data.tutors || []);
    } catch (error: unknown) {
      console.error("Error fetching tutors:", error);
      setError("Unable to retrieve tutor listings. Please check backend connection.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTutors();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedSubject, selectedUniversity]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F3EEFF] to-[#FFF0E8] text-[#241B3B] flex flex-col justify-between">
      <div>
        <Navbar />

        <main className="mx-auto max-w-7xl px-6 py-10 md:px-10">
          <div className="mb-10 text-center md:text-left">
            <span className="inline-flex rounded-full border border-[#6C4CF1]/40 bg-[#6C4CF1]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#6C4CF1]">
              Find Peer Support
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#241B3B] md:text-4xl">
              Discover CS & Math Student Tutors
            </h1>
            <p className="mt-2 text-[#625B71]">
              Connect with verified student tutors from your university based on subjects and hourly rates.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="mb-8 rounded-2xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#625B71]">
                  Search Tutor or Keyword
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="e.g. Computer Science, Calculus, Thabo..."
                  style={{ background: "rgba(255, 255, 255, 0.65)" }}
                  className="w-full rounded-xl border border-[#CFC4F8] px-4 py-2.5 text-sm text-[#241B3B] placeholder-[#625B71] outline-none transition focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#625B71]">
                  Filter By Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  style={{ background: "rgba(255, 255, 255, 0.65)" }}
                  className="w-full rounded-xl border border-[#CFC4F8] px-4 py-2.5 text-sm text-[#241B3B] outline-none transition focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white"
                >
                  {SUBJECT_OPTIONS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub === "All" ? "All Subjects" : sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#625B71]">
                  Filter By University
                </label>
                <select
                  value={selectedUniversity}
                  onChange={(e) => setSelectedUniversity(e.target.value)}
                  style={{ background: "rgba(255, 255, 255, 0.65)" }}
                  className="w-full rounded-xl border border-[#CFC4F8] px-4 py-2.5 text-sm text-[#241B3B] outline-none transition focus:border-[#6C4CF1] focus:ring-2 focus:ring-[#6C4CF1]/30 focus:bg-white"
                >
                  {UNIVERSITY_OPTIONS.map((uni) => (
                    <option key={uni} value={uni}>
                      {uni === "All" ? "All Universities" : uni}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject Filter Pills */}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#CFC4F8]/40 pt-4">
              <span className="text-xs font-semibold text-[#625B71] mr-2">Popular:</span>
              {SUBJECT_OPTIONS.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    selectedSubject === sub
                      ? "bg-[#6C4CF1] text-white font-bold shadow-sm"
                      : "bg-[#EDE7FF] text-[#6C4CF1] hover:bg-[#CFC4F8]"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm">
                  <div className="h-10 w-10 rounded-full bg-[#EDE7FF]"></div>
                  <div className="mt-4 h-5 w-3/4 rounded bg-[#EDE7FF]"></div>
                  <div className="mt-2 h-4 w-1/2 rounded bg-[#EDE7FF]"></div>
                  <div className="mt-6 h-10 w-full rounded-xl bg-[#EDE7FF]"></div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="rounded-2xl border border-[#EF4444] bg-[#EF4444]/10 p-6 text-center text-sm font-medium text-[#EF4444]">
              {error}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && tutors.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#CFC4F8] bg-white/80 p-12 text-center backdrop-blur-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EDE7FF] text-[#6C4CF1] font-bold text-xl">
                🔍
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#241B3B]">No tutors found</h3>
              <p className="mt-1 text-sm text-[#625B71]">
                We couldn&apos;t find any peer tutors matching your search or filters.
              </p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedSubject("All");
                  setSelectedUniversity("All");
                }}
                className="mt-5 rounded-full bg-[#241B3B] px-5 py-2 text-xs font-semibold text-white hover:bg-[#6C4CF1] transition"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Tutor Cards Grid */}
          {!loading && !error && tutors.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tutors.map((tutor) => (
                <div
                  key={tutor.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#CFC4F8] bg-white/80 p-6 shadow-sm transition hover:shadow-md hover:border-[#6C4CF1] backdrop-blur-sm"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFD166] font-black text-[#241B3B] text-lg shadow-sm">
                        {tutor.firstName[0]}
                        {tutor.lastName[0]}
                      </div>
                      <span className="rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#22C55E] uppercase tracking-wider">
                        VERIFIED PEER TUTOR
                      </span>
                    </div>

                    <div className="mt-4">
                      <h2 className="text-xl font-bold text-[#241B3B]">
                        {tutor.firstName} {tutor.lastName}
                      </h2>
                      <p className="text-xs font-semibold text-[#625B71]">{tutor.university}</p>
                    </div>

                    <p className="mt-3 text-xs font-semibold text-[#241B3B] line-clamp-2">
                      {tutor.headline}
                    </p>

                    {/* Hourly Rate Display */}
                    <div className="mt-4 flex items-center justify-between border-t border-[#CFC4F8]/40 pt-3">
                      <span className="text-xs text-[#625B71] font-medium">Hourly Rate:</span>
                      <span className="text-lg font-extrabold text-[#6C4CF1]">
                        R{tutor.hourlyRate.toFixed(0)} <span className="text-xs font-normal text-[#625B71]">/ hour</span>
                      </span>
                    </div>

                    {/* Subjects Badges */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tutor.subjects.map((sub) => (
                        <span
                          key={sub}
                          className="rounded-md bg-[#EDE7FF] px-2 py-0.5 text-[11px] font-medium text-[#6C4CF1]"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-[#CFC4F8]/40 pt-4">
                    <Link
                      href={`/tutors/${tutor.id}`}
                      style={{ background: "linear-gradient(90deg, #6C4CF1, #8B5CF6)" }}
                      className="block w-full rounded-xl py-2.5 text-center text-sm font-semibold text-white shadow-md transition hover:opacity-95"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
