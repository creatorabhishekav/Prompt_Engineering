import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ChallengeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CHALLENGE RUNTIME ERROR CAUGHT]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center p-4">
          <Card className="w-full text-center border-rose-200 bg-white/95 shadow-lg backdrop-blur-md">
            <CardBody className="py-10 px-6 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                <AlertCircle className="h-7 w-7" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Challenge failed to load
                </h2>
                <p className="text-xs text-slate-500">
                  An unexpected runtime issue occurred while preparing the challenge arena.
                </p>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={this.handleReset}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = '/instructions';
                  }}
                  className="flex items-center gap-2 border-slate-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Challenges
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
