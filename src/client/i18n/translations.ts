import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AgentActivityKind, CompanyTier, OfficeZone } from '../../shared/types';

export type Locale = 'tr' | 'en';

export interface Translations {
  appTitle: string;
  companyTiers: Record<CompanyTier, string>;
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
  };
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
  zones: {
    DESK_ARCHITECT: 'Yönetici Köşesi',
    DESK_CODING: 'Geliştirici Masaları',
    DESK_QA: 'QA & Analiz',
    WAR_ROOM: 'Swarm Beyaz Tahta Odası',
    SERVER_RACK: 'Sunucu & Test Kabini',
    COFFEE_LOUNGE: 'Kahve & Dinlenme Köşesi',
  },
  activities: {
    coding: 'Kod Yazıyor',
    reading: 'Dosya İnceliyor',
    searching: 'Kod Arıyor',
    terminal: 'Terminal Çalıştırıyor',
    meeting: 'Swarm Toplantısı',
    thinking: 'Planlama / Düşünüyor',
    sleeping: 'Beklemede (Zzz)',
    coffee: 'Kahve Molası',
    lounging: 'Koltukta Dinleniyor',
    gaming: 'Konsol Oyunu Oynuyor 🎮',
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
    coordinatorBadge: 'KOORDİNATÖR',
  },
  whiteboardModal: {
    title: 'SWARM BEYAZ TAHTA PANOSU',
    close: 'KAPAT',
    empty: 'Bu katın Swarm panosunda henüz mesaj yok.',
    messagesCount: 'mesaj',
    liveSync: 'Canlı Senkron',
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
  zones: {
    DESK_ARCHITECT: 'Executive Corner',
    DESK_CODING: 'Developer Desks',
    DESK_QA: 'QA & Analysis',
    WAR_ROOM: 'Swarm Whiteboard Room',
    SERVER_RACK: 'Server & Test Rack',
    COFFEE_LOUNGE: 'Coffee & Lounge',
  },
  activities: {
    coding: 'Writing Code',
    reading: 'Reading Files',
    searching: 'Searching Code',
    terminal: 'Running Terminal',
    meeting: 'Swarm Huddle',
    thinking: 'Planning / Thinking',
    sleeping: 'Waiting (Zzz)',
    coffee: 'Coffee Break',
    lounging: 'Relaxing on Sofa',
    gaming: 'Playing Console Game 🎮',
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
    coordinatorBadge: 'COORDINATOR',
  },
  whiteboardModal: {
    title: 'SWARM WHITEBOARD',
    close: 'CLOSE',
    empty: 'No messages on this floor’s Swarm board yet.',
    messagesCount: 'messages',
    liveSync: 'Live Sync',
  },
};

const DICTIONARIES: Record<Locale, Translations> = { tr: TR, en: EN };
const LOCALE_STORAGE_KEY = 'swarm_plaza_locale';

interface I18nContextValue {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'tr',
  setLocale: () => {},
  t: TR,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === 'en' || saved === 'tr') return saved;
    } catch {
      // ignore storage errors
    }
    return 'tr';
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
