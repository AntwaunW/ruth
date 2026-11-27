/**
 * line-splitter.test.ts — automatic checks for the line splitter and router.
 *
 * Run with:  npm test
 *
 * WHY TESTS HERE?
 * Line splitting is the kind of code that looks right and breaks in edge cases
 * (lines split across chunks, "\r\n", too-long lines). These tests feed in
 * tricky input and check the result, so a later change can't quietly break it.
 * Uses node:test, which is built into Node, so there's nothing extra to install.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { LineSplitter } from "./line-splitter.js";
import { routeLine } from "./line-router.js";

/** Helper: makes a splitter that records what it produced. */
function makeSplitter(maxBytes?: number) {
  const lines: string[] = [];
  let overflows = 0;
  const splitter = new LineSplitter(
    (line) => lines.push(line),
    () => overflows++,
    maxBytes,
  );
  return { splitter, lines, overflowCount: () => overflows };
}

test("one whole line in one chunk", () => {
  const { splitter, lines } = makeSplitter();
  splitter.feed("hello\n");
  assert.deepEqual(lines, ["hello"]);
});

test("a line split across several chunks is joined back together", () => {
  const { splitter, lines } = makeSplitter();
  splitter.feed('@{"v":0,"id":1,"ty');
  splitter.feed('pe":"hb","payload":{}}');
  assert.deepEqual(lines, [], "nothing yet: no newline has arrived");
  splitter.feed("\n");
  assert.deepEqual(lines, ['@{"v":0,"id":1,"type":"hb","payload":{}}']);
});

test("several lines in one chunk, with a leftover piece", () => {
  const { splitter, lines } = makeSplitter();
  splitter.feed("one\ntwo\nthr");
  assert.deepEqual(lines, ["one", "two"]);
  splitter.feed("ee\n");
  assert.deepEqual(lines, ["one", "two", "three"]);
});

test("Windows line endings (\\r\\n) are accepted", () => {
  const { splitter, lines } = makeSplitter();
  splitter.feed("abc\r\n");
  assert.deepEqual(lines, ["abc"]);
});

test("a too-long line is dropped and reported, and the next line still works", () => {
  const { splitter, lines, overflowCount } = makeSplitter(10);
  splitter.feed("this line is far too long\nok\n");
  assert.deepEqual(lines, ["ok"]);
  assert.equal(overflowCount(), 1);
});

test("a too-long line with no newline yet is cut off early (no endless memory use)", () => {
  const { splitter, lines, overflowCount } = makeSplitter(10);
  splitter.feed("aaaaaaaaaaaaaaaaaaaa"); // 20 bytes, no newline
  assert.equal(overflowCount(), 1, "reported as soon as it passed the limit");
  splitter.feed("bbbb\nok\n"); // rest of the bad line, then a good one
  assert.deepEqual(lines, ["ok"]);
  assert.equal(overflowCount(), 1, "the same bad line isn't reported twice");
});

test("the limit counts bytes, not characters", () => {
  const { splitter, lines, overflowCount } = makeSplitter(4);
  splitter.feed("éé\n"); // 2 characters but 4 bytes: exactly at the limit
  splitter.feed("ééé\n"); // 3 characters but 6 bytes: over the limit
  assert.deepEqual(lines, ["éé"]);
  assert.equal(overflowCount(), 1);
});

test("router sends @ lines to protocol and other lines to debug", () => {
  const protocol: string[] = [];
  const debug: string[] = [];
  const routes = {
    onProtocol: (json: string) => protocol.push(json),
    onDebug: (line: string) => debug.push(line),
  };
  routeLine('@{"type":"hb"}', routes);
  routeLine("I (312) boot: ESP-IDF", routes);
  routeLine("   ", routes); // blank: ignored
  assert.deepEqual(protocol, ['{"type":"hb"}']);
  assert.deepEqual(debug, ["I (312) boot: ESP-IDF"]);
});