import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { healthApi } from '@/lib/api';

export function ApiStatusBanner() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    let active = true;
    healthApi
      .check()
      .then((res) => {
        if (active) setStatus(res.status === 'ok' ? 'ok' : 'down');
      })
      .catch(() => {
        if (active) setStatus('down');
      });
    return () => {
      active = false;
    };
  }, []);

  if (status === 'ok' || status === 'checking') return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">Backend not reachable</p>
        <p className="mt-0.5 text-amber-700">
          Start the backend with{' '}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
            uvicorn app.main:app --reload
          </code>{' '}
          inside <code className="font-mono text-xs">backend/</code>. See the{' '}
          <Link to="/instructions" className="font-semibold underline">
            instructions
          </Link>
          .
        </p>
      </div>
    </div>
  );
}