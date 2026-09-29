import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, Crown, Medal, RefreshCw } from 'lucide-react';
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
  const [search, setSearch] = useState('');

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

  // Filtered entries for search
  const filteredEntries = useMemo(() => {
    if (!search.trim()) return sortedEntries;
    const q = search.toLowerCase().trim();
    return sortedEntries.filter(
      (e) =>
        e.username.toLowerCase().includes(q) ||
        (e.full_name && e.full_name.toLowerCase().includes(q))
    );
  }, [sortedEntries, search]);

  // Extract Top 3 for the podium from the sorted dataset
  const first = sortedEntries.length > 0 ? sortedEntries[0] : null;
  const second = sortedEntries.length > 1 ? sortedEntries[1] : null;
  const third = sortedEntries.length > 2 ? sortedEntries[2] : null;

  const topThree = [
    { rank: 2, label: '2nd Place', icon: <Medal className="h-5 w-5 text-slate-400" />, entry: second, border: 'border-slate-300' },
    { rank: 1, label: '1st Place', icon: <Crown className="h-6 w-6 text-amber-500" />, entry: first, border: 'border-amber-300 shadow-md ring-1 ring-amber-200' },
    { rank: 3, label: '3rd Place', icon: <Medal className="h-5 w-5 text-amber-700" />, entry: third, border: 'border-amber-200' },
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Official Leaderboard
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Rankings based strictly on authoritative final evaluation scores (/80).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participant..."
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 w-48 sm:w-56"
            />
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Current User Highlight Banner if ranked */}
        {currentUserEntry && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4 text-slate-900 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="font-mono text-xl font-black text-brand-600">
                #{currentUserEntry.rank}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  Your Current Standing
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {currentUserEntry.full_name || currentUserEntry.username}{' '}
                  <span className="font-normal text-xs text-slate-400">(@{currentUserEntry.username})</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Final Vision Score</div>
              <div className="font-mono text-2xl font-black text-slate-900 tabular-nums">
                {Number(currentUserEntry.total_score).toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-400">/ 80</span>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Top 3 Podium visual */}
        {sortedEntries.length >= 3 && !search && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {topThree.map((p) => (
              <motion.div
                key={p.rank}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: p.rank * 0.08 }}
                className={`rounded-2xl border ${p.border} bg-white p-5 shadow-sm flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">{p.label}</span>
                    <div>{p.icon}</div>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-slate-900 truncate">
                    {p.entry ? p.entry.full_name || p.entry.username : '—'}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {p.entry ? `@${p.entry.username}` : ''}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500">Final Score</span>
                  <span className="font-mono text-xl font-black text-slate-900 tabular-nums">
                    {p.entry ? Number(p.entry.total_score).toFixed(1) : '—'}{' '}
                    <span className="text-xs font-normal text-slate-400">/ 80</span>
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Full Leaderboard Table */}
        <Card>
          <CardBody className="p-0">
            {loading && <Loading label="Loading leaderboard rankings..." />}
            {!loading && filteredEntries.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">
                {search ? `No participants matching "${search}".` : 'No scored final submissions yet. Be the first to complete a challenge!'}
              </div>
            )}
            {!loading && filteredEntries.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/70">
                      <th className="px-6 py-3.5 font-semibold">Rank</th>
                      <th className="px-6 py-3.5 font-semibold">Participant</th>
                      <th className="px-6 py-3.5 text-center font-semibold">Rounds</th>
                      <th className="px-6 py-3.5 text-right font-semibold">Final AI Score (/80)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((row) => {
                      const isCurrentUser = Boolean(
                        user && (row.user_id === user.id || row.username.toLowerCase() === user.username.toLowerCase())
                      );

                      return (
                        <tr
                          key={row.user_id}
                          className={`border-b border-slate-50 last:border-0 transition-colors ${
                            isCurrentUser
                              ? 'bg-brand-50/50 hover:bg-brand-50/70'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-6 py-4 font-mono font-bold text-xs tabular-nums text-slate-700">
                            #{row.rank}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{row.full_name || row.username}</span>
                              {isCurrentUser && (
                                <span className="text-[10px] font-bold text-brand-600">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">@{row.username}</div>
                          </td>
                          <td className="px-6 py-4 text-center font-mono text-xs tabular-nums text-slate-500">
                            {row.rounds_played}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-mono text-base font-bold tabular-nums text-slate-900">
                              {Number(row.total_score).toFixed(1)}{' '}
                              <span className="text-xs font-normal text-slate-400">/ 80</span>
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

        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <p>
            Rankings reflect official FINAL evaluation scores. +20 offline marks added separately.
          </p>
          <Link to="/instructions" className="hover:text-slate-600 underline">
            Competition Rules
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}