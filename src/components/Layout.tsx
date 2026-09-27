import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-8 sm:py-12">
        <div className="container-page">
          <Outlet />
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="container-page flex flex-col items-center justify-between gap-2 text-sm text-slate-500 sm:flex-row">
          <p>Match That Image — Reverse Prompt Engineering Challenge</p>
          <p>Demo mode running · No AI API key required</p>
        </div>
      </footer>
    </div>
  );
}