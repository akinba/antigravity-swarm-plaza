import type { OfficeZone } from '../../shared/types';
import {
  COFFEE_SLOT,
  FURNITURE_BLOCKS,
  GAMING_SLOTS,
  getTileZone as defaultGetTileZone,
  LOUNGE_SEAT_SLOTS,
  MEETING_CHAIR_SLOTS,
  PRESENTER_SLOT,
  ZONE_SLOTS,
  type ZoneSlot,
} from './pathfinding';
import { hashString } from './pixelSprites';

export type MascotKind = 'tabby_cat' | 'tuxedo_cat' | 'robo_vac';

export interface ThemePalette {
  id: number;
  nameTr: string;
  nameEn: string;
  woodDay: [string, string, string];
  woodNight: [string, string, string];
  carpetDay: [string, string, string];
  carpetNight: [string, string, string];
  confDay: [string, string, string];
  confNight: [string, string, string];
}

export interface FloorLayout {
  blueprintIndex: number;
  themeIndex: number;
  furniture: ReadonlyArray<{ gx: number; gy: number; kind: string }>;
  getTileZone: (gx: number, gy: number) => OfficeZone;
  zoneSlots: Record<OfficeZone, ZoneSlot[]>;
  presenterSlot: ZoneSlot;
  meetingChairSlots: ZoneSlot[];
  gamingSlots: ZoneSlot[];
  loungeSeatSlots: ZoneSlot[];
  coffeeSlots: ZoneSlot[];
  watercoolerSlots: ZoneSlot[];
  pizzaSlots: ZoneSlot[];
  propPositions: Array<{ key: string; kind: string; gx: number; gy: number }>;
  themePalette: ThemePalette;
  mascotKind: MascotKind;
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: 0,
    nameTr: 'Bal Meşe & Kum',
    nameEn: 'Honey Oak & Sand',
    woodDay: ['#a87849', '#996c40', '#6e4b2b'],
    woodNight: ['#63452f', '#563b28', '#362316'],
    carpetDay: ['#cfc6b4', '#c4baa6', '#a89e8c'],
    carpetNight: ['#4b4658', '#433e50', '#332f3d'],
    confDay: ['#2e4f82', '#284573', '#4a73b0'],
    confNight: ['#1e3152', '#192945', '#2c4673'],
  },
  {
    id: 1,
    nameTr: 'İskandinav Huş & Adaçayı',
    nameEn: 'Nordic Birch & Sage Mint',
    woodDay: ['#c7a97e', '#b89a70', '#8a704d'],
    woodNight: ['#6b5a42', '#5c4d38', '#3b3123'],
    carpetDay: ['#bdd4c7', '#b0c9bb', '#8eab9b'],
    carpetNight: ['#354a42', '#2d4039', '#21302b'],
    confDay: ['#356b6e', '#2d5c5e', '#4d8c8f'],
    confNight: ['#1e3d3f', '#183335', '#2c5457'],
  },
  {
    id: 2,
    nameTr: 'Terracotta Loft & Ceviz',
    nameEn: 'Terracotta Loft & Walnut',
    woodDay: ['#875338', '#784830', '#522f1e'],
    woodNight: ['#4d2e1f', '#422619', '#29170f'],
    carpetDay: ['#d6b39a', '#c9a48b', '#a6826a'],
    carpetNight: ['#523c35', '#47332d', '#332420'],
    confDay: ['#7a3b47', '#69313c', '#9e5462'],
    confNight: ['#472129', '#3b1b22', '#5e2c36'],
  },
  {
    id: 3,
    nameTr: 'Bauhaus Kül & Kobalt',
    nameEn: 'Bauhaus Ash & Cobalt',
    woodDay: ['#9c9488', '#8c8478', '#635d54'],
    woodNight: ['#4f4b46', '#45413d', '#2e2b28'],
    carpetDay: ['#c4ccd9', '#b5bfd0', '#929eb3'],
    carpetNight: ['#384154', '#30384a', '#232938'],
    confDay: ['#2b4ea8', '#244291', '#476dd1'],
    confNight: ['#1a2e66', '#152554', '#27428c'],
  },
  {
    id: 4,
    nameTr: 'Kyoto Sedir & Sıcak Vizon',
    nameEn: 'Kyoto Cedar & Warm Taupe',
    woodDay: ['#b07b50', '#9e6c44', '#704b2d'],
    woodNight: ['#5e4029', '#523722', '#362315'],
    carpetDay: ['#cfc2b6', '#c2b4a7', '#a19386'],
    carpetNight: ['#4a423d', '#403834', '#2e2825'],
    confDay: ['#4a5e44', '#3f523a', '#637d5c'],
    confNight: ['#293626', '#222d1f', '#384a34'],
  },
];

