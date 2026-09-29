import assert from "node:assert/strict";
import { test } from "node:test";
import { compactCount, parseLocalDateTime, plainPreview, plural, timeAgo } from "./format.ts";

const now = Date.parse("2026-09-28T12:00:00Z");
test("timeAgo picks a readable unit", () => {
  assert.equal(timeAgo("2026-09-28T11:59:40Z", now), "just now");
  assert.equal(timeAgo("2026-09-28T11:55:00Z", now), "5m");
  assert.equal(timeAgo("2026-09-28T09:00:00Z", now), "3h");
  assert.equal(timeAgo("2026-09-26T12:00:00Z", now), "2d");
  assert.equal(timeAgo(null, now), "");
  assert.equal(timeAgo("not a date", now), "");
});
test("compactCount abbreviates", () => {
  assert.equal(compactCount(999), "999");
  assert.equal(compactCount(1200), "1.2k");
  assert.equal(compactCount(12_000), "12k");
  assert.equal(compactCount(2_500_000), "2.5m");
});
test("plural handles one and many", () => {
  assert.equal(plural(1, "member"), "1 member");
  assert.equal(plural(3, "member"), "3 members");
});

test("parseLocalDateTime accepts real dates only", () => {
  const parsed = parseLocalDateTime("2026-10-31 19:30");
  assert.ok(parsed && !Number.isNaN(Date.parse(parsed)));
  assert.equal(new Date(parsed!).getHours(), 19);
  assert.equal(parseLocalDateTime("2026-02-31 10:00"), null);
  assert.equal(parseLocalDateTime("31/10/2026"), null);
  assert.equal(parseLocalDateTime("2026-10-31 25:00"), null);
});

test("plainPreview removes markdown marks but keeps the words", () => {
  assert.equal(plainPreview("## Say hello!\nMeet **everyone** and read [the rules](https://x.test)\n- be kind"), "Say hello! Meet everyone and read the rules be kind");
});
