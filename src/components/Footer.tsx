import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="relative w-full border-t border-[#D8EBDD] bg-[#F8FCF9]/95 backdrop-blur-md pt-14 pb-7 mt-auto overflow-hidden text-slate-900 transition-colors duration-200"
    >
      {/* Subtle radial glow background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(20,83,45,0.05),transparent_45%)]"
        aria-hidden="true"
      />

      <div className="w-full max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12">
        {/* Top Brand Section */}
        <section className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-10 border-b border-[#D8EBDD]">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-xs font-black tracking-wider text-white shadow-sm">
                RP
              </span>
              <div>
                <span className="text-lg font-bold tracking-tight text-[#0F172A] block leading-tight">
                  Prompt Arena
                </span>
                <span className="text-xs font-medium text-[#475569] block">
                  Reverse Prompt Engineering Challenge
                </span>
              </div>
            </div>

            <p className="mt-3.5 max-w-xl text-xs sm:text-sm text-[#475569] leading-relaxed">
              An interactive AI challenge platform designed to test observation, prompt engineering, visual understanding, and image similarity skills.
            </p>

            {/* Micro Information Badges */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[
                'AI-Powered',
                'Visual Similarity',
                '80 Points',
                'Reverse Prompt Engineering',
              ].map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center rounded-md border border-[#D8EBDD] bg-[rgba(20,83,45,0.05)] px-2.5 py-0.5 text-[11px] font-medium text-[#14532D]"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 py-10">
          {/* Column 1: Platform Links */}
          <nav aria-label="Platform Links">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-3.5">
              Platform
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/challenge"
                  className="text-[#475569] hover:text-[#14532D] hover:translate-x-0.5 transition-all duration-150 inline-block py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14532D]/40 rounded-sm"
                >
                  Challenges
                </Link>
              </li>
              <li>
                <Link
                  to="/instructions"
                  className="text-[#475569] hover:text-[#14532D] hover:translate-x-0.5 transition-all duration-150 inline-block py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14532D]/40 rounded-sm"
                >
                  Instructions
                </Link>
              </li>
              <li>
                <Link
                  to="/leaderboard"
                  className="text-[#475569] hover:text-[#14532D] hover:translate-x-0.5 transition-all duration-150 inline-block py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14532D]/40 rounded-sm"
                >
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link
                  to="/result"
                  className="text-[#475569] hover:text-[#14532D] hover:translate-x-0.5 transition-all duration-150 inline-block py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14532D]/40 rounded-sm"
                >
                  Results
                </Link>
              </li>
            </ul>
          </nav>

          {/* Column 2: Challenge Information */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-3.5">
              Challenge
            </h3>
            <ul className="space-y-2 text-xs text-[#475569]">
              <li className="py-0.5">Reverse Prompt Engineering</li>
              <li className="py-0.5">AI Visual Evaluation</li>
              <li className="py-0.5">80 Point Automated Score</li>
              <li className="py-0.5">Two-Stage Prompt Workflow</li>
            </ul>
          </div>

          {/* Column 3: Genuine Project Technology */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-3.5">
              Technology
            </h3>
            <ul className="space-y-2 text-xs text-[#475569]">
              <li className="py-0.5">React + TypeScript</li>
              <li className="py-0.5">Vite</li>
              <li className="py-0.5">AI / Computer Vision</li>
              <li className="py-0.5">CLIP-based Visual Evaluation</li>
              <li className="py-0.5">Firebase Authentication</li>
            </ul>
          </div>

          {/* Column 4: Contact & Developer Info */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-3.5">
              Contact
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <p className="font-semibold text-[#0F172A]">
                  Made by Abhishek Vishwakarma
                </p>
                <p className="text-[11px] text-[#475569] mt-0.5">
                  (BCA Final Year Student)
                </p>
              </div>
              <div className="pt-1">
                <span className="text-[11px] font-medium text-[#475569] block">
                  Email
                </span>
                <a
                  href="mailto:creatorabhishekav@gmail.com"
                  className="font-medium text-[#14532D] hover:text-[#0b331b] hover:underline underline-offset-2 transition-colors duration-150 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14532D]/40 rounded-sm mt-0.5"
                  aria-label="Send email to creatorabhishekav@gmail.com"
                >
                  creatorabhishekav@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[#D8EBDD]" />

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 text-xs text-[#475569] text-center sm:text-left">
          <p className="font-medium">
            &copy; 2026 Prompt Arena. All rights reserved.
          </p>

          <p className="text-[11px] text-[#475569]">
            Made by Abhishek Vishwakarma{' '}
            <span className="text-slate-400">·</span> (BCA Final Year Student)
          </p>

          <div>
            <a
              href="mailto:creatorabhishekav@gmail.com"
              className="font-medium text-[#14532D] hover:text-[#0b331b] hover:underline underline-offset-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14532D]/40 rounded-sm"
            >
              creatorabhishekav@gmail.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