// Blueprint 0: Classic Corner Studio
const BLUEPRINT_0: Omit<FloorLayout, 'blueprintIndex' | 'themeIndex' | 'themePalette' | 'mascotKind'> = {
  furniture: FURNITURE_BLOCKS,
  getTileZone: defaultGetTileZone,
  zoneSlots: ZONE_SLOTS,
  presenterSlot: PRESENTER_SLOT,
  meetingChairSlots: MEETING_CHAIR_SLOTS,
  gamingSlots: GAMING_SLOTS,
  loungeSeatSlots: LOUNGE_SEAT_SLOTS,
  coffeeSlots: [COFFEE_SLOT, { gx: 13, gy: 9, facing: 'SE' }],
  watercoolerSlots: [
    { gx: 13, gy: 5, facing: 'SE' },
    { gx: 14, gy: 6, facing: 'NE' },
  ],
  pizzaSlots: [
    { gx: 8, gy: 11, facing: 'SE' },
    { gx: 10, gy: 12, facing: 'NW' },
    { gx: 9, gy: 10, facing: 'SW' },
  ],
  propPositions: [
    { key: 'plants', kind: 'prop_plant', gx: 0.4, gy: 4.2 },
    { key: 'trophy', kind: 'prop_trophy', gx: 4.1, gy: 1.2 },
    { key: 'arcade', kind: 'prop_arcade', gx: 14.2, gy: 8.2 },
    { key: 'hologram', kind: 'prop_hologram', gx: 6.5, gy: 11.2 },
  ],
};

