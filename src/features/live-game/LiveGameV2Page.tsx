"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveGameJoinOnly } from "@/contexts/LiveGameJoinOnlyContext";
import { useI18n } from "@/i18n/I18nProvider";
import { translateApiError } from "@/i18n/translate";
import { apiFetch, parseApiError } from "@/lib/apiUrl";
import { isGuestLiveHostname } from "@/lib/liveGameHost";
import { getGuestLiveGameBaseUrl, getPublicAppUrlForUi } from "@/lib/publicUrls";
import {
  advanceLiveSession,
  createLiveSession,
  finishLiveSession,
  getLiveSession,
  joinLiveSession,
  leaveLiveSession,
  LiveGameApiError,
  startLiveSession,
  submitLiveAnswer,
} from "./api";
import CreateLiveGameDialog, {
  type LiveGameSetOption,
} from "./components/CreateLiveGameDialog";
import type { SelectableLiveGameModeId } from "./gameModes";
import LiveHub from "./components/LiveHub";
import LiveSessionView, {
  type LiveAction,
  type LiveConnectionState,
} from "./components/LiveSessionView";
import type { LiveGameSessionSnapshot } from "./contracts";
import {
  clearLiveGameToken,
  markLiveGameResultsSaved,
  readLiveGameMeta,
  readLiveGameToken,
  saveLiveGameMeta,
  saveLiveGameToken,
  type LiveGameClientRole,
} from "./sessionStorage";
import { normalizeRoomCode } from "./utils";

const NICKNAME_STORAGE_KEY = "duocards_live_v2_nickname";
const POLL_INTERVAL_MS = 1_250;

interface ActiveLiveSession {
  id: string;
  role: LiveGameClientRole;
  token: string;
}

function isClientRole(value: string | null): value is LiveGameClientRole {
  return value === "host" || value === "player";
}

