/**
 * connection.ts — the contract every device connection must follow.
 *
 * WHY THIS FILE EXISTS
 * Ruth should never care HOW a device is connected. A real USB serial port,
 * the fake test device, and (someday) a Wi-Fi link all look the same to the
 * rest of Ruth, because they all fit this interface.
 *
 * Analogy: a wall outlet. A lamp, a phone charger and a fan all plug into the
 * same outlet shape. The outlet doesn't care what's plugged in, and the lamp
 * doesn't care where the power comes from. This interface is the outlet shape.
 *
 * Notice what's NOT here: no COM port, no baud rate, no USB. Those are details
 * of ONE kind of connection, so they live in that connection's own file.
 */

/** Called with one complete line of text, without its newline. */
export type LineHandler = (line: string) => void;

/** Called once when the connection closes, with a short reason for the log. */
export type CloseHandler = (reason: string) => void;

/** Called when an incoming line was longer than the allowed maximum and was thrown away. */
export type OverflowHandler = () => void;

export interface Connection {
  /** A readable name for logs, e.g. "fake:cyd" or "serial:COM5". */
  readonly name: string;

  /** Is the connection currently open? */
  readonly isOpen: boolean;

  /** Send one line. The connection adds the newline, so callers never do. */
  send(line: string): void;

  /** Register a function to run for every complete incoming line. */
  onLine(handler: LineHandler): void;

  /** Register a function to run when an incoming line was too long and was dropped. */
  onOverflow(handler: OverflowHandler): void;

  /** Register a function to run once when the connection closes (on purpose or not). */
  onClose(handler: CloseHandler): void;

  /** Close the connection on purpose. */
  close(): void;
}