// Blueprint 1: Central War-Room Hub
const BLUEPRINT_1: Omit<FloorLayout, 'blueprintIndex' | 'themeIndex' | 'themePalette' | 'mascotKind'> = {
  furniture: [
    // Exec NE (11..15, 0..4)
    { gx: 13, gy: 2, kind: 'exec_desk' },
    { gx: 13, gy: 3, kind: 'desk_chair' },
    { gx: 12, gy: 1, kind: 'bookshelf' },
    { gx: 14, gy: 1, kind: 'filing_cabinet' },
    // Server & QA North (3..9, 0..3)
    { gx: 5, gy: 1, kind: 'server_rack' },
    { gx: 6, gy: 1, kind: 'server_rack' },
    { gx: 8, gy: 1, kind: 'qa_desk' },
    { gx: 8, gy: 2, kind: 'desk_chair' },
    // Coding West (0..4, 1..10)
    { gx: 1, gy: 3, kind: 'dev_desk' },
    { gx: 1, gy: 4, kind: 'desk_chair' },
    { gx: 1, gy: 6, kind: 'dev_desk' },
    { gx: 1, gy: 7, kind: 'desk_chair' },
    { gx: 1, gy: 9, kind: 'dev_desk' },
    { gx: 1, gy: 10, kind: 'desk_chair' },
    { gx: 3, gy: 6, kind: 'qa_desk' },
    { gx: 3, gy: 7, kind: 'desk_chair' },
    // Central War-Room Hub (5..10, 4..8)
    { gx: 7, gy: 4, kind: 'whiteboard_l' },
    { gx: 8, gy: 4, kind: 'whiteboard_r' },
    { gx: 7, gy: 6, kind: 'war_table' },
    { gx: 8, gy: 6, kind: 'war_table' },
    { gx: 6, gy: 6, kind: 'meeting_chair' },
    { gx: 7, gy: 7, kind: 'meeting_chair' },
    { gx: 8, gy: 7, kind: 'meeting_chair' },
    { gx: 9, gy: 6, kind: 'meeting_chair' },
    { gx: 9, gy: 5, kind: 'meeting_chair' },
    // Skylight Lounge & Console South (4..15, 10..13)
    { gx: 14, gy: 10, kind: 'coffee_machine' },
    { gx: 12, gy: 9, kind: 'water_cooler' },
    { gx: 13, gy: 11, kind: 'tv_console' },
    { gx: 12, gy: 12, kind: 'gaming_seat' },
    { gx: 13, gy: 12, kind: 'gaming_seat' },
    { gx: 6, gy: 12, kind: 'sofa_l' },
    { gx: 7, gy: 12, kind: 'sofa_r' },
    { gx: 5, gy: 11, kind: 'armchair' },
    { gx: 8, gy: 11, kind: 'armchair' },
    { gx: 10, gy: 12, kind: 'armchair' },
    { gx: 7, gy: 11, kind: 'lounge_table' },
    { gx: 0, gy: 12, kind: 'office_plant' },
    { gx: 14, gy: 5, kind: 'office_plant' },
  ],
  getTileZone: (gx, gy) => {
    if (gx >= 11 && gy <= 4) return 'DESK_ARCHITECT';
    if (gx >= 5 && gx <= 10 && gy >= 4 && gy <= 8) return 'WAR_ROOM';
    if (gx >= 4 && gx <= 7 && gy <= 3) return 'SERVER_RACK';
    if (gx >= 8 && gx <= 10 && gy <= 3) return 'DESK_QA';
    if (gx >= 4 && gy >= 10) return 'COFFEE_LOUNGE';
    return 'DESK_CODING';
  },
  zoneSlots: {
    DESK_ARCHITECT: [
      { gx: 13, gy: 3, facing: 'NE' },
      { gx: 12, gy: 3, facing: 'NW' },
    ],
    DESK_CODING: [
      { gx: 1, gy: 4, facing: 'NE' },
      { gx: 1, gy: 7, facing: 'NE' },
      { gx: 1, gy: 10, facing: 'NE' },
      { gx: 2, gy: 3, facing: 'NW' },
    ],
    DESK_QA: [
      { gx: 8, gy: 2, facing: 'NE' },
      { gx: 3, gy: 7, facing: 'NE' },
    ],
    WAR_ROOM: [
      { gx: 6, gy: 6, facing: 'NE' },
      { gx: 7, gy: 7, facing: 'NW' },
      { gx: 8, gy: 7, facing: 'NW' },
      { gx: 9, gy: 6, facing: 'NW' },
      { gx: 9, gy: 5, facing: 'SW' },
    ],
    SERVER_RACK: [
      { gx: 5, gy: 2, facing: 'NE' },
      { gx: 6, gy: 2, facing: 'NE' },
    ],
    COFFEE_LOUNGE: [
      { gx: 14, gy: 11, facing: 'NW' },
      { gx: 6, gy: 12, facing: 'NE' },
      { gx: 7, gy: 12, facing: 'NE' },
      { gx: 5, gy: 11, facing: 'SE' },
      { gx: 8, gy: 11, facing: 'SW' },
      { gx: 10, gy: 12, facing: 'NW' },
    ],
  },
  presenterSlot: { gx: 7, gy: 5, facing: 'SE' },
  meetingChairSlots: [
    { gx: 6, gy: 6, facing: 'NE' },
    { gx: 7, gy: 7, facing: 'NW' },
    { gx: 8, gy: 7, facing: 'NW' },
    { gx: 9, gy: 6, facing: 'NW' },
    { gx: 9, gy: 5, facing: 'SW' },
  ],
  gamingSlots: [
    { gx: 12, gy: 12, facing: 'NE' },
    { gx: 13, gy: 12, facing: 'NW' },
  ],
  loungeSeatSlots: [
    { gx: 6, gy: 12, facing: 'NE' },
    { gx: 7, gy: 12, facing: 'NE' },
    { gx: 5, gy: 11, facing: 'SE' },
    { gx: 8, gy: 11, facing: 'SW' },
    { gx: 10, gy: 12, facing: 'NW' },
  ],
  coffeeSlots: [{ gx: 14, gy: 11, facing: 'NW' }],
  watercoolerSlots: [
    { gx: 11, gy: 9, facing: 'SE' },
    { gx: 12, gy: 10, facing: 'NE' },
  ],
  pizzaSlots: [
    { gx: 6, gy: 11, facing: 'SE' },
    { gx: 8, gy: 12, facing: 'NW' },
    { gx: 7, gy: 10, facing: 'SW' },
  ],
  propPositions: [
    { key: 'plants', kind: 'prop_plant', gx: 10.2, gy: 1.5 },
    { key: 'trophy', kind: 'prop_trophy', gx: 11.4, gy: 3.5 },
    { key: 'arcade', kind: 'prop_arcade', gx: 4.2, gy: 12.2 },
    { key: 'hologram', kind: 'prop_hologram', gx: 10.5, gy: 7.5 },
  ],
};

