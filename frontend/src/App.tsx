import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { InstructionsPage } from '@/pages/Instructions';
import { PracticePage } from '@/pages/Practice';
import { ChallengePage } from '@/pages/Challenge';
import { ResultPage } from '@/pages/Result';
import { LeaderboardPage } from '@/pages/Leaderboard';
import { AdminDashboardPage } from '@/pages/AdminDashboard';
import { NotFoundPage } from '@/pages/NotFound';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/instructions" element={<InstructionsPage />} />
              <Route path="/practice" element={<PracticePage />} />
              <Route path="/challenge" element={<ChallengePage />} />
              <Route path="/result" element={<ResultPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
            </Route>

            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/instructions" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}