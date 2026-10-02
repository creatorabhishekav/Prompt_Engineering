import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Ambient3DBackground } from '@/components/Ambient3DBackground';
import { KineticCursor } from '@/components/KineticCursor';

export function Layout() {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#F3FAF5] text-slate-900 overflow-x-hidden">
      {/* Global Ambient 3D Rotating Object (Behind Content) */}
      <Ambient3DBackground />

      {/* Global Premium Kinetic Cursor System */}
      <KineticCursor />

      {/* Application Content Layer */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 py-8 sm:py-12">
          <div className="container-page">
            <Outlet />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}