import type {
  ApprovalRequestPayload,
  ExecutionMode,
  PromptProvider,
  PromptStreamEvent,
  SwarmRoleAssignment,
  ThinkingLevel,
} from '../../shared/types.js';
import type {
  AgentTurnMessage,
  ProviderRuntimeConfig,
  UnifiedProviderAdapter,
} from '../providers/providerAdapter.js';
import {
  FileLockManager,
  SwarmBoard,
  normalizeRoleKey,
  normalizeSwarmFilePath,
  type SwarmBoardEntry,
  type SwarmPlanTask,
  type WhiteboardSnapshot,
} from './swarmBoard.js';
import {
  ApprovalGate,
  WORKSPACE_TOOL_DEFINITIONS,
  WorkspaceToolExecutor,
  type CommandRunnerFn,
} from './workspaceTools.js';

const KNOWN_PROVIDER_PREFIXES: readonly PromptProvider[] = [
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'deepseek',
  'groq',
  'xai',
  'mistral',
  'copilot',
  'custom',
  'ollama',
  'lmstudio',
];

export function resolveSwarmModelProvider(
  rawModel: string,
  fallbackProvider: PromptProvider = 'gemini',
): { provider: PromptProvider; modelId: string } {
  const trimmed = rawModel.trim();
  for (const prefix of KNOWN_PROVIDER_PREFIXES) {
    if (trimmed.toLowerCase().startsWith(`${prefix}:`)) {
      return {
        provider: prefix,
        modelId: trimmed.slice(prefix.length + 1).trim(),
      };
    }
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'qwen2.5-coder:14b') {
    return { provider: 'ollama', modelId: trimmed };
  }
  if (lower.startsWith('claude-')) {
    return { provider: 'anthropic', modelId: trimmed };
  }
  if (lower.startsWith('gpt-') || lower.startsWith('o1-') || lower.startsWith('o3-')) {
    return { provider: 'openai', modelId: trimmed };
  }
  if (lower.startsWith('deepseek-')) {
    return { provider: 'deepseek', modelId: trimmed };
  }
  if (lower.startsWith('grok-')) {
    return { provider: 'xai', modelId: trimmed };
  }
  if (lower.startsWith('mistral-') || lower.startsWith('codestral')) {
    return { provider: 'mistral', modelId: trimmed };
  }
  if (lower.startsWith('gemini-')) {
    return { provider: 'gemini', modelId: trimmed };
  }

  return { provider: fallbackProvider, modelId: trimmed };
}

export function mapSwarmRoleToAgentKey(role: string): string {
  const lower = role.trim().toLowerCase();
  if (lower === 'architect' || lower === 'coordinator') return 'coordinator';
  if (lower === 'coder core' || lower === 'coder-core') return 'coder-core';
  if (lower === 'coder ui' || lower === 'coder-ui') return 'coder-ui';
  if (lower === 'analyst' || lower === 'analyst-grill') return 'analyst-grill';
  if (lower === 'verifier' || lower === 'verifier-qa') return 'verifier-qa';
  return normalizeRoleKey(role) || 'worker';
}

function isVerifierRole(role: string): boolean {
  return /^(verifier|verifier-qa|qa)$/i.test(role.trim());
}

function isArchitectRole(role: string): boolean {
  return /^(architect|coordinator)$/i.test(role.trim());
}

function isCoderRole(role: string): boolean {
  return /coder/i.test(role.trim());
}

function ownedFilesConflict(filesA: string[], filesB: string[]): boolean {
  if (filesA.length === 0 || filesB.length === 0) {
    return false;
  }
  const normA = filesA.map(normalizeSwarmFilePath);
  const normB = filesB.map(normalizeSwarmFilePath);

  for (const a of normA) {
    for (const b of normB) {
      if (a === '*' || b === '*' || a === '**' || b === '**') return true;
      if (a === b) return true;
      const cleanA = a.replace(/\/\*+$/, '');
      const cleanB = b.replace(/\/\*+$/, '');
      if (cleanA === cleanB) return true;
      if (cleanA.startsWith(`${cleanB}/`) || cleanB.startsWith(`${cleanA}/`)) {
        return true;
      }
    }
  }
  return false;
}

