import assert from "node:assert/strict";
import { test } from "node:test";
import { albumFor, blankQuestion, buildPayload, emptyContent, questionImagesFor, validateContent } from "./compose.ts";

test("a post needs a real title", () => {
  assert.match(validateContent(emptyContent()) ?? "", /title/);
  assert.equal(validateContent({ ...emptyContent(), title: "Hello" }), null);
});

test("links, pictures and polls are checked", () => {
  const base = { ...emptyContent(), title: "Hello" };
  assert.match(validateContent({ ...base, type: "link", url: "ftp://x" }) ?? "", /link/);
  assert.equal(validateContent({ ...base, type: "link", url: "https://kamino.app" }), null);
  assert.match(validateContent({ ...base, type: "image" }) ?? "", /picture/);
  assert.match(validateContent({ ...base, type: "poll", opts: ["Yes", "", "", "", ""] }) ?? "", /two options/);
  assert.equal(validateContent({ ...base, type: "poll", opts: ["Yes", "No", "", "", ""] }), null);
});

test("quiz answers keep pointing at the right choice after blanks are dropped", () => {
  const content = {
    ...emptyContent("quiz"),
    title: "Quiz time",
    questions: [{ q: "Capital of France?", choices: ["", "Paris", "", "Rome"], answer: 3 }],
  };
  assert.equal(validateContent(content), null);
  assert.deepEqual(buildPayload(content, "").questions, [{ q: "Capital of France?", choices: ["Paris", "Rome"], answer: 1 }]);
});

test("a quiz whose correct answer is blank is refused", () => {
  const content = { ...emptyContent("quiz"), title: "Quiz time", questions: [{ q: "Q?", choices: ["A", "B", "", ""], answer: 2 }] };
  assert.match(validateContent(content) ?? "", /correct answer/);
});

test("payload only carries what the post type needs", () => {
  const wiki = buildPayload({ ...emptyContent("wiki"), title: "Lore" }, "Lore/Places");
  assert.deepEqual(wiki, { format: "markdown", category: "Lore/Places" });
  assert.deepEqual(buildPayload({ ...emptyContent("blog"), title: "Hi" }, "ignored"), { format: "markdown" });
});

test("quiz time limit is optional and must be 10 to 3600 seconds", () => {
  const base = { ...emptyContent("quiz"), title: "Timed", questions: [{ q: "Q?", choices: ["A", "B", "", ""], answer: 0 }] };
  assert.equal(validateContent(base), null);
  assert.equal(validateContent({ ...base, timeLimitSec: 0 }), null);
  assert.equal(validateContent({ ...base, timeLimitSec: 60 }), null);
  assert.match(validateContent({ ...base, timeLimitSec: 5 }) ?? "", /time limit/);
  assert.match(validateContent({ ...base, timeLimitSec: 7200 }) ?? "", /time limit/);
  assert.match(validateContent({ ...base, timeLimitSec: 12.5 }) ?? "", /time limit/);
  assert.equal(buildPayload({ ...base, timeLimitSec: 90 }, "").timeLimitSec, 90);
  assert.equal(buildPayload(base, "").timeLimitSec, undefined);
});

test("quiz pictures travel beside the payload, one entry per question", () => {
  const base = emptyContent("quiz");
  const picture = "data:image/png;base64,AAAA";
  const content = { ...base, questions: [{ ...blankQuestion(), image: picture }, blankQuestion()] };
  assert.deepEqual(questionImagesFor(content), [picture, ""]);
  assert.equal(questionImagesFor(base), undefined);
  assert.equal(JSON.stringify(buildPayload(content, "")).includes("AAAA"), false, "pictures never go inside the payload");
});

test("stories keep one caption per scene and image posts keep their album", () => {
  const story = { ...emptyContent("story"), image: "cover", album: ["b", "c"], captions: ["  One ", "", "Three", "extra"] };
  assert.deepEqual(buildPayload(story, "").captions, ["One", "", "Three"]);
  assert.equal(buildPayload({ ...story, captions: ["", "", ""] }, "").captions, undefined);
  assert.deepEqual(albumFor(story), ["b", "c"]);
  assert.equal(albumFor({ ...story, type: "blog" }), undefined);
  assert.deepEqual(albumFor({ ...story, type: "image" }), ["b", "c"]);
});
