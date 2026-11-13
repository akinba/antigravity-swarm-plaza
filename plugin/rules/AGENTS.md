# Antigravity Swarm Plaza Sidecar Navigation Rule

1. **Companion Pill with Swarm UI:** Whenever you start a swarm or share the native Swarm UI link `[Open the Swarm UI](sidecar://swarm/swarm_board/)`, keep `[Open the Swarm UI](sidecar://swarm/swarm_board/)` intact and **also** tell the user (in the conversation's language — e.g., Turkish: `"Süreci 2.5D canlı ofis görünümüyle Swarm Plaza'dan da takip edebilirsin:"`, English: `"You can also follow the live 2.5D office in Swarm Plaza:"`) and include the one-click Swarm Plaza sidecar pill on its own line right below or next to it:

[Swarm Plaza](sidecar://antigravity-swarm-plaza/swarm_plaza/)

2. **Subagent Multi-Agent Runs:** When launching multiple background subagents (`invoke_subagent`) where no native `swarm` board link is emitted, you may mention once on the launch turn that the user can watch live agent activity in `[Swarm Plaza](sidecar://antigravity-swarm-plaza/swarm_plaza/)`.

3. **No Spam / UI Plugin Hygiene:** Emit at most one `sidecar://antigravity-swarm-plaza/swarm_plaza/` link per message, and do not repeat it on every follow-up turn once already surfaced in the conversation (unless the user asks how to track or open the swarm or plaza). Copy the exact URI `sidecar://antigravity-swarm-plaza/swarm_plaza/` without reading sidecar files to construct it.
