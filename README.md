# Ruth

Ruth is a Jarvis-style assistant for my Windows PC and my hardware builds.
She runs on the PC, controls my workflow (text and touchscreen now, voice later), and
talks to every device I build through one shared protocol.

Every device Ruth talks to is its own firmware project, so embedded development
stays at the center of this repo.

> **Status:** Milestone 0, Foundation (repo, protocol spec, fake device).
> The full plan is in "Ruth — Engineering Plan (v1)".

---

## How it fits together

Ruth uses a **hub-and-spoke** design:

- **Hub:** Ruth Core, the program on the PC.
- **Spokes:** the devices (CYD, power monitor, HERBIE…), each connected over USB serial.
- **Adapter:** one per device. It acts like a driver and turns Ruth's tool calls
  into protocol messages.
- **Protocol:** the contract every device follows. It's defined in [`docs/protocol.md`](docs/protocol.md).

A command flows down the chain:

```
input → tool → permission check → adapter → protocol message → device
```

The device does the physical work under its own safety rules.
Adding a new device means adding firmware, an adapter and tools.
Ruth Core's connection, protocol and permission code stay the same.

---

## Repo layout

```
ruth/
├── ruth-core/            # The PC program (Node.js + TypeScript, native Windows)
├── firmware/
│   └── cyd/              # CYD touchscreen firmware (C/C++, ESP-IDF, PlatformIO)
├── tools/
│   └── fake-device/      # Pretends to be a device so Ruth can be tested without hardware
├── docs/
│   ├── protocol.md       # Device protocol spec (the contract)
│   ├── decisions.md      # Architecture Decision Records: what was decided, why, when
│   └── notes-from-jarvis.md  # Useful notes carried over from the old JARVIS Workbench
├── .gitignore
└── README.md
```

| Folder | What it is | Why it's separate |
|---|---|---|
| `ruth-core/` | The hub: connections, protocol parsing, permissions, tools | PC code and firmware use different languages and build tools |
| `firmware/<device>/` | One PlatformIO project per device | Each device builds and flashes on its own |
| `tools/fake-device/` | A test stand-in for real hardware | Ruth can be developed and tested with nothing plugged in |
| `docs/` | Spec, decisions, notes | The spec gets written **before** the code |

---

## Requirements

- Windows 11 (Ruth Core runs natively, **not** in WSL, so it can reach COM ports and the desktop)
- [Node.js LTS](https://nodejs.org/)
- [VS Code](https://code.visualstudio.com/) with the [PlatformIO](https://platformio.org/) extension
- Git

---

## Running each part

> Commands marked *(planned)* don't exist yet. They get filled in as each milestone is built.

### Ruth Core
```powershell
cd ruth-core
npm install        # install dependencies (serialport, zod, TypeScript)
npm run dev        # Ruth Starting...
```

### Fake device (test without hardware)
```powershell
# (planned) Ruth connects to the fake device instead of a real COM port
```

### CYD firmware
In VS Code, open `firmware/cyd/` as a PlatformIO project, then:
```powershell
pio run                  # build
pio run -t upload        # flash to the board over USB
pio device monitor       # watch serial output
```

---

## Ground rules

- **Protocol changes:** update `docs/protocol.md` first, then the code. A breaking change bumps the major version.
- **One feature = one tool file.** Core code changes only for real infrastructure reasons.
- **Big decisions** go in `docs/decisions.md`.
- **Secrets** (API keys, key-card ID) go in `.env` or local config. They are never committed.
- **Safety:** the AI suggests, deterministic code decides, and firmware has the final say on anything physical.