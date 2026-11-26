# Ruth Device Protocol — v0

This file is the contract between Ruth Core (the PC program) and every device that talks to it.
Ruth Core and all firmware must follow it. If the code and this file disagree, the file wins and the code gets fixed.

**Rule for changes:** update this file first, then the code. A breaking change bumps the major version (see [Versioning](#versioning)).

---

## 1. Framing

How one message travels over the wire (USB serial).

- **One message per line.** A protocol line is the `@` character, then one JSON object, then a newline (`\n`).
- **Line ending:** senders end lines with `\n`. Receivers also accept `\r\n` and strip the `\r`.
- **Text encoding:** UTF-8.
- **Maximum length:** 256 bytes, counting the `@` but not the newline.
- **Compact JSON:** no extra spaces or line breaks inside the JSON. This keeps lines short.
- **Debug lines:** any line that does **not** start with `@` is debug output. Ruth writes it to the debug log and otherwise ignores it. Firmware may print debug lines freely.
- **Bad lines:** a line that starts with `@` but is too long, isn't valid JSON, or breaks the rules below is thrown away. The receiver answers with an `err` (see [`err`](#err--error)).

Example of what a serial stream can look like:

```
I (312) boot: ESP-IDF v5.x          <- debug line, ignored
@{"v":0,"id":1,"type":"hello","payload":{"name":"cyd","fw":"0.1.0","proto":0,"caps":["display.text"]}}
@{"v":0,"id":2,"type":"hb","payload":{}}
```

---

## 2. Envelope fields

Every protocol message has exactly these four fields.

| Field | Type | Meaning |
|---|---|---|
| `v` | whole number | Protocol **major** version. This spec is `0`. |
| `id` | whole number, 0–4294967295 | Message ID (see ID rules below). |
| `type` | text | One of: `hello`, `cmd`, `ack`, `res`, `evt`, `err`, `hb`. |
| `payload` | object | The contents. Always present; use `{}` when there is nothing to send. |

Unknown extra fields at the top level are an error (`BAD_FIELD`). Inside `payload`, each message type defines its own fields.

### ID rules

- **Each side keeps its own counter**, starting at 1 and going up by 1 for each message it starts. It wraps back to 1 after 4294967295. `0` is reserved (see below).
- **Messages a side starts** (`hello`, `cmd`, `evt`, `hb`, or an `err` about something it noticed by itself) get the next number from that side's counter.
- **Replies** (`ack`, `res`, and an `err` that answers a specific message) carry the **`id` of the message they answer**. That's how the sender matches a reply to its question.
- **`id` 0** is used only for an `err` that answers a line so broken that its `id` couldn't be read.
- **Duplicate commands:** a device remembers the IDs of its last 8 `cmd` messages and does not run a repeated ID a second time. It just sends the same `ack` again. The device **clears this list after every new `hello`**, because Ruth's counter starts over when Ruth restarts.

---

## 3. Message types

| Type | Sent by | Meaning |
|---|---|---|
| `hello` | Device | "I connected." Who I am and what I can do. |
| `cmd` | Ruth | "Do something." |
| `ack` | Device | "I received your command." (Not "it worked.") |
| `res` | Either | The final result of a `cmd` (from the device) or of a `hello` (from Ruth). |
| `evt` | Device | "Something happened by itself." |
| `err` | Either | "That message was broken, unknown, or refused." |
| `hb` | Both | Heartbeat: "I'm alive." |

### `hello` — device introduces itself

Sent by the device when it boots and whenever it reaches the "waiting for Ruth" state.

| Payload field | Type | Meaning |
|---|---|---|
| `name` | text | Unique device name, lowercase (e.g. `cyd`, `power-monitor`). Ruth identifies devices by this, never by COM port. |
| `fw` | text | Firmware version, `major.minor.patch`. |
| `proto` | whole number | Protocol major version the firmware speaks. Must equal `v`. |
| `caps` | list of text | Capabilities: the action names this device accepts in a `cmd`. |

```
@{"v":0,"id":1,"type":"hello","payload":{"name":"cyd","fw":"0.1.0","proto":0,"caps":["display.text"]}}
```

Ruth answers with a `res` carrying the `hello`'s `id` and the current time, so the device can timestamp things:

| Payload field | Type | Meaning |
|---|---|---|
| `ok` | true/false | `true` = accepted. |
| `time` | whole number | Current time as Unix seconds (seconds since Jan 1, 1970, UTC). |
| `tz` | whole number | Local time zone offset from UTC, in minutes (Central Time = `-360`). |

```
@{"v":0,"id":1,"type":"res","payload":{"ok":true,"time":1764129180,"tz":-360}}
```

If the versions don't match, Ruth answers with an `err` (`BAD_VERSION`) instead and doesn't talk to the device.

### `cmd` — Ruth asks the device to do something

| Payload field | Type | Meaning |
|---|---|---|
| `action` | text | Which action. Must be one of the device's `caps`. |
| `args` | object | The action's inputs. `{}` if none. |

```
@{"v":0,"id":42,"type":"cmd","payload":{"action":"display.text","args":{"text":"Hello Ruth"}}}
```

The device **range-checks every argument itself** and never trusts Ruth's values. Out-of-range input gets `err` (`OUT_OF_RANGE`).

**No `cmd` can approve anything.** Approvals only travel from device to Ruth, as an `evt`. A device must refuse any command that tries to approve something (`err`, `REFUSED`).

### `ack` — "I received it"

Sent by the device as soon as it has a valid `cmd`, before doing the work. Same `id` as the `cmd`.

```
@{"v":0,"id":42,"type":"ack","payload":{}}
```

### `res` — the result

Sent by the device when the command has finished or failed. Same `id` as the `cmd`.

| Payload field | Type | Meaning |
|---|---|---|
| `ok` | true/false | Did it work? |
| `state` | object | The device's actual state after the attempt (what really happened, not what was asked). |
| `code` | text | Only when `ok` is false: why (same codes as `err`). |

```
@{"v":0,"id":42,"type":"res","payload":{"ok":true,"state":{"text":"Hello Ruth"}}}
```

### `evt` — something happened

Sent by the device on its own: a card tap, a button press, a sensor reading, an overcurrent.

| Payload field | Type | Meaning |
|---|---|---|
| `event` | text | Event name, `area.what` style (e.g. `card.tap`, `touch.confirm`). |
| `data` | object | Event details. `{}` if none. |

```
@{"v":0,"id":7,"type":"evt","payload":{"event":"card.tap","data":{"uid":"04A1B2C3D4E5F6"}}}
```

### `err` — something was wrong

| Payload field | Type | Meaning |
|---|---|---|
| `code` | text | Machine-readable reason, from the list below. Code reads this. |
| `msg` | text | Short human-readable note for the log. People read this. Keep it short. |

```
@{"v":0,"id":0,"type":"err","payload":{"code":"BAD_JSON","msg":"could not parse line"}}
```

| Code | Meaning |
|---|---|
| `BAD_JSON` | The text after `@` isn't valid JSON. |
| `TOO_LONG` | The line was over 256 bytes. |
| `BAD_FIELD` | A field is missing, the wrong type, or not allowed. |
| `UNKNOWN_TYPE` | `type` isn't one of the seven types. |
| `UNKNOWN_ACTION` | The `cmd` action isn't in this device's `caps`. |
| `BAD_VERSION` | Protocol major versions don't match. |
| `OUT_OF_RANGE` | An argument is outside what the device allows. |
| `REFUSED` | Valid, but not allowed (e.g. anything trying to approve over serial). |
| `BUSY` | The device can't take this command right now. |

An `err` never gets an `err` back. This prevents two sides from bouncing errors at each other forever.

### `hb` — heartbeat

Both sides send one every second.

```
@{"v":0,"id":3,"type":"hb","payload":{}}
```

---

## 4. Timing and reliability

| Rule | Value |
|---|---|
| `ack` must arrive within | 1000 ms of the `cmd` |
| If no `ack` | Ruth retries **once** with the **same `id`**, then reports the command as failed |
| `res` timeout | Set per action by Ruth (default 10 s) |
| Heartbeat interval | 1000 ms, both directions |
| Link lost | No valid protocol line received for 3000 ms (three missed heartbeats). Any valid message counts as "alive." |
| On link lost (device) | Go to its **safe state** (stop motion, outputs off, show "Link lost") and wait for Ruth |
| On link lost (Ruth) | Mark the device disconnected and keep trying to reconnect |
| Reconnect | The device sends `hello` again, and Ruth answers as on first connect |
| Reset or brownout | The device always boots into its safe state and sends `hello` |

A brownout is a voltage dip that resets the chip.

---

## 5. Versioning

- `v` is the protocol **major** version. This spec is **0**.
- **Breaking change** (a field renamed or removed, or its meaning changed) → bump `v` and update this file first.
- **Adding something optional** (a new event name, a new action, an extra payload field receivers can ignore) → no bump. Note it in the changelog below.
- Ruth refuses (`BAD_VERSION`) any device whose `proto` differs from Ruth's major version.

---

## 6. Not in v0

These were left out on purpose. They would add complexity before it's needed:

- **Checksums.** USB serial already checks its data.
- **Binary encoding.** Text JSON is easy to read in a serial monitor.
- **Encryption.** The link is a cable on my desk.
- **The small-board text format.** Boards like the Arduino UNO (2 KB of RAM) may later get a plain-text version of the same envelope. It will be defined here when the first such board joins.

---

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-11-25 | 0 | First version. |