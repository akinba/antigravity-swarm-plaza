import React, { useMemo } from 'react';
import type { OfficeEmployee, QuotaPoolStatus } from '../../shared/types';
import { useI18n } from '../i18n/translations';

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.max(0, Math.round(n)));
}

export function pctColor(pct: number): string {
  return pct < 20 ? '#ff5666' : pct < 50 ? '#ffbe3b' : '#3be87a';
}

export interface HudQuotaPoolEntry {
  id: 'gemini' | 'claude_gpt';
  shortLabel: string;
  label: string;
  pct: number;
  resetsMin?: number;
}

export interface HudQuotaInfo {
  kind: 'quota' | 'ctx';
  pct: number;
  detail: string;
  resetsMin?: number;
  pools?: HudQuotaPoolEntry[];
}

/** Shows all known quota pools (border stays healthy if >=1 pool is >=50%); otherwise fullest active agent's remaining context. */
export function computeHudQuota(
  quotaPools: QuotaPoolStatus[] | undefined,
  employees: OfficeEmployee[] | undefined,
  nowMs: number = Date.now(),
): HudQuotaInfo | null {
  const pools = (quotaPools ?? []).filter((p) => p.remainingPct !== null);
  if (pools.length > 0) {
    const mapped: HudQuotaPoolEntry[] = pools
      .map((p) => {
        const resetMs = p.resetsAt ? Date.parse(p.resetsAt) - nowMs : NaN;
        return {
          id: p.pool,
          shortLabel: p.pool === 'gemini' ? 'GEM' : 'CLD',
          label: p.label,
          pct: Math.round(p.remainingPct ?? 0),
          resetsMin: Number.isFinite(resetMs) && resetMs > 0 ? Math.ceil(resetMs / 60000) : undefined,
        };
      })
      .sort((a, b) => (a.id === b.id ? 0 : a.id === 'gemini' ? -1 : 1));
    const maxPct = Math.max(...mapped.map((m) => m.pct));
    return {
      kind: 'quota',
      pct: maxPct,
      detail: mapped
        .map(
          (m) =>
            `${m.label}: %${m.pct}${m.resetsMin !== undefined ? ` (↻ ${m.resetsMin}m)` : ''}`,
        )
        .join(' | '),
      resetsMin: mapped.length === 1 && mapped[0].pct < 50 ? mapped[0].resetsMin : undefined,
      pools: mapped,
    };
  }
  let best: { pct: number; left: number; name: string } | null = null;
  for (const e of employees ?? []) {
    if (!e.contextLimitTokens || e.contextUsedTokens === undefined) continue;
    if (e.status !== 'working') continue;
    const left = Math.max(0, e.contextLimitTokens - e.contextUsedTokens);
    const pct = Math.round((left / e.contextLimitTokens) * 100);
    if (!best || e.contextUsedTokens / e.contextLimitTokens > 1 - best.pct / 100) {
      best = { pct, left, name: e.name };
    }
  }
  return best
    ? { kind: 'ctx', pct: best.pct, detail: `${best.name} · ${formatTokens(best.left)}` }
    : null;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="pixel-bar-track" style={{ flex: 1, minWidth: 80 }}>
      <div
        className="pixel-bar-fill"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  );
}

interface QuotaPanelProps {
  quotaPools?: QuotaPoolStatus[];
  employees?: OfficeEmployee[];
}

export const QuotaPanel: React.FC<QuotaPanelProps> = ({ quotaPools, employees }) => {
  const { t } = useI18n();

  const nowMs = Date.now();
  const poolDefs: Array<{ id: 'gemini' | 'claude_gpt'; label: string }> = [
    { id: 'gemini', label: t.quota.poolGemini },
    { id: 'claude_gpt', label: t.quota.poolClaudeGpt },
  ];

  const ctxRows = useMemo(
    () =>
      (employees ?? [])
        .filter((e) => e.contextLimitTokens && e.contextUsedTokens !== undefined)
        .map((e) => {
          const limit = e.contextLimitTokens as number;
          const left = Math.max(0, limit - (e.contextUsedTokens as number));
          return { id: e.id, name: e.name, limit, left, pct: Math.round((left / limit) * 100) };
        })
        .sort((a, b) => a.pct - b.pct),
    [employees],
  );

  return (
    <div
      className="pixel-panel-inset"
      style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div className="pixel-title" style={{ fontSize: 10, color: '#3cd8ff' }}>
        {t.quota.title}
      </div>

      {/* Quota pools */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {poolDefs.map((def) => {
          const pool = (quotaPools ?? []).find((p) => p.pool === def.id && p.remainingPct !== null);
          const pct = pool ? Math.round(pool.remainingPct ?? 0) : null;
          const resetMs = pool?.resetsAt ? Date.parse(pool.resetsAt) - nowMs : NaN;
          const resetMin = Number.isFinite(resetMs) && resetMs > 0 ? Math.ceil(resetMs / 60000) : null;
          return (
            <div key={def.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ width: 120, color: '#dce6ff' }}>{def.label}</span>
              {pct === null ? (
                <span className="pixel-badge" style={{ color: '#3be87a' }}>
                  {t.quota.normalBadge}
                </span>
              ) : (
                <>
                  <Bar pct={pct} color={pctColor(pct)} />
                  <span style={{ color: pctColor(pct), fontWeight: 700, minWidth: 70 }}>
                    %{pct} {t.quota.remainingLabel}
                  </span>
                  {resetMin !== null && (
                    <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                      {t.quota.resetsInMin.replace('{n}', String(resetMin))}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
        {!(quotaPools ?? []).some((p) => p.remainingPct !== null) && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.quota.normalNote}</div>
        )}
      </div>

      {/* Agent context */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 10, color: '#9aa7c7', fontFamily: 'var(--font-pixel)' }}>
          {t.quota.ctxTitle}
        </div>
        {ctxRows.length === 0 ? (
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.quota.noContext}</div>
        ) : (
          ctxRows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span
                style={{
                  width: 120,
                  color: '#dce6ff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={r.name}
              >
                {r.name}
              </span>
              <Bar pct={r.pct} color={pctColor(r.pct)} />
              <span style={{ color: pctColor(r.pct), minWidth: 130 }}>
                {formatTokens(r.left)} / {formatTokens(r.limit)} {t.quota.ctxLeft} (%{r.pct})
              </span>
              {r.pct < 20 && (
                <span className="pixel-badge" style={{ color: '#ff6b6b', fontSize: 9 }}>
                  {t.quota.compactWarn}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
