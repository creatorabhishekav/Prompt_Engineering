import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  Layers,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loading } from '@/components/ui/Loading';
import { AiModeBadge } from '@/components/AiModeBadge';
import { adminApi, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';
import type {
  AdminSubmission,
  AdminUserListItem,
  Competition,
  OverviewStats,
  Round,
} from '@/types';

const badge: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-sky-100 text-sky-700',
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  ended: 'bg-slate-200 text-slate-600',
};

type RoundActionKey = 'start' | 'pause' | 'resume' | 'end';
type CompetitionActionKey = 'schedule' | 'start' | 'pause' | 'resume' | 'end';

const roundActions: Record<RoundActionKey, { label: string; icon: typeof Play }> = {
  start: { label: 'Start', icon: Play },
  pause: { label: 'Pause', icon: Pause },
  resume: { label: 'Resume', icon: Play },
  end: { label: 'End', icon: Flag },
};

const competitionActions: Record<CompetitionActionKey, { label: string; icon: typeof Play }> = {
  schedule: { label: 'Schedule', icon: CalendarPlus },
  start: { label: 'Start', icon: Play },
  pause: { label: 'Pause', icon: Pause },
  resume: { label: 'Resume', icon: Play },
  end: { label: 'End', icon: Flag },
};

const allowedRoundActions: Record<Round['status'], RoundActionKey[]> = {
  draft: ['start', 'end'],
  scheduled: ['start', 'end'],
  active: ['pause', 'end'],
  paused: ['resume', 'end'],
  ended: [],
};

const allowedCompetitionActions: Record<Competition['status'], CompetitionActionKey[]> = {
  draft: ['schedule', 'start', 'end'],
  scheduled: ['start', 'end'],
  active: ['pause', 'end'],
  paused: ['resume', 'end'],
  ended: [],
};

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
};

function formatSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

