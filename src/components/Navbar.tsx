import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Medal,
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
  { to: '/challenge', label: 'Challenge', icon: <Trophy className="h-4 w-4" /> },
  { to: '/result', label: 'My Submissions', icon: <BarChart3 className="h-4 w-4" /> },
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const visibleLinks = navLinks.filter(
    (link) => !link.adminOnly || user?.role === 'ADMIN'
  );

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-all duration-300',
        scrolled
          ? 'border-b border-[#D8EBDD] bg-[#F8FCF9]/95 backdrop-blur-md shadow-sm'
          : 'border-b border-[#D8EBDD]/70 bg-[#F8FCF9]/85 backdrop-blur-sm'
      )}
    >
      <div className="container-page">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Zone 1: Single text wordmark */}
          <Link
            to={isAuthenticated ? '/instructions' : '/'}
            className="flex items-center gap-2.5 shrink-0 group"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-black tracking-wider text-white transition-transform duration-200 group-hover:scale-105">
              RP
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Prompt Arena
            </span>
          </Link>

          {/* Zone 2: Clean text nav links with animated glider */}
          {isAuthenticated && (
            <nav className="hidden items-center gap-6 md:flex">
              {visibleLinks.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      'text-sm font-medium transition-colors relative py-1 px-0.5',
                      isActive ? 'text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-900'
                    )}
                  >
                    <span>{link.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeNavUnderline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Zone 3: Primary Actions */}
          <div className="hidden items-center gap-4 md:flex shrink-0">
            {isAuthenticated ? (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-4"
              >
                {user && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-900">{user.full_name || user.username}</span>
                    {user.role === 'ADMIN' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-brand-600">Admin</span>
                      </>
                    )}
                  </div>
                )}
                <button
                  onClick={logout}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-100 active:scale-95"
                >
                  Log out
                </button>
              </motion.div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-sm"
                >
                  Get started
                </Link>
              </div>
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