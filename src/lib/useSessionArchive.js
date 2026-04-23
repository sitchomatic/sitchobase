/**
 * Session archive state (#35).
 * Moved off localStorage-only into userMetadata on the session — broadcasting
 * an archived flag via BB session userMetadata so it syncs across browsers.
 * Falls back to localStorage when bbClient.updateSession isn't available.
 *
 * Schema: userMetadata.archived = true | false
 */
import { useCallback, useEffect, useState } from 'react';
import { bbClient } from '@/lib/bbClient';

const LOCAL_KEY = 'bb_archived_sessions';

function readLocal() {
  try { return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')); } catch { return new Set(); }
}
function writeLocal(set) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify([...set]));
}

export function useSessionArchive(sessions = []) {
  const [archived, setArchived] = useState(readLocal);

  // Merge userMetadata.archived from BB sessions into the local set on every refresh
  useEffect(() => {
    if (!Array.isArray(sessions) || !sessions.length) return;
    setArchived((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const s of sessions) {
        if (s?.userMetadata?.archived === true && !next.has(s.id)) {
          next.add(s.id); changed = true;
        }
      }
      if (changed) writeLocal(next);
      return changed ? next : prev;
    });
  }, [sessions]);

  const archive = useCallback(async (ids) => {
    setArchived((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      writeLocal(next);
      return next;
    });
    // Best-effort: persist to BB so other browsers see it.
    await Promise.allSettled(ids.map((id) =>
      bbClient.updateSession(id, { userMetadata: { archived: true } })
    ));
  }, []);

  const unarchive = useCallback(async (ids) => {
    setArchived((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      writeLocal(next);
      return next;
    });
    await Promise.allSettled(ids.map((id) =>
      bbClient.updateSession(id, { userMetadata: { archived: false } })
    ));
  }, []);

  return { archived, archive, unarchive };
}