// Blueprint 2: Open L-Wing Lab
const BLUEPRINT_2: Omit<FloorLayout, 'blueprintIndex' | 'themeIndex' | 'themePalette' | 'mascotKind'> = {
  furniture: [
    // Lounge & Console NW (0..6, 0..5)
    { gx: 1, gy: 1, kind: 'coffee_machine' },
    { gx: 5, gy: 1, kind: 'water_cooler' },
    { gx: 2, gy: 1, kind: 'tv_console' },
    { gx: 2, gy: 2, kind: 'gaming_seat' },
    { gx: 3, gy: 2, kind: 'gaming_seat' },
    { gx: 1, gy: 4, kind: 'sofa_l' },
    { gx: 2, gy: 4, kind: 'sofa_r' },
    { gx: 4, gy: 4, kind: 'armchair' },
    { gx: 2, gy: 3, kind: 'lounge_table' },
    // Exec SW (0..4, 9..13)
    { gx: 2, gy: 11, kind: 'exec_desk' },
    { gx: 2, gy: 12, kind: 'desk_chair' },
    { gx: 1, gy: 10, kind: 'bookshelf' },
    { gx: 4, gy: 10, kind: 'filing_cabinet' },
    // Server & QA East (11..15, 1..7)
    { gx: 12, gy: 1, kind: 'server_rack' },
    { gx: 13, gy: 1, kind: 'server_rack' },
    { gx: 12, gy: 4, kind: 'qa_desk' },
    { gx: 12, gy: 5, kind: 'desk_chair' },
    { gx: 12, gy: 6, kind: 'qa_desk' },
    { gx: 12, gy: 7, kind: 'desk_chair' },
    // Coding Pods Center (5..10, 3..9)
    { gx: 6, gy: 4, kind: 'dev_desk' },
    { gx: 6, gy: 5, kind: 'desk_chair' },
    { gx: 9, gy: 4, kind: 'dev_desk' },
    { gx: 9, gy: 5, kind: 'desk_chair' },
    { gx: 6, gy: 7, kind: 'dev_desk' },
    { gx: 6, gy: 8, kind: 'desk_chair' },
    { gx: 9, gy: 7, kind: 'dev_desk' },
    { gx: 9, gy: 8, kind: 'desk_chair' },
    // Presentation Room SE (9..15, 8..13)
    { gx: 11, gy: 9, kind: 'whiteboard_l' },
    { gx: 12, gy: 9, kind: 'whiteboard_r' },
    { gx: 11, gy: 11, kind: 'war_table' },
    { gx: 12, gy: 11, kind: 'war_table' },
    { gx: 10, gy: 11, kind: 'meeting_chair' },
    { gx: 11, gy: 12, kind: 'meeting_chair' },
    { gx: 12, gy: 12, kind: 'meeting_chair' },
    { gx: 13, gy: 11, kind: 'meeting_chair' },
    { gx: 13, gy: 10, kind: 'meeting_chair' },
    { gx: 0, gy: 7, kind: 'office_plant' },
    { gx: 14, gy: 2, kind: 'office_plant' },
  ],
  getTileZone: (gx, gy) => {
    if (gx <= 5 && gy <= 5) return 'COFFEE_LOUNGE';
    if (gx <= 4 && gy >= 9) return 'DESK_ARCHITECT';
    if (gx >= 11 && gy <= 3) return 'SERVER_RACK';
    if (gx >= 11 && gy >= 4 && gy <= 7) return 'DESK_QA';
    if (gx >= 9 && gy >= 8) return 'WAR_ROOM';
    return 'DESK_CODING';
  },
  zoneSlots: {
    DESK_ARCHITECT: [
      { gx: 2, gy: 12, facing: 'NE' },
      { gx: 3, gy: 11, facing: 'NW' },
    ],
    DESK_CODING: [
      { gx: 6, gy: 5, facing: 'NE' },
      { gx: 9, gy: 5, facing: 'NE' },
      { gx: 6, gy: 8, facing: 'NE' },
      { gx: 9, gy: 8, facing: 'NE' },
    ],
    DESK_QA: [
      { gx: 12, gy: 5, facing: 'NE' },
      { gx: 12, gy: 7, facing: 'NE' },
    ],
    WAR_ROOM: [
      { gx: 10, gy: 11, facing: 'NE' },
      { gx: 11, gy: 12, facing: 'NW' },
      { gx: 12, gy: 12, facing: 'NW' },
      { gx: 13, gy: 11, facing: 'NW' },
      { gx: 13, gy: 10, facing: 'SW' },
    ],
    SERVER_RACK: [
      { gx: 12, gy: 2, facing: 'NE' },
      { gx: 13, gy: 2, facing: 'NE' },
    ],
    COFFEE_LOUNGE: [
      { gx: 1, gy: 2, facing: 'NE' },
      { gx: 1, gy: 4, facing: 'NE' },
      { gx: 2, gy: 4, facing: 'NE' },
      { gx: 4, gy: 4, facing: 'NW' },
    ],
  },
  presenterSlot: { gx: 11, gy: 10, facing: 'SE' },
  meetingChairSlots: [
    { gx: 10, gy: 11, facing: 'NE' },
    { gx: 11, gy: 12, facing: 'NW' },
    { gx: 12, gy: 12, facing: 'NW' },
    { gx: 13, gy: 11, facing: 'NW' },
    { gx: 13, gy: 10, facing: 'SW' },
  ],
  gamingSlots: [
    { gx: 2, gy: 2, facing: 'NE' },
    { gx: 3, gy: 2, facing: 'NW' },
  ],
  loungeSeatSlots: [
    { gx: 1, gy: 4, facing: 'NE' },
    { gx: 2, gy: 4, facing: 'NE' },
    { gx: 4, gy: 4, facing: 'NW' },
  ],
  coffeeSlots: [{ gx: 1, gy: 2, facing: 'NE' }],
  watercoolerSlots: [
    { gx: 5, gy: 2, facing: 'NE' },
    { gx: 4, gy: 1, facing: 'SE' },
  ],
  pizzaSlots: [
    { gx: 1, gy: 3, facing: 'SE' },
    { gx: 3, gy: 3, facing: 'SW' },
  ],
  propPositions: [
    { key: 'plants', kind: 'prop_plant', gx: 5.5, gy: 1.5 },
    { key: 'trophy', kind: 'prop_trophy', gx: 3.5, gy: 10.2 },
    { key: 'arcade', kind: 'prop_arcade', gx: 0.5, gy: 5.2 },
    { key: 'hologram', kind: 'prop_hologram', gx: 7.5, gy: 11.2 },
  ],
};

