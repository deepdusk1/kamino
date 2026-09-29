import { useCallback, useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUIZ_IMAGE_BASE } from "@/lib/kamino/albums";
import { startQuiz, submitQuiz } from "@/lib/kamino/server";
import type { PostPayload } from "@/lib/kamino/types";

type Question = NonNullable<PostPayload["questions"]>[number];

type Props = {
  postId: number;
  questions: Question[];
  /** 0 means no time limit. */
  timeLimitSec: number;
  /** Set when the quiz was started earlier but not handed in: the server's clock keeps running. */
  quizRun: { startedAt: string; serverNow: string } | null;
  /** Called after the score is saved, so the page can reload the result and the board. */
  onDone: () => void;
};

/** "1:05" for 65 seconds. */
function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Plays a quiz. The time is measured by the server (the "Start" press records the moment), so the
 * countdown here is only a display; what counts is the server's clock.
 */
export function QuizPlayer({ postId, questions, timeLimitSec, quizRun, onDone }: Props) {
  const [phase, setPhase] = useState<"idle" | "playing" | "scoring">("idle");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number; timedOut: boolean } | null>(
    null,
  );
  // How much of the time was already used when this device joined the run, and when we looked.
  const clockRef = useRef<{ usedMs: number; seenAt: number } | null>(null);
  const finishing = useRef(false);

  const finish = useCallback(
    async (given: number[]) => {
      if (finishing.current) return;
      finishing.current = true;
      setPhase("scoring");
      try {
        setResult(await submitQuiz({ data: { postId, answers: given } }));
        onDone();
      } catch (e) {
        finishing.current = false;
        setError(e instanceof Error ? e.message : "Could not save your score.");
        setPhase("idle");
      }
    },
    [postId, onDone],
  );

  // The countdown. When it reaches zero the answers so far are handed in.
  const answersRef = useRef<number[]>([]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    if (phase !== "playing" || timeLimitSec <= 0) return;
    const timer = window.setInterval(() => {
      const c = clockRef.current;
      if (!c) return;
      const left = timeLimitSec * 1000 - c.usedMs - (performance.now() - c.seenAt);
      setRemaining(left);
      if (left <= 0) void finish(answersRef.current);
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase, timeLimitSec, finish]);

  async function begin() {
    setError(null);
    try {
      const run = await startQuiz({ data: { postId } });
      clockRef.current = {
        usedMs: Math.max(0, new Date(run.serverNow).getTime() - new Date(run.startedAt).getTime()),
        seenAt: performance.now(),
      };
      setRemaining(timeLimitSec > 0 ? timeLimitSec * 1000 - clockRef.current.usedMs : null);
      finishing.current = false;
      setStep(0);
      setAnswers([]);
      setPhase("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the quiz.");
    }
  }

  if (result) {
    return (
      <p className="text-sm" role="status">
        {result.timedOut ? (
          <span className="text-warn">
            Time ran out before your answers arrived, so this try scored 0.
          </span>
        ) : (
          <>
            You scored{" "}
            <span className="tabular-nums text-accent">
              {result.score}/{result.total}
            </span>
          </>
        )}
      </p>
    );
  }

  if (phase === "idle") {
    return (
      <div>
        {timeLimitSec > 0 && (
          <p className="mb-2 flex items-center gap-1.5 text-sm text-muted">
            <Timer className="size-4" />
            Timed: {clock(timeLimitSec * 1000)} for the whole quiz. The clock starts when you press
            Start.
          </p>
        )}
        {quizRun && (
          <p className="mb-2 text-sm text-muted">
            You started this quiz earlier. The clock has kept running.
          </p>
        )}
        <Button onClick={() => void begin()}>{quizRun ? "Continue quiz" : "Start quiz"}</Button>
        {error && <p className="mt-2 text-sm text-warn">{error}</p>}
      </div>
    );
  }

  if (phase === "scoring" || step >= questions.length) {
    return <p className="text-sm text-muted">Scoring…</p>;
  }

  const question = questions[step]!;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-subtle">
        <span>
          {step + 1} / {questions.length}
        </span>
        {remaining != null && (
          <span
            className={
              remaining < 10_000 ? "flex items-center gap-1 text-warn" : "flex items-center gap-1"
            }
            aria-label="Time left"
          >
            <Timer className="size-3.5" />
            <span className="tabular-nums">{clock(remaining)}</span>
          </span>
        )}
      </div>
      <p className="mt-2 font-medium">{question.q}</p>
      {question.hasImage && (
        <img
          key={step}
          src={`/api/v1/media/post/${postId}/${QUIZ_IMAGE_BASE + step}`}
          alt={`Picture for question ${step + 1}`}
          className="mt-3 max-h-72 w-full rounded-xl object-contain outline outline-1 -outline-offset-1 outline-fg/10"
        />
      )}
      <div className="mt-3 grid gap-2">
        {question.choices.map((c, i) => (
          <Button
            key={c}
            variant="secondary"
            onClick={() => {
              const next = [...answers, i];
              setAnswers(next);
              if (step + 1 >= questions.length) void finish(next);
              else setStep(step + 1);
            }}
          >
            {c}
          </Button>
        ))}
      </div>
    </div>
  );
}