export function parseOrchestratorPlanJson(
  rawText: string,
  swarmProfile: SwarmRoleAssignment[],
  userPrompt: string,
): SwarmPlanTask[] {
  const cleaned = rawText.trim();
  const candidates: string[] = [];

  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(cleaned);
  if (fenceMatch?.[1]) {
    candidates.push(fenceMatch[1].trim());
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }
  candidates.push(cleaned);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        tasks?: Array<{
          id?: unknown;
          role?: unknown;
          title?: unknown;
          ownedFiles?: unknown;
          dependsOn?: unknown;
        }>;
      };
      if (Array.isArray(parsed?.tasks) && parsed.tasks.length > 0) {
        const validTasks: SwarmPlanTask[] = [];
        for (let i = 0; i < parsed.tasks.length; i++) {
          const item = parsed.tasks[i];
          const id =
            typeof item.id === 'string' && item.id.trim()
              ? item.id.trim()
              : `task-${i + 1}`;
          const role =
            typeof item.role === 'string' && item.role.trim()
              ? item.role.trim()
              : swarmProfile[i % Math.max(1, swarmProfile.length)]?.role ?? 'Coder Core';
          const title =
            typeof item.title === 'string' && item.title.trim()
              ? item.title.trim()
              : `Execute ${role} task for: ${userPrompt.slice(0, 80)}`;
          const ownedFiles = Array.isArray(item.ownedFiles)
            ? item.ownedFiles.filter((f): f is string => typeof f === 'string')
            : [];
          const dependsOn = Array.isArray(item.dependsOn)
            ? item.dependsOn.filter((d): d is string => typeof d === 'string')
            : [];

          validTasks.push({
            id,
            role,
            title,
            ownedFiles,
            dependsOn,
          });
        }
        if (validTasks.length > 0) {
          return validTasks;
        }
      }
    } catch {
      // Try next candidate
    }
  }

  // Fallback to swarmProfile roles when JSON parsing fails
  const specialistRoles = swarmProfile.filter(
    (r) => !isArchitectRole(r.role) && !isVerifierRole(r.role),
  );
  const fallbackSource =
    specialistRoles.length > 0
      ? specialistRoles
      : swarmProfile.filter((r) => !isVerifierRole(r.role));

  if (fallbackSource.length === 0) {
    return [
      {
        id: 'task-1',
        role: 'Coder Core',
        title: userPrompt.slice(0, 120),
        ownedFiles: [],
        dependsOn: [],
      },
    ];
  }

  return fallbackSource.map((assignment, idx) => ({
    id: `task-${idx + 1}`,
    role: assignment.role,
    title: `${assignment.role}: ${userPrompt.slice(0, 100)}`,
    ownedFiles: [],
    dependsOn: idx === 0 ? [] : [`task-${idx}`],
  }));
}

function trimMessagesForBudget(
  messages: AgentTurnMessage[],
  maxTotalChars = 14_000,
): AgentTurnMessage[] {
  if (messages.length <= 3) return messages;
  let total = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (total <= maxTotalChars) return messages;

  const head = messages.slice(0, 2); // Keep system + initial user task prompt
  const tail = messages.slice(2);

  while (tail.length > 2 && total > maxTotalChars) {
    const removed = tail.shift();
    if (removed) {
      total -= removed.content.length;
    }
  }
  return [...head, ...tail];
}

export type AgentOfficeState = 'working' | 'waiting' | 'idle' | 'error';

export interface SwarmAgentStateDetail {
  role: string;
  currentFile?: string;
  toolName?: string;
}

