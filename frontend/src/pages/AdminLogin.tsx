import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function AdminLoginPage() {
  const { loginAdminWithEmailPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginAdminWithEmailPassword(email, password);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      console.error('Admin login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid admin credentials. Please check your email and password, or verify that Email/Password sign-in is enabled in Firebase Console.');
      } else {
        setError(err.message || 'Access denied. This account does not have administrator privileges.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-8">
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-brand-700 text-white shadow-glow"
          >
            <Shield className="h-7 w-7" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            PROMPT ENGINEERING
          </h1>
          <p className="mt-1 text-sm font-medium text-brand-600">
            Admin Portal
          </p>
        </div>

        <Card className="p-6 sm:p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" fullWidth size="lg" loading={submitting}>
              {!submitting && <LogIn className="h-4 w-4" />}
              Login as Admin
            </Button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Google Login
            </Button>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
