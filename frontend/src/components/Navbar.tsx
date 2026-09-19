import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Image as ImageIcon,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Medal,
  Play,
  ShieldCheck,
  Target,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface NavLink {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const navLinks: NavLink[] = [
  { to: '/instructions', label: 'Instructions', icon: <Target className="h-4 w-4" /> },
  { to: '/practice', label: 'Practice', icon: <Play className="h-4 w-4" /> },
  { to: '/challenge', label: 'Challenge', icon: <Trophy className="h-4 w-4" /> },
  { to: '/leaderboard', label: 'Leaderboard', icon: <Medal className="h-4 w-4" /> },
  {
    to: '/admin',
    label: 'Admin Dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    adminOnly: true,
  },
];

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const visibleLinks = navLinks.filter(
    (link) => !link.adminOnly || user?.role === 'ADMIN'
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
      <div className="container-page">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            to={isAuthenticated ? '/instructions' : '/'}
            className="flex items-center gap-2.5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-glow">
              <ImageIcon className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              PROMPT <span className="gradient-text">ENGINEERING</span>
            </span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden items-center gap-1 md:flex">
              {visibleLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                    location.pathname === link.to
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="hidden items-center gap-3 md:flex">
            {user?.role === 'ADMIN' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 ring-1 ring-accent-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </span>
            )}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                {user && (
                  <span className="text-sm font-medium text-slate-600">
                    {user.full_name || user.username}
                  </span>
                )}
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : (
              <>
                <Link to="/login">
                  <span className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                    <LogIn className="h-4 w-4" />
                    Log in
                  </span>
                </Link>
                <Link to="/register">
                  <span className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700">
                    <UserPlus className="h-4 w-4" />
                    Sign up
                  </span>
                </Link>
              </>
            )}
          </div>

          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 md:hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isAuthenticated && (
              <div className="flex flex-col gap-1 py-2">
                {visibleLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium',
                      location.pathname === link.to
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600'
                    )}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-2 border-t border-slate-100 pt-3">
              {isAuthenticated ? (
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              ) : (
                <div className="flex gap-2">
                  <Link to="/login" className="flex-1">
                    <span className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700">
                      <LogIn className="h-4 w-4" />
                      Log in
                    </span>
                  </Link>
                  <Link to="/register" className="flex-1">
                    <span className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white">
                      <UserPlus className="h-4 w-4" />
                      Sign up
                    </span>
                  </Link>
                </div>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}