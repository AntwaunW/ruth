# Ruth — Decision Log

This file records every big decision: **what** was decided, **why**, and **when**.
Each entry is an ADR (Architecture Decision Record). This log is how future-me remembers why things are the way they are, before changing them.

**Rules**
- Add a new entry for every big decision. Number them in order, and never reuse a number.
- Never delete an entry. If a decision changes, add a new entry, and set the old one's status to "Replaced by ADR-XXX".
- Keep each entry short. If it needs more than a screen, it probably belongs in its own doc in `docs/`.

**Status values:** Accepted · Replaced by ADR-XXX · Deprecated (no longer applies)

---

## Template (copy this for new entries)

```markdown
## ADR-XXX: Title
- **Date:** YYYY-MM-DD
- **Status:** Accepted
- **Context:** What problem or question forced a decision?
- **Decision:** What did I choose?
- **Why:** The main reasons.
- **Alternatives considered:** What else I looked at, and why not.
- **Consequences:** What this makes easier, and what it costs me.
```

---

## ADR-001: Start Ruth as a new repo instead of continuing JARVIS Workbench
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** The old JARVIS Workbench had grown without a clear architecture, and Ruth's goals (one hub that every device plugs into) are bigger.
- **Decision:** Start fresh in a new `ruth` repo. Archive JARVIS Workbench, and copy anything useful into `docs/notes-from-jarvis.md`.
- **Why:** It's easier to build the right structure from the start than to untangle the old one. Its hardware (CYD, PN532, optocouplers) is reused.
- **Alternatives considered:** Refactoring JARVIS Workbench in place. I rejected it because I'd be fighting old structure the whole way.
- **Consequences:** I lose the old commit history in the new repo, but the archived repo keeps it.

## ADR-002: Ruth Core is written in Node.js + TypeScript (Node LTS)
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** Ruth Core mostly coordinates: it talks to devices, runs tools and calls cloud AI over the internet.
- **Decision:** Node.js + TypeScript, on the Node LTS (Long-Term Support) version.
- **Why:** I already know JavaScript, so I spend my learning time on C and embedded instead. TypeScript catches mistakes before the code runs. Calling cloud AI works the same in any language.
- **Alternatives considered:** Python. It has strong AI and hardware libraries, but it's a second new language at the same time as C.
- **Consequences:** Python-only libraries (like some local speech tools) would need a separate service later. See ADR-010.

## ADR-003: Ruth Core runs on native Windows, not WSL2
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** Ruth must reach USB devices (COM ports) and control the Windows desktop. WSL2 is a Linux environment running inside Windows.
- **Decision:** Install Node and run Ruth Core directly on Windows 11.
- **Why:** WSL2 can't easily reach COM ports or control Windows apps. Native Windows can do both.
- **Alternatives considered:** WSL2 with USB passthrough. It's more setup and more things that can break.
- **Consequences:** Commands and paths in docs must be Windows/PowerShell style.