// Blueprint 3: Twin-Wing Corporate
const BLUEPRINT_3: Omit<FloorLayout, 'blueprintIndex' | 'themeIndex' | 'themePalette' | 'mascotKind'> = {
  furniture: [
    // Exec & Presentation Boardroom North (2..13, 0..4)
    { gx: 3, gy: 2, kind: 'exec_desk' },
    { gx: 3, gy: 3, kind: 'desk_chair' },
    { gx: 1, gy: 1, kind: 'bookshelf' },
    { gx: 2, gy: 1, kind: 'filing_cabinet' },
    { gx: 9, gy: 1, kind: 'whiteboard_l' },
    { gx: 10, gy: 1, kind: 'whiteboard_r' },
    { gx: 9, gy: 3, kind: 'war_table' },
    { gx: 10, gy: 3, kind: 'war_table' },
    { gx: 8, gy: 3, kind: 'meeting_chair' },
    { gx: 9, gy: 4, kind: 'meeting_chair' },
    { gx: 10, gy: 4, kind: 'meeting_chair' },
    { gx: 11, gy: 3, kind: 'meeting_chair' },
    { gx: 11, gy: 2, kind: 'meeting_chair' },
    // Coding Left Wing (0..5, 5..12)
    { gx: 2, gy: 6, kind: 'dev_desk' },
    { gx: 2, gy: 7, kind: 'desk_chair' },
    { gx: 2, gy: 9, kind: 'dev_desk' },
    { gx: 2, gy: 10, kind: 'desk_chair' },
    { gx: 4, gy: 6, kind: 'dev_desk' },
    { gx: 4, gy: 7, kind: 'desk_chair' },
    // QA & Server Right Wing (10..15, 5..9)
    { gx: 12, gy: 5, kind: 'server_rack' },
    { gx: 13, gy: 5, kind: 'server_rack' },
    { gx: 11, gy: 7, kind: 'qa_desk' },
    { gx: 11, gy: 8, kind: 'desk_chair' },
    { gx: 13, gy: 7, kind: 'qa_desk' },
    { gx: 13, gy: 8, kind: 'desk_chair' },
    // Central Atrium Lounge & Console (6..9, 6..13)
    { gx: 6, gy: 7, kind: 'coffee_machine' },
    { gx: 9, gy: 7, kind: 'water_cooler' },
    { gx: 7, gy: 9, kind: 'tv_console' },
    { gx: 7, gy: 10, kind: 'gaming_seat' },
    { gx: 8, gy: 10, kind: 'gaming_seat' },
    { gx: 6, gy: 12, kind: 'sofa_l' },
    { gx: 7, gy: 12, kind: 'sofa_r' },
    { gx: 9, gy: 12, kind: 'armchair' },
    { gx: 7, gy: 11, kind: 'lounge_table' },
    { gx: 0, gy: 12, kind: 'office_plant' },
    { gx: 14, gy: 1, kind: 'office_plant' },
  ],
  getTileZone: (gx, gy) => {
    if (gx <= 5 && gy <= 4) return 'DESK_ARCHITECT';
    if (gx >= 6 && gy <= 4) return 'WAR_ROOM';
    if (gx <= 5 && gy >= 5) return 'DESK_CODING';
    if (gx >= 11 && gy >= 5 && gy <= 6) return 'SERVER_RACK';
    if (gx >= 10 && gy >= 7 && gy <= 9) return 'DESK_QA';
    return 'COFFEE_LOUNGE';
  },
  zoneSlots: {
    DESK_ARCHITECT: [
      { gx: 3, gy: 3, facing: 'NE' },
      { gx: 4, gy: 2, facing: 'NW' },
    ],
    DESK_CODING: [
      { gx: 2, gy: 7, facing: 'NE' },
      { gx: 2, gy: 10, facing: 'NE' },
      { gx: 4, gy: 7, facing: 'NE' },
      { gx: 4, gy: 10, facing: 'NE' },
    ],
    DESK_QA: [
      { gx: 11, gy: 8, facing: 'NE' },
      { gx: 13, gy: 8, facing: 'NE' },
    ],
    WAR_ROOM: [
      { gx: 8, gy: 3, facing: 'NE' },
      { gx: 9, gy: 4, facing: 'NW' },
      { gx: 10, gy: 4, facing: 'NW' },
      { gx: 11, gy: 3, facing: 'NW' },
      { gx: 11, gy: 2, facing: 'SW' },
    ],
    SERVER_RACK: [
      { gx: 12, gy: 6, facing: 'NE' },
      { gx: 13, gy: 6, facing: 'NE' },
    ],
    COFFEE_LOUNGE: [
      { gx: 6, gy: 8, facing: 'NE' },
      { gx: 6, gy: 12, facing: 'NE' },
      { gx: 7, gy: 12, facing: 'NE' },
      { gx: 9, gy: 12, facing: 'NW' },
    ],
  },
  presenterSlot: { gx: 9, gy: 2, facing: 'SE' },
  meetingChairSlots: [
    { gx: 8, gy: 3, facing: 'NE' },
    { gx: 9, gy: 4, facing: 'NW' },
    { gx: 10, gy: 4, facing: 'NW' },
    { gx: 11, gy: 3, facing: 'NW' },
    { gx: 11, gy: 2, facing: 'SW' },
  ],
  gamingSlots: [
    { gx: 7, gy: 10, facing: 'NE' },
    { gx: 8, gy: 10, facing: 'NW' },
  ],
  loungeSeatSlots: [
    { gx: 6, gy: 12, facing: 'NE' },
    { gx: 7, gy: 12, facing: 'NE' },
    { gx: 9, gy: 12, facing: 'NW' },
  ],
  coffeeSlots: [{ gx: 6, gy: 8, facing: 'NE' }],
  watercoolerSlots: [
    { gx: 9, gy: 8, facing: 'NE' },
    { gx: 8, gy: 7, facing: 'SE' },
  ],
  pizzaSlots: [
    { gx: 6, gy: 11, facing: 'SE' },
    { gx: 8, gy: 11, facing: 'SW' },
  ],
  propPositions: [
    { key: 'plants', kind: 'prop_plant', gx: 5.2, gy: 1.5 },
    { key: 'trophy', kind: 'prop_trophy', gx: 4.5, gy: 1.2 },
    { key: 'arcade', kind: 'prop_arcade', gx: 13.5, gy: 11.2 },
    { key: 'hologram', kind: 'prop_hologram', gx: 7.5, gy: 6.2 },
  ],
};

