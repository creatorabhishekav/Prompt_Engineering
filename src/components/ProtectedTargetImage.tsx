import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert, ShieldCheck, Maximize2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
 * and copy-deterrence for the challenge target image.
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
  const [zoomOpen, setZoomOpen] = useState<boolean>(false);
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

  // Deter copy/print/save keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        showProtectionNotice('Saving the challenge target image is disabled.');
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        showProtectionNotice('Printing the challenge target image is disabled.');
        return;
      }

      if (e.key === 'PrintScreen') {
        showProtectionNotice('Please do not capture or save the challenge target image.');
        return;
      }

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

  const maskedParticipant = participantId
    ? participantId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()
    : 'PARTICIPANT';

  return (
    <>
      <div
        ref={containerRef}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        className={`group relative select-none overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl ${className}`}
        style={{
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        {/* Toast Alert overlay */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/90 px-4 py-1.5 text-xs font-bold text-black shadow-lg backdrop-blur-md transition-all duration-200">
            <ShieldAlert className="h-4 w-4 shrink-0 text-black" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex aspect-square w-full items-center justify-center bg-slate-950 text-xs font-medium text-slate-400">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <span className="font-mono text-xs text-slate-400">Securing & retrieving target image...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && (loadError || !blobUrl) && (
          <div className="flex aspect-square w-full items-center justify-center bg-slate-950 p-6 text-center text-xs text-slate-400 font-mono">
            Target image stream not active for this round.
          </div>
        )}

        {/* Rendered protected image */}
        {!loading && blobUrl && (
          <div className="relative aspect-square w-full overflow-hidden">
            <img
              src={blobUrl}
              alt="Protected Challenge Target Visual"
              draggable={false}
              onContextMenu={handleContextMenu}
              onDragStart={handleDragStart}
              className="pointer-events-auto h-full w-full object-cover select-none transition-transform duration-300 group-hover:scale-[1.02]"
              style={{ userSelect: 'none' }}
            />

            {/* Transparent protection shield layer */}
            <div
              className="absolute inset-0 z-10 cursor-default bg-transparent"
              onContextMenu={handleContextMenu}
              onDragStart={handleDragStart}
            />

            {/* Visible Event & Participant Watermark Overlay */}
            <div
              className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3.5 select-none"
              style={{ userSelect: 'none' }}
            >
              {/* Top header badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 rounded-lg bg-slate-950/80 px-2.5 py-1 text-[11px] font-mono font-bold tracking-wider text-emerald-300 border border-emerald-500/30 backdrop-blur-md shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  OFFICIAL TARGET
                </span>
                <span className="rounded-lg bg-slate-950/80 px-2 py-1 text-[10px] font-mono font-semibold text-slate-300 border border-white/10 backdrop-blur-md">
                  SLOT: {maskedParticipant}
                </span>
              </div>

              {/* Diagonal watermark */}
              <div className="flex flex-col items-center justify-center opacity-20">
                <span className="text-center font-mono font-black tracking-widest text-white text-xs sm:text-sm uppercase -rotate-12 drop-shadow-md">
                  PROMPT ENGINEERING COMPETITION
                </span>
                <span className="text-[10px] font-mono tracking-wider text-white uppercase -rotate-12 drop-shadow-sm">
                  CONFIDENTIAL TARGET SPECIFICATION
                </span>
              </div>

              {/* Bottom protection notice and zoom trigger */}
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span className="rounded-lg bg-slate-950/70 px-2 py-0.5 border border-white/10 font-mono backdrop-blur-sm">
                  PROTECTED ASSET
                </span>
                <button
                  type="button"
                  onClick={() => setZoomOpen(true)}
                  className="pointer-events-auto flex items-center gap-1 rounded-lg bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-slate-200 border border-white/20 hover:bg-white/10 hover:text-white transition-colors backdrop-blur-md"
                  title="Expand to inspect details"
                >
                  <Maximize2 className="h-3 w-3" />
                  Inspect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Inspection Modal with protection intact */}
      <AnimatePresence>
        {zoomOpen && blobUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => setZoomOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onContextMenu={handleContextMenu}
              className="relative z-10 max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/20 bg-slate-950 shadow-2xl p-2 select-none"
            >
              <div className="relative">
                <img
                  src={blobUrl}
                  alt="Target Inspection"
                  draggable={false}
                  onContextMenu={handleContextMenu}
                  onDragStart={handleDragStart}
                  className="max-h-[82vh] w-auto rounded-2xl object-contain select-none"
                  style={{ userSelect: 'none' }}
                />
                <button
                  onClick={() => setZoomOpen(false)}
                  className="absolute top-3 right-3 rounded-full bg-slate-950/80 p-2 text-white border border-white/20 hover:bg-white/20 transition-colors backdrop-blur-md"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-slate-950/80 px-3 py-1.5 text-xs font-mono text-slate-300 border border-white/10 backdrop-blur-md">
                  Target Inspection Mode · Protected Stream
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