export interface SwarmOrchestratorOptions {
  adapters?:
    | Partial<Record<PromptProvider, UnifiedProviderAdapter>>
    | Map<PromptProvider, UnifiedProviderAdapter>;
  getAdapter?: (provider: PromptProvider) => UnifiedProviderAdapter | undefined;
  getRuntimeConfig?: (
    provider: PromptProvider,
    modelId: string,
  ) => ProviderRuntimeConfig;
  defaultWorkspace?: string;
  maxTurns?: number;
  maxHealingRounds?: number;
  commandRunner?: CommandRunnerFn;
}

export interface SwarmOrchestratorRunParams {
  runId: string;
  prompt: string;
  mode: ExecutionMode;
  swarmProfile: SwarmRoleAssignment[];
  orchestratorModel?: string;
  orchestratorProvider?: PromptProvider;
  workspace?: string;
  board?: SwarmBoard;
  lockManager?: FileLockManager;
  approvalGate?: ApprovalGate;
  signal?: AbortSignal;
  onEvent?: (event: PromptStreamEvent) => void;
  onAgentStateChange?: (
    agentKey: string,
    state: AgentOfficeState,
    detail?: SwarmAgentStateDetail,
  ) => void;
  onApprovalRequest?: (payload: ApprovalRequestPayload) => void;
}

export interface SwarmOrchestrationResult {
  runId: string;
  tasks: SwarmPlanTask[];
  whiteboard: WhiteboardSnapshot;
  healingRoundsUsed: number;
  verified: boolean;
  roleOutputs: Record<string, string>;
}

export class SwarmOrchestrator {
  private readonly adaptersMap = new Map<PromptProvider, UnifiedProviderAdapter>();
  private readonly getAdapterFn?: (
    provider: PromptProvider,
  ) => UnifiedProviderAdapter | undefined;
  private readonly getRuntimeConfigFn?: (
    provider: PromptProvider,
    modelId: string,
  ) => ProviderRuntimeConfig;
  private readonly defaultWorkspace: string;
  private readonly maxTurns: number;
  private readonly maxHealingRounds: number;
  private readonly commandRunner?: CommandRunnerFn;

  constructor(options: SwarmOrchestratorOptions = {}) {
    if (options.adapters instanceof Map) {
      for (const [k, v] of options.adapters.entries()) {
        this.adaptersMap.set(k, v);
      }
    } else if (options.adapters) {
      for (const [k, v] of Object.entries(options.adapters)) {
        if (v) {
          this.adaptersMap.set(k as PromptProvider, v);
        }
      }
    }
    this.getAdapterFn = options.getAdapter;
    this.getRuntimeConfigFn = options.getRuntimeConfig;
    this.defaultWorkspace = options.defaultWorkspace ?? process.cwd();
    this.maxTurns = options.maxTurns ?? 8;
    this.maxHealingRounds = options.maxHealingRounds ?? 2;
    this.commandRunner = options.commandRunner;
  }

  private resolveAdapter(provider: PromptProvider): UnifiedProviderAdapter {
    const direct = this.getAdapterFn?.(provider) ?? this.adaptersMap.get(provider);
    if (direct) return direct;

    // Fallback to first registered adapter if a single mock adapter is supplied
    const first = this.adaptersMap.values().next().value;
    if (first) return first;

    throw new Error(`No UnifiedProviderAdapter registered for provider "${provider}".`);
  }

  private resolveRuntimeConfig(
    provider: PromptProvider,
    modelId: string,
  ): ProviderRuntimeConfig {
    return this.getRuntimeConfigFn?.(provider, modelId) ?? {};
  }

