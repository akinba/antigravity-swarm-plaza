---
name: swarm-plaza
description: Launch and open Antigravity Swarm Plaza 2.5D Pixel Office dashboard to visualize live agents, swarms, and analytics.
---

# Antigravity Swarm Plaza Skill

Use this skill when the user wants to open, launch, or inspect the **Antigravity Swarm Plaza** 2.5D retro pixel-art office dashboard.

## Instructions

1. **Check if the dashboard is already running** on the default port (`3210`):
   - Run a quick non-blocking check (e.g., `curl -s -o /dev/null -w "%{http_code}" http://localhost:3210/api/plaza` or PowerShell `Invoke-WebRequest -UseBasicParsing http://localhost:3210/api/plaza`).
   - If it returns HTTP `200`, the server is already live — skip launching a new process.

2. **Start the server if it is not running**:
   - Prefer `npx antigravity-swarm-plaza --no-open` (or add `--demo` if the user wants demo agents, or `--port <n>` if port `3210` is busy).
   - If you are inside the `antigravity-swarm-plaza` repository workspace and `dist/cli.js` is built, you may also run `npm start` as a background daemon.
   - Start it as a background daemon/task so it keeps serving while the user interacts with it.
   - Wait briefly until `http://localhost:3210/api/plaza` responds with `200`.

3. **Surface the dashboard link to the user**:
   - Provide the clickable URL **`http://localhost:3210`** (or the custom `--port` URL).
   - Mention that `~/.gemini/antigravity` is read strictly in **read-only** mode (`?mode=ro`).
