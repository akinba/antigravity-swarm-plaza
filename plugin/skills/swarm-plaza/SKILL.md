---
name: swarm-plaza
description: Launch and open Antigravity Swarm Plaza 2.5D Pixel Office dashboard to visualize live agents, swarms, and analytics.
---

# Antigravity Swarm Plaza Skill

Use this skill when the user wants to open, launch, or inspect the **Antigravity Swarm Plaza** 2.5D retro pixel-art office dashboard.

**Antigravity Swarm Plaza** runs natively as an embedded Auxiliary Pane sidecar inside Antigravity!

## Primary Action: Embedded Auxiliary Pane Sidecar

When the user asks to view or open Swarm Plaza, surface the one-click sidecar navigation pill directly in your response:

[Swarm Plaza](sidecar://antigravity-swarm-plaza/swarm_plaza/)

- Clicking this pill opens the live 2.5D office directly inside the Antigravity IDE Auxiliary Side Pane.
- The web port (`ANTIGRAVITY_SIDECAR_WEB_PORT`) and process lifecycle are managed automatically by the Antigravity sidecar manager.
- The sidecar automatically adapts to compact pane widths (`< 760px`) with collapsible elevator drawer and HUD controls.
- When `[Open the Swarm UI](sidecar://swarm/swarm_board/)` is shown, you can also surface `[Swarm Plaza](sidecar://antigravity-swarm-plaza/swarm_plaza/)` alongside it as a companion 2.5D office view.

## Secondary Fallback: Standalone Web App

If running outside the IDE or if the user requests a standalone browser window:

1. **Check if the dashboard is already running** on default port `3210`:
   - Quick check: `http://localhost:3210/api/plaza`.
   - If HTTP `200`, the server is already live.

2. **Start the standalone server if needed**:
   - Run `npx antigravity-swarm-plaza --no-open` (or `npm start` inside the repo).
   - The server accesses `~/.gemini/antigravity` strictly in **read-only** mode (`?mode=ro`).

3. **Surface the dashboard link to the user**:
   - Provide the clickable link: **`http://localhost:3210`**.