## ADR-004: Firmware is C/C++ with ESP-IDF, built in PlatformIO
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** My career goal is embedded/firmware engineering, and HERBIE already uses ESP32 boards.
- **Decision:** Write firmware in C/C++ using ESP-IDF (Espressif's official ESP32 framework), inside PlatformIO in VS Code.
- **Why:** ESP-IDF is what professionals use for ESP32 work. It teaches the real skills: drivers, FreeRTOS tasks and timers. It also matches HERBIE and my C-first study plan.
- **Alternatives considered:** The Arduino framework. It's easier at first, but it hides the parts I want to learn.
- **Consequences:** Slower start, steeper learning curve, and more transferable skills.

## ADR-005: Hub-and-spoke architecture with one adapter per device
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** Ruth must keep growing for years without rewrites as new devices are added.
- **Decision:** Ruth Core is the hub. Each device is a spoke with its own adapter in Ruth, a translator that works like a driver.
- **Why:** A new device means adding new files (firmware, adapter, tools), never changing the core.
- **Alternatives considered:** Devices talking to each other directly. That's harder to debug and puts safety decisions in many places.
- **Consequences:** Everything goes through Ruth, so if Ruth is down, devices fall back to their safe state.

## ADR-006: USB serial first; Wi-Fi/MQTT only when needed
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** Devices need a link to Ruth. MQTT is a messaging system for devices on a network.
- **Decision:** Use USB serial for every device. Add Wi-Fi/MQTT only when a device must be wireless, or once there are 3 or more Wi-Fi devices.
- **Why:** USB serial is the simplest and easiest to debug (I can watch it in a serial monitor), and the cable also powers the board.
- **Alternatives considered:** MQTT from the start. It's an extra server and network problems to debug before anything works.
- **Consequences:** Devices must sit within cable reach of the PC for now.

## ADR-007: Protocol is "@" + JSON lines with a shared envelope, written before firmware
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** Ruth and every device need one shared language.
- **Decision:** One message per line: `@` + JSON with the fields `v`, `id`, `type` and `payload`. The spec lives in `docs/protocol.md` and is written before any firmware.
- **Why:** It's human-readable in a serial monitor, the `@` separates protocol lines from debug output, and writing the spec first means both sides build to the same contract.
- **Alternatives considered:** A binary protocol (smaller and faster, but unreadable while learning). No spec, letting the code define the rules (it drifts quickly).
- **Consequences:** Text is bigger than binary, but at 256 bytes a line and USB speeds that doesn't matter.

## ADR-008: Features are tools (one action each) plus routines that chain tools
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** Ruth will gain many features over the years.
- **Decision:** Each feature is a tool (one file, one action). Routines are plain functions that call several tools in order.
- **Why:** Adding a feature never touches the core. Tools are also exactly what a cloud AI can choose from later (Phase 4).
- **Alternatives considered:** Features built into the core. Every addition would risk breaking everything else.
- **Consequences:** More small files. The `tools/` folder needs clear names.

## ADR-009: Approvals come from hardware: touchscreen for moderate, RFID key card for high
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** Some actions are risky (deleting files, shutting down, moving HERBIE), and later an AI will be suggesting actions.
- **Decision:** Moderate-risk actions need Confirm on the CYD touchscreen. High-risk actions need a tap of my one RFID key card. Approvals only flow from device to Ruth, and each covers one action for about 20 seconds.
- **Why:** An AI can't press a screen or tap a card. One card (not one per project) keeps it simple.
- **Alternatives considered:** Software confirmations (clicking "yes"). A tricked AI or a bad script could fake those.
- **Consequences:** The card proves presence, not identity, because cheap cards can be cloned. That's acceptable at my desk; encrypted cards are a later upgrade.

## ADR-010: Python only later, as a separate service, if a feature needs it
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** Some future features (like local speech recognition) are easier in Python.
- **Decision:** Don't use Python now. If a feature truly needs it, it runs as its own small service that talks to Ruth through a protocol.
- **Why:** Parts that talk through protocols can be written in any language, so adding Python later is cheap.
- **Alternatives considered:** Rewriting Ruth in Python. That's unnecessary, see ADR-002.
- **Consequences:** If it happens, there's one more process to start and monitor.

## ADR-011: Postpone dashboard, local AI, MQTT, on-device voice, encrypted cards, custom PCB
- **Date:** 2026-11-23
- **Status:** Accepted
- **Context:** All of these are interesting, and none are needed for Milestones 0–3.
- **Decision:** Park them until there's a real need. They're listed under "Parked" in the Engineering Plan.
- **Why:** Finishing small milestones beats starting big features. Each of these adds work before anything works end to end.
- **Alternatives considered:** Building them in parallel. That spreads my limited evening time too thin.
- **Consequences:** Ruth starts out plain. Each parked item gets its own ADR when it's picked up.

## ADR-012: Protocol v0 details (version, IDs, payloads, errors)
- **Date:** 2026-11-25
- **Status:** Accepted
- **Context:** The plan left some protocol details open while writing `docs/protocol.md`.
- **Decision:**
  - `v` is a whole number (the major version only).
  - `id` is a counting number. Each side has its own counter, replies reuse the `id` they answer, and `0` is reserved for errors about unreadable lines.
  - Devices clear their remembered command IDs after every new `hello`.
  - `payload` is always present (`{}` when empty).
  - `err` carries both `code` (for code) and `msg` (for people), and an `err` never gets an `err` back.
- **Why:** Simple to parse in C, it matches replies to requests, and it avoids a bug where a restarted Ruth's commands would be ignored as repeats.
- **Alternatives considered:** Text versions like `"0.1"` (harder to compare in C). Text IDs (cost more memory on the device). Optional payloads (more special cases in both parsers).
- **Consequences:** Small additions (new events, actions or optional fields) don't change `v`; they're recorded in the protocol changelog instead.