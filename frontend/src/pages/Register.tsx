import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Image as ImageIcon, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getApiErrorMessage } from '@/lib/api';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        username,
        email,
        password,
        full_name: fullName || undefined,
      });
      navigate('/instructions', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

  return (
    <PageTransition>
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-8">
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-glow"
          >
            <ImageIcon className="h-7 w-7" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Join the reverse prompt engineering arena
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="fullName"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Full name <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                placeholder="Alex Rivera"
              />
            </div>

            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
                placeholder="alexr"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Repeat your password"
              />
            </div>

            <Button type="submit" fullWidth size="lg" loading={submitting}>
              {!submitting && <UserPlus className="h-4 w-4" />}
              Create account
            </Button>

            <p className="text-center text-xs text-slate-400">
              Participants sign up automatically. Admin accounts are provisioned
              by the system.
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </PageTransition>
  );
}