type FilterTab = 'all' | 'active' | 'scheduled' | 'ended' | 'archived';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [createCompOpen, setCreateCompOpen] = useState(false);
  const [createCompError, setCreateCompError] = useState<string | null>(null);

  const [createRoundFor, setCreateRoundFor] = useState<Competition | null>(null);
  const [createRoundError, setCreateRoundError] = useState<string | null>(null);

  const [uploadFor, setUploadFor] = useState<Round | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [submissionsFor, setSubmissionsFor] = useState<Round | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Confirm Archive & Delete modals
  const [archiveCompTarget, setArchiveCompTarget] = useState<Competition | null>(null);
  const [archiveRoundTarget, setArchiveRoundTarget] = useState<Round | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState<AdminSubmission | null>(null);
  const [clearSubsRoundTarget, setClearSubsRoundTarget] = useState<Round | null>(null);
  const [subSuccessMsg, setSubSuccessMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, comps, usersData] = await Promise.all([
        adminApi.overview(),
        adminApi.competitions(),
        adminApi.users(),
      ]);
      setStats(statsData);
      setCompetitions(comps);
      setUsers(usersData);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runCompetitionAction = async (competition: Competition, action: CompetitionActionKey) => {
    const key = `${competition.id}:${action}`;
    setBusyAction(key);
    setError(null);
    try {
      await adminApi.competitionAction(action, competition.id);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const handleArchiveCompetition = async (competition: Competition) => {
    const key = `${competition.id}:archive`;
    setBusyAction(key);
    setError(null);
    try {
      await adminApi.archiveCompetition(competition.id);
      setArchiveCompTarget(null);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestoreCompetition = async (competition: Competition) => {
    const key = `${competition.id}:restore`;
    setBusyAction(key);
    setError(null);
    try {
      await adminApi.restoreCompetition(competition.id);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const runRoundAction = async (round: Round, action: RoundActionKey) => {
    const key = `${round.id}:${action}`;
    setBusyAction(key);
    setError(null);
    try {
      await adminApi.roundAction(action, round.id);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const handleArchiveRound = async (round: Round) => {
    const key = `${round.id}:archive`;
    setBusyAction(key);
    setError(null);
    try {
      await adminApi.archiveRound(round.id);
      setArchiveRoundTarget(null);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestoreRound = async (round: Round) => {
    const key = `${round.id}:restore`;
    setBusyAction(key);
    setError(null);
    try {
      await adminApi.restoreRound(round.id);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const openSubmissions = async (round: Round) => {
    setSubmissionsFor(round);
    setSubmissionsLoading(true);
    setSubSuccessMsg(null);
    try {
      setSubmissions(await adminApi.submissions(round.id));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handleDeleteSubmission = async (sub: AdminSubmission) => {
    const key = `delete:${sub.id}`;
    setBusyAction(key);
    setError(null);
    try {
      await adminApi.deleteSubmission(sub.id);
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
      setDeleteSubTarget(null);
      setSubSuccessMsg('Submission deleted successfully.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const handleClearSubmissions = async (round: Round) => {
    const key = `clear:${round.id}`;
    setBusyAction(key);
    setError(null);
    try {
      for (const s of submissions) {
        await adminApi.deleteSubmission(s.id);
      }
      setSubmissions([]);
      setClearSubsRoundTarget(null);
      setSubSuccessMsg('All submissions cleared for this round.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const filteredCompetitions = competitions.filter((comp) => {
    if (activeTab === 'archived') {
      return comp.is_archived === true;
    }
    // For non-archived tabs, hide archived competitions by default
    if (comp.is_archived === true) return false;

    if (activeTab === 'all') return true;
    if (activeTab === 'active') return comp.status === 'active' || comp.status === 'paused';
    if (activeTab === 'scheduled') return comp.status === 'scheduled' || comp.status === 'draft';
    if (activeTab === 'ended') return comp.status === 'ended';
    return true;
  });

  return (
    <PageTransition>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-accent-600">
              <ShieldCheck className="h-4 w-4" />
              Admin
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Admin Dashboard</h1>
            <p className="mt-1 text-slate-500">Run competitions, rounds and monitor submissions.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <AiModeBadge />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Participants', value: stats?.participants ?? 0, icon: <Users className="h-5 w-5" />, tint: 'bg-brand-50 text-brand-600' },
            { label: 'Competitions', value: stats?.competitions ?? 0, icon: <Trophy className="h-5 w-5" />, tint: 'bg-accent-50 text-accent-600' },
            { label: 'Rounds', value: stats?.rounds ?? 0, icon: <Layers className="h-5 w-5" />, tint: 'bg-emerald-50 text-emerald-600' },
            { label: 'Submissions', value: stats?.submissions ?? 0, icon: <CalendarPlus className="h-5 w-5" />, tint: 'bg-amber-50 text-amber-600' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover>
                <CardBody>
                  <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${stat.tint}`}>{stat.icon}</div>
                  <p className="text-3xl font-extrabold text-slate-900">{stat.value}</p>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Competitions */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Competitions</CardTitle>
                  <div className="mt-2 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
                    {(['all', 'active', 'scheduled', 'ended', 'archived'] as FilterTab[]).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                          activeTab === tab ? 'bg-white font-bold text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
                <Button size="sm" onClick={() => setCreateCompOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New competition
                </Button>
              </CardHeader>
              <CardBody className="space-y-3">
                {loading && <Loading label="Loading competitions..." />}
                {!loading && filteredCompetitions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                    {activeTab === 'archived'
                      ? 'No archived competitions found.'
                      : 'No competitions match the selected filter.'}
                  </div>
                )}
                {!loading &&
                  filteredCompetitions.map((competition) => {
                    const isOpen = expanded === competition.id;
                    return (
                      <div key={competition.id} className={`rounded-xl border ${competition.is_archived ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <button
                            className="flex min-w-0 items-center gap-2 text-left"
                            onClick={() => setExpanded(isOpen ? null : competition.id)}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">
                                {competition.title}
                                {competition.is_archived && (
                                  <span className="ml-2 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                    Archived
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400">
                                {competition.rounds.length} rounds · slug: {competition.slug}
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[competition.status]}`}>
                              {statusLabel[competition.status]}
                            </span>
                            {allowedCompetitionActions[competition.status].map((action) => {
                              const meta = competitionActions[action];
                              const Icon = meta.icon;
                              const busy = busyAction === `${competition.id}:${action}`;
                              return (
                                <Button
                                  key={action}
                                  size="sm"
                                  variant={action === 'end' ? 'danger' : action === 'start' ? 'primary' : 'secondary'}
                                  loading={busy}
                                  onClick={() => void runCompetitionAction(competition, action)}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  {meta.label}
                                </Button>
                              );
                            })}
                            {/* Archive / Restore Button for Ended Competition */}
                            {competition.status === 'ended' && !competition.is_archived && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => setArchiveCompTarget(competition)}
                              >
                                Archive
                              </Button>
                            )}
                            {competition.is_archived && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                loading={busyAction === `${competition.id}:restore`}
                                onClick={() => void handleRestoreCompetition(competition)}
                              >
                                Restore
                              </Button>
                            )}
                          </div>
                        </div>

                        {isOpen && (
                          <div className="space-y-2 border-t border-slate-100 px-4 py-3">
                            {competition.rounds.length === 0 && (
                              <p className="py-2 text-sm text-slate-400">No rounds yet.</p>
                            )}
                            {competition.rounds.map((round) => (
                              <div key={round.id} className={`rounded-lg px-4 py-3 ${round.is_archived ? 'bg-amber-100/40 border border-amber-200' : 'bg-slate-50'}`}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-800 flex items-center gap-2">
                                      <span>Round {round.round_number}: {round.title}</span>
                                      {round.is_archived && (
                                        <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-200/80 px-1.5 py-0.5 rounded">
                                          Archived
                                        </span>
                                      )}
                                    </p>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                                        Submissions: {round.submission_count ?? 0}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {formatSeconds(round.time_limit_seconds)} limit
                                      </span>
                                      <span>
                                        {round.target_image_url ? 'Target image: yes' : 'Target image: missing'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[round.status]}`}>
                                      {statusLabel[round.status]}
                                    </span>
                                    {!round.target_image_url && round.status !== 'ended' && (
                                      <Button size="sm" variant="outline" onClick={() => setUploadFor(round)}>
                                        <Upload className="h-3.5 w-3.5" />
                                        Upload image
                                      </Button>
                                    )}
                                    {allowedRoundActions[round.status].map((action) => {
                                      const meta = roundActions[action];
                                      const Icon = meta.icon;
                                      const busy = busyAction === `${round.id}:${action}`;
                                      return (
                                        <Button
                                          key={action}
                                          size="sm"
                                          variant={action === 'end' ? 'danger' : action === 'start' ? 'primary' : 'secondary'}
                                          loading={busy}
                                          onClick={() => void runRoundAction(round, action)}
                                        >
                                          <Icon className="h-3.5 w-3.5" />
                                          {meta.label}
                                        </Button>
                                      );
                                    })}
                                    {/* Round Archive / Restore Button */}
                                    {round.status === 'ended' && !round.is_archived && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-amber-300 text-amber-700 hover:bg-amber-50 text-xs px-2"
                                        onClick={() => setArchiveRoundTarget(round)}
                                      >
                                        Archive
                                      </Button>
                                    )}
                                    {round.is_archived && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs px-2"
                                        loading={busyAction === `${round.id}:restore`}
                                        onClick={() => void handleRestoreRound(round)}
                                      >
                                        Restore
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => void openSubmissions(round)}>
                                      <Eye className="h-3.5 w-3.5" />
                                      Submissions ({round.submission_count ?? 0})
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div className="pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={competition.status === 'ended'}
                                onClick={() => setCreateRoundFor(competition)}
                              >
                                <Plus className="h-4 w-4" />
                                Add round
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </CardBody>
              <CardFooter className="text-sm text-slate-500">
                Rounds must have a target image uploaded before they can start. Ending a competition ends all its rounds.
              </CardFooter>
            </Card>
          </div>

          {/* Users */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand-600" />
                  Participants
                </CardTitle>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-3 pr-4 font-semibold">User</th>
                        <th className="py-3 pr-4 font-semibold">Joined</th>
                        <th className="py-3 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 && (
                        <tr>
                          <td className="py-6 text-center text-slate-400" colSpan={3}>
                            No participants registered yet.
                          </td>
                        </tr>
                      )}
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-slate-50">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-slate-800">{user.username}</p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </td>
                          <td className="py-3 pr-4 text-xs text-slate-400">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 text-right">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {user.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Admin-only controls are protected. Participant submissions are automatically evaluated and published with an AI score out of 80.
          </p>
        </div>
      </div>

      {/* Create competition modal */}
      <CreateCompetitionModal
        open={createCompOpen}
        error={createCompError}
        onClose={() => {
          setCreateCompOpen(false);
          setCreateCompError(null);
        }}
        onCreated={async () => {
          setCreateCompOpen(false);
          await refresh();
        }}
        onError={setCreateCompError}
      />

      {/* Create round modal */}
      <CreateRoundModal
        competition={createRoundFor}
        error={createRoundError}
        onClose={() => {
          setCreateRoundFor(null);
          setCreateRoundError(null);
        }}
        onCreated={async () => {
          setCreateRoundFor(null);
          await refresh();
        }}
        onError={setCreateRoundError}
      />

      {/* Upload target image modal */}
      <UploadModal
        round={uploadFor}
        error={uploadError}
        onClose={() => {
          setUploadFor(null);
          setUploadError(null);
        }}
        onUploaded={async () => {
          setUploadFor(null);
          await refresh();
        }}
        onError={setUploadError}
      />

      {/* Submissions modal */}
      <Modal
        open={submissionsFor !== null}
        onClose={() => {
          setSubmissionsFor(null);
          setSubSuccessMsg(null);
        }}
        title={submissionsFor ? `Submissions — Round ${submissionsFor.round_number}` : ''}
        description={submissionsFor?.title}
        size="lg"
      >
        {subSuccessMsg && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 font-medium">
            <span>{subSuccessMsg}</span>
            <button onClick={() => setSubSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">✕</button>
          </div>
        )}

        {submissionsLoading && <Loading label="Loading submissions..." />}

        {!submissionsLoading && submissions.length > 0 && (
          <div className="mb-4 flex justify-end">
            <Button
              size="sm"
              variant="danger"
              className="bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
              onClick={() => submissionsFor && setClearSubsRoundTarget(submissionsFor)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All Submissions ({submissions.length})
            </Button>
          </div>
        )}

        {!submissionsLoading && submissions.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            No submissions yet for this round.
          </div>
        )}
        {!submissionsLoading && submissions.length > 0 && (
          <div className="space-y-4">
            {submissions.map((sub) => (
              <div key={sub.id} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900">{sub.full_name || sub.username}</span>
                    <span className="ml-2 text-xs text-slate-400">@{sub.username}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[sub.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {sub.status.replace('_', ' ')}
                    </span>
                    {sub.total_score !== undefined && sub.total_score !== null && (
                      <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-700">
                        Score: {sub.total_score} / 80
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs px-2 py-1 h-7"
                      onClick={() => setDeleteSubTarget(sub)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">First Prompt</p>
                        <p className="text-xs font-medium text-slate-800">{sub.prompt_1 || sub.prompt_used || '(No first prompt)'}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-brand-600 mb-1">Follow-up Prompt</p>
                        <p className="text-xs font-medium text-slate-800">{sub.prompt_2 || '(No follow-up prompt)'}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Final Image — Used for Evaluation</p>
                    {sub.image_url ? (
                      <img src={resolveMediaUrl(sub.image_url) || undefined} alt="Uploaded final generated" className="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                        No image uploaded
                      </div>
                    )}
                  </div>
                </div>

                {sub.total_score !== undefined && sub.total_score !== null && (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-slate-50 p-3 text-xs flex flex-wrap justify-between gap-2 font-medium text-slate-600">
                      <span>Semantic: <strong>{sub.semantic_score}/32</strong></span>
                      <span>Composition: <strong>{sub.composition_score}/20</strong></span>
                      <span>Objects: <strong>{sub.objects_score}/16</strong></span>
                      <span>Color: <strong>{sub.color_score}/8</strong></span>
                      <span>Details: <strong>{sub.details_score}/4</strong></span>
                    </div>
                    {(sub.clip_similarity !== undefined && sub.clip_similarity !== null || sub.evaluation_method) && (
                      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1">
                        {sub.clip_similarity !== undefined && sub.clip_similarity !== null && (
                          <span>CLIP Visual Similarity: <strong className="text-brand-700">{sub.clip_similarity.toFixed(1)}%</strong></span>
                        )}
                        {sub.evaluation_method && (
                          <span>Engine: <span className="font-medium text-slate-700">{sub.evaluation_method}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Delete Single Submission Modal */}
      <Modal
        open={deleteSubTarget !== null}
        onClose={() => setDeleteSubTarget(null)}
        title="Delete Submission?"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteSubTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busyAction === `delete:${deleteSubTarget?.id}`}
              onClick={() => deleteSubTarget && void handleDeleteSubmission(deleteSubTarget)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 font-medium">
          Are you sure you want to delete this submission by <strong className="text-slate-900">@{deleteSubTarget?.username}</strong>?
        </p>
        <p className="mt-2 text-sm text-slate-500">
          This action cannot be undone. The submission document, its score record, and its uploaded generated image file will be permanently removed.
        </p>
      </Modal>

      {/* Clear All Submissions Modal */}
      <Modal
        open={clearSubsRoundTarget !== null}
        onClose={() => setClearSubsRoundTarget(null)}
        title="Clear All Submissions in this Round?"
        footer={
          <>
            <Button variant="outline" onClick={() => setClearSubsRoundTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busyAction === `clear:${clearSubsRoundTarget?.id}`}
              onClick={() => clearSubsRoundTarget && void handleClearSubmissions(clearSubsRoundTarget)}
            >
              <Trash2 className="h-4 w-4" />
              Clear All Submissions
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 font-medium">
          Are you sure you want to clear all {submissions.length} submission(s) for <strong className="text-slate-900">Round {clearSubsRoundTarget?.round_number}: {clearSubsRoundTarget?.title}</strong>?
        </p>
        <p className="mt-2 text-sm text-slate-500">
          This action cannot be undone. All participant submission documents, score records, and uploaded image files for this round will be deleted. User accounts, rounds, target images, and competitions will remain untouched.
        </p>
      </Modal>


      {/* Archive Competition Modal */}
      <Modal
        open={archiveCompTarget !== null}
        onClose={() => setArchiveCompTarget(null)}
        title="Archive Competition?"
        footer={
          <>
            <Button variant="outline" onClick={() => setArchiveCompTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="bg-amber-600 hover:bg-amber-700 text-white border-none"
              loading={busyAction === `${archiveCompTarget?.id}:archive`}
              onClick={() => archiveCompTarget && void handleArchiveCompetition(archiveCompTarget)}
            >
              Archive
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This competition has ended.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Archiving will remove it from the normal Admin Dashboard list, but all participant submissions, results, scores, uploaded images and Gemini chat evidence will be preserved.
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-700">
          You can keep the historical data for review.
        </p>
      </Modal>

      {/* Archive Round Modal */}
      <Modal
        open={archiveRoundTarget !== null}
        onClose={() => setArchiveRoundTarget(null)}
        title="Archive Round?"
        footer={
          <>
            <Button variant="outline" onClick={() => setArchiveRoundTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="bg-amber-600 hover:bg-amber-700 text-white border-none"
              loading={busyAction === `${archiveRoundTarget?.id}:archive`}
              onClick={() => archiveRoundTarget && void handleArchiveRound(archiveRoundTarget)}
            >
              Archive
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This round has ended.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          The round will be removed from the normal management view, but participant submissions and results will be preserved.
        </p>
      </Modal>
    </PageTransition>
  );
}

// --- Create competition ---

function CreateCompetitionModal({
  open,
  error,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  error: string | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      onError('Title is required.');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await adminApi.createCompetition({
        title: title.trim(),
        description: description.trim() || null,
        slug: null,
      });
      await onCreated();
    } catch (e) {
      onError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create competition"
      description="A draft container your rounds will live in."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            <Trophy className="h-4 w-4" />
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <FormError message={error} />}
        <Field label="Title">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neon Nights" className={inputClass} />
        </Field>
        <Field label="Description (optional)">
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-none`} />
        </Field>
      </div>
    </Modal>
  );
}

// --- Create round ---

function CreateRoundModal({
  competition,
  error,
  onClose,
  onCreated,
  onError,
}: {
  competition: Competition | null;
  error: string | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [title, setTitle] = useState('');
  const [secretPrompt, setSecretPrompt] = useState('');
  const [seconds, setSeconds] = useState(600);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (competition) {
      setTitle('');
      setSecretPrompt('');
      setSeconds(600);
    }
  }, [competition]);

  const submit = async () => {
    if (!competition) return;
    if (!title.trim() || !secretPrompt.trim()) {
      onError('Title and reference prompt are required.');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await adminApi.createRound(competition.id, {
        title: title.trim(),
        secret_prompt: secretPrompt.trim(),
        time_limit_seconds: seconds,
        max_submissions: 1,
      });
      await onCreated();
    } catch (e) {
      onError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={competition !== null}
      onClose={onClose}
      title={`Add round to "${competition?.title ?? ''}"`}
      description="Round numbers are assigned automatically."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            <Plus className="h-4 w-4" />
            Add round
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <FormError message={error} />}
        <Field label="Round title">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Round One" className={inputClass} />
        </Field>
        <Field label="Reference prompt (kept secret)">
          <textarea rows={3} value={secretPrompt} onChange={(e) => setSecretPrompt(e.target.value)} placeholder="e.g. neon-lit cyberpunk city in the rain, 4k" className={`${inputClass} resize-none`} />
        </Field>
        <Field label={`Time limit (seconds) — ${formatSeconds(seconds)}`}>
          <input
            type="number"
            min={10}
            max={604800}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>
    </Modal>
  );
}

// --- Upload target image ---

function UploadModal({
  round,
  error,
  onClose,
  onUploaded,
  onError,
}: {
  round: Round | null;
  error: string | null;
  onClose: () => void;
  onUploaded: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (round) {
      setFile(null);
      setAlt('');
    }
  }, [round]);

  const submit = async () => {
    if (!round || !file) {
      onError('Choose an image file (PNG, JPEG or WEBP).');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await adminApi.uploadTargetImage(round.id, file, alt.trim() || undefined);
      await onUploaded();
    } catch (e) {
      onError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={round !== null}
      onClose={onClose}
      title={`Target image — Round ${round?.round_number ?? ''}`}
      description="Participants will try to reproduce this image from its prompt alone."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!file} onClick={() => void submit()}>
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <FormError message={error} />}
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 hover:border-brand-400 hover:bg-brand-50">
          <Upload className="h-6 w-6 text-slate-400" />
          {file ? <span className="font-medium text-brand-700">{file.name}</span> : 'Click to choose a PNG, JPEG or WEBP image'}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <Field label="Alt text (optional)">
          <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </Modal>
  );
}

const inputClass =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}