import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <PageTransition>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <FileQuestion className="mb-4 h-12 w-12 text-slate-300" />
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">404</h1>
        <p className="mt-2 text-slate-500">This page doesn't exist.</p>
        <Link to="/instructions" className="mt-6">
          <Button variant="outline">Back home</Button>
        </Link>
      </div>
    </PageTransition>
  );
}