  private findRoleAssignment(
    roleName: string,
    swarmProfile: SwarmRoleAssignment[],
    fallbackModel: string,
  ): SwarmRoleAssignment {
    const normTarget = normalizeRoleKey(roleName);
    const exact = swarmProfile.find((r) => normalizeRoleKey(r.role) === normTarget);
    if (exact) return exact;

    if (isArchitectRole(roleName)) {
      const arch = swarmProfile.find((r) => isArchitectRole(r.role));
      if (arch) return arch;
    }
    if (isVerifierRole(roleName)) {
      const ver = swarmProfile.find((r) => isVerifierRole(r.role));
      if (ver) return ver;
    }
    if (isCoderRole(roleName)) {
      const coder = swarmProfile.find((r) => isCoderRole(r.role));
      if (coder) return coder;
    }

    return {
      role: roleName,
      model: swarmProfile[0]?.model ?? fallbackModel,
      level: swarmProfile[0]?.level ?? 'medium',
    };
  }

  public async run(params: SwarmOrchestratorRunParams): Promise<SwarmOrchestrationResult> {
    const workspaceRoot = params.workspace ?? this.defaultWorkspace;
    const board = params.board ?? new SwarmBoard();
    const lockManager = params.lockManager ?? new FileLockManager();
    const roleOutputs: Record<string, string> = {};
    const activeRoles = new Set<string>();

    const emitEvent = (ev: Omit<PromptStreamEvent, 'runId' | 'timestamp'>) => {
      params.onEvent?.({
        runId: params.runId,
        timestamp: Date.now(),
        ...ev,
      });
    };

    const setAgentState = (
      role: string,
      state: AgentOfficeState,
      extra?: { currentFile?: string; toolName?: string },
    ) => {
      const agentKey = mapSwarmRoleToAgentKey(role);
      if (state === 'working') {
        activeRoles.add(role);
      }
      params.onAgentStateChange?.(agentKey, state, {
        role,
        currentFile: extra?.currentFile,
        toolName: extra?.toolName,
      });
    };

    const approvalGate =
      params.approvalGate ??
      new ApprovalGate({
        onApprovalRequest: (reqPayload) => {
          params.onApprovalRequest?.(reqPayload);
          emitEvent({
            type: 'approval_request',
            agentId: mapSwarmRoleToAgentKey(reqPayload.role),
            approval: reqPayload,
            toolName: reqPayload.toolName,
            text: `[APPROVAL REQUIRED] ${reqPayload.role} wants to run ${reqPayload.toolName}: ${reqPayload.summary}`,
          });
        },
        onApprovalResolved: (approvalId, decision) => {
          emitEvent({
            type: 'approval_resolved',
            text: `[APPROVAL ${decision.toUpperCase()}] (${approvalId})`,
          });
        },
      });

    const toolExecutor = new WorkspaceToolExecutor({
      workspaceRoot,
      runId: params.runId,
      mode: params.mode,
      board,
      lockManager,
      approvalGate,
      commandRunner: this.commandRunner,
      onFileChanged: (relPath, role) => {
        const agentKey = mapSwarmRoleToAgentKey(role);
        setAgentState(role, 'working', { currentFile: relPath });
        emitEvent({
          type: 'file',
          agentId: agentKey,
          file: relPath,
        });
      },
      onBoardMessage: (entry: SwarmBoardEntry) => {
        emitEvent({
          type: 'board',
          agentId: mapSwarmRoleToAgentKey(entry.agent),
          boardMessage: entry,
          text: `💬 @${entry.agent}${entry.to ? ` → @${entry.to}` : ''}: ${entry.text}`,
        });
      },
    });

    let plannedTasks: SwarmPlanTask[] = [];
    let healingRoundsUsed = 0;
    let verified = false;

    try {
      // =========================================================================
      // STAGE 0: Orchestrator Planning (DAG creation)
      // =========================================================================
      const archAssignment = this.findRoleAssignment(
        'Architect',
        params.swarmProfile,
        params.orchestratorModel ?? 'gemini:gemini-2.5-pro',
      );
      const orchestratorModelStr = params.orchestratorModel ?? archAssignment.model;
      const { provider: orchProvider, modelId: orchModelId } = resolveSwarmModelProvider(
        orchestratorModelStr,
        params.orchestratorProvider ?? 'gemini',
      );
      const orchAdapter = this.resolveAdapter(orchProvider);
      const orchConfig = this.resolveRuntimeConfig(orchProvider, orchModelId);

      setAgentState('Architect', 'working');
      emitEvent({
        type: 'status',
        agentId: 'coordinator',
        status: 'running',
        text: `[STAGE 0: PLAN] Architect (${orchProvider}:${orchModelId}) analyzing workspace...`,
      });

      const treeResult = await toolExecutor.executeTool('coordinator', undefined, {
        id: 'stage0-list-dir',
        name: 'list_dir',
        args: { path: '.', recursive: true },
      });

      const availableRolesList =
        params.swarmProfile.length > 0
          ? params.swarmProfile.map((r) => `${r.role} (${r.model})`).join(', ')
          : 'Coder Core, Coder UI, Verifier';

      const planningMessages: AgentTurnMessage[] = [
        {
          role: 'system',
          content:
            'You are the Swarm Architect & Orchestrator. Inspect the workspace file tree and decompose the user request into a JSON DAG of tasks.\n' +
            `Available roles: ${availableRolesList}.\n` +
            'Respond with JSON containing: {"tasks": [{"id": "task-1", "role": "Coder Core", "title": "...", "ownedFiles": ["src/..."], "dependsOn": []}]}',
        },
        {
          role: 'user',
          content: `Workspace Tree:\n${treeResult.output}\n\nUser Request:\n${params.prompt}`,
        },
      ];

      let planText = '';
      if (!params.signal?.aborted) {
        const planTurn = await orchAdapter.runTurn(
          {
            model: orchModelId,
            messages: planningMessages,
            thinkingLevel: archAssignment.level,
            workspace: workspaceRoot,
            signal: params.signal,
            onDelta: (delta) => {
              planText += delta;
              emitEvent({
                type: 'chunk',
                agentId: 'coordinator',
                text: delta,
              });
            },
          },
          orchConfig,
        );
        if (planTurn.text && !planText) {
          planText = planTurn.text;
          emitEvent({
            type: 'chunk',
            agentId: 'coordinator',
            text: planTurn.text,
          });
        } else if (planTurn.text) {
          planText = planTurn.text;
        }
      }

      roleOutputs['Architect'] = planText;
      plannedTasks = parseOrchestratorPlanJson(
        planText,
        params.swarmProfile,
        params.prompt,
      );

      board.setTasks(
        plannedTasks.map((t) => ({
          id: t.id,
          role: t.role,
          ownerName: t.role,
          ownerRole: t.role,
          title: t.title,
          ownedFiles: t.ownedFiles,
          dependsOn: t.dependsOn,
          status: 'pending',
        })),
      );

      const planBoardMsg = board.postMessage({
        from: 'coordinator',
        text: `Planned ${plannedTasks.length} DAG task(s): ${plannedTasks.map((t) => `${t.id} (${t.role})`).join(', ')}`,
        kind: 'plan',
      });
      emitEvent({
        type: 'board',
        agentId: 'coordinator',
        boardMessage: planBoardMsg,
        text: `💬 @coordinator: ${planBoardMsg.text}`,
      });
      setAgentState('Architect', 'waiting');

      // =========================================================================
      // STAGE 1 & 2: Dependency-Ordered & Parallel Specialist Execution
      // =========================================================================
      const specialistTasks = plannedTasks.filter((t) => !isVerifierRole(t.role));
      const completedTaskIds = new Set<string>();
      const remainingTasks = [...specialistTasks];

      while (remainingTasks.length > 0) {
        if (params.signal?.aborted) break;

        // Tasks whose dependencies are satisfied
        let readyTasks = remainingTasks.filter((t) =>
          t.dependsOn.every(
            (depId) =>
              completedTaskIds.has(depId) ||
              !remainingTasks.some((rem) => rem.id === depId),
          ),
        );

        // Guard against cyclic dependencies in LLM plan output
        if (readyTasks.length === 0) {
          readyTasks = [remainingTasks[0]];
        }

        // Select a parallel wave of tasks that do not have conflicting ownedFiles
        const wave: SwarmPlanTask[] = [];
        for (const candidate of readyTasks) {
          const hasConflict = wave.some((picked) =>
            ownedFilesConflict(picked.ownedFiles, candidate.ownedFiles),
          );
          if (!hasConflict) {
            wave.push(candidate);
          }
        }

        await Promise.all(
          wave.map(async (task) => {
            const assignment = this.findRoleAssignment(
              task.role,
              params.swarmProfile,
              orchestratorModelStr,
            );
            board.updateTaskStatus(task.id, 'running');
            const out = await this.executeRoleTurnLoop({
              runId: params.runId,
              role: task.role,
              assignment,
              taskTitle: task.title,
              ownedFiles: task.ownedFiles,
              userPrompt: params.prompt,
              workspaceRoot,
              board,
              lockManager,
              toolExecutor,
              signal: params.signal,
              emitEvent,
              setAgentState,
            });
            roleOutputs[task.role] = (roleOutputs[task.role] ?? '') + out;
            board.updateTaskStatus(task.id, 'completed');
            completedTaskIds.add(task.id);
          }),
        );

        for (const doneTask of wave) {
          const idx = remainingTasks.findIndex((t) => t.id === doneTask.id);
          if (idx !== -1) {
            remainingTasks.splice(idx, 1);
          }
        }
      }

      // =========================================================================
      // STAGE 3: Verifier & Self-Healing Loop (Max 2 Healing Rounds)
      // =========================================================================
      const verifierInProfile = params.swarmProfile.find((r) => isVerifierRole(r.role));
      const verifierTaskInPlan = plannedTasks.find((t) => isVerifierRole(t.role));

      if ((verifierInProfile || verifierTaskInPlan) && !params.signal?.aborted) {
        const verifierAssignment =
          verifierInProfile ??
          this.findRoleAssignment('Verifier', params.swarmProfile, orchestratorModelStr);
        const verifierTaskId = verifierTaskInPlan?.id ?? 'task-verifier';

        if (!verifierTaskInPlan) {
          board.setTasks([
            ...board.getTasks(),
            {
              id: verifierTaskId,
              title: 'Verify build & test suite',
              ownerName: verifierAssignment.role,
              ownerRole: verifierAssignment.role,
              dependsOnTaskIds: specialistTasks.map((t) => t.id),
              status: 'pending',
            },
          ]);
        }

        for (let attempt = 0; attempt <= this.maxHealingRounds; attempt++) {
          if (params.signal?.aborted) break;

          board.updateTaskStatus(verifierTaskId, 'running');
          let commandFailed = false;
          let failedCommandOutput = '';

          const verifierOutput = await this.executeRoleTurnLoop({
            runId: params.runId,
            role: verifierAssignment.role,
            assignment: verifierAssignment,
            taskTitle:
              verifierTaskInPlan?.title ??
              'Run verification checks (build/tests) and report [PASS] or [FAIL] with @coder-* mention.',
            ownedFiles: verifierTaskInPlan?.ownedFiles ?? [],
            userPrompt: params.prompt,
            workspaceRoot,
            board,
            lockManager,
            toolExecutor,
            signal: params.signal,
            emitEvent,
            setAgentState,
            onCommandResult: (ok, output) => {
              if (!ok) {
                commandFailed = true;
                failedCommandOutput = output;
              }
            },
          });

          roleOutputs[verifierAssignment.role] = verifierOutput;

          const explicitFail =
            /\[FAIL\]|\[VERIFICATION FAILED\]|\[TEST FAILED\]|\[BUILD ERROR\]/i.test(
              verifierOutput,
            );
          const explicitPass =
            /\[PASS\]|\[VERIFIED\]|EXIT 0/i.test(verifierOutput) && !explicitFail;

          if (!commandFailed && (!explicitFail || explicitPass)) {
            verified = true;
            board.updateTaskStatus(verifierTaskId, 'verified', {
              verifiedKeyword: 'PASS',
            });
            break;
          }

          // Verification failed
          if (attempt >= this.maxHealingRounds) {
            verified = false;
            board.updateTaskStatus(verifierTaskId, 'blocked', {
              verifiedKeyword: 'FAIL',
            });
            break;
          }

          healingRoundsUsed += 1;

          // Determine which @coder-* role to wake for self-healing
          const mentionMatch = /@(coder-[a-zA-Z0-9_-]+)/i.exec(verifierOutput);
          const targetRoleKey = mentionMatch?.[1]?.toLowerCase() ?? 'coder-core';
          const targetTask =
            specialistTasks.find(
              (t) =>
                mapSwarmRoleToAgentKey(t.role) === targetRoleKey ||
                normalizeRoleKey(t.role) === targetRoleKey,
            ) ??
            specialistTasks.find((t) => isCoderRole(t.role)) ??
            specialistTasks[0];

          const targetRoleName = targetTask?.role ?? 'Coder Core';
          const targetAssignment = this.findRoleAssignment(
            targetRoleName,
            params.swarmProfile,
            orchestratorModelStr,
          );

          const errorDigest = (failedCommandOutput || verifierOutput).slice(0, 600);
          const healMsg = board.postMessage({
            from: mapSwarmRoleToAgentKey(verifierAssignment.role),
            to: mapSwarmRoleToAgentKey(targetRoleName),
            text: `@${mapSwarmRoleToAgentKey(targetRoleName)} [SELF-HEAL ROUND ${healingRoundsUsed}] Verification failed: ${errorDigest}`,
            kind: 'self-heal',
          });
          emitEvent({
            type: 'board',
            agentId: mapSwarmRoleToAgentKey(verifierAssignment.role),
            boardMessage: healMsg,
            text: `💬 @${healMsg.agent} → @${healMsg.to}: ${healMsg.text}`,
          });

          const healOutput = await this.executeRoleTurnLoop({
            runId: params.runId,
            role: targetRoleName,
            assignment: targetAssignment,
            taskTitle: `[SELF-HEALING ROUND ${healingRoundsUsed}] Fix verification failure: ${errorDigest}`,
            ownedFiles: targetTask?.ownedFiles ?? [],
            userPrompt: params.prompt,
            workspaceRoot,
            board,
            lockManager,
            toolExecutor,
            signal: params.signal,
            emitEvent,
            setAgentState,
          });
          roleOutputs[targetRoleName] =
            (roleOutputs[targetRoleName] ?? '') + `\n${healOutput}`;
        }
      } else {
        verified = true;
      }

      return {
        runId: params.runId,
        tasks: plannedTasks,
        whiteboard: board.toWhiteboardSnapshot(),
        healingRoundsUsed,
        verified,
        roleOutputs,
      };
    } finally {
      // =========================================================================
      // STAGE 4: Synthesis & Cleanup
      // =========================================================================
      approvalGate.cancelAll();
      lockManager.clearAll();
      for (const role of activeRoles) {
        setAgentState(role, 'idle');
      }
      setAgentState('Architect', 'idle');
    }
  }

