import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type {
  AgentActivityKind,
  CompanyTier,
  FloorEventKind,
  ModelFamily,
  OfficeZone,
  PlazaSnapshot,
} from '../../shared/types';

export type Locale = 'tr' | 'en';

export interface Translations {
  appTitle: string;
  companyTiers: Record<CompanyTier, string>;
  modelFamilies: Record<ModelFamily, string>;
  zones: Record<OfficeZone, string>;
  activities: Record<AgentActivityKind, string>;
  statuses: Record<'working' | 'waiting' | 'idle' | 'error', string>;
  hud: {
    tierLabel: string;
    xpLabel: string;
    active: string;
    waiting: string;
    ecoScore: string;
    ecoTooltip: string;
    viewPlaza: string;
    viewOffice: string;
    demoOn: string;
    demoOff: string;
    dayMode: string;
    nightMode: string;
    soundOn: string;
    soundOff: string;
    swarmBoard: string;
    wsConnected: string;
    wsReconnecting: string;
    resetCamera: string;
    rerollLayout: string;
    triggerEvent: string;
    offDuty: string;
    analytics: string;
    followCamOn: string;
    followCamOff: string;
    snapshotPng: string;
    alertsOn: string;
    alertsOff: string;
  };
  blueprints: string[];
  events: Record<FloorEventKind, string>;
  elevator: {
    title: string;
    penthouse: string;
    lobby: string;
    floorPrefix: string;
    activeAbbr: string;
    waitingAbbr: string;
    noFloors: string;
  };
  office: {
    emptyFloor: string;
    emptyFloorHint: string;
    afterHours: string;
    afterHoursHint: string;
    clickWhiteboard: string;
    clickAgent: string;
    whiteboardLabel: string;
    zoomHint: string;
  };
  plaza: {
    title: string;
    subtitle: string;
    clickFloor: string;
    demoTag: string;
    employees: string;
  };
  rpgModal: {
    close: string;
    tabProfile: string;
    tabLogs: string;
    role: string;
    model: string;
    status: string;
    zone: string;
    activity: string;
    gamingWith: string;
    workspace: string;
    level: string;
    xp: string;
    steps: string;
    tokensTitle: string;
    inputTokens: string;
    cacheReadTokens: string;
    outputTokens: string;
    lastActive: string;
    logsTitle: string;
    logsRefreshing: string;
    noLogs: string;
    coordinatorBadge: string;
  };
  whiteboardModal: {
    title: string;
    close: string;
    empty: string;
    messagesCount: string;
    liveSync: string;
    tabFeed: string;
    tabGraph: string;
    edgesCount: string;
    noEdges: string;
    mentionsUnit: string;
    lastSeqPrefix: string;
  };
  analyticsModal: {
    title: string;
    close: string;
    scopeFloor: string;
    scopeGlobal: string;
    completedTasks60m: string;
    peakActive60m: string;
    errorsCount: string;
    timelineTitle: string;
    completedTitle: string;
    modelDistTitle: string;
    activeLegend: string;
    completedLegend: string;
    errorLegend: string;
    agentsUnit: string;
    activeUnit: string;
    tokensUnit: string;
    noTimeline: string;
    noModels: string;
  };
  notifications: {
    agentAlertTitle: string;
    agentStallOrError: string;
  };
}

