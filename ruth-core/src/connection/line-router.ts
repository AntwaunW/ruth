/**
 * line-router.ts — sorts each incoming line into "protocol" or "debug".
 *
 * Rule from docs/protocol.md (Framing):
 *   - A line starting with "@" is a protocol message. Hand the JSON part to the protocol code.
 *   - Any other line is debug output from the firmware. Log it and move on.
 *
 * Analogy: a mailroom with two bins. Envelopes with the company stamp ("@") go
 * to the protocol desk; everything else goes in the "FYI" pile.
 *
 * This file only SORTS. It doesn't parse JSON or check fields. That's the
 * protocol layer's job (zod, in Milestone 1). One job per file keeps each one
 * small and easy to test.
 */

export const PROTOCOL_PREFIX = "@";

export interface LineRoutes {
  /** Gets the text AFTER the "@", which should be one JSON object. */
  onProtocol: (json: string) => void;
  /** Gets a whole non-protocol line, for the debug log. */
  onDebug: (line: string) => void;
}

export function routeLine(line: string, routes: LineRoutes): void {
  // Blank lines carry nothing. Firmware often prints them, so just skip them.
  if (line.trim() === "") return;

  if (line.startsWith(PROTOCOL_PREFIX)) {
    routes.onProtocol(line.slice(PROTOCOL_PREFIX.length));
  } else {
    routes.onDebug(line);
  }
}