function LiveGameV2Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const joinOnly = useLiveGameJoinOnly();
  const { locale, t } = useI18n();
  const initializedRef = useRef(false);

  const [initialized, setInitialized] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [sets, setSets] = useState<LiveGameSetOption[]>([]);
  const [selectedSetIds, setSelectedSetIds] = useState<number[]>([]);
  const [selectedModeId, setSelectedModeId] = useState<SelectableLiveGameModeId>("classic_arena");
  const [questionCount, setQuestionCount] = useState(10);
  const [questionTimeSeconds, setQuestionTimeSeconds] = useState(20);
  const [loadingSets, setLoadingSets] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveLiveSession | null>(null);
  const [snapshot, setSnapshot] = useState<LiveGameSessionSnapshot | null>(null);
  const [connection, setConnection] = useState<LiveConnectionState>("reconnecting");
  const [action, setAction] = useState<LiveAction>(null);
  const [copied, setCopied] = useState(false);
  const [resultsSaved, setResultsSaved] = useState<"saving" | "saved" | "error" | null>(null);

  const acceptSnapshot = useCallback((next: LiveGameSessionSnapshot) => {
    setSnapshot((current) => {
      if (!current || current.id !== next.id || next.sequence >= current.sequence) {
        return next;
      }
      return current;
    });
  }, []);

  const localizedError = useCallback((error: unknown) => {
    if (error instanceof LiveGameApiError) {
      return translateApiError(locale, error.code, error.message);
    }
    return t("liveGameV2.requestFailed");
  }, [locale, t]);

  const hubPath = useCallback(() => {
    if (!joinOnly) return "/live-game";
    if (typeof window !== "undefined" && isGuestLiveHostname(window.location.hostname)) {
      return "/";
    }
    return "/live";
  }, [joinOnly]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const roomFromUrl = normalizeRoomCode(searchParams.get("room") ?? "");
    const sessionId = searchParams.get("session");
    const role = searchParams.get("role");
    setRoomCode(roomFromUrl);

    try {
      setNickname(sessionStorage.getItem(NICKNAME_STORAGE_KEY) ?? "");
    } catch {
      // A nickname is optional until the player submits the join form.
    }

    if (sessionId && isClientRole(role)) {
      const token = readLiveGameToken(sessionId, role);
      if (token) {
        setActive({ id: sessionId, role, token });
        setConnection("reconnecting");
      } else {
        setPageError(t("liveGameV2.sessionMissing"));
      }
    }
    setInitialized(true);
  }, [searchParams, t]);

  const enterSession = useCallback((
    session: LiveGameSessionSnapshot,
    role: LiveGameClientRole,
    token: string,
  ) => {
    saveLiveGameToken(session.id, role, token);
    setActive({ id: session.id, role, token });
    setSnapshot(session);
    setConnection("connected");
    setConnectionError(null);
    setPageError(null);
    router.replace(`${hubPath()}?session=${encodeURIComponent(session.id)}&role=${role}`, { scroll: false });
  }, [hubPath, router]);

  const sessionFinished = snapshot?.status === "FINISHED";

  // The host stores the finished game into history exactly once per tab.
  useEffect(() => {
    if (!sessionFinished || !snapshot || active?.role !== "host") return;
    if (snapshot.participants.length === 0) return;
    if (!markLiveGameResultsSaved(snapshot.id)) return;

    const meta = readLiveGameMeta(snapshot.id);
    setResultsSaved("saving");
    void fetch("/api/live-game/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomCode: snapshot.roomCode,
        modeId: snapshot.modeId,
        setName: meta.setName ?? undefined,
        startedAt: meta.startedAt ?? undefined,
        players: snapshot.participants.map((participant) => ({
          name: participant.nickname,
          score: participant.score,
          correct: participant.correct,
          total: participant.total,
        })),
      }),
    })
      .then((response) => setResultsSaved(response.ok ? "saved" : "error"))
      .catch(() => setResultsSaved("error"));
  }, [active?.role, sessionFinished, snapshot]);


  useEffect(() => {
    if (!active || sessionFinished) return;

    let stopped = false;
    let running = false;
    let controller: AbortController | null = null;

    const poll = async () => {
      if (running || stopped) return;
      running = true;
      controller = new AbortController();
      try {
        const response = await getLiveSession(active.id, active.token, controller.signal);
        if (stopped) return;
        acceptSnapshot(response.session);
        setConnection("connected");
        setConnectionError(null);
      } catch (error) {
        if (stopped || controller.signal.aborted) return;
        if (
          error instanceof LiveGameApiError &&
          (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 410)
        ) {
          // The session no longer exists (expired or ended elsewhere).
          stopped = true;
          clearLiveGameToken(active.id, active.role);
          setActive(null);
          setSnapshot(null);
          setConnectionError(null);
          setPageError(t("liveGameV2.sessionGone"));
          router.replace(hubPath(), { scroll: false });
          return;
        }
        setConnection((current) => current === "connected" ? "reconnecting" : "offline");
        setConnectionError(localizedError(error));
      } finally {
        running = false;
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, [acceptSnapshot, active, hubPath, localizedError, router, sessionFinished, t]);

  const loadSets = useCallback(async () => {
    setLoadingSets(true);
    setCreateError(null);
    try {
      const response = await apiFetch("/flashcard-sets");
      const payload = await response.json().catch(() => null) as {
        flashcardSets?: LiveGameSetOption[];
      } | null;
      if (!response.ok) {
        const parsed = parseApiError(payload, t("liveGame.loadSetsFailed"));
        throw new LiveGameApiError(response.status, parsed.code, parsed.message);
      }
      const availableSets = (payload?.flashcardSets ?? []).filter(
        (set) => Array.isArray(set.words) && set.words.length > 0,
      );
      setSets(availableSets);
      setSelectedSetIds((current) => current.filter((id) =>
        availableSets.some((set) => set.id === id),
      ));
    } catch (error) {
      setSets([]);
      setCreateError(localizedError(error));
    } finally {
      setLoadingSets(false);
    }
  }, [localizedError, t]);

  const openCreate = useCallback(() => {
    setCreateOpen(true);
    void loadSets();
  }, [loadSets]);

  const handleCreate = useCallback(async () => {
    if (selectedSetIds.length === 0) {
      setCreateError(t("liveGameV2.selectSet"));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const response = await createLiveSession({
        modeId: selectedModeId,
        flashcardSetIds: selectedSetIds,
        questionCount,
        questionTimeSeconds,
      });
      setCreateOpen(false);
      const setName = sets
        .filter((set) => selectedSetIds.includes(set.id))
        .map((set) => set.name)
        .join(", ")
        .slice(0, 200);
      saveLiveGameMeta(response.session.id, {
        setName: setName || null,
        startedAt: null,
      });
      enterSession(response.session, "host", response.hostToken);
    } catch (error) {
      setCreateError(localizedError(error));
    } finally {
      setCreating(false);
    }
  }, [enterSession, localizedError, questionCount, questionTimeSeconds, selectedModeId, selectedSetIds, sets, t]);

  const handleJoin = useCallback(async () => {
    const normalizedCode = normalizeRoomCode(roomCode);
    const trimmedNickname = nickname.trim();
    if (normalizedCode.length < 4 || !trimmedNickname) return;

    setJoining(true);
    setPageError(null);
    try {
      const response = await joinLiveSession({
        roomCode: normalizedCode,
        nickname: trimmedNickname,
      });
      try {
        sessionStorage.setItem(NICKNAME_STORAGE_KEY, trimmedNickname);
      } catch {
        // Joining still succeeds when storage is unavailable.
      }
      enterSession(response.session, "player", response.playerToken);
    } catch (error) {
      setPageError(localizedError(error));
    } finally {
      setJoining(false);
    }
  }, [enterSession, localizedError, nickname, roomCode]);

  const runSessionAction = useCallback(async (
    nextAction: Exclude<LiveAction, "answer" | null>,
    request: (sessionId: string, token: string) => Promise<{ session: LiveGameSessionSnapshot }>,
  ) => {
    if (!active || action !== null) return;
    setAction(nextAction);
    setPageError(null);
    try {
      const response = await request(active.id, active.token);
      acceptSnapshot(response.session);
      setConnection("connected");
      setConnectionError(null);
    } catch (error) {
      setPageError(localizedError(error));
    } finally {
      setAction(null);
    }
  }, [acceptSnapshot, action, active, localizedError]);

  const handleStart = useCallback(() => {
    if (active) {
      saveLiveGameMeta(active.id, {
        ...readLiveGameMeta(active.id),
        startedAt: new Date().toISOString(),
      });
    }
    void runSessionAction("start", startLiveSession);
  }, [active, runSessionAction]);

  const handleAnswer = useCallback(async (answer: string) => {
    if (!active || !snapshot?.currentQuestion || action !== null) return;
    setAction("answer");
    setPageError(null);
    try {
      const response = await submitLiveAnswer(active.id, active.token, {
        roundId: snapshot.currentQuestion.id,
        answer,
        idempotencyKey: crypto.randomUUID(),
      });
      acceptSnapshot(response.session);
      setConnection("connected");
      setConnectionError(null);
    } catch (error) {
      setPageError(localizedError(error));
    } finally {
      setAction(null);
    }
  }, [acceptSnapshot, action, active, localizedError, snapshot?.currentQuestion]);

  const handleLeave = useCallback(async () => {
    if (
      active?.role === "host" &&
      snapshot?.status !== "FINISHED"
    ) {
      // Potvrzení řeší vlastní dialog v LiveSessionView (requestLeave).
      setAction("finish");
      setPageError(null);
      try {
        await finishLiveSession(active.id, active.token);
      } catch (error) {
        setPageError(localizedError(error));
        setAction(null);
        return;
      }
    }
    if (active?.role === "player") {
      void leaveLiveSession(active.id, active.token).catch(() => {
        // Leaving the UI must stay instant even if presence cleanup is delayed.
      });
    }
    if (active) clearLiveGameToken(active.id, active.role);
    setActive(null);
    setSnapshot(null);
    setAction(null);
    setConnectionError(null);
    setPageError(null);
    router.replace(hubPath(), { scroll: false });
  }, [active, hubPath, localizedError, router, snapshot?.status]);

  const inviteUrl = useMemo(() => {
    if (!snapshot || typeof window === "undefined") return null;
    const guestBase = getGuestLiveGameBaseUrl();
    const localPath = isGuestLiveHostname(window.location.hostname) ? "/" : "/live";
    return guestBase
      ? `${guestBase}/?room=${encodeURIComponent(snapshot.roomCode)}`
      : `${window.location.origin}${localPath}?room=${encodeURIComponent(snapshot.roomCode)}`;
  }, [snapshot]);

  const handleCopyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setPageError(t("liveGameV2.copyFailed"));
    }
  }, [inviteUrl, t]);

  const visibleError = pageError ?? connectionError;

  if (!initialized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <p className="animate-pulse text-sm font-bold text-slate-300">{t("liveGameV2.reconnecting")}</p>
      </main>
    );
  }

  if (active && snapshot) {
    return (
      <LiveSessionView
        session={snapshot}
        role={active.role}
        connection={connection}
        action={action}
        copied={copied}
        error={visibleError}
        inviteUrl={inviteUrl}
        resultsSaved={resultsSaved}
        onCopyInvite={handleCopyInvite}
        onStart={handleStart}
        onAdvance={() => void runSessionAction("advance", advanceLiveSession)}
        onAnswer={(answer) => void handleAnswer(answer)}
        onFinish={() => void runSessionAction("finish", finishLiveSession)}
        onLeave={() => void handleLeave()}
      />
    );
  }

  if (active) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-950 px-4 text-center text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-400/25 border-t-blue-300" aria-hidden="true" />
        <p className="font-bold text-slate-200">{t("liveGameV2.reconnecting")}</p>
        {visibleError && <p role="alert" className="max-w-lg text-sm text-red-200">{visibleError}</p>}
        <button type="button" onClick={() => void handleLeave()} className="cursor-pointer rounded-xl border border-white/15 px-4 py-2 text-sm font-bold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          {t("liveGameV2.backToHub")}
        </button>
      </main>
    );
  }

  return (
    <>
      <LiveHub
        joinOnly={joinOnly}
        mainAppUrl={getPublicAppUrlForUi() || null}
        roomCode={roomCode}
        nickname={nickname}
        joining={joining}
        error={pageError}
        onRoomCodeChange={(value) => setRoomCode(normalizeRoomCode(value))}
        onNicknameChange={setNickname}
        onJoin={() => void handleJoin()}
        onCreate={openCreate}
      />
      {!joinOnly && (
        <CreateLiveGameDialog
          open={createOpen}
          sets={sets}
          selectedSetIds={selectedSetIds}
          modeId={selectedModeId}
          questionCount={questionCount}
          questionTimeSeconds={questionTimeSeconds}
          loadingSets={loadingSets}
          creating={creating}
          error={createError}
          onToggleSet={(id) => setSelectedSetIds((current) =>
            current.includes(id) ? current.filter((setId) => setId !== id) : [...current, id],
          )}
          onModeChange={setSelectedModeId}
          onQuestionCountChange={setQuestionCount}
          onQuestionTimeChange={setQuestionTimeSeconds}
          onClose={() => setCreateOpen(false)}
          onCreate={() => void handleCreate()}
        />
      )}
    </>
  );
}

export default function LiveGameV2Page() {
  return (
    <Suspense fallback={null}>
      <LiveGameV2Content />
    </Suspense>
  );
}