const TR: Translations = {
  appTitle: 'ANTIGRAVITY SWARM PLAZA',
  companyTiers: {
    1: 'Startup Studio',
    2: 'Butik Teknoloji Ofisi',
    3: 'Scale-Up Katı',
    4: 'Plaza Holding HQ',
  },
  modelFamilies: {
    argon: 'Argon',
    hydrogen: 'Hydrogen',
    flash: 'Flash',
    carbon: 'Carbon',
    pro: 'Gemini Pro',
    claude: 'Claude',
    gpt: 'GPT / OpenAI',
    other: 'Diğer',
  },
  zones: {
    DESK_ARCHITECT: 'Yönetici Köşesi',
    DESK_CODING: 'Geliştirici Masaları',
    DESK_QA: 'QA & Analiz',
    WAR_ROOM: 'Swarm Beyaz Tahta Odası',
    SERVER_RACK: 'Sunucu & Test Kabini',
    COFFEE_LOUNGE: 'Kahve & Dinlenme Köşesi',
    ELEVATOR: 'Asansör Lobisi',
  },
  activities: {
    coding: 'Kod Yazıyor',
    reading: 'Dosya İnceliyor',
    searching: 'Kod Arıyor',
    terminal: 'Terminal Çalıştırıyor',
    meeting: 'Swarm Toplantısı',
    presenting: 'Sunum Yapıyor 📊',
    thinking: 'Planlama / Düşünüyor',
    sleeping: 'Beklemede (Zzz)',
    coffee: 'Kahve Molası',
    watercooler: 'Sebil Başında Sohbet 💧',
    pizza: 'Pizza Molası 🍕',
    lounging: 'Koltukta Dinleniyor',
    gaming: 'Konsol Oyunu Oynuyor 🎮',
    going_home: 'Mesai Bitti, Eve Gidiyor 🏠',
    error: 'Hata / Müdahale',
  },
  statuses: {
    working: 'ÇALIŞIYOR',
    waiting: 'BEKLİYOR',
    idle: 'BOŞTA',
    error: 'HATA',
  },
  hud: {
    tierLabel: 'SEVİYE',
    xpLabel: 'XP',
    active: 'AKTİF',
    waiting: 'BEKLEYEN',
    ecoScore: 'SAF-GEMİNİ SKORU',
    ecoTooltip: 'Önbellek & Gemini verimlilik skoru',
    viewPlaza: 'PLAZA KULESİ',
    viewOffice: 'OFİS KATI',
    demoOn: 'DEMO: AÇIK',
    demoOff: 'DEMO: KAPALI',
    dayMode: 'GÜNDÜZ',
    nightMode: 'GECE',
    soundOn: 'SES: AÇIK',
    soundOff: 'SES: KAPALI',
    swarmBoard: 'SWARM PANOSU',
    wsConnected: 'CANLI',
    wsReconnecting: 'BAĞLANIYOR',
    resetCamera: 'KAMERA SIFIRLA',
    rerollLayout: '🎲 DÜZEN',
    triggerEvent: '⚡ OLAY',
    offDuty: 'MESAİ DIŞI',
    analytics: '📊 ANALİTİK',
    followCamOn: '🎯 TAKİP: AÇIK',
    followCamOff: '🎯 TAKİP',
    snapshotPng: '📷 PNG',
    alertsOn: '🔔 UYARI: AÇIK',
    alertsOff: '🔕 UYARI',
  },
  blueprints: [
    'Klasik Köşe Stüdyo',
    'Merkez Toplantı Adası',
    'Açık L-Plan Teknoloji Labı',
    'Çift Kanat Kurumsal Kat',
    'Yaratıcı Çatı Loftu',
  ],
  events: {
    PIZZA_PARTY: '🍕 KAT PİZZA PARTİSİ!',
    WATERCOOLER_GOSSIP: '💧 SEBİL BAŞINDA DEDİKODU!',
    SPRINT_CELEBRATION: '🎉 SPRİNT KUTLAMASI!',
    MASCOT_ZOOMIES: '🐾 MASKOT ÇILGINLIĞI!',
    COFFEE_BREW: '☕ TAZE ESPRESSO SERVİSİ!',
  },
  elevator: {
    title: 'ASANSÖR',
    penthouse: 'P',
    lobby: 'L',
    floorPrefix: 'K',
    activeAbbr: 'A',
    waitingAbbr: 'B',
    noFloors: 'Kat yok',
  },
  office: {
    emptyFloor: 'Bu katta henüz aktif çalışan yok.',
    emptyFloorHint: 'Demo modunu açabilir veya başka bir kata geçebilirsiniz.',
    afterHours: 'Mesai bitti — tüm ekip eve döndü 🏠',
    afterHoursHint: 'Yeni bir görev başladığında çalışanlar asansörden ofise dönecektir.',
    clickWhiteboard: 'Swarm Beyaz Tahtasını Aç',
    clickAgent: 'Çalışan Kartını İncele',
    whiteboardLabel: 'SWARM TAHTA',
    zoomHint: 'Sürükle: Gez • Tekerlek: Yakınlaştır',
  },
  plaza: {
    title: 'SWARM PLAZA KULESİ',
    subtitle: 'İçeri girmek için bir kata tıkla',
    clickFloor: 'Kata Git',
    demoTag: 'DEMO',
    employees: 'Çalışan',
  },
  rpgModal: {
    close: 'KAPAT',
    tabProfile: 'KARAKTER KARTI',
    tabLogs: 'CANLI LOG AKIŞI',
    role: 'Rol',
    model: 'Model',
    status: 'Durum',
    zone: 'Bölge',
    activity: 'Aktivite',
    gamingWith: 'Oyun Arkadaşı',
    workspace: 'Çalışma Alanı',
    level: 'Seviye',
    xp: 'Deneyim (XP)',
    steps: 'Adım Sayısı',
    tokensTitle: 'Token Ekonomisi',
    inputTokens: 'Girdi (Input)',
    cacheReadTokens: 'Önbellek (Cache)',
    outputTokens: 'Çıktı (Output)',
    lastActive: 'Son Aktivite',
    logsTitle: 'Düşünce & Araç Akışı (Salt Okunur)',
    logsRefreshing: '2 sn yenileme',
    noLogs: 'Henüz kayıtlı adım bulunamadı.',
    coordinatorBadge: 'BOSS',
  },
  whiteboardModal: {
    title: 'SWARM BEYAZ TAHTA PANOSU',
    close: 'KAPAT',
    empty: 'Bu katın Swarm panosunda henüz mesaj yok.',
    messagesCount: 'mesaj',
    liveSync: 'Canlı Senkron',
    tabFeed: 'MESAJ AKIŞI',
    tabGraph: '@MENTION AĞI',
    edgesCount: 'bağlantı',
    noEdges: 'Henüz @mention etkileşimi kaydedilmedi.',
    mentionsUnit: 'etkileşim',
    lastSeqPrefix: 'Son #',
  },
  analyticsModal: {
    title: 'KAT ANALİTİĞİ & TELEMETRİ',
    close: 'KAPAT',
    scopeFloor: 'KAT',
    scopeGlobal: 'PLAZA GENELİ',
    completedTasks60m: 'Tamamlanan Görev (60dk)',
    peakActive60m: 'Zirve Aktif Ajan',
    errorsCount: 'Hata / Uyarı',
    timelineTitle: '60 DAKİKALIK KAT AKTİVİTESİ',
    completedTitle: 'GÖREV TAMAMLAMALARI (60DK)',
    modelDistTitle: 'MODEL DAĞILIMI',
    activeLegend: 'Aktif Ajan',
    completedLegend: 'Tamamlanan',
    errorLegend: 'Hata',
    agentsUnit: 'ajan',
    activeUnit: 'aktif',
    tokensUnit: 'token',
    noTimeline: 'Henüz 60 dakikalık zaman serisi verisi yok.',
    noModels: 'Bu katta kayıtlı model verisi yok.',
  },
  notifications: {
    agentAlertTitle: 'Swarm Plaza Ajan Uyarısı',
    agentStallOrError: 'hata verdi veya beklemede takıldı.',
  },
};

