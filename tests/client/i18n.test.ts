import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DICTIONARIES,
  detectDefaultLocale,
  localizeServerText,
  localizeSnapshot,
  SERVER_TR_TO_EN,
} from '../../src/client/i18n/translations';
import type { PlazaSnapshot } from '../../src/shared/types';

function makeFixtureSnapshot(): PlazaSnapshot {
  return {
    generatedAt: '2026-11-13T18:00:00.000Z',
    demoMode: true,
    globalEcoScore: 92,
    totalActiveAgents: 2,
    activeProjectFloorId: 'demo-penthouse',
    floors: [
      {
        id: 'demo-penthouse',
        floorNumber: 99,
        companyName: 'Swarm Simülasyon A.Ş. (Demo)',
        workspacePath: '/demo',
        isDemo: true,
        tier: 4,
        companyXp: 4200,
        nextTierXp: 5000,
        ecoScore: 92,
        activeCount: 2,
        waitingCount: 1,
        totalConversations: 3,
        lastModifiedAt: '2026-11-13T18:00:00.000Z',
        unlockedProps: ['plants', 'arcade'],
        employees: [
          {
            id: 'emp-1',
            name: 'coder-core',
            roleTitle: 'Backend Lead',
            isCoordinator: false,
            modelId: 'gemini-3-flash',
            modelFamily: 'flash',
            workspaceMode: 'share',
            status: 'working',
            zone: 'DESK_CODING',
            activity: 'coding',
            speechBubble: '@coder-core API kontratı hazır!',
            xp: 500,
            level: 3,
            stepCount: 12,
            inputTokens: 1000,
            cacheReadTokens: 800,
            outputTokens: 200,
            lastActiveAt: '2026-11-13T18:00:00.000Z',
          },
          {
            id: 'emp-2',
            name: 'gamer-1',
            roleTitle: 'QA Engineer',
            isCoordinator: false,
            modelId: 'gemini-3-flash',
            modelFamily: 'flash',
            workspaceMode: 'inherit',
            status: 'waiting',
            zone: 'COFFEE_LOUNGE',
            activity: 'gaming',
            speechBubble: '🎮 Pas at, boşum!',
            xp: 300,
            level: 2,
            stepCount: 5,
            inputTokens: 500,
            cacheReadTokens: 400,
            outputTokens: 100,
            lastActiveAt: '2026-11-13T17:58:00.000Z',
          },
          {
            id: 'emp-3',
            name: 'live-agent',
            roleTitle: 'Architect',
            isCoordinator: true,
            modelId: 'gemini-3-pro',
            modelFamily: 'pro',
            workspaceMode: 'inherit',
            status: 'working',
            zone: 'DESK_ARCHITECT',
            activity: 'thinking',
            speechBubble: 'Refactoring isoMath.ts projection cache',
            xp: 900,
            level: 5,
            stepCount: 20,
            inputTokens: 2000,
            cacheReadTokens: 1500,
            outputTokens: 500,
            lastActiveAt: '2026-11-13T18:00:00.000Z',
          },
        ],
        boardMessages: [
          {
            seq: 1,
            agent: 'coordinator',
            text: '@coder-core @coder-ui Phase 2 paralel geliştirme başladı.',
            time: '2026-11-13T17:50:00.000Z',
            kind: 'post',
            mentions: ['coder-core', 'coder-ui'],
          },
          {
            seq: 2,
            agent: 'live-agent',
            text: '@coder-ui Custom live board message stays unchanged',
            time: '2026-11-13T17:55:00.000Z',
            kind: 'post',
            mentions: ['coder-ui'],
          },
        ],
      },
    ],
  };
}