// Blueprint 4: Creative Rooftop Loft
const BLUEPRINT_4: Omit<FloorLayout, 'blueprintIndex' | 'themeIndex' | 'themePalette' | 'mascotKind'> = {
  furniture: [
    // Server Closet NW (0..5, 0..1)
    { gx: 1, gy: 1, kind: 'server_rack' },
    { gx: 2, gy: 1, kind: 'server_rack' },
    { gx: 3, gy: 1, kind: 'filing_cabinet' },
    // Presentation Stage West (0..5, 2..7)
    { gx: 2, gy: 3, kind: 'whiteboard_l' },
    { gx: 3, gy: 3, kind: 'whiteboard_r' },
    { gx: 2, gy: 5, kind: 'war_table' },
    { gx: 3, gy: 5, kind: 'war_table' },
    { gx: 1, gy: 5, kind: 'meeting_chair' },
    { gx: 2, gy: 6, kind: 'meeting_chair' },
    { gx: 3, gy: 6, kind: 'meeting_chair' },
    { gx: 4, gy: 5, kind: 'meeting_chair' },
    { gx: 4, gy: 4, kind: 'meeting_chair' },
    // Coding Studio NE (7..15, 0..6)
    { gx: 8, gy: 2, kind: 'dev_desk' },
    { gx: 8, gy: 3, kind: 'desk_chair' },
    { gx: 11, gy: 2, kind: 'dev_desk' },
    { gx: 11, gy: 3, kind: 'desk_chair' },
    { gx: 8, gy: 5, kind: 'qa_desk' },
    { gx: 8, gy: 6, kind: 'desk_chair' },
    { gx: 11, gy: 5, kind: 'qa_desk' },
    { gx: 11, gy: 6, kind: 'desk_chair' },
    { gx: 14, gy: 1, kind: 'bookshelf' },
    // Exec East (12..15, 7..10)
    { gx: 13, gy: 8, kind: 'exec_desk' },
    { gx: 13, gy: 9, kind: 'desk_chair' },
    // Wide Lounge, Pizza Bar & Console South (0..11, 8..13)
    { gx: 1, gy: 9, kind: 'coffee_machine' },
    { gx: 10, gy: 8, kind: 'water_cooler' },
    { gx: 8, gy: 10, kind: 'tv_console' },
    { gx: 7, gy: 11, kind: 'gaming_seat' },
    { gx: 8, gy: 11, kind: 'gaming_seat' },
    { gx: 2, gy: 12, kind: 'sofa_l' },
    { gx: 3, gy: 12, kind: 'sofa_r' },
    { gx: 1, gy: 11, kind: 'armchair' },
    { gx: 5, gy: 12, kind: 'armchair' },
    { gx: 3, gy: 11, kind: 'lounge_table' },
    { gx: 0, gy: 13, kind: 'office_plant' },
    { gx: 14, gy: 12, kind: 'office_plant' },
  ],
  getTileZone: (gx, gy) => {
    if (gx <= 5 && gy <= 1) return 'SERVER_RACK';
    if (gx <= 5 && gy >= 2 && gy <= 7) return 'WAR_ROOM';
    if (gx >= 7 && gy <= 3) return 'DESK_CODING';
    if (gx >= 7 && gy >= 4 && gy <= 6) return 'DESK_QA';
    if (gx >= 12 && gy >= 7 && gy <= 10) return 'DESK_ARCHITECT';
    return 'COFFEE_LOUNGE';
  },
  zoneSlots: {
    DESK_ARCHITECT: [
      { gx: 13, gy: 9, facing: 'NE' },
      { gx: 12, gy: 8, facing: 'SE' },
    ],
    DESK_CODING: [
      { gx: 8, gy: 3, facing: 'NE' },
      { gx: 11, gy: 3, facing: 'NE' },
      { gx: 9, gy: 2, facing: 'NW' },
      { gx: 12, gy: 2, facing: 'NW' },
    ],
    DESK_QA: [
      { gx: 8, gy: 6, facing: 'NE' },
      { gx: 11, gy: 6, facing: 'NE' },
    ],
    WAR_ROOM: [
      { gx: 1, gy: 5, facing: 'NE' },
      { gx: 2, gy: 6, facing: 'NW' },
      { gx: 3, gy: 6, facing: 'NW' },
      { gx: 4, gy: 5, facing: 'NW' },
      { gx: 4, gy: 4, facing: 'SW' },
    ],
    SERVER_RACK: [
      { gx: 1, gy: 2, facing: 'NE' },
      { gx: 2, gy: 2, facing: 'NE' },
    ],
    COFFEE_LOUNGE: [
      { gx: 1, gy: 10, facing: 'NE' },
      { gx: 2, gy: 12, facing: 'NE' },
      { gx: 3, gy: 12, facing: 'NE' },
      { gx: 1, gy: 11, facing: 'SE' },
      { gx: 5, gy: 12, facing: 'NW' },
    ],
  },
  presenterSlot: { gx: 2, gy: 4, facing: 'SE' },
  meetingChairSlots: [
    { gx: 1, gy: 5, facing: 'NE' },
    { gx: 2, gy: 6, facing: 'NW' },
    { gx: 3, gy: 6, facing: 'NW' },
    { gx: 4, gy: 5, facing: 'NW' },
    { gx: 4, gy: 4, facing: 'SW' },
  ],
  gamingSlots: [
    { gx: 7, gy: 11, facing: 'NE' },
    { gx: 8, gy: 11, facing: 'NW' },
  ],
  loungeSeatSlots: [
    { gx: 2, gy: 12, facing: 'NE' },
    { gx: 3, gy: 12, facing: 'NE' },
    { gx: 1, gy: 11, facing: 'SE' },
    { gx: 5, gy: 12, facing: 'NW' },
  ],
  coffeeSlots: [{ gx: 1, gy: 10, facing: 'NE' }],
  watercoolerSlots: [
    { gx: 10, gy: 9, facing: 'NE' },
    { gx: 9, gy: 8, facing: 'SE' },
  ],
  pizzaSlots: [
    { gx: 2, gy: 11, facing: 'SE' },
    { gx: 4, gy: 11, facing: 'SW' },
    { gx: 3, gy: 10, facing: 'SW' },
  ],
  propPositions: [
    { key: 'plants', kind: 'prop_plant', gx: 6.2, gy: 1.5 },
    { key: 'trophy', kind: 'prop_trophy', gx: 14.5, gy: 7.2 },
    { key: 'arcade', kind: 'prop_arcade', gx: 10.5, gy: 12.2 },
    { key: 'hologram', kind: 'prop_hologram', gx: 6.2, gy: 8.5 },
  ],
};

const BLUEPRINTS = [BLUEPRINT_0, BLUEPRINT_1, BLUEPRINT_2, BLUEPRINT_3, BLUEPRINT_4];
const MASCOTS: MascotKind[] = ['tabby_cat', 'tuxedo_cat', 'robo_vac'];

export function getFloorLayout(
  floorId: string,
  floorNumber: number,
  layoutSeed = 0,
): FloorLayout {
  const h = hashString(floorId);
  const blueprintIndex = Math.abs(h + floorNumber + layoutSeed) % 5;
  const themeIndex = Math.abs(h * 3 + floorNumber * 2 + layoutSeed * 2) % 5;
  const mascotKind = MASCOTS[Math.abs(h + floorNumber + layoutSeed) % MASCOTS.length];

  const bp = BLUEPRINTS[blueprintIndex];
  const themePalette = THEME_PALETTES[themeIndex];

  return {
    ...bp,
    blueprintIndex,
    themeIndex,
    themePalette,
    mascotKind,
  };
}