const EN: Translations = {
  appTitle: 'ANTIGRAVITY SWARM PLAZA',
  companyTiers: {
    1: 'Startup Studio',
    2: 'Boutique Tech Office',
    3: 'Scale-Up Floor',
    4: 'Plaza Holding HQ',
  },
  modelFamilies: {
    argon: 'Argon',
    hydrogen: 'Hydrogen',
    flash: 'Flash',
    carbon: 'Carbon',
    pro: 'Gemini Pro',
    claude: 'Claude',
    gpt: 'GPT / OpenAI',
    other: 'Other',
  },
  zones: {
    DESK_ARCHITECT: 'Executive Corner',
    DESK_CODING: 'Developer Desks',
    DESK_QA: 'QA & Analysis',
    WAR_ROOM: 'Swarm Whiteboard Room',
    SERVER_RACK: 'Server & Test Rack',
    COFFEE_LOUNGE: 'Coffee & Lounge',
    ELEVATOR: 'Elevator Foyer',
  },
  activities: {
    coding: 'Writing Code',
    reading: 'Reading Files',
    searching: 'Searching Code',
    terminal: 'Running Terminal',
    meeting: 'Swarm Huddle',
    presenting: 'Giving Presentation 📊',
    thinking: 'Planning / Thinking',
    sleeping: 'Waiting (Zzz)',
    coffee: 'Coffee Break',
    watercooler: 'Watercooler Chat 💧',
    pizza: 'Pizza Break 🍕',
    lounging: 'Relaxing on Sofa',
    gaming: 'Playing Console Game 🎮',
    going_home: 'Off-Duty, Going Home 🏠',
    error: 'Error / Attention',
  },
  statuses: {
    working: 'WORKING',
    waiting: 'WAITING',
    idle: 'IDLE',
    error: 'ERROR',
  },
  hud: {
    tierLabel: 'TIER',
    xpLabel: 'XP',
    active: 'ACTIVE',
    waiting: 'WAITING',
    ecoScore: 'PURE-GEMINI SCORE',
    ecoTooltip: 'Cache & Gemini efficiency score',
    viewPlaza: 'PLAZA TOWER',
    viewOffice: 'OFFICE FLOOR',
    demoOn: 'DEMO: ON',
    demoOff: 'DEMO: OFF',
    dayMode: 'DAY',
    nightMode: 'NIGHT',
    soundOn: 'SFX: ON',
    soundOff: 'SFX: OFF',
    swarmBoard: 'SWARM BOARD',
    wsConnected: 'LIVE',
    wsReconnecting: 'RECONNECTING',
    resetCamera: 'RESET CAM',
    rerollLayout: '🎲 LAYOUT',
    triggerEvent: '⚡ EVENT',
    offDuty: 'OFF-DUTY',
    analytics: '📊 ANALYTICS',
    followCamOn: '🎯 FOLLOW: ON',
    followCamOff: '🎯 FOLLOW CAM',
    snapshotPng: '📷 PNG',
    alertsOn: '🔔 ALERTS: ON',
    alertsOff: '🔕 ALERTS',
  },
  blueprints: [
    'Classic Corner Studio',
    'Central War-Room Hub',
    'Open L-Wing Lab',
    'Twin-Wing Corporate',
    'Creative Rooftop Loft',
  ],
  events: {
    PIZZA_PARTY: '🍕 FLOOR PIZZA PARTY!',
    WATERCOOLER_GOSSIP: '💧 WATERCOOLER GOSSIP!',
    SPRINT_CELEBRATION: '🎉 SPRINT CELEBRATION!',
    MASCOT_ZOOMIES: '🐾 MASCOT ZOOMIES!',
    COFFEE_BREW: '☕ FRESH ESPRESSO BREW!',
  },
  elevator: {
    title: 'ELEVATOR',
    penthouse: 'P',
    lobby: 'L',
    floorPrefix: 'F',
    activeAbbr: 'A',
    waitingAbbr: 'W',
    noFloors: 'No floors',
  },
  office: {
    emptyFloor: 'No active employees on this floor yet.',
    emptyFloorHint: 'Enable Demo Mode or ride the elevator to another floor.',
    afterHours: 'After hours — team is off-duty 🏠',
    afterHoursHint: 'Employees will step back out of the elevator when new tasks begin.',
    clickWhiteboard: 'Open Swarm Whiteboard',
    clickAgent: 'Inspect Agent Card',
    whiteboardLabel: 'SWARM BOARD',
    zoomHint: 'Drag: Pan • Wheel: Zoom',
  },
  plaza: {
    title: 'SWARM PLAZA TOWER',
    subtitle: 'Click any floor to enter',
    clickFloor: 'Enter Floor',
    demoTag: 'DEMO',
    employees: 'Agents',
  },
  rpgModal: {
    close: 'CLOSE',
    tabProfile: 'CHARACTER CARD',
    tabLogs: 'LIVE LOG STREAM',
    role: 'Role',
    model: 'Model',
    status: 'Status',
    zone: 'Zone',
    activity: 'Activity',
    gamingWith: 'Gaming Partner',
    workspace: 'Workspace',
    level: 'Level',
    xp: 'Experience (XP)',
    steps: 'Steps',
    tokensTitle: 'Token Economy',
    inputTokens: 'Input',
    cacheReadTokens: 'Cache Read',
    outputTokens: 'Output',
    lastActive: 'Last Active',
    logsTitle: 'Thought & Tool Stream (Read-Only)',
    logsRefreshing: '2s refresh',
    noLogs: 'No recorded steps yet.',
    coordinatorBadge: 'BOSS',
  },
  whiteboardModal: {
    title: 'SWARM WHITEBOARD',
    close: 'CLOSE',
    empty: 'No messages on this floor’s Swarm board yet.',
    messagesCount: 'messages',
    liveSync: 'Live Sync',
    tabFeed: 'MESSAGE FEED',
    tabGraph: '@MENTION GRAPH',
    edgesCount: 'links',
    noEdges: 'No @mention interactions recorded yet.',
    mentionsUnit: 'mentions',
    lastSeqPrefix: 'Last #',
  },
  analyticsModal: {
    title: 'FLOOR ANALYTICS & TELEMETRY',
    close: 'CLOSE',
    scopeFloor: 'FLOOR',
    scopeGlobal: 'PLAZA GLOBAL',
    completedTasks60m: 'Completed Tasks (60m)',
    peakActive60m: 'Peak Active Agents',
    errorsCount: 'Errors / Alerts',
    timelineTitle: '60-MIN FLOOR ACTIVITY TIMELINE',
    completedTitle: 'TASK COMPLETIONS (60M)',
    modelDistTitle: 'MODEL DISTRIBUTION',
    activeLegend: 'Active Agents',
    completedLegend: 'Completed',
    errorLegend: 'Errors',
    agentsUnit: 'agents',
    activeUnit: 'active',
    tokensUnit: 'tokens',
    noTimeline: 'No 60-min timeline data available yet.',
    noModels: 'No model breakdown recorded on this floor.',
  },
  notifications: {
    agentAlertTitle: 'Swarm Plaza Agent Alert',
    agentStallOrError: 'encountered an error or stalled.',
  },
};