describe('i18n browser locale & server snapshot localization', () => {
  it('detectDefaultLocale defaults to en unless browser language starts with tr', () => {
    assert.equal(detectDefaultLocale('tr'), 'tr');
    assert.equal(detectDefaultLocale('tr-TR'), 'tr');
    assert.equal(detectDefaultLocale('TR-tr'), 'tr');
    assert.equal(detectDefaultLocale('en'), 'en');
    assert.equal(detectDefaultLocale('en-US'), 'en');
    assert.equal(detectDefaultLocale('de-DE'), 'en');
    assert.equal(detectDefaultLocale(''), 'en');
    assert.equal(detectDefaultLocale(undefined), 'en');
  });

  it('localizeServerText translates known server strings in en and preserves them in tr', () => {
    assert.equal(
      localizeServerText('🏠 Mesai bitti, eve gidiyorum!', 'tr'),
      '🏠 Mesai bitti, eve gidiyorum!',
    );
    assert.equal(
      localizeServerText('🏠 Mesai bitti, eve gidiyorum!', 'en'),
      '🏠 Shift over, heading home!',
    );
    assert.equal(
      localizeServerText('@coder-core API kontratı hazır!', 'en'),
      '@coder-core API contract is ready!',
    );
    assert.equal(localizeServerText(undefined, 'en'), '');
  });

  it('localizeServerText passes through custom live agent text unchanged', () => {
    const custom = 'Inspecting src/server/gamification.ts for edge cases';
    assert.equal(localizeServerText(custom, 'en'), custom);
    assert.equal(localizeServerText(custom, 'tr'), custom);
  });

  it('localizeSnapshot translates demo company, speech bubbles, and board messages in en', () => {
    const raw = makeFixtureSnapshot();
    assert.equal(localizeSnapshot(raw, 'tr'), raw);

    const enSnap = localizeSnapshot(raw, 'en');
    assert.notEqual(enSnap, raw);
    const floor = enSnap.floors[0];
    assert.equal(floor.companyName, 'Swarm Simulation Inc. (Demo)');
    assert.equal(floor.employees[0].speechBubble, '@coder-core API contract is ready!');
    assert.equal(floor.employees[1].speechBubble, "🎮 Pass it, I'm open!");
    assert.equal(floor.employees[2].speechBubble, 'Refactoring isoMath.ts projection cache');
    assert.equal(
      floor.boardMessages[0].text,
      '@coder-core @coder-ui Phase 2 parallel development started.',
    );
    assert.equal(
      floor.boardMessages[1].text,
      '@coder-ui Custom live board message stays unchanged',
    );
  });

  it('SERVER_TR_TO_EN covers all gamification.ts and demoSimulator.ts Turkish string pools', () => {
    const expectedServerStrings = [
      // gamification.ts
      '🏠 Mesai bitti, eve gidiyorum!',
      'Zzz (0 token)',
      'Hata tespit edildi',
      '📊 Mimari & ilerleme sunumu',
      '🎮 Pas at, boşum!',
      '🎮 Gol be! 2-1!',
      '🎮 Street Fighter 1v1!',
      '🎮 Hadouken!! Kaçma!',
      '🎮 Mario Kart son tur!',
      '🎮 Mavi kabuk attım :D',
      '🎮 Co-op boss savaşı!',
      '🎮 Süper kombo! GG!',
      '🍕 Sıcak pepperoni kap!',
      '🍕 Dilim efsane!',
      '🍕 Tam zamanında geldi!',
      '💧 Su başı dedikodusu!',
      '💧 Flash 0 token yakıyor!',
      '☕ Taze espresso kokusu!',
      '☕ Duble shot zamanı!',
      '🐱 Kedi turboya geçti :D',
      '🤖 Maskot şov yapıyor!',
      '🎉 Sprint hedefi tamam!',
      '🚀 Şirket uçuyor!',
      '🎉 Harika gidiyoruz!',
      '🛋️ Koltukta dinleniyor (0 token)',
      '😌 Zzz (0 token)',
      '🛋️ Kanepede mola keyfi',
      '☕ Kahve & dinlenme',
      '💧 Yeni modeli duydun mu?',
      '💧 Su molası iyi geldi',
      '🍕 Atıştırmalık molası',
      // demoSimulator.ts
      'Swarm Simülasyon A.Ş. (Demo)',
      '@coder-core API kontratı hazır!',
      'Mimari plan güncelleniyor...',
      '@verifier-qa E2E testi başlat',
      'SQLite read-only katmanı yazılıyor',
      'npm.cmd test çalıştırılıyor',
      '@Chief-Architect WS yayını aktif',
      'Kısa kahve molası',
      'İzometrik ofis sahnesi çiziliyor',
      'Shared tipler kontrol ediliyor',
      '@coder-core /ws bağlandı!',
      'Edge-case senaryoları taranıyor',
      '@coder-core cycle guard ekle!',
      'EcoScore formülü doğrulanıyor',
      'Test kapsamı inceleniyor',
      '@Chief-Architect Tüm testler yeşil',
      '📊 Sprint mimari sunumu',
      'Sunum dinleniyor',
      'Notlar alınıyor...',
      'İzometrik UI kodlanıyor',
      '@coder-core @coder-ui Phase 2 paralel geliştirme başladı.',
      '@coder-core parent_conversation_id cycle guard eklendi mi?',
      '@analyst-grill Evet, Set + maxDepth 25 ile korundu.',
      '@Chief-Architect @all Demo Penthouse simülasyonu stabil.',
      '⚡ Beyaz tahtaya ışınlandım!',
      '⚡ Ekibi beyaz tahtaya ışınladım!',
      '⚔️ Güç seninle olsun!',
      '⚔️ Işın kılıcı hazır!',
      '🦸 Pelerinler havaya!',
      '🦸 Bugünü biz kurtaracağız!',
      '🎃 Şeker mi şaka mı?',
      '🎃 Balkabağı kostümüm nasıl?',
    ];

    for (const key of expectedServerStrings) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(SERVER_TR_TO_EN, key),
        `Missing SERVER_TR_TO_EN entry for: ${key}`,
      );
      assert.ok(SERVER_TR_TO_EN[key].length > 0, `Empty translation for: ${key}`);
    }
  });

  it('whiteboardModal includes liveActive, jumpToLive, and newMessagesSuffix for tr and en', () => {
    assert.equal(DICTIONARIES.tr.whiteboardModal.liveActive, '● CANLI TAKİP');
    assert.equal(DICTIONARIES.tr.whiteboardModal.jumpToLive, '↓ SON MESAJLAR');
    assert.equal(DICTIONARIES.tr.whiteboardModal.newMessagesSuffix, 'yeni');

    assert.equal(DICTIONARIES.en.whiteboardModal.liveActive, '● LIVE');
    assert.equal(DICTIONARIES.en.whiteboardModal.jumpToLive, '↓ JUMP TO LIVE');
    assert.equal(DICTIONARIES.en.whiteboardModal.newMessagesSuffix, 'new');
  });

  it('includes costume party event translations in tr and en', () => {
    assert.equal(DICTIONARIES.tr.events.STAR_WARS_PARTY, '⚔️ STAR WARS KOSTÜM PARTİSİ!');
    assert.equal(DICTIONARIES.tr.events.SUPERHERO_PARTY, '🦸 SÜPER KAHRAMAN KOSTÜM PARTİSİ!');
    assert.equal(DICTIONARIES.tr.events.HALLOWEEN_PARTY, '🎃 CADILAR BAYRAMI KOSTÜM PARTİSİ!');

    assert.equal(DICTIONARIES.en.events.STAR_WARS_PARTY, '⚔️ STAR WARS COSTUME PARTY!');
    assert.equal(DICTIONARIES.en.events.SUPERHERO_PARTY, '🦸 SUPERHERO COSTUME PARTY!');
    assert.equal(DICTIONARIES.en.events.HALLOWEEN_PARTY, '🎃 HALLOWEEN COSTUME PARTY!');

    // Operational AI Agent Control Center translations
    assert.equal(DICTIONARIES.tr.whiteboardModal.taskFlowTab, '📋 GÖREV AKIŞI (DAG)');
    assert.equal(DICTIONARIES.en.whiteboardModal.taskFlowTab, '📋 TASK FLOW (DAG)');
    assert.equal(DICTIONARIES.tr.rpgModal.healthSectionTitle, 'SAĞLIK & GÜVENİLİRLİK (HP)');
    assert.equal(DICTIONARIES.en.rpgModal.healthSectionTitle, 'HEALTH & RELIABILITY (HP)');
    assert.equal(
      DICTIONARIES.tr.analyticsModal.resourceMonitorTitle,
      'AI KAYNAK & MALİYET İZLEYİCİ (~TAHMİNİ)',
    );
    assert.equal(
      DICTIONARIES.en.analyticsModal.resourceMonitorTitle,
      'AI RESOURCE & COST MONITOR (~ESTIMATED)',
    );
    assert.equal(DICTIONARIES.tr.alertModal.filterCritical, 'KRİTİK');
    assert.equal(DICTIONARIES.en.alertModal.filterCritical, 'CRITICAL');
    assert.ok(DICTIONARIES.tr.alertModal.filterAll.length > 0);
    assert.ok(DICTIONARIES.en.alertModal.filterAll.length > 0);

    // Gantt Work Plan tab translations
    assert.equal(DICTIONARIES.tr.whiteboardModal.ganttTab, '📅 İŞ PLANI (GANTT)');
    assert.equal(DICTIONARIES.en.whiteboardModal.ganttTab, '📅 WORK PLAN (GANTT)');
    assert.equal(DICTIONARIES.tr.whiteboardModal.workflowGanttTab, '🧭 İŞ AKIŞI & GANTT');
    assert.equal(DICTIONARIES.en.whiteboardModal.workflowGanttTab, '🧭 WORKFLOW & GANTT');
    assert.equal(DICTIONARIES.tr.whiteboardModal.clearFilter, 'TÜMÜNÜ GÖSTER');
    assert.equal(DICTIONARIES.en.whiteboardModal.clearFilter, 'SHOW ALL');
    const ganttKeys = [
      'ganttTab',
      'ganttTitle',
      'ganttLegendCoding',
      'ganttLegendAnalysis',
      'ganttLegendTesting',
      'ganttLegendCoord',
      'ganttLegendBreak',
      'ganttSequenceTitle',
      'ganttFinishedThenStarted',
      'workflowLinksLabel',
      'noLinksYet',
      'workflowGanttTab',
      'clearFilter',
    ] as const;
    for (const key of ganttKeys) {
      assert.ok(DICTIONARIES.tr.whiteboardModal[key].length > 0, `tr.whiteboardModal.${key}`);
      assert.ok(DICTIONARIES.en.whiteboardModal[key].length > 0, `en.whiteboardModal.${key}`);
    }

    // RPG Modal Back to List translation
    assert.equal(DICTIONARIES.tr.rpgModal.backToList, '⬅ LİSTEYE DÖN');
    assert.equal(DICTIONARIES.en.rpgModal.backToList, '⬅ BACK TO LIST');

    // Settings modal & HUD button translations
    assert.equal(DICTIONARIES.tr.hud.settings, '⚙️ AYARLAR');
    assert.equal(DICTIONARIES.en.hud.settings, '⚙️ SETTINGS');
    for (const key of Object.keys(DICTIONARIES.en.settingsModal) as Array<
      keyof typeof DICTIONARIES.en.settingsModal
    >) {
      assert.ok(DICTIONARIES.tr.settingsModal[key].length > 0, `tr.settingsModal.${key}`);
      assert.ok(DICTIONARIES.en.settingsModal[key].length > 0, `en.settingsModal.${key}`);
    }
  });
});
