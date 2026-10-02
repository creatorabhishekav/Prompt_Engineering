import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Brain,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Layers,
  Link2,
  RefreshCw,
  Sparkles,
  Trophy,
  User as UserIcon,
  X,
  ZoomIn,
} from 'lucide-react';
import { adminApi, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';
import type {
  AdminSubmission,
  Competition,
  ParticipantDetailResponse,
  ParticipantDetailRoundItem,
  ParticipantDetailSubmission,
  Round,
} from '@/types';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';

interface AdminParticipantInspectorProps {
  userId: string | null;
  initialRoundId?: string | null;
  onClose: () => void;
}

// Fallback helper to reconstruct participant details from existing admin endpoints
// if the dedicated endpoint returns 404 on an unupdated production backend.
async function reconstructFromExistingAdminRoutes(
  uid: string,
  rId?: string | null
): Promise<ParticipantDetailResponse | null> {
  const usersList = await adminApi.users();
  const cleanUid = decodeURIComponent(uid).toLowerCase().trim();
  const foundUser = usersList.find(
    (u) =>
      u.id?.toLowerCase() === cleanUid ||
      u.email?.toLowerCase() === cleanUid ||
      u.username?.toLowerCase() === cleanUid
  );

  if (!foundUser) {
    return null;
  }

  const comps = await adminApi.competitions();
  const allRoundsWithComp: { comp: Competition; round: Round }[] = [];

  for (const c of comps) {
    if (c.rounds && Array.isArray(c.rounds) && c.rounds.length > 0) {
      for (const r of c.rounds) {
        allRoundsWithComp.push({ comp: c, round: r });
      }
    } else {
      try {
        const compRounds = await adminApi.rounds(c.id);
        for (const r of compRounds) {
          allRoundsWithComp.push({ comp: c, round: r });
        }
      } catch {
        // Ignore single comp round fetch failure
      }
    }
  }

  const roundsList: ParticipantDetailRoundItem[] = [];
  const participantSubmissions: {
    comp: Competition;
    round: Round;
    sub: AdminSubmission;
  }[] = [];

  for (const item of allRoundsWithComp) {
    try {
      const subs = await adminApi.submissions(item.round.id);
      const userSub = subs.find(
        (s) =>
          s.user_id?.toLowerCase() === foundUser.id.toLowerCase() ||
          s.user_id?.toLowerCase() === cleanUid ||
          s.username?.toLowerCase() === foundUser.username.toLowerCase()
      );
      if (userSub) {
        participantSubmissions.push({
          comp: item.comp,
          round: item.round,
          sub: userSub,
        });
        roundsList.push({
          competition_id: item.comp.id,
          competition_title: item.comp.title,
          round_id: item.round.id,
          round_title: item.round.title,
          round_number: item.round.round_number || 1,
          status: userSub.status,
          score:
            userSub.total_score ??
            userSub.final_score ??
            userSub.final_score_breakdown?.total_score ??
            userSub.first_score ??
            null,
          target_image_url: null,
        });
      }
    } catch {
      // Ignore submission fetch error for inactive/archived round
    }
  }

  let selected = participantSubmissions.find((p) => p.round.id === rId);
  if (!selected && participantSubmissions.length > 0) {
    selected = [...participantSubmissions].sort((a, b) => {
      const scoreB = b.sub.total_score || b.sub.final_score || 0;
      const scoreA = a.sub.total_score || a.sub.final_score || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.sub.created_at).getTime() - new Date(a.sub.created_at).getTime();
    })[0];
  }

  let targetImageUrl: string | null = null;
  if (selected?.round?.id) {
    try {
      const targetImages = await adminApi.targetImages(selected.round.id);
      if (targetImages && targetImages.length > 0) {
        targetImageUrl = targetImages[0].image_url;
      }
    } catch {
      // Ignore target image fetch error
    }
  }

  const selectedRound = selected
    ? {
        id: selected.round.id,
        title: selected.round.title,
        round_number: selected.round.round_number || 1,
        status: selected.round.status,
        target_image_url: targetImageUrl,
        competition_id: selected.comp.id,
        competition_title: selected.comp.title,
      }
    : null;

  const sub = selected?.sub;
  const subData: ParticipantDetailSubmission | null = sub
    ? {
        id: sub.id,
        user_id: sub.user_id,
        round_id: sub.round_id,
        status: sub.status,
        prompt_1: sub.prompt_1 || sub.prompt_used || null,
        prompt_1_submitted_at: sub.created_at || null,
        prompt_2: sub.prompt_2 || null,
        prompt_2_submitted_at: sub.submitted_at || null,
        first_image_url: sub.first_image_url || null,
        first_image_uploaded_at: sub.created_at || null,
        final_image_url: sub.final_image_url || sub.image_url || null,
        final_image_uploaded_at: sub.submitted_at || null,
        gemini_chat_link: sub.gemini_chat_link || null,
        first_stage_breakdown: (sub.first_score_breakdown as any) || null,
        final_stage_breakdown: (sub.final_score_breakdown as any) || null,
        first_score: sub.first_score ?? sub.first_score_breakdown?.total_score ?? null,
        final_score: sub.final_score ?? sub.final_score_breakdown?.total_score ?? sub.total_score ?? null,
        total_score: sub.total_score ?? sub.final_score ?? null,
        started_at: sub.created_at || null,
        submitted_at: sub.submitted_at || null,
        created_at: sub.created_at,
        updated_at: sub.submitted_at || sub.created_at,
      }
    : null;

  return {
    user: {
      id: foundUser.id,
      username: foundUser.username,
      email: foundUser.email,
      full_name: foundUser.full_name,
      role: 'PARTICIPANT',
      created_at: foundUser.created_at,
    },
    rounds: roundsList,
    selected_round: selectedRound,
    submission: subData,
  };
}