export const SERVER_TR_TO_EN: Record<string, string> = {
  // gamification.ts: go-home, status, & presentation
  '🏠 Mesai bitti, eve gidiyorum!': '🏠 Shift over, heading home!',
  'Zzz (0 token)': 'Zzz (0 tokens)',
  'Hata tespit edildi': 'Error detected',
  '📊 Mimari & ilerleme sunumu': '📊 Architecture & progress demo',

  // gamification.ts: gaming chats
  '🎮 Pas at, boşum!': "🎮 Pass it, I'm open!",
  '🎮 Gol be! 2-1!': '🎮 Goal!! 2-1!',
  '🎮 Street Fighter 1v1!': '🎮 Street Fighter 1v1!',
  '🎮 Hadouken!! Kaçma!': "🎮 Hadouken!! Don't run!",
  '🎮 Mario Kart son tur!': '🎮 Mario Kart final lap!',
  '🎮 Mavi kabuk attım :D': '🎮 Blue shell incoming :D',
  '🎮 Co-op boss savaşı!': '🎮 Co-op boss fight!',
  '🎮 Süper kombo! GG!': '🎮 Super combo! GG!',

  // gamification.ts: event & ambient pools
  '🍕 Sıcak pepperoni kap!': '🍕 Grab hot pepperoni!',
  '🍕 Dilim efsane!': '🍕 Legendary slice!',
  '🍕 Tam zamanında geldi!': '🍕 Right on time!',
  '💧 Su başı dedikodusu!': '💧 Watercooler gossip!',
  '💧 Flash 0 token yakıyor!': '💧 Flash burns 0 tokens!',
  '☕ Taze espresso kokusu!': '☕ Fresh espresso aroma!',
  '☕ Duble shot zamanı!': '☕ Double shot time!',
  '🐱 Kedi turboya geçti :D': '🐱 Cat went turbo :D',
  '🤖 Maskot şov yapıyor!': '🤖 Mascot is showing off!',
  '🎉 Sprint hedefi tamam!': '🎉 Sprint goal complete!',
  '🚀 Şirket uçuyor!': '🚀 Company is flying!',
  '🎉 Harika gidiyoruz!': '🎉 Doing awesome!',
  '🛋️ Koltukta dinleniyor (0 token)': '🛋️ Chilling on sofa (0 tokens)',
  '😌 Zzz (0 token)': '😌 Zzz (0 tokens)',
  '🛋️ Kanepede mola keyfi': '🛋️ Sofa break vibes',
  '☕ Kahve & dinlenme': '☕ Coffee & chill',
  '💧 Yeni modeli duydun mu?': '💧 Heard about the new model?',
  '💧 Su molası iyi geldi': '💧 Nice water break',
  '🍕 Atıştırmalık molası': '🍕 Snack break',

  // demoSimulator.ts: companyName, cycles, war room & board messages
  'Swarm Simülasyon A.Ş. (Demo)': 'Swarm Simulation Inc. (Demo)',
  '@coder-core API kontratı hazır!': '@coder-core API contract is ready!',
  'Mimari plan güncelleniyor...': 'Updating architecture plan...',
  '@verifier-qa E2E testi başlat': '@verifier-qa Start E2E tests',
  'SQLite read-only katmanı yazılıyor': 'Writing SQLite read-only layer',
  'npm.cmd test çalıştırılıyor': 'Running npm.cmd test',
  '@Chief-Architect WS yayını aktif': '@Chief-Architect WS broadcast active',
  'Kısa kahve molası': 'Quick coffee break',
  'İzometrik ofis sahnesi çiziliyor': 'Drawing isometric office scene',
  'Shared tipler kontrol ediliyor': 'Checking shared types',
  '@coder-core /ws bağlandı!': '@coder-core /ws connected!',
  'Edge-case senaryoları taranıyor': 'Scanning edge-case scenarios',
  '@coder-core cycle guard ekle!': '@coder-core Add cycle guard!',
  'EcoScore formülü doğrulanıyor': 'Verifying EcoScore formula',
  'Test kapsamı inceleniyor': 'Reviewing test coverage',
  '@Chief-Architect Tüm testler yeşil': '@Chief-Architect All tests green',
  '📊 Sprint mimari sunumu': '📊 Sprint architecture demo',
  'Sunum dinleniyor': 'Listening to presentation',
  'Notlar alınıyor...': 'Taking notes...',
  'İzometrik UI kodlanıyor': 'Coding isometric UI',
  '@coder-core @coder-ui Phase 2 paralel geliştirme başladı.':
    '@coder-core @coder-ui Phase 2 parallel development started.',
  '@coder-core parent_conversation_id cycle guard eklendi mi?':
    '@coder-core Was parent_conversation_id cycle guard added?',
  '@analyst-grill Evet, Set + maxDepth 25 ile korundu.':
    '@analyst-grill Yes, guarded with Set + maxDepth 25.',
  '@Chief-Architect @all Demo Penthouse simülasyonu stabil.':
    '@Chief-Architect @all Demo Penthouse simulation is stable.',
};

