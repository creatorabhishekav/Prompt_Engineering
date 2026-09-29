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
        <div className="container-page flex flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
          <p>Prompt Arena · Reverse Prompt Engineering Challenge</p>
          <div className="flex items-center gap-2 text-slate-400">
            <span>CLIP ViT-B/32 Vision Scoring</span>
            <span aria-hidden="true">·</span>
            <span>80 Points Automated Evaluation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}