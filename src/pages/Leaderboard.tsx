import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, Crown, Medal, RefreshCw, Trophy } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { leaderboardApi, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { LeaderboardEntry } from '@/types';

export function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await leaderboardApi.list();
      setEntries(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Compute sorted participants strictly by numeric FINAL total_score descending
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const scoreA = Number(a.total_score);
      const scoreB = Number(b.total_score);
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return (a.rank || 0) - (b.rank || 0);
    });
  }, [entries]);

  // Extract Top 3 for the podium from the sorted dataset
  const first = sortedEntries.length > 0 ? sortedEntries[0] : null;
  const second = sortedEntries.length > 1 ? sortedEntries[1] : null;
  const third = sortedEntries.length > 2 ? sortedEntries[2] : null;

  const topThree = [
    { rank: 2, color: 'bg-slate-200', height: 'h-20', label: '2nd', icon: <Medal className="h-5 w-5 text-slate-500" />, entry: second },
    { rank: 1, color: 'bg-amber-300', height: 'h-28', label: '1st', icon: <Crown className="h-6 w-6 text-amber-600" />, entry: first },
    { rank: 3, color: 'bg-orange-300', height: 'h-16', label: '3rd', icon: <Medal className="h-5 w-5 text-orange-500" />, entry: third },
  ];

  // Check if current authenticated user has an entry on the leaderboard
  const currentUserEntry = useMemo(() => {
    if (!user) return null;
    return sortedEntries.find(
      (e) => e.user_id === user.id || e.username.toLowerCase() === user.username.toLowerCase()
    );
  }, [user, sortedEntries]);

  return (
    <PageTransition>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              PROMPT ENGINEERING
            </h1>
            <p className="mt-1 text-slate-500">
              Reverse Prompt Engineering Challenge — Official Final Leaderboard (/80)
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Current User Highlight Banner if ranked */}
        {currentUserEntry && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50/80 px-6 py-4 text-brand-900 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-sm shadow-sm">
                #{currentUserEntry.rank}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Your Current Standing</span>
                  <span className="rounded-full bg-brand-200/80 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                    {user?.role === 'PARTICIPANT' ? 'Participant' : 'You'}
                  </span>
                </div>
                <div className="text-base font-extrabold text-slate-900">
                  {currentUserEntry.full_name || currentUserEntry.username} (@{currentUserEntry.username})
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-medium text-slate-500">Final AI Score</div>
                <div className="text-xl font-black text-brand-700">
                  {Number(currentUserEntry.total_score).toFixed(1)}{' '}
                  <span className="text-xs font-normal text-slate-400">/ 80</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Top 3 Podium visual */}
        <div className="flex items-end justify-center gap-4 pt-4">
          {topThree.map((p) => (
            <motion.div
              key={p.rank}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: p.rank * 0.1 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-card ring-1 ring-slate-200">
                {p.icon}
              </div>
              <span className="text-xs font-bold text-slate-800 text-center max-w-[100px] truncate">
                {p.entry ? p.entry.full_name || p.entry.username : '—'}
              </span>
              {p.entry && (
                <span className="text-xs font-extrabold text-brand-600">
                  {Number(p.entry.total_score).toFixed(1)} / 80
                </span>
              )}
              <div className={`w-24 rounded-t-xl ${p.color} ${p.height} flex items-center justify-center text-xs font-black text-slate-700 shadow-sm`}>
                {p.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Full Leaderboard Table (Option A: Top 3 Podium + Complete Table with All Participants) */}
        <Card>
          <CardBody className="p-0">
            {loading && <Loading label="Loading leaderboard rankings..." />}
            {!loading && sortedEntries.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">
                No scored final submissions yet. Be the first to complete a challenge!
              </div>
            )}
            {!loading && sortedEntries.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 bg-slate-50">
                      <th className="px-6 py-4 font-semibold">Rank</th>
                      <th className="px-6 py-4 font-semibold">Participant</th>
                      <th className="px-6 py-4 text-center font-semibold">Rounds Played</th>
                      <th className="px-6 py-4 text-right font-semibold">Final AI Score (/80)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((row) => {
                      const isCurrentUser = Boolean(
                        user && (row.user_id === user.id || row.username.toLowerCase() === user.username.toLowerCase())
                      );

                      return (
                        <tr
                          key={row.user_id}
                          className={`border-b border-slate-50 last:border-0 transition-colors ${
                            isCurrentUser
                              ? 'bg-brand-50/70 hover:bg-brand-50 font-medium'
                              : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${
                                row.rank === 1
                                  ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                                  : row.rank === 2
                                  ? 'bg-slate-200 text-slate-800'
                                  : row.rank === 3
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              #{row.rank}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{row.full_name || row.username}</span>
                              {isCurrentUser && (
                                <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">@{row.username}</div>
                          </td>
                          <td className="px-6 py-4 text-center text-slate-500 font-medium">
                            {row.rounds_played}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span
                              className={`inline-block rounded-xl px-3 py-1 text-base font-extrabold ${
                                isCurrentUser
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-brand-50 text-brand-700'
                              }`}
                            >
                              {Number(row.total_score).toFixed(1)}{' '}
                              <span className={`text-xs font-normal ${isCurrentUser ? 'text-brand-100' : 'text-slate-400'}`}>
                                / 80
                              </span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>
            Leaderboard rankings reflect only official FINAL evaluation scores (/80). Offline teacher/judge 20 marks are added separately offline.
          </p>
        </div>

        <div className="flex justify-center">
          <Link to="/instructions">
            <Button variant="outline">Back to instructions</Button>
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}