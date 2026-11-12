import { useCallback, useState, Dispatch, SetStateAction } from 'react';
import { followApi } from '../../lib/api';
import { CommentsSheet } from './CommentsSheet';
import { ReportSheet } from './ReportSheet';
import type { FeedReel } from './ReelViewer';

/**
 * Comments, follow and report for a list of reels (feed, single-reel viewer).
 * Returns handlers for <ReelItem/> and the sheets to render once in the screen.
 */
export function useReelInteractions(reels: FeedReel[], setReels: Dispatch<SetStateAction<FeedReel[]>>) {
  const [commentsId, setCommentsId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportedId, setReportedId] = useState<string | null>(null);

  const onComments = useCallback((r: FeedReel) => setCommentsId(r.id), []);
  const onReport = useCallback((r: FeedReel) => { setReportedId(null); setReportId(r.id); }, []);

  // Follow applies to every post from that store in the list
  const onFollow = useCallback(async (r: FeedReel) => {
    const next = !r.is_following;
    const apply = (on: boolean) => setReels((prev) => prev.map((x) => (x.vendor_id === r.vendor_id
      ? { ...x, is_following: on, vendor_follower_count: Math.max(0, x.vendor_follower_count + (on ? 1 : -1)) }
      : x)));
    apply(next);
    try {
      const { data } = await followApi.toggle(r.vendor_id);
      if (data && typeof data.following === 'boolean' && data.following !== next) apply(data.following);
    } catch {
      apply(!next);
    }
  }, [setReels]);

  const onCountChange = useCallback((id: string, delta: number) => {
    setReels((prev) => prev.map((x) => (x.id === id ? { ...x, comment_count: Math.max(0, x.comment_count + delta) } : x)));
  }, [setReels]);

  const closeReport = () => {
    // A reported post disappears from your feed once you close the sheet
    if (reportedId) setReels((prev) => prev.filter((x) => x.id !== reportedId));
    setReportId(null);
    setReportedId(null);
  };

  const sheets = (
    <>
      <CommentsSheet
        reelId={commentsId}
        visible={!!commentsId}
        onClose={() => setCommentsId(null)}
        count={reels.find((x) => x.id === commentsId)?.comment_count ?? 0}
        onCountChange={onCountChange}
      />
      <ReportSheet
        reelId={reportId}
        visible={!!reportId}
        onClose={closeReport}
        onDone={(id) => setReportedId(id)}
      />
    </>
  );

  return { onComments, onFollow, onReport, sheets, sheetOpen: !!commentsId || !!reportId };
}
