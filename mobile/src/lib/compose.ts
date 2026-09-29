import type { DraftContent } from "@/api/models";
import type { PostPayload, PostType } from "@/api/types";

export const blankQuestion = (): DraftContent["questions"][number] => ({ q: "", choices: ["", "", "", ""], answer: 0 });

/** Quiz time limits the server accepts, in seconds. */
export const MIN_TIME_LIMIT = 10;
export const MAX_TIME_LIMIT = 3600;

export function emptyContent(type: PostType = "blog"): DraftContent {
  return {
    type,
    title: "",
    body: "",
    url: "",
    warning: "",
    opts: ["", "", "", "", ""],
    image: "",
    album: [],
    commentsOff: false,
    announce: false,
    questions: [blankQuestion()],
  };
}

/** Returns a plain-English problem with the post, or null when it is ready to publish. */
export function validateContent(c: DraftContent): string | null {
  if (c.title.trim().length < 3) return "Give your post a title (at least 3 characters).";
  if (c.type === "link" && !/^https?:\/\//i.test(c.url.trim())) return "Add a link that starts with http:// or https://.";
  if ((c.type === "image" || c.type === "story") && !c.image) return "Choose a picture first.";
  if (c.type === "poll" && c.opts.filter((o) => o.trim()).length < 2) return "A poll needs at least two options.";
  if (c.type === "quiz") {
    for (const [i, q] of c.questions.entries()) {
      const filled = q.choices.filter((x) => x.trim());
      if (!q.q.trim()) return `Question ${i + 1} needs some text.`;
      if (filled.length < 2) return `Question ${i + 1} needs at least two answers.`;
      if (!q.choices[q.answer]?.trim()) return `Pick a correct answer for question ${i + 1}.`;
    }
    const limit = c.timeLimitSec;
    if (limit !== undefined && limit !== 0 && (!Number.isInteger(limit) || limit < MIN_TIME_LIMIT || limit > MAX_TIME_LIMIT))
      return `Choose a time limit between ${MIN_TIME_LIMIT} and ${MAX_TIME_LIMIT} seconds, or leave it empty.`;
  }
  return null;
}

/** Turns what was typed into the exact payload the server expects. */
export function buildPayload(c: DraftContent, category: string): PostPayload {
  const payload: PostPayload = { format: "markdown" };
  if (c.type === "link") payload.url = c.url.trim();
  if (c.type === "poll") payload.options = c.opts.map((o) => o.trim()).filter(Boolean);
  if (c.type === "wiki" && category) payload.category = category;
  if (c.type === "quiz") {
    payload.questions = c.questions.map((q) => {
      // Blank answers are dropped, so the "correct" index has to be recalculated.
      const kept = q.choices.map((choice, index) => ({ choice: choice.trim(), index })).filter((x) => x.choice);
      return { q: q.q.trim(), choices: kept.map((x) => x.choice), answer: Math.max(0, kept.findIndex((x) => x.index === q.answer)) };
    });
  }
  if (c.type === "quiz" && c.timeLimitSec) payload.timeLimitSec = c.timeLimitSec;
  if (c.type === "story") {
    // One caption per scene (the cover, then each extra picture). Nothing is sent when no scene has a caption.
    const scenes = 1 + (c.album?.length ?? 0);
    const captions = Array.from({ length: scenes }, (_, n) => (c.captions?.[n] ?? "").trim());
    if (captions.some(Boolean)) payload.captions = captions;
  }
  return payload;
}

/** The extra pictures to send: albums for image posts, scenes for stories. */
export function albumFor(c: DraftContent): string[] | undefined {
  return (c.type === "image" || c.type === "story") && c.album?.length ? c.album : undefined;
}

/** One picture per quiz question ("" for none), or undefined when no question has one. */
export function questionImagesFor(c: DraftContent): string[] | undefined {
  return c.type === "quiz" && c.questions.some((q) => q.image) ? c.questions.map((q) => q.image ?? "") : undefined;
}
