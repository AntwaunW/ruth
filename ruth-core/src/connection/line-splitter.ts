/**
 * line-splitter.ts — turns a stream of text chunks into complete lines.
 *
 * THE PROBLEM IT SOLVES
 * Serial data doesn't arrive one neat line at a time. It arrives in random-sized
 * chunks. One line might come in three pieces, or one chunk might hold two and a
 * half lines:
 *
 *   chunk 1: '@{"v":0,"id":1,"ty'
 *   chunk 2: 'pe":"hb","payload":{}}\n@{"v":0,'
 *   chunk 3: '"id":2,...}\n'
 *
 * Analogy: mail arriving in torn pieces. This class is the person at the desk
 * who tapes the pieces together and only hands over a letter once it's whole
 * (once the newline arrives).
 *
 * WHY IT'S ITS OWN CLASS
 * It has no idea where the text comes from. That makes it easy to test with
 * plain strings, and it's reused by every connection type.
 */

import type { LineHandler, OverflowHandler } from "./connection.js";

/** Protocol limit from docs/protocol.md: 256 bytes per line, newline not counted. */
export const MAX_LINE_BYTES = 256;

export class LineSplitter {
  /** Text received so far that hasn't ended in a newline yet. */
  private partial = "";

  /**
   * True while we're throwing away the rest of a line that got too long.
   * We keep discarding until the next newline, then start fresh.
   */
  private discarding = false;

  constructor(
    private readonly onLine: LineHandler,
    private readonly onOverflow: OverflowHandler,
    private readonly maxBytes: number = MAX_LINE_BYTES,
  ) {}

  /** Feed in the next chunk of text. Calls onLine once for every complete line found. */
  feed(chunk: string): void {
    // Split on "\n". The LAST piece is whatever came after the final newline,
    // which is an unfinished line (or "" if the chunk ended exactly on a newline).
    const pieces = chunk.split("\n");
    const unfinished = pieces.pop() ?? "";

    for (const piece of pieces) {
      // Each piece here ended with a newline, so it completes a line.
      if (this.discarding) {
        // This newline ends the too-long line we were throwing away.
        this.discarding = false;
        this.partial = "";
        continue;
      }

      const line = stripCarriageReturn(this.partial + piece);
      this.partial = "";

      if (byteLength(line) > this.maxBytes) {
        this.onOverflow();
        continue;
      }
      this.onLine(line);
    }

    // Keep the unfinished end for next time, unless we're discarding.
    if (!this.discarding) {
      this.partial += unfinished;
      // If the unfinished line is ALREADY too long, stop collecting it now.
      // Otherwise a device that never sends a newline could make us store
      // text forever and eat memory.
      if (byteLength(this.partial) > this.maxBytes) {
        this.partial = "";
        this.discarding = true;
        this.onOverflow();
      }
    }
  }

  /** Forget any half-received line (used when a connection closes or reconnects). */
  reset(): void {
    this.partial = "";
    this.discarding = false;
  }
}

/** Windows tools sometimes end lines with "\r\n". The spec says accept it and drop the "\r". */
function stripCarriageReturn(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

/**
 * The limit is in BYTES, not characters. Most characters are 1 byte in UTF-8,
 * but symbols like "é" or "→" take 2-3 bytes. Firmware buffers count bytes,
 * so Ruth must count the same way.
 */
function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}