export function AdminParticipantInspector({
  userId,
  initialRoundId,
  onClose,
}: AdminParticipantInspectorProps) {
  const [data, setData] = useState<ParticipantDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(initialRoundId || null);

  // Copy feedbacks
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Lightbox viewer
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>('');
  const [lightboxZoom, setLightboxZoom] = useState(false);

  const fetchDetails = async (uid: string, rId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      console.log('[PARTICIPANT INSPECTOR]');
      console.log('userId:', uid);
      console.log('endpoint:', `/admin/participants/${encodeURIComponent(uid)}/details`);
      const res = await adminApi.participantDetails(uid, rId || undefined);
      console.log('response status: 200 OK');
      setData(res);
      if (res.selected_round?.id) {
        setSelectedRoundId(res.selected_round.id);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      console.log('response status:', status);

      // If the dedicated endpoint returns 404 (for instance on production where Render has not yet deployed this route),
      // gracefully reconstruct details from existing admin endpoints that ARE on Render:
      if (status === 404) {
        try {
          console.log('[PARTICIPANT INSPECTOR] Falling back to existing admin routes...');
          const fallbackData = await reconstructFromExistingAdminRoutes(uid, rId);
          if (fallbackData) {
            console.log('[PARTICIPANT INSPECTOR] Fallback reconstruction succeeded.');
            setData(fallbackData);
            if (fallbackData.selected_round?.id) {
              setSelectedRoundId(fallbackData.selected_round.id);
            }
            return;
          }
        } catch (fallbackErr) {
          console.warn('[PARTICIPANT INSPECTOR] Fallback reconstruction failed:', fallbackErr);
        }
      }

      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      void fetchDetails(userId, initialRoundId);
    } else {
      setData(null);
      setError(null);
    }
  }, [userId, initialRoundId]);

  const handleSelectRound = (rId: string) => {
    if (!userId || rId === selectedRoundId) return;
    setSelectedRoundId(rId);
    void fetchDetails(userId, rId);
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
      }
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  if (!userId) return null;

  const sub = data?.submission;
  const user = data?.user;
  const selectedRound = data?.selected_round;
  const roundsList = data?.rounds || [];

  const firstScore = sub?.first_score;
  const finalScore = sub?.final_score ?? sub?.total_score;
  const scoreDiff =
    firstScore !== null &&
    firstScore !== undefined &&
    finalScore !== null &&
    finalScore !== undefined
      ? Number((finalScore - firstScore).toFixed(1))
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-title"
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border border-[#D8EBDD] bg-[#F8FCF9] text-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8EBDD] bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-xs shadow-sm">
              <UserIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 id="inspector-title" className="text-base sm:text-lg font-bold text-slate-900">
                Participant Details
              </h2>
              <p className="text-xs text-slate-500">
                Admin Comprehensive Submission Inspection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close inspector"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Loading state */}
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loading label="Retrieving complete participant records..." />
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-rose-800">
                Unable to load participant details.
              </p>
              <p className="text-xs text-rose-600">{error}</p>
              <Button
                size="sm"
                variant="outline"
                className="border-rose-300 text-rose-700 hover:bg-rose-100"
                onClick={() => userId && void fetchDetails(userId, selectedRoundId)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
              </Button>
            </div>
          )}

          {!loading && !error && user && (
            <>
              {/* Section 1: Participant Information Card */}
              <div className="rounded-2xl border border-[#D8EBDD] bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {user.full_name || user.username}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>@{user.username}</span>
                      <span>·</span>
                      <a
                        href={`mailto:${user.email}`}
                        className="text-brand-700 hover:underline font-medium"
                      >
                        {user.email}
                      </a>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-600 border border-slate-200 flex items-center gap-1.5">
                      <span>ID:</span>
                      <span className="font-bold">{user.id}</span>
                      <button
                        onClick={() => copyToClipboard(user.id, 'user_id')}
                        className="text-slate-400 hover:text-slate-700"
                        title="Copy User ID"
                      >
                        {copiedKey === 'user_id' ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                        sub?.status === 'completed' || sub?.status === 'evaluated'
                          ? 'bg-emerald-100 text-emerald-800'
                          : sub?.status
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {sub?.status ? sub.status.replace('_', ' ') : 'No Submission'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Competition</span>
                    <span className="font-semibold text-slate-800">
                      {selectedRound?.competition_title || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Round</span>
                    <span className="font-semibold text-slate-800">
                      {selectedRound
                        ? `Round ${selectedRound.round_number}: ${selectedRound.title}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Submitted At</span>
                    <span className="font-semibold text-slate-800">
                      {sub?.submitted_at
                        ? new Date(sub.submitted_at).toLocaleString()
                        : sub?.created_at
                        ? new Date(sub.created_at).toLocaleString()
                        : 'Pending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Authoritative Score</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {sub?.total_score !== undefined && sub?.total_score !== null
                        ? `${sub.total_score} / 80`
                        : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Multiple Rounds Selector (Section 14) */}
              {roundsList.length > 1 && (
                <div className="rounded-2xl border border-[#D8EBDD] bg-white p-4 shadow-sm space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <Layers className="h-3.5 w-3.5 text-brand-600" />
                    <span>Participating Rounds ({roundsList.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {roundsList.map((r) => {
                      const isSelected = r.round_id === selectedRoundId;
                      return (
                        <button
                          key={r.round_id}
                          onClick={() => handleSelectRound(r.round_id)}
                          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <span>
                            R{r.round_number}: {r.round_title}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              isSelected
                                ? 'bg-emerald-500 text-white'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {r.score !== null ? `${r.score} pts` : 'In Progress'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state if no submission for selected round */}
              {!sub && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-2">
                  <FileText className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">
                    No submission available for this round.
                  </p>
                  <p className="text-xs text-slate-400">
                    The participant has not started or completed an attempt for this challenge round yet.
                  </p>
                </div>
              )}

              {sub && (
                <>
                  {/* Section 3: Prompt History (Section 4) */}
                  <div className="rounded-2xl border border-[#D8EBDD] bg-white p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-brand-600" />
                      Prompt History
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Prompt 1 */}
                      <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white font-mono font-bold">
                              1
                            </span>
                            Prompt 1 (Initial)
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              sub.prompt_1
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {sub.prompt_1 ? 'Submitted' : 'Not submitted'}
                          </span>
                        </div>

                        {sub.prompt_1_submitted_at && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(sub.prompt_1_submitted_at).toLocaleString()}
                          </p>
                        )}

                        <div className="flex-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-xs font-mono text-slate-800 leading-relaxed select-text">
                          {sub.prompt_1 || '(No Prompt 1 content)'}
                        </div>

                        {sub.prompt_1 && (
                          <div className="flex justify-end pt-1">
                            <Button
                              size="xs"
                              variant="outline"
                              className="text-xs gap-1.5"
                              onClick={() => copyToClipboard(sub.prompt_1!, 'p1')}
                            >
                              {copiedKey === 'p1' ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600" /> Copied ✓
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" /> Copy Prompt 1
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Prompt 2 */}
                      <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white font-mono font-bold">
                              2
                            </span>
                            Prompt 2 (Follow-up)
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              sub.prompt_2
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {sub.prompt_2 ? 'Submitted' : 'Not submitted'}
                          </span>
                        </div>

                        {sub.prompt_2_submitted_at && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(sub.prompt_2_submitted_at).toLocaleString()}
                          </p>
                        )}

                        <div className="flex-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-xs font-mono text-slate-800 leading-relaxed select-text">
                          {sub.prompt_2 || '(No Prompt 2 follow-up content)'}
                        </div>

                        {sub.prompt_2 && (
                          <div className="flex justify-end pt-1">
                            <Button
                              size="xs"
                              variant="outline"
                              className="text-xs gap-1.5"
                              onClick={() => copyToClipboard(sub.prompt_2!, 'p2')}
                            >
                              {copiedKey === 'p2' ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600" /> Copied ✓
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" /> Copy Prompt 2
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Image Comparison (Section 11) */}
                  <div className="rounded-2xl border border-[#D8EBDD] bg-white p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-brand-600" />
                      Image Comparison (Target vs. First vs. Final)
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-3">
                      {/* Target Image */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">1. Target Image</span>
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">
                            Reference
                          </span>
                        </div>
                        {selectedRound?.target_image_url ? (
                          <div className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                            <img
                              src={resolveMediaUrl(selectedRound.target_image_url) || undefined}
                              alt="Target visual reference"
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            <button
                              onClick={() => {
                                setLightboxUrl(resolveMediaUrl(selectedRound.target_image_url));
                                setLightboxTitle('Target Visual Reference');
                              }}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold gap-1.5"
                            >
                              <Eye className="h-4 w-4" /> View Full
                            </button>
                          </div>
                        ) : (
                          <div className="aspect-square flex items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                            No target image
                          </div>
                        )}
                        <p className="text-[11px] text-slate-500">Official secret target visual</p>
                      </div>

                      {/* First Image */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">2. First Image</span>
                          <span className="rounded bg-brand-100 text-brand-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold">
                            Attempt 1
                          </span>
                        </div>
                        {sub.first_image_url ? (
                          <div className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                            <img
                              src={resolveMediaUrl(sub.first_image_url) || undefined}
                              alt="First generated attempt"
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            <button
                              onClick={() => {
                                setLightboxUrl(resolveMediaUrl(sub.first_image_url));
                                setLightboxTitle('First Generated Image (Attempt 1)');
                              }}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold gap-1.5"
                            >
                              <Eye className="h-4 w-4" /> View Full
                            </button>
                          </div>
                        ) : (
                          <div className="aspect-square flex items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                            No first image uploaded
                          </div>
                        )}
                        <p className="text-[11px] text-slate-500">
                          {sub.first_image_uploaded_at
                            ? `Uploaded: ${new Date(sub.first_image_uploaded_at).toLocaleTimeString()}`
                            : 'Practice stage attempt'}
                        </p>
                      </div>

                      {/* Final Image */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">3. Final Image</span>
                          <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-mono font-bold">
                            Official
                          </span>
                        </div>
                        {sub.final_image_url ? (
                          <div className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                            <img
                              src={resolveMediaUrl(sub.final_image_url) || undefined}
                              alt="Final generated submission"
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            <button
                              onClick={() => {
                                setLightboxUrl(resolveMediaUrl(sub.final_image_url));
                                setLightboxTitle('Final Official Submission (Attempt 2)');
                              }}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold gap-1.5"
                            >
                              <Eye className="h-4 w-4" /> View Full
                            </button>
                          </div>
                        ) : (
                          <div className="aspect-square flex items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                            No final image uploaded
                          </div>
                        )}
                        <p className="text-[11px] text-slate-500">
                          {sub.final_image_uploaded_at
                            ? `Uploaded: ${new Date(sub.final_image_uploaded_at).toLocaleTimeString()}`
                            : 'Scored for leaderboard'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 5: Score Comparison Card (Section 12) */}
                  <div className="rounded-2xl border border-[#D8EBDD] bg-white p-5 shadow-sm space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-brand-600" />
                      Score Progression (First Score → Final Score)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center rounded-xl bg-slate-50 p-4 border border-slate-100 text-center">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Stage 1 (Practice)
                        </span>
                        <div className="text-xl sm:text-2xl font-black font-mono text-slate-800 mt-1">
                          {firstScore !== null && firstScore !== undefined ? (
                            <>
                              {firstScore} <span className="text-xs text-slate-400 font-bold">/ 80</span>
                            </>
                          ) : (
                            <span className="text-sm text-slate-400 font-normal">Not evaluated</span>
                          )}
                        </div>
                      </div>

                      <div className="sm:border-x border-slate-200 px-4 py-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Progression Delta
                        </span>
                        <div
                          className={`text-lg sm:text-xl font-black font-mono mt-1 ${
                            scoreDiff === null
                              ? 'text-slate-400'
                              : scoreDiff > 0
                              ? 'text-emerald-700'
                              : scoreDiff < 0
                              ? 'text-rose-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {scoreDiff !== null ? `${scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff} pts` : '—'}
                        </div>
                        {scoreDiff !== null && (
                          <span className="text-[10px] text-slate-500">
                            {scoreDiff > 0 ? 'Refinement improved visual fidelity' : 'Maintained fidelity'}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                          Stage 2 (Leaderboard)
                        </span>
                        <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 mt-1">
                          {finalScore !== null && finalScore !== undefined ? (
                            <>
                              {finalScore} <span className="text-xs text-emerald-500 font-bold">/ 80</span>
                            </>
                          ) : (
                            <span className="text-sm text-slate-400 font-normal">Not evaluated</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 6: Detailed Evaluations Breakdown (Sections 6 & 8) */}
                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* Stage 1 Breakdown */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <Brain className="h-4 w-4 text-brand-600" />
                          Stage 1 Evaluation Breakdown
                        </h4>
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {firstScore !== null && firstScore !== undefined ? `${firstScore}/80` : '—'}
                        </span>
                      </div>

                      {sub.first_stage_breakdown ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Overall Visual Similarity</span>
                            <span className="font-mono font-bold text-slate-800">
                              {sub.first_stage_breakdown.semantic_similarity ?? sub.first_stage_breakdown.semantic_score ?? 0} / 45
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Composition & Layout</span>
                            <span className="font-mono font-bold text-slate-800">
                              {sub.first_stage_breakdown.composition_score ?? 0} / 12
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Objects & Attributes</span>
                            <span className="font-mono font-bold text-slate-800">
                              {sub.first_stage_breakdown.objects_score ?? 0} / 10
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Color & Lighting</span>
                            <span className="font-mono font-bold text-slate-800">
                              {sub.first_stage_breakdown.color_score ?? 0} / 7
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Image Quality</span>
                            <span className="font-mono font-bold text-slate-800">
                              {sub.first_stage_breakdown.image_quality_score ?? 0} / 4
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">Fine Details</span>
                            <span className="font-mono font-bold text-slate-800">
                              {sub.first_stage_breakdown.fine_details_score ?? sub.first_stage_breakdown.details_score ?? 0} / 2
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 py-6 text-center">
                          Stage 1 evaluation not completed.
                        </p>
                      )}
                    </div>

                    {/* Stage 2 Official Final Breakdown */}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/20 p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-emerald-600" />
                          Final AI Evaluation (Official)
                        </h4>
                        <span className="font-mono text-sm font-extrabold text-emerald-800">
                          {finalScore !== null && finalScore !== undefined ? `${finalScore} / 80` : '—'}
                        </span>
                      </div>

                      {sub.final_stage_breakdown ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-emerald-100/50">
                            <span className="text-slate-600">Visual Similarity</span>
                            <span className="font-mono font-bold text-slate-900">
                              {sub.final_stage_breakdown.semantic_similarity ?? sub.final_stage_breakdown.semantic_score ?? 0} / 45
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-emerald-100/50">
                            <span className="text-slate-600">Composition & Layout</span>
                            <span className="font-mono font-bold text-slate-900">
                              {sub.final_stage_breakdown.composition_score ?? 0} / 12
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-emerald-100/50">
                            <span className="text-slate-600">Objects & Attributes</span>
                            <span className="font-mono font-bold text-slate-900">
                              {sub.final_stage_breakdown.objects_score ?? 0} / 10
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-emerald-100/50">
                            <span className="text-slate-600">Color & Lighting</span>
                            <span className="font-mono font-bold text-slate-900">
                              {sub.final_stage_breakdown.color_score ?? 0} / 7
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-emerald-100/50">
                            <span className="text-slate-600">Image Quality</span>
                            <span className="font-mono font-bold text-slate-900">
                              {sub.final_stage_breakdown.image_quality_score ?? 0} / 4
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-600">Fine Details</span>
                            <span className="font-mono font-bold text-slate-900">
                              {sub.final_stage_breakdown.fine_details_score ?? sub.final_stage_breakdown.details_score ?? 0} / 2
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 py-6 text-center">
                          Official final evaluation not completed yet.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Section 7: Gemini Chat Link (Section 9) */}
                  <div className="rounded-2xl border border-[#D8EBDD] bg-white p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-brand-600" />
                        Google Gemini Chat Verification
                      </h3>
                      {sub.gemini_chat_link ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          Verified Link Provided
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                          Not Provided
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500">
                      Private conversation link recorded during participant final submission. Hidden from public participants.
                    </p>

                    {sub.gemini_chat_link ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                        <span className="font-mono text-xs text-slate-800 truncate max-w-lg select-all">
                          {sub.gemini_chat_link}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="xs"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => copyToClipboard(sub.gemini_chat_link!, 'gemini_link')}
                          >
                            {copiedKey === 'gemini_link' ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" /> Copied ✓
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" /> Copy Link
                              </>
                            )}
                          </Button>
                          <a
                            href={sub.gemini_chat_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
                          >
                            Open Gemini Chat <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No Gemini chat link was attached to this submission.
                      </p>
                    )}
                  </div>

                  {/* Section 8: Submission Timeline (Section 10) */}
                  <div className="rounded-2xl border border-[#D8EBDD] bg-white p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-brand-600" />
                      Submission Lifecycle Timeline
                    </h3>

                    <div className="space-y-3 pl-2 border-l-2 border-emerald-200">
                      {/* 1. Challenge Started */}
                      <div className="relative pl-4">
                        <div className="absolute -left-[17px] top-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-300" />
                        <p className="text-xs font-bold text-slate-800">Challenge Started</p>
                        <p className="text-[11px] text-slate-400">
                          {sub.started_at ? new Date(sub.started_at).toLocaleString() : 'Timestamp unavailable'}
                        </p>
                      </div>

                      {/* 2. Prompt 1 Submitted */}
                      <div className="relative pl-4">
                        <div
                          className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ${
                            sub.prompt_1 ? 'bg-emerald-500 ring-emerald-300' : 'bg-slate-300 ring-slate-200'
                          }`}
                        />
                        <p className="text-xs font-bold text-slate-800">Prompt 1 Submitted</p>
                        <p className="text-[11px] text-slate-400">
                          {sub.prompt_1_submitted_at
                            ? new Date(sub.prompt_1_submitted_at).toLocaleString()
                            : sub.prompt_1
                            ? 'Submitted'
                            : 'Pending'}
                        </p>
                      </div>

                      {/* 3. First Image Uploaded */}
                      <div className="relative pl-4">
                        <div
                          className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ${
                            sub.first_image_url ? 'bg-emerald-500 ring-emerald-300' : 'bg-slate-300 ring-slate-200'
                          }`}
                        />
                        <p className="text-xs font-bold text-slate-800">First Image Uploaded</p>
                        <p className="text-[11px] text-slate-400">
                          {sub.first_image_uploaded_at
                            ? new Date(sub.first_image_uploaded_at).toLocaleString()
                            : sub.first_image_url
                            ? 'Uploaded'
                            : 'Pending'}
                        </p>
                      </div>

                      {/* 4. First Image Evaluated */}
                      <div className="relative pl-4">
                        <div
                          className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ${
                            firstScore !== null && firstScore !== undefined
                              ? 'bg-emerald-500 ring-emerald-300'
                              : 'bg-slate-300 ring-slate-200'
                          }`}
                        />
                        <p className="text-xs font-bold text-slate-800">
                          First Image Evaluated{' '}
                          {firstScore !== null && firstScore !== undefined && `(${firstScore} / 80)`}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {firstScore !== null && firstScore !== undefined
                            ? 'Stage 1 Practice scoring complete'
                            : 'Pending'}
                        </p>
                      </div>

                      {/* 5. Prompt 2 Submitted */}
                      <div className="relative pl-4">
                        <div
                          className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ${
                            sub.prompt_2 ? 'bg-emerald-500 ring-emerald-300' : 'bg-slate-300 ring-slate-200'
                          }`}
                        />
                        <p className="text-xs font-bold text-slate-800">Prompt 2 Submitted</p>
                        <p className="text-[11px] text-slate-400">
                          {sub.prompt_2_submitted_at
                            ? new Date(sub.prompt_2_submitted_at).toLocaleString()
                            : sub.prompt_2
                            ? 'Submitted'
                            : 'Pending'}
                        </p>
                      </div>

                      {/* 6. Final Image Uploaded */}
                      <div className="relative pl-4">
                        <div
                          className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ${
                            sub.final_image_url ? 'bg-emerald-500 ring-emerald-300' : 'bg-slate-300 ring-slate-200'
                          }`}
                        />
                        <p className="text-xs font-bold text-slate-800">Final Image Uploaded</p>
                        <p className="text-[11px] text-slate-400">
                          {sub.final_image_uploaded_at
                            ? new Date(sub.final_image_uploaded_at).toLocaleString()
                            : sub.final_image_url
                            ? 'Uploaded'
                            : 'Pending'}
                        </p>
                      </div>

                      {/* 7. Gemini Chat Link Added */}
                      <div className="relative pl-4">
                        <div
                          className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ${
                            sub.gemini_chat_link ? 'bg-emerald-500 ring-emerald-300' : 'bg-slate-300 ring-slate-200'
                          }`}
                        />
                        <p className="text-xs font-bold text-slate-800">Gemini Chat Link Attached</p>
                        <p className="text-[11px] text-slate-400">
                          {sub.gemini_chat_link ? 'Verified HTTPS URL provided' : 'Not provided'}
                        </p>
                      </div>

                      {/* 8. Final Submission */}
                      <div className="relative pl-4">
                        <div
                          className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ${
                            sub.submitted_at ? 'bg-emerald-500 ring-emerald-300' : 'bg-slate-300 ring-slate-200'
                          }`}
                        />
                        <p className="text-xs font-bold text-slate-800">Final Submission Completed</p>
                        <p className="text-[11px] text-slate-400">
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'In Progress'}
                        </p>
                      </div>

                      {/* 9. Final Official Score */}
                      <div className="relative pl-4">
                        <div
                          className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ${
                            finalScore !== null && finalScore !== undefined
                              ? 'bg-emerald-600 ring-emerald-400'
                              : 'bg-slate-300 ring-slate-200'
                          }`}
                        />
                        <p className="text-xs font-bold text-emerald-800">
                          Official Competition Score: {finalScore ?? 'Pending'} / 80
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Authoritative score recorded on competition leaderboard
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#D8EBDD] bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Confidential administrative records · Prompt Arena</span>
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Lightbox Modal (Section 17) */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none"
          onClick={() => {
            setLightboxUrl(null);
            setLightboxZoom(false);
          }}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full pb-3 text-white">
              <span className="text-sm font-semibold">{lightboxTitle}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLightboxZoom((prev) => !prev)}
                  className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                  title="Toggle Zoom"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setLightboxUrl(null);
                    setLightboxZoom(false);
                  }}
                  className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                  title="Close Lightbox"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              className={`overflow-auto max-h-[82vh] rounded-2xl border border-white/20 bg-black ${
                lightboxZoom ? 'cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              onClick={() => setLightboxZoom((prev) => !prev)}
            >
              <img
                src={lightboxUrl}
                alt={lightboxTitle}
                className={`transition-all duration-200 object-contain rounded-xl ${
                  lightboxZoom ? 'scale-150 max-h-none w-auto' : 'max-h-[80vh] w-auto'
                }`}
              />
            </div>
            <p className="pt-2 text-[11px] text-zinc-400">
              Click image to toggle zoom · Press Esc or click outside to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
