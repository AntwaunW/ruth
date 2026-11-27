/**
 * stream-connection.ts — a Connection built on top of ANY Node.js duplex stream.
 *
 * WHAT'S A DUPLEX STREAM?
 * A stream is Node's way of moving data a bit at a time. A "duplex" stream goes
 * both directions: you can read from it AND write to it, like a phone call
 * rather than a radio broadcast.
 *
 * WHY THIS MATTERS FOR RUTH
 * The `serialport` package's SerialPort IS a duplex stream. The fake device
 * (step 0.12) will also be a duplex stream. So this one class works for both:
 *
 *   new StreamConnection("serial:COM5", new SerialPort({...}))   // Milestone 1
 *   new StreamConnection("fake:cyd",    fakeDeviceStream)        // step 0.12
 *
 * The real port and the fake fit the same "outlet" (the Connection interface).
 */

import type { Duplex } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import type {
  CloseHandler,
  Connection,
  LineHandler,
  OverflowHandler,
} from "./connection.js";
import { LineSplitter } from "./line-splitter.js";

export class StreamConnection implements Connection {
  private readonly lineHandlers: LineHandler[] = [];
  private readonly overflowHandlers: OverflowHandler[] = [];
  private readonly closeHandlers: CloseHandler[] = [];
  private open = true;

  /**
   * Turns raw bytes into text safely. If a multi-byte character (like "é")
   * gets split across two chunks, the decoder waits for the rest of it
   * instead of producing garbage. Plain .toString() would break it.
   */
  private readonly decoder = new StringDecoder("utf8");

  private readonly splitter = new LineSplitter(
    (line) => this.lineHandlers.forEach((handler) => handler(line)),
    () => this.overflowHandlers.forEach((handler) => handler()),
  );

  constructor(
    public readonly name: string,
    private readonly stream: Duplex,
  ) {
    // Bytes arrive → decode to text → splitter turns text into whole lines.
    stream.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : this.decoder.write(chunk);
      this.splitter.feed(text);
    });

    // Any of these means the connection is over. finish() makes sure the
    // close handlers run only ONCE, even if several of these fire.
    stream.on("close", () => this.finish("stream closed"));
    stream.on("end", () => this.finish("stream ended"));
    stream.on("error", (err: Error) => this.finish(`error: ${err.message}`));
  }

  get isOpen(): boolean {
    return this.open;
  }

  send(line: string): void {
    if (!this.open) {
      throw new Error(`${this.name}: cannot send, connection is closed`);
    }
    // A newline inside the message would split it into two lines on the
    // other side and break the protocol, so refuse it outright.
    if (line.includes("\n")) {
      throw new Error(`${this.name}: a line must not contain a newline`);
    }
    this.stream.write(line + "\n");
  }

  onLine(handler: LineHandler): void {
    this.lineHandlers.push(handler);
  }

  onOverflow(handler: OverflowHandler): void {
    this.overflowHandlers.push(handler);
  }

  onClose(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  close(): void {
    this.stream.destroy();
    this.finish("closed by Ruth");
  }

  private finish(reason: string): void {
    if (!this.open) return; // already closed; don't announce it twice
    this.open = false;
    this.splitter.reset();
    this.closeHandlers.forEach((handler) => handler(reason));
  }
}