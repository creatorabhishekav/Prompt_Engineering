import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface ProtectedTargetImageProps {
  roundId?: string;
  challengeId?: string;
  fallbackUrl?: string | null;
  participantId?: string;
  className?: string;
  onNotice?: (msg: string) => void;
}

/**
 * ProtectedTargetImage provides authenticated retrieval, visible watermarking,
 * and reasonable browser copy-deterrence for the challenge target image.
 */
export const ProtectedTargetImage: React.FC<ProtectedTargetImageProps> = ({
  roundId,
  challengeId,
  fallbackUrl,
  participantId,
  className = '',
  onNotice,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showProtectionNotice = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    if (onNotice) onNotice(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Authenticated fetch of the protected target image blob
  useEffect(() => {
    let isSubscribed = true;
    let createdUrl: string | null = null;

    async function fetchImage() {
      setLoading(true);
      setLoadError(false);

      try {
        const { challengeApi } = await import('@/lib/api');
        let url: string | null = null;

        if (challengeId) {
          try {
            url = await challengeApi.getChallengeTargetImageBlob(challengeId);
          } catch {
            // fallback to round blob if challenge route 404s
            if (roundId) {
              url = await challengeApi.getProtectedTargetImageBlob(roundId);
            }
          }
        } else if (roundId) {
          url = await challengeApi.getProtectedTargetImageBlob(roundId);
        }

        if (isSubscribed && url) {
          createdUrl = url;
          setBlobUrl(url);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('[PROTECTED IMAGE] Authenticated blob fetch failed, checking fallback:', err);
      }

      if (isSubscribed) {
        if (fallbackUrl) {
          const { resolveMediaUrl } = await import('@/lib/api');
          setBlobUrl(resolveMediaUrl(fallbackUrl));
        } else {
          setLoadError(true);
        }
        setLoading(false);
      }
    }

    void fetchImage();

    return () => {
      isSubscribed = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [roundId, challengeId, fallbackUrl]);

  // Deter common copy/print/save keyboard shortcuts when interacting with the challenge view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if event targets an input or textarea (do not block typing in prompt boxes)
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') {
        return;
      }

      // Ctrl/Cmd + S (Save Page/Image)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        showProtectionNotice('Saving the challenge target image is disabled.');
        return;
      }

      // Ctrl/Cmd + P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        showProtectionNotice('Printing the challenge target image is disabled.');
        return;
      }

      // PrintScreen key
      if (e.key === 'PrintScreen') {
        showProtectionNotice('Please do not capture or save the challenge target image.');
        return;
      }

      // Ctrl/Cmd + C when not focused on prompt text
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const selection = window.getSelection()?.toString();
        if (!selection) {
          showProtectionNotice('Target image copying is disabled during the challenge.');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    showProtectionNotice('Target image is protected during the challenge.');
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
    showProtectionNotice('Dragging the target image is disabled.');
  };

  // Safe non-sensitive participant ID display
  const maskedParticipant = participantId
    ? participantId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()
    : 'PARTICIPANT';

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      className={`relative select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-950 ${className}`}
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Toast Alert overlay */}
      {toastMessage && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-amber-300 bg-amber-500/95 px-4 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm transition-all duration-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex aspect-square w-full items-center justify-center bg-slate-900 text-xs font-medium text-slate-400">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span>Loading protected target image...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && (loadError || !blobUrl) && (
        <div className="flex aspect-square w-full items-center justify-center bg-slate-900 p-6 text-center text-xs text-slate-400">
          No target image available for this round.
        </div>
      )}

      {/* Rendered protected image with non-draggable attributes */}
      {!loading && blobUrl && (
        <div className="relative aspect-square w-full">
          <img
            src={blobUrl}
            alt="Protected Challenge Target Visual"
            draggable={false}
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
            className="pointer-events-auto h-full w-full object-cover select-none"
            style={{
              userSelect: 'none',
            }}
          />

          {/* Transparent protection shield layer intercepting casual mouse gestures */}
          <div
            className="absolute inset-0 z-10 cursor-default bg-transparent"
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
          />

          {/* Visible Non-intrusive Event & Participant Watermark Overlay */}
          <div
            className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 select-none"
            style={{ userSelect: 'none' }}
          >
            {/* Top header badge */}
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 rounded-md bg-slate-900/70 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-200 backdrop-blur-md">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                OFFICIAL TARGET
              </span>
              <span className="rounded-md bg-slate-900/70 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-300 backdrop-blur-md">
                ID: {maskedParticipant}
              </span>
            </div>

            {/* Subtle diagonal repeating watermark text across center */}
            <div className="flex flex-col items-center justify-center opacity-25">
              <span className="text-center font-black tracking-widest text-white text-xs uppercase -rotate-12 drop-shadow-md">
                PROMPT ENGINEERING CHALLENGE
              </span>
              <span className="text-[9px] font-mono tracking-wider text-white uppercase -rotate-12 drop-shadow-sm">
                CONFIDENTIAL COMPETITION MATERIAL
              </span>
            </div>

            {/* Bottom protection notice */}
            <div className="flex items-center justify-between text-[9px] text-slate-300">
              <span className="rounded bg-slate-900/60 px-1.5 py-0.5 backdrop-blur-sm">
                Reverse Prompt Engineering
              </span>
              <span className="rounded bg-slate-900/60 px-1.5 py-0.5 font-mono backdrop-blur-sm">
                DO NOT REDISTRIBUTE
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