  private async executeRoleTurnLoop(params: {
    runId: string;
    role: string;
    assignment: SwarmRoleAssignment;
    taskTitle: string;
    ownedFiles: string[];
    userPrompt: string;
    workspaceRoot: string;
    board: SwarmBoard;
    lockManager: FileLockManager;
    toolExecutor: WorkspaceToolExecutor;
    signal?: AbortSignal;
    emitEvent: (ev: Omit<PromptStreamEvent, 'runId' | 'timestamp'>) => void;
    setAgentState: (
      role: string,
      state: AgentOfficeState,
      extra?: { currentFile?: string; toolName?: string },
    ) => void;
    onCommandResult?: (ok: boolean, output: string) => void;
  }): Promise<string> {
    const agentKey = mapSwarmRoleToAgentKey(params.role);
    const { provider, modelId } = resolveSwarmModelProvider(params.assignment.model);
    const adapter = this.resolveAdapter(provider);
    const runtimeConfig = this.resolveRuntimeConfig(provider, modelId);

    params.setAgentState(params.role, 'working');
    params.emitEvent({
      type: 'status',
      agentId: agentKey,
      status: 'running',
      text: `[SWARM ROLE] ${params.role} (${provider}:${modelId}, level=${params.assignment.level})`,
    });
    params.emitEvent({
      type: 'chunk',
      agentId: agentKey,
      text: `\n━━━ [${params.role} · ${params.assignment.model} (${params.assignment.level})] ━━━\n`,
    });

    const ownershipNote =
      params.ownedFiles.length > 0
        ? `Owned files (only write/edit these): ${params.ownedFiles.join(', ')}`
        : 'Owned files: unrestricted within workspace.';

    const boardSummary = params.board.getCompactSummary();
    const messages: AgentTurnMessage[] = [
      {
        role: 'system',
        content:
          `You are ${params.role} (agent key: @${agentKey}) in an autonomous multi-agent coding swarm.\n` +
          `Thinking Level: ${params.assignment.level}.\n` +
          `${ownershipNote}\n` +
          `Shared SwarmBoard Snapshot:\n${boardSummary || '(empty)'}`,
      },
      {
        role: 'user',
        content: `Assigned Task: ${params.taskTitle}\n\nOriginal User Request:\n${params.userPrompt}`,
      },
    ];

    let collectedText = '';

    try {
      for (let turn = 0; turn < this.maxTurns; turn++) {
        if (params.signal?.aborted) break;

        const budgetedMessages = trimMessagesForBudget(messages);
        let turnDeltaText = '';

        const result = await adapter.runTurn(
          {
            model: modelId,
            messages: budgetedMessages,
            tools: WORKSPACE_TOOL_DEFINITIONS,
            thinkingLevel: params.assignment.level as ThinkingLevel,
            workspace: params.workspaceRoot,
            signal: params.signal,
            onDelta: (delta) => {
              turnDeltaText += delta;
              params.emitEvent({
                type: 'chunk',
                agentId: agentKey,
                text: delta,
              });
            },
          },
          runtimeConfig,
        );

        const turnText = result.text || turnDeltaText;
        if (result.text && !turnDeltaText) {
          params.emitEvent({
            type: 'chunk',
            agentId: agentKey,
            text: result.text,
          });
        }
        if (turnText) {
          collectedText += (collectedText ? '\n' : '') + turnText;
        }

        if (
          !result.toolCalls ||
          result.toolCalls.length === 0 ||
          result.finishReason === 'stop' ||
          result.finishReason === 'aborted'
        ) {
          break;
        }

        messages.push({
          role: 'assistant',
          content: turnText || '',
          toolCalls: result.toolCalls,
        });

        for (const toolCall of result.toolCalls) {
          if (params.signal?.aborted) break;

          params.setAgentState(params.role, 'working', { toolName: toolCall.name });
          params.emitEvent({
            type: 'tool_call',
            agentId: agentKey,
            toolName: toolCall.name,
            toolArgs: toolCall.args,
            text: `🔧 [${params.role}] ${toolCall.name}(${JSON.stringify(toolCall.args)})`,
          });

          const toolRes = await params.toolExecutor.executeTool(
            agentKey,
            params.ownedFiles,
            toolCall,
          );

          if (toolCall.name === 'run_command') {
            params.onCommandResult?.(toolRes.ok, toolRes.output);
          }

          params.emitEvent({
            type: 'tool_result',
            agentId: agentKey,
            toolName: toolCall.name,
            text: toolRes.output,
          });

          messages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: toolRes.output,
          });
        }
      }
    } finally {
      params.lockManager.releaseAll(agentKey);
      params.setAgentState(params.role, 'idle');
    }

    return collectedText;
  }
}