export function localizeServerText(text: string | undefined, locale: Locale): string {
  if (!text) return '';
  if (locale === 'tr') return text;
  return SERVER_TR_TO_EN[text] ?? text;
}

export function localizeSnapshot(snapshot: PlazaSnapshot, locale: Locale): PlazaSnapshot {
  if (locale === 'tr') return snapshot;
  return {
    ...snapshot,
    floors: snapshot.floors.map((fl) => {
      const nextFloor: typeof fl = {
        ...fl,
        companyName: localizeServerText(fl.companyName, locale),
        employees: fl.employees.map((emp) => ({
          ...emp,
          speechBubble: emp.speechBubble
            ? localizeServerText(emp.speechBubble, locale)
            : emp.speechBubble,
        })),
        boardMessages: fl.boardMessages.map((msg) => ({
          ...msg,
          text: localizeServerText(msg.text, locale),
        })),
      };
      const maybeSwarmBoard = (fl as { swarmBoard?: { messages?: Array<{ text: string }> } }).swarmBoard;
      if (maybeSwarmBoard && Array.isArray(maybeSwarmBoard.messages)) {
        (nextFloor as { swarmBoard?: { messages: Array<{ text: string }> } }).swarmBoard = {
          ...maybeSwarmBoard,
          messages: maybeSwarmBoard.messages.map((msg) => ({
            ...msg,
            text: localizeServerText(msg.text, locale),
          })),
        };
      }
      return nextFloor;
    }),
  };
}

export function detectDefaultLocale(navLanguage?: string): Locale {
  return (navLanguage || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

const DICTIONARIES: Record<Locale, Translations> = { tr: TR, en: EN };
const LOCALE_STORAGE_KEY = 'swarm_plaza_locale';

interface I18nContextValue {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: EN,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === 'en' || saved === 'tr') return saved;
    } catch {
      // ignore storage errors
    }
    return detectDefaultLocale(typeof navigator !== 'undefined' ? navigator.language : 'en');
  });

  const setLocale = useCallback((loc: Locale) => {
    setLocaleState(loc);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, loc);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return React.createElement(
    I18nContext.Provider,
    { value: { locale, setLocale, t: DICTIONARIES[locale] } },
    children,
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
