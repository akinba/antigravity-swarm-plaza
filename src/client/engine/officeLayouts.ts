import type { OfficeZone } from '../../shared/types';
import { type Facing, type ZoneSlot } from './pathfinding';
import { hashString } from './pixelSprites';

export type MascotKind = 'none' | 'tabby_cat' | 'tuxedo_cat' | 'robo_vac' | 'office_dog';

export const ELEVATOR_SLOT: ZoneSlot = { gx: 0, gy: 6, facing: 'SE' };

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
  deskStyle: 'clover_desk' | 'single_desk' | 'bench_desk' | 'u_pod_desk' | 'twin_desk';
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

type BlueprintBase = Omit<
  FloorLayout,
  'blueprintIndex' | 'themeIndex' | 'themePalette' | 'mascotKind'
>;

// Blueprint 0: Classic Corner Studio (Clover 2x2 Quad Cluster + Aquarium, no roaming mascot)
const BLUEPRINT_0: BlueprintBase = {
  deskStyle: 'clover_desk',
  furniture: [
    { gx: 0, gy: 6, kind: 'elevator_doors' },
    // Exec NW (0..4, 0..4)
    { gx: 2, gy: 2, kind: 'exec_desk' },
    { gx: 2, gy: 3, kind: 'desk_chair' },
    { gx: 1, gy: 1, kind: 'bookshelf' },
    { gx: 4, gy: 1, kind: 'filing_cabinet' },
    { gx: 4, gy: 0, kind: 'wood_partition' },
    { gx: 4, gy: 2, kind: 'wood_partition' },
    { gx: 4, gy: 3, kind: 'wood_partition' },
    { gx: 1, gy: 4, kind: 'wood_partition_x' },
    { gx: 2, gy: 4, kind: 'wood_partition_x' },
    // War Room N (5..9, 0..4)
    { gx: 6, gy: 1, kind: 'whiteboard_l' },
    { gx: 7, gy: 1, kind: 'whiteboard_r' },
    { gx: 6, gy: 3, kind: 'war_table' },
    { gx: 7, gy: 3, kind: 'war_table' },
    { gx: 5, gy: 3, kind: 'meeting_chair' },
    { gx: 6, gy: 4, kind: 'meeting_chair' },
    { gx: 7, gy: 4, kind: 'meeting_chair' },
    { gx: 8, gy: 3, kind: 'meeting_chair' },
    { gx: 8, gy: 2, kind: 'meeting_chair' },
    { gx: 9, gy: 0, kind: 'glass_partition' },
    { gx: 9, gy: 1, kind: 'glass_partition' },
    { gx: 9, gy: 2, kind: 'glass_partition' },
    { gx: 9, gy: 3, kind: 'glass_partition' },
    // Server NE (10..15, 0..4)
    { gx: 10, gy: 4, kind: 'glass_partition_x' },
    { gx: 11, gy: 4, kind: 'glass_partition_x' },
    { gx: 12, gy: 4, kind: 'glass_partition_x' },
    { gx: 11, gy: 1, kind: 'server_rack' },
    { gx: 12, gy: 1, kind: 'server_rack' },
    { gx: 13, gy: 1, kind: 'server_rack' },
    { gx: 12, gy: 3, kind: 'qa_desk' },
    { gx: 14, gy: 1, kind: 'aquarium' },
    // Clover 2x2 Coding Cluster Center (3..6, 6..10) + QA Desks (9..10, 6..8)
    { gx: 4, gy: 6, kind: 'dev_desk' },
    { gx: 5, gy: 6, kind: 'dev_desk' },
    { gx: 4, gy: 7, kind: 'dev_desk' },
    { gx: 5, gy: 7, kind: 'dev_desk' },
    { gx: 3, gy: 6, kind: 'desk_chair' },
    { gx: 6, gy: 6, kind: 'desk_chair' },
    { gx: 3, gy: 7, kind: 'desk_chair' },
    { gx: 6, gy: 7, kind: 'desk_chair' },
    { gx: 9, gy: 6, kind: 'qa_desk' },
    { gx: 9, gy: 7, kind: 'desk_chair' },
    { gx: 11, gy: 6, kind: 'qa_desk' },
    { gx: 11, gy: 7, kind: 'desk_chair' },
    { gx: 14, gy: 5, kind: 'water_cooler' },
    // Lounge & Console SE (7..15, 9..13)
    { gx: 14, gy: 9, kind: 'coffee_machine' },
    { gx: 13, gy: 10, kind: 'tv_console' },
    { gx: 12, gy: 11, kind: 'gaming_seat' },
    { gx: 13, gy: 11, kind: 'gaming_seat' },
    { gx: 8, gy: 12, kind: 'sofa_l' },
    { gx: 9, gy: 12, kind: 'sofa_r' },
    { gx: 7, gy: 11, kind: 'armchair' },
    { gx: 10, gy: 11, kind: 'armchair' },
    { gx: 11, gy: 12, kind: 'armchair' },
    { gx: 14, gy: 12, kind: 'armchair' },
    { gx: 9, gy: 11, kind: 'lounge_table' },
    // SW Acoustic Phone Pod & Mini Reading Library (gx:0..4, gy:10..13)
    { gx: 0, gy: 10, kind: 'wood_partition_x' },
    { gx: 1, gy: 10, kind: 'wood_partition_x' },
    { gx: 4, gy: 11, kind: 'glass_partition' },
    { gx: 4, gy: 12, kind: 'glass_partition' },
    { gx: 0, gy: 11, kind: 'phone_booth' },
    { gx: 0, gy: 12, kind: 'office_plant' },
    { gx: 0, gy: 13, kind: 'bookshelf' },
    { gx: 1, gy: 12, kind: 'armchair' },
    { gx: 2, gy: 12, kind: 'library_table' },
    { gx: 3, gy: 12, kind: 'armchair' },
    { gx: 3, gy: 13, kind: 'bonsai' },
    // East Retro Arcade, Snack & Maker 3D-Print Nook (gx:13..15, gy:5..8)
    { gx: 15, gy: 5, kind: 'bonsai' },
    { gx: 13, gy: 7, kind: 'glass_partition' },
    { gx: 15, gy: 6, kind: '3d_printer' },
    { gx: 15, gy: 7, kind: 'arcade_cabinet' },
    { gx: 15, gy: 8, kind: 'snack_vending' },
  ],
  getTileZone: (gx, gy) => {
    if (gx <= 1 && gy >= 5 && gy <= 7) return 'ELEVATOR';
    if (gx <= 4 && gy <= 4) return 'DESK_ARCHITECT';
    if (gx >= 5 && gx <= 9 && gy <= 4) return 'WAR_ROOM';
    if (gx >= 10 && gy <= 4) return 'SERVER_RACK';
    if (gx <= 4 && gy >= 10) return 'COFFEE_LOUNGE';
    if (gx >= 7 && gy >= 9) return 'COFFEE_LOUNGE';
    if (gx <= 7 && gy >= 5) return 'DESK_CODING';
    if (gx >= 8 && gx <= 12 && gy >= 5 && gy <= 8) return 'DESK_QA';
    return 'COFFEE_LOUNGE';
  },
  zoneSlots: {
    ELEVATOR: [ELEVATOR_SLOT],
    DESK_ARCHITECT: [
      { gx: 2, gy: 3, facing: 'NE' },
      { gx: 3, gy: 2, facing: 'NW' },
    ],
    DESK_CODING: [
      { gx: 3, gy: 6, facing: 'SE' },
      { gx: 6, gy: 6, facing: 'NW' },
      { gx: 3, gy: 7, facing: 'SE' },
      { gx: 6, gy: 7, facing: 'NW' },
    ],
    DESK_QA: [
      { gx: 9, gy: 7, facing: 'NE' },
      { gx: 11, gy: 7, facing: 'NE' },
    ],
    WAR_ROOM: [
      { gx: 5, gy: 3, facing: 'SE' },
      { gx: 6, gy: 4, facing: 'NE' },
      { gx: 7, gy: 4, facing: 'NE' },
      { gx: 8, gy: 3, facing: 'NW' },
      { gx: 8, gy: 2, facing: 'SW' },
    ],
    SERVER_RACK: [
      { gx: 11, gy: 2, facing: 'NE' },
      { gx: 12, gy: 2, facing: 'NE' },
      { gx: 13, gy: 2, facing: 'NE' },
    ],
    COFFEE_LOUNGE: [
      { gx: 14, gy: 10, facing: 'NE' },
      { gx: 8, gy: 12, facing: 'NE' },
      { gx: 9, gy: 12, facing: 'NE' },
      { gx: 7, gy: 11, facing: 'SE' },
      { gx: 10, gy: 11, facing: 'NW' },
    ],
  },
  presenterSlot: { gx: 6, gy: 2, facing: 'SE' },
  meetingChairSlots: [
    { gx: 5, gy: 3, facing: 'SE' },
    { gx: 6, gy: 4, facing: 'NE' },
    { gx: 7, gy: 4, facing: 'NE' },
    { gx: 8, gy: 3, facing: 'NW' },
    { gx: 8, gy: 2, facing: 'SW' },
  ],
  gamingSlots: [
    { gx: 12, gy: 11, facing: 'SE' },
    { gx: 13, gy: 11, facing: 'NE' },
  ],
  loungeSeatSlots: [
    { gx: 8, gy: 12, facing: 'SE' },
    { gx: 9, gy: 12, facing: 'SW' },
    { gx: 7, gy: 11, facing: 'SE' },
    { gx: 10, gy: 11, facing: 'SW' },
    { gx: 11, gy: 12, facing: 'SE' },
    { gx: 14, gy: 12, facing: 'SW' },
  ],
  coffeeSlots: [{ gx: 14, gy: 10, facing: 'SW' }],
  watercoolerSlots: [
    { gx: 13, gy: 5, facing: 'SE' },
    { gx: 14, gy: 6, facing: 'SW' },
  ],
  pizzaSlots: [
    { gx: 8, gy: 11, facing: 'SE' },
    { gx: 10, gy: 12, facing: 'SW' },
    { gx: 9, gy: 10, facing: 'SW' },
  ],
  propPositions: [
    { key: 'plants', kind: 'prop_plant', gx: 0.4, gy: 4.2 },
    { key: 'trophy', kind: 'prop_trophy', gx: 4.1, gy: 1.2 },
    { key: 'arcade', kind: 'prop_arcade', gx: 12.4, gy: 9.2 },
    { key: 'hologram', kind: 'prop_hologram', gx: 6.2, gy: 11.2 },
  ],
};

// Blueprint 1: Central War-Room Hub (Single Spaced Desks + Tabby Cat)
const BLUEPRINT_1: BlueprintBase = {
  deskStyle: 'single_desk',
  furniture: [
    { gx: 0, gy: 6, kind: 'elevator_doors' },
    // Exec NE (11..15, 0..4)
    { gx: 13, gy: 2, kind: 'exec_desk' },
    { gx: 13, gy: 3, kind: 'desk_chair' },
    { gx: 12, gy: 1, kind: 'bookshelf' },
    { gx: 14, gy: 1, kind: 'filing_cabinet' },
    { gx: 11, gy: 0, kind: 'wood_partition' },
    { gx: 11, gy: 1, kind: 'wood_partition' },
    { gx: 11, gy: 2, kind: 'wood_partition' },
    // Server & QA North (3..10, 0..3)
    { gx: 4, gy: 0, kind: 'glass_partition' },
    { gx: 4, gy: 1, kind: 'glass_partition' },
    { gx: 7, gy: 0, kind: 'glass_partition' },
    { gx: 7, gy: 1, kind: 'glass_partition' },
    { gx: 5, gy: 1, kind: 'server_rack' },
    { gx: 6, gy: 1, kind: 'server_rack' },
    { gx: 8, gy: 1, kind: 'qa_desk' },
    { gx: 8, gy: 2, kind: 'desk_chair' },
    // Spaced Individual Coding Desks (2..4, 2..11) — leaving (0..1, 6..7) elevator foyer open
    { gx: 3, gy: 3, kind: 'dev_desk' },
    { gx: 3, gy: 4, kind: 'desk_chair' },
    { gx: 3, gy: 8, kind: 'dev_desk' },
    { gx: 3, gy: 9, kind: 'desk_chair' },
    { gx: 1, gy: 10, kind: 'dev_desk' },
    { gx: 1, gy: 11, kind: 'desk_chair' },
    { gx: 4, gy: 11, kind: 'qa_desk' },
    { gx: 4, gy: 12, kind: 'desk_chair' },
    // Central War-Room Hub (6..10, 4..8)
    { gx: 7, gy: 4, kind: 'whiteboard_l' },
    { gx: 8, gy: 4, kind: 'whiteboard_r' },
    { gx: 7, gy: 6, kind: 'war_table' },
    { gx: 8, gy: 6, kind: 'war_table' },
    { gx: 6, gy: 6, kind: 'meeting_chair' },
    { gx: 7, gy: 7, kind: 'meeting_chair' },
    { gx: 8, gy: 7, kind: 'meeting_chair' },
    { gx: 9, gy: 6, kind: 'meeting_chair' },
    { gx: 9, gy: 5, kind: 'meeting_chair' },
    { gx: 5, gy: 5, kind: 'glass_partition' },
    { gx: 5, gy: 6, kind: 'glass_partition' },
    { gx: 5, gy: 7, kind: 'glass_partition' },
    { gx: 10, gy: 4, kind: 'glass_partition' },
    { gx: 10, gy: 5, kind: 'glass_partition' },
    { gx: 10, gy: 6, kind: 'glass_partition' },
    // Skylight Lounge & Console South (5..15, 10..13)
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
    { gx: 14, gy: 5, kind: 'office_plant' },
    // NW Mini Library & Acoustic Call Nook (gx:0..3, gy:0..3)
    { gx: 0, gy: 0, kind: 'bookshelf' },
    { gx: 1, gy: 0, kind: 'phone_booth' },
    { gx: 3, gy: 0, kind: 'bonsai' },
    { gx: 0, gy: 2, kind: 'armchair' },
    { gx: 1, gy: 2, kind: 'library_table' },
    { gx: 2, gy: 2, kind: 'armchair' },
    { gx: 0, gy: 3, kind: 'wood_partition_x' },
    // East Corridor Retro Arcade, Snack & Quiet Pod Nook (gx:13..15, gy:5..9)
    { gx: 13, gy: 5, kind: 'glass_partition_x' },
    { gx: 13, gy: 6, kind: 'glass_partition' },
    { gx: 15, gy: 6, kind: 'arcade_cabinet' },
    { gx: 15, gy: 7, kind: 'snack_vending' },
    { gx: 14, gy: 8, kind: 'armchair' },
    { gx: 15, gy: 8, kind: 'phone_booth' },
    { gx: 15, gy: 9, kind: 'bonsai' },
    // SW Maker 3D-Print Micro-Lab (gx:0..3, gy:12..13)
    { gx: 0, gy: 12, kind: 'wood_partition_x' },
    { gx: 0, gy: 13, kind: 'office_plant' },
    { gx: 1, gy: 13, kind: '3d_printer' },
    { gx: 2, gy: 13, kind: 'armchair' },
    { gx: 3, gy: 13, kind: 'bonsai' },
  ],
  getTileZone: (gx, gy) => {
    if (gx <= 1 && gy >= 5 && gy <= 7) return 'ELEVATOR';
    if (gx >= 11 && gy <= 4) return 'DESK_ARCHITECT';
    if (gx >= 6 && gx <= 10 && gy >= 4 && gy <= 8) return 'WAR_ROOM';
    if (gx >= 4 && gx <= 7 && gy <= 3) return 'SERVER_RACK';
    if (gx >= 8 && gy <= 3) return 'DESK_QA';
    if (gx <= 3 && gy <= 2) return 'COFFEE_LOUNGE';
    if (gx >= 13 && gy >= 5 && gy <= 9) return 'COFFEE_LOUNGE';
    if (gx <= 2 && gy >= 12) return 'SERVER_RACK';
    if (gx >= 5 && gy >= 10) return 'COFFEE_LOUNGE';
    return 'DESK_CODING';
  },
  zoneSlots: {
    ELEVATOR: [ELEVATOR_SLOT],
    DESK_ARCHITECT: [
      { gx: 13, gy: 3, facing: 'NE' },
      { gx: 12, gy: 3, facing: 'SE' },
    ],
    DESK_CODING: [
      { gx: 3, gy: 4, facing: 'NE' },
      { gx: 3, gy: 9, facing: 'NE' },
      { gx: 1, gy: 11, facing: 'NE' },
      { gx: 2, gy: 3, facing: 'SE' },
    ],
    DESK_QA: [
      { gx: 8, gy: 2, facing: 'NE' },
      { gx: 4, gy: 12, facing: 'NE' },
    ],
    WAR_ROOM: [
      { gx: 6, gy: 6, facing: 'SE' },
      { gx: 7, gy: 7, facing: 'NE' },
      { gx: 8, gy: 7, facing: 'NE' },
      { gx: 9, gy: 6, facing: 'NW' },
      { gx: 9, gy: 5, facing: 'SW' },
    ],
    SERVER_RACK: [
      { gx: 5, gy: 2, facing: 'NE' },
      { gx: 6, gy: 2, facing: 'NE' },
    ],
    COFFEE_LOUNGE: [
      { gx: 14, gy: 11, facing: 'NE' },
      { gx: 6, gy: 12, facing: 'NE' },
      { gx: 7, gy: 12, facing: 'NE' },
      { gx: 5, gy: 11, facing: 'SE' },
      { gx: 8, gy: 11, facing: 'NW' },
      { gx: 10, gy: 12, facing: 'NW' },
    ],
  },
  presenterSlot: { gx: 7, gy: 5, facing: 'SE' },
  meetingChairSlots: [
    { gx: 6, gy: 6, facing: 'SE' },
    { gx: 7, gy: 7, facing: 'NE' },
    { gx: 8, gy: 7, facing: 'NE' },
    { gx: 9, gy: 6, facing: 'NW' },
    { gx: 9, gy: 5, facing: 'SW' },
  ],
  gamingSlots: [
    { gx: 12, gy: 12, facing: 'SE' },
    { gx: 13, gy: 12, facing: 'NE' },
  ],
  loungeSeatSlots: [
    { gx: 6, gy: 12, facing: 'SE' },
    { gx: 7, gy: 12, facing: 'SW' },
    { gx: 5, gy: 11, facing: 'SE' },
    { gx: 8, gy: 11, facing: 'SW' },
    { gx: 10, gy: 12, facing: 'SW' },
  ],
  coffeeSlots: [{ gx: 14, gy: 11, facing: 'SW' }],
  watercoolerSlots: [
    { gx: 11, gy: 9, facing: 'SE' },
    { gx: 12, gy: 10, facing: 'SW' },
  ],
  pizzaSlots: [
    { gx: 6, gy: 11, facing: 'SE' },
    { gx: 8, gy: 12, facing: 'SW' },
    { gx: 7, gy: 10, facing: 'SW' },
  ],
  propPositions: [
    { key: 'plants', kind: 'prop_plant', gx: 10.2, gy: 1.5 },
    { key: 'trophy', kind: 'prop_trophy', gx: 11.4, gy: 3.5 },
    { key: 'arcade', kind: 'prop_arcade', gx: 4.8, gy: 12.2 },
    { key: 'hologram', kind: 'prop_hologram', gx: 10.5, gy: 7.5 },
  ],
};

// Blueprint 2: Open L-Wing Lab (Long Startup Bench Row + Ping Pong + Robo Vac)
const BLUEPRINT_2: BlueprintBase = {
  deskStyle: 'bench_desk',
  furniture: [
    { gx: 0, gy: 6, kind: 'elevator_doors' },
    // Lounge & Console NW (0..6, 0..4)
    { gx: 1, gy: 1, kind: 'coffee_machine' },
    { gx: 5, gy: 1, kind: 'water_cooler' },
    { gx: 2, gy: 1, kind: 'tv_console' },
    { gx: 2, gy: 2, kind: 'gaming_seat' },
    { gx: 3, gy: 2, kind: 'gaming_seat' },
    { gx: 1, gy: 4, kind: 'sofa_l' },
    { gx: 2, gy: 4, kind: 'sofa_r' },
    { gx: 4, gy: 4, kind: 'armchair' },
    { gx: 2, gy: 3, kind: 'lounge_table' },
    { gx: 6, gy: 1, kind: 'ping_pong' },
    // Exec SW (0..4, 9..13)
    { gx: 2, gy: 11, kind: 'exec_desk' },
    { gx: 2, gy: 12, kind: 'desk_chair' },
    { gx: 1, gy: 10, kind: 'bookshelf' },
    { gx: 4, gy: 10, kind: 'filing_cabinet' },
    { gx: 4, gy: 11, kind: 'wood_partition' },
    { gx: 4, gy: 12, kind: 'wood_partition' },
    { gx: 4, gy: 13, kind: 'wood_partition' },
    { gx: 1, gy: 9, kind: 'wood_partition_x' },
    { gx: 2, gy: 9, kind: 'wood_partition_x' },
    // Server & QA East (11..15, 1..7)
    { gx: 10, gy: 0, kind: 'glass_partition' },
    { gx: 10, gy: 1, kind: 'glass_partition' },
    { gx: 10, gy: 2, kind: 'glass_partition' },
    { gx: 11, gy: 3, kind: 'glass_partition_x' },
    { gx: 12, gy: 3, kind: 'glass_partition_x' },
    { gx: 13, gy: 3, kind: 'glass_partition_x' },
    { gx: 12, gy: 1, kind: 'server_rack' },
    { gx: 13, gy: 1, kind: 'server_rack' },
    { gx: 12, gy: 4, kind: 'qa_desk' },
    { gx: 12, gy: 5, kind: 'desk_chair' },
    { gx: 12, gy: 6, kind: 'qa_desk' },
    { gx: 12, gy: 7, kind: 'desk_chair' },
    // Long Startup Bench Row Center (5..8, 6..7)
    { gx: 5, gy: 6, kind: 'dev_desk' },
    { gx: 6, gy: 6, kind: 'dev_desk' },
    { gx: 7, gy: 6, kind: 'dev_desk' },
    { gx: 8, gy: 6, kind: 'dev_desk' },
    { gx: 5, gy: 7, kind: 'desk_chair' },
    { gx: 6, gy: 7, kind: 'desk_chair' },
    { gx: 7, gy: 7, kind: 'desk_chair' },
    { gx: 8, gy: 7, kind: 'desk_chair' },
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
    { gx: 9, gy: 10, kind: 'glass_partition' },
    { gx: 9, gy: 11, kind: 'glass_partition' },
    { gx: 9, gy: 12, kind: 'glass_partition' },
    { gx: 9, gy: 13, kind: 'glass_partition' },
    { gx: 10, gy: 8, kind: 'glass_partition_x' },
    { gx: 11, gy: 8, kind: 'glass_partition_x' },
    { gx: 12, gy: 8, kind: 'glass_partition_x' },
    { gx: 13, gy: 8, kind: 'glass_partition_x' },
    { gx: 14, gy: 2, kind: 'office_plant' },
    // East Corridor Acoustic Phone Pod & Retro Arcade/Snack Nook (gx:13..15, gy:5..8)
    { gx: 13, gy: 6, kind: 'glass_partition' },
    { gx: 15, gy: 5, kind: 'phone_booth' },
    { gx: 14, gy: 6, kind: 'armchair' },
    { gx: 15, gy: 6, kind: 'snack_vending' },
    { gx: 15, gy: 7, kind: 'arcade_cabinet' },
    { gx: 15, gy: 8, kind: 'bonsai' },
    // Mid-South Reading Library & Maker 3D-Print Studio (gx:5..8, gy:11..13)
    { gx: 5, gy: 11, kind: 'glass_partition_x' },
    { gx: 8, gy: 11, kind: 'glass_partition_x' },
    { gx: 5, gy: 12, kind: 'armchair' },
    { gx: 6, gy: 12, kind: 'library_table' },
    { gx: 7, gy: 12, kind: 'armchair' },
    { gx: 8, gy: 12, kind: 'office_plant' },
    { gx: 5, gy: 13, kind: 'bookshelf' },
    { gx: 8, gy: 13, kind: '3d_printer' },
  ],
  getTileZone: (gx, gy) => {
    if (gx <= 1 && gy >= 5 && gy <= 7) return 'ELEVATOR';
    if (gx <= 6 && gy <= 4) return 'COFFEE_LOUNGE';
    if (gx <= 4 && gy >= 9) return 'DESK_ARCHITECT';
    if (gx >= 11 && gy <= 3) return 'SERVER_RACK';
    if (gx >= 14 && gy >= 4 && gy <= 7) return 'COFFEE_LOUNGE';
    if (gx >= 11 && gy >= 4 && gy <= 7) return 'DESK_QA';
    if (gx >= 9 && gy >= 8) return 'WAR_ROOM';
    if (gx >= 5 && gx <= 8 && gy >= 11) return 'COFFEE_LOUNGE';
    return 'DESK_CODING';
  },
  zoneSlots: {
    ELEVATOR: [ELEVATOR_SLOT],
    DESK_ARCHITECT: [
      { gx: 2, gy: 12, facing: 'NE' },
      { gx: 3, gy: 11, facing: 'NW' },
    ],
    DESK_CODING: [
      { gx: 5, gy: 7, facing: 'NE' },
      { gx: 6, gy: 7, facing: 'NE' },
      { gx: 7, gy: 7, facing: 'NE' },
      { gx: 8, gy: 7, facing: 'NE' },
    ],
    DESK_QA: [
      { gx: 12, gy: 5, facing: 'NE' },
      { gx: 12, gy: 7, facing: 'NE' },
    ],
    WAR_ROOM: [
      { gx: 10, gy: 11, facing: 'SE' },
      { gx: 11, gy: 12, facing: 'NE' },
      { gx: 12, gy: 12, facing: 'NE' },
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
    { gx: 10, gy: 11, facing: 'SE' },
    { gx: 11, gy: 12, facing: 'NE' },
    { gx: 12, gy: 12, facing: 'NE' },
    { gx: 13, gy: 11, facing: 'NW' },
    { gx: 13, gy: 10, facing: 'SW' },
  ],
  gamingSlots: [
    { gx: 2, gy: 2, facing: 'NE' },
    { gx: 3, gy: 2, facing: 'NW' },
  ],
  loungeSeatSlots: [
    { gx: 1, gy: 4, facing: 'SE' },
    { gx: 2, gy: 4, facing: 'SW' },
    { gx: 4, gy: 4, facing: 'SW' },
  ],
  coffeeSlots: [{ gx: 1, gy: 2, facing: 'SE' }],
  watercoolerSlots: [
    { gx: 5, gy: 2, facing: 'SE' },
    { gx: 4, gy: 1, facing: 'SW' },
  ],
  pizzaSlots: [
    { gx: 1, gy: 3, facing: 'SE' },
    { gx: 3, gy: 3, facing: 'SW' },
  ],
  propPositions: [
    { key: 'plants', kind: 'prop_plant', gx: 5.5, gy: 2.5 },
    { key: 'trophy', kind: 'prop_trophy', gx: 3.5, gy: 10.2 },
    { key: 'arcade', kind: 'prop_arcade', gx: 0.5, gy: 9.2 },
    { key: 'hologram', kind: 'prop_hologram', gx: 7.5, gy: 9.5 },
  ],
};

// Blueprint 3: Twin-Wing Corporate (U-Shaped Team Pod + Office Dog)
const BLUEPRINT_3: BlueprintBase = {
  deskStyle: 'u_pod_desk',
  furniture: [
    { gx: 0, gy: 6, kind: 'elevator_doors' },
    // Exec & Presentation Boardroom North (2..13, 0..4)
    { gx: 3, gy: 2, kind: 'exec_desk' },
    { gx: 3, gy: 3, kind: 'desk_chair' },
    { gx: 1, gy: 1, kind: 'bookshelf' },
    { gx: 2, gy: 1, kind: 'filing_cabinet' },
    { gx: 6, gy: 0, kind: 'glass_partition' },
    { gx: 6, gy: 1, kind: 'glass_partition' },
    { gx: 6, gy: 2, kind: 'glass_partition' },
    { gx: 6, gy: 3, kind: 'glass_partition' },
    { gx: 1, gy: 4, kind: 'wood_partition_x' },
    { gx: 2, gy: 4, kind: 'wood_partition_x' },
    { gx: 3, gy: 4, kind: 'wood_partition_x' },
    { gx: 7, gy: 5, kind: 'glass_partition_x' },
    { gx: 8, gy: 5, kind: 'glass_partition_x' },
    { gx: 9, gy: 5, kind: 'glass_partition_x' },
    { gx: 10, gy: 5, kind: 'glass_partition' },
    { gx: 10, gy: 6, kind: 'glass_partition' },
    { gx: 9, gy: 1, kind: 'whiteboard_l' },
    { gx: 10, gy: 1, kind: 'whiteboard_r' },
    { gx: 9, gy: 3, kind: 'war_table' },
    { gx: 10, gy: 3, kind: 'war_table' },
    { gx: 8, gy: 3, kind: 'meeting_chair' },
    { gx: 9, gy: 4, kind: 'meeting_chair' },
    { gx: 10, gy: 4, kind: 'meeting_chair' },
    { gx: 11, gy: 3, kind: 'meeting_chair' },
    { gx: 11, gy: 2, kind: 'meeting_chair' },
    // U-Pod Coding Left Wing (2..5, 8..11) — keeping (0..2, 6..7) open
    { gx: 3, gy: 8, kind: 'dev_desk' },
    { gx: 4, gy: 8, kind: 'dev_desk' },
    { gx: 3, gy: 10, kind: 'dev_desk' },
    { gx: 4, gy: 10, kind: 'dev_desk' },
    { gx: 2, gy: 9, kind: 'desk_chair' },
    { gx: 3, gy: 9, kind: 'desk_chair' },
    { gx: 4, gy: 9, kind: 'desk_chair' },
    { gx: 5, gy: 9, kind: 'desk_chair' },
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
    // NE Acoustic Dual Phone Pod Suite (gx:12..15, gy:0..2)
    { gx: 12, gy: 0, kind: 'wood_partition' },
    { gx: 12, gy: 1, kind: 'wood_partition' },
    { gx: 13, gy: 0, kind: 'phone_booth' },
    { gx: 15, gy: 0, kind: 'phone_booth' },
    { gx: 14, gy: 2, kind: 'bonsai' },
    { gx: 15, gy: 2, kind: 'armchair' },
    // SW Mini Library & Reading Nook (gx:0..3, gy:11..13)
    { gx: 0, gy: 11, kind: 'wood_partition_x' },
    { gx: 1, gy: 12, kind: 'armchair' },
    { gx: 2, gy: 12, kind: 'library_table' },
    { gx: 3, gy: 12, kind: 'armchair' },
    { gx: 0, gy: 13, kind: 'bookshelf' },
    { gx: 3, gy: 13, kind: 'wood_partition' },
    // SE Retro Arcade, Snack & Maker 3D-Print Corner (gx:11..15, gy:11..13)
    { gx: 11, gy: 11, kind: 'glass_partition' },
    { gx: 11, gy: 12, kind: 'glass_partition' },
    { gx: 13, gy: 11, kind: 'glass_partition_x' },
    { gx: 14, gy: 11, kind: 'glass_partition_x' },
    { gx: 12, gy: 12, kind: 'armchair' },
    { gx: 15, gy: 12, kind: 'arcade_cabinet' },
    { gx: 13, gy: 13, kind: '3d_printer' },
    { gx: 14, gy: 13, kind: 'snack_vending' },
    { gx: 15, gy: 13, kind: 'bonsai' },
  ],
  getTileZone: (gx, gy) => {
    if (gx <= 1 && gy >= 5 && gy <= 7) return 'ELEVATOR';
    if (gx <= 5 && gy <= 4) return 'DESK_ARCHITECT';
    if (gx >= 12 && gy <= 2) return 'DESK_ARCHITECT';
    if (gx >= 6 && gy <= 4) return 'WAR_ROOM';
    if (gx <= 3 && gy >= 11) return 'COFFEE_LOUNGE';
    if (gx <= 5 && gy >= 5) return 'DESK_CODING';
    if (gx >= 11 && gy >= 5 && gy <= 6) return 'SERVER_RACK';
    if (gx >= 10 && gy >= 7 && gy <= 9) return 'DESK_QA';
    return 'COFFEE_LOUNGE';
  },
  zoneSlots: {
    ELEVATOR: [ELEVATOR_SLOT],
    DESK_ARCHITECT: [
      { gx: 3, gy: 3, facing: 'NE' },
      { gx: 4, gy: 2, facing: 'NW' },
    ],
    DESK_CODING: [
      { gx: 2, gy: 9, facing: 'SE' },
      { gx: 3, gy: 9, facing: 'NE' },
      { gx: 4, gy: 9, facing: 'NE' },
      { gx: 5, gy: 9, facing: 'NW' },
    ],
    DESK_QA: [
      { gx: 11, gy: 8, facing: 'NE' },
      { gx: 13, gy: 8, facing: 'NE' },
    ],
    WAR_ROOM: [
      { gx: 8, gy: 3, facing: 'SE' },
      { gx: 9, gy: 4, facing: 'NE' },
      { gx: 10, gy: 4, facing: 'NE' },
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
    { gx: 8, gy: 3, facing: 'SE' },
    { gx: 9, gy: 4, facing: 'NE' },
    { gx: 10, gy: 4, facing: 'NE' },
    { gx: 11, gy: 3, facing: 'NW' },
    { gx: 11, gy: 2, facing: 'SW' },
  ],
  gamingSlots: [
    { gx: 7, gy: 10, facing: 'NE' },
    { gx: 8, gy: 10, facing: 'NW' },
  ],
  loungeSeatSlots: [
    { gx: 6, gy: 12, facing: 'SE' },
    { gx: 7, gy: 12, facing: 'SW' },
    { gx: 9, gy: 12, facing: 'SW' },
  ],
  coffeeSlots: [{ gx: 6, gy: 8, facing: 'SE' }],
  watercoolerSlots: [
    { gx: 9, gy: 8, facing: 'SE' },
    { gx: 8, gy: 7, facing: 'SW' },
  ],
  pizzaSlots: [
    { gx: 6, gy: 11, facing: 'SE' },
    { gx: 8, gy: 11, facing: 'SW' },
  ],
  propPositions: [
    { key: 'plants', kind: 'prop_plant', gx: 5.2, gy: 1.5 },
    { key: 'trophy', kind: 'prop_trophy', gx: 4.5, gy: 1.2 },
    { key: 'arcade', kind: 'prop_arcade', gx: 10.4, gy: 10.2 },
    { key: 'hologram', kind: 'prop_hologram', gx: 7.5, gy: 6.2 },
  ],
};

// Blueprint 4: Creative Rooftop Loft (Paired Duo Twin Desks + Aquarium + Bonsai + Tuxedo Cat)
const BLUEPRINT_4: BlueprintBase = {
  deskStyle: 'twin_desk',
  furniture: [
    { gx: 0, gy: 6, kind: 'elevator_doors' },
    // Server Closet NW (0..5, 0..1)
    { gx: 1, gy: 1, kind: 'server_rack' },
    { gx: 2, gy: 1, kind: 'server_rack' },
    { gx: 3, gy: 1, kind: 'filing_cabinet' },
    // Presentation Stage West (1..5, 2..6) — keeping (0..1, 6..7) elevator foyer open
    { gx: 3, gy: 2, kind: 'whiteboard_l' },
    { gx: 4, gy: 2, kind: 'whiteboard_r' },
    { gx: 3, gy: 4, kind: 'war_table' },
    { gx: 4, gy: 4, kind: 'war_table' },
    { gx: 2, gy: 4, kind: 'meeting_chair' },
    { gx: 3, gy: 5, kind: 'meeting_chair' },
    { gx: 4, gy: 5, kind: 'meeting_chair' },
    { gx: 5, gy: 4, kind: 'meeting_chair' },
    { gx: 5, gy: 3, kind: 'meeting_chair' },
    { gx: 6, gy: 2, kind: 'glass_partition' },
    { gx: 6, gy: 3, kind: 'glass_partition' },
    { gx: 6, gy: 4, kind: 'glass_partition' },
    { gx: 6, gy: 5, kind: 'glass_partition' },
    { gx: 5, gy: 0, kind: 'glass_partition' },
    { gx: 5, gy: 1, kind: 'glass_partition' },
    // Paired Duo Twin Desks NE (8..15, 0..6)
    { gx: 8, gy: 2, kind: 'dev_desk' },
    { gx: 9, gy: 2, kind: 'dev_desk' },
    { gx: 8, gy: 3, kind: 'desk_chair' },
    { gx: 9, gy: 3, kind: 'desk_chair' },
    { gx: 12, gy: 2, kind: 'dev_desk' },
    { gx: 13, gy: 2, kind: 'dev_desk' },
    { gx: 12, gy: 3, kind: 'desk_chair' },
    { gx: 13, gy: 3, kind: 'desk_chair' },
    { gx: 8, gy: 5, kind: 'qa_desk' },
    { gx: 8, gy: 6, kind: 'desk_chair' },
    { gx: 11, gy: 5, kind: 'qa_desk' },
    { gx: 11, gy: 6, kind: 'desk_chair' },
    { gx: 14, gy: 1, kind: 'bookshelf' },
    // Exec East (12..15, 7..10)
    { gx: 11, gy: 8, kind: 'wood_partition' },
    { gx: 11, gy: 9, kind: 'wood_partition' },
    { gx: 11, gy: 10, kind: 'wood_partition' },
    { gx: 12, gy: 7, kind: 'wood_partition_x' },
    { gx: 13, gy: 7, kind: 'wood_partition_x' },
    { gx: 13, gy: 8, kind: 'exec_desk' },
    { gx: 13, gy: 9, kind: 'desk_chair' },
    { gx: 14, gy: 8, kind: 'bonsai' },
    // Wide Lounge, Aquarium, Pizza Bar & Console South (0..11, 8..13)
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
    { gx: 6, gy: 9, kind: 'aquarium' },
    { gx: 14, gy: 12, kind: 'office_plant' },
    // Mid-South Reading Library & Retro Arcade/Snack Nook (gx:5..9, gy:12..13)
    { gx: 6, gy: 12, kind: 'library_table' },
    { gx: 5, gy: 13, kind: 'bookshelf' },
    { gx: 8, gy: 12, kind: 'armchair' },
    { gx: 9, gy: 12, kind: 'glass_partition' },
    { gx: 8, gy: 13, kind: 'arcade_cabinet' },
    { gx: 9, gy: 13, kind: 'snack_vending' },
    // SE Maker 3D-Print Lab & Acoustic Phone Pod Suite (gx:11..15, gy:11..13)
    { gx: 11, gy: 11, kind: 'glass_partition_x' },
    { gx: 12, gy: 11, kind: 'glass_partition_x' },
    { gx: 15, gy: 11, kind: 'wood_partition_x' },
    { gx: 12, gy: 12, kind: 'armchair' },
    { gx: 11, gy: 13, kind: 'phone_booth' },
    { gx: 13, gy: 13, kind: '3d_printer' },
    { gx: 15, gy: 13, kind: 'bookshelf' },
  ],
  getTileZone: (gx, gy) => {
    if (gx <= 1 && gy >= 5 && gy <= 7) return 'ELEVATOR';
    if (gx <= 5 && gy <= 1) return 'SERVER_RACK';
    if (gx <= 6 && gy >= 2 && gy <= 6) return 'WAR_ROOM';
    if (gx >= 7 && gy <= 3) return 'DESK_CODING';
    if (gx >= 7 && gy >= 4 && gy <= 6) return 'DESK_QA';
    if (gx >= 12 && gy >= 7 && gy <= 10) return 'DESK_ARCHITECT';
    return 'COFFEE_LOUNGE';
  },
  zoneSlots: {
    ELEVATOR: [ELEVATOR_SLOT],
    DESK_ARCHITECT: [
      { gx: 13, gy: 9, facing: 'NE' },
      { gx: 12, gy: 8, facing: 'SE' },
    ],
    DESK_CODING: [
      { gx: 8, gy: 3, facing: 'NE' },
      { gx: 9, gy: 3, facing: 'NE' },
      { gx: 12, gy: 3, facing: 'NE' },
      { gx: 13, gy: 3, facing: 'NE' },
    ],
    DESK_QA: [
      { gx: 8, gy: 6, facing: 'NE' },
      { gx: 11, gy: 6, facing: 'NE' },
    ],
    WAR_ROOM: [
      { gx: 2, gy: 4, facing: 'SE' },
      { gx: 3, gy: 5, facing: 'NE' },
      { gx: 4, gy: 5, facing: 'NE' },
      { gx: 5, gy: 4, facing: 'NW' },
      { gx: 5, gy: 3, facing: 'SW' },
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
  presenterSlot: { gx: 3, gy: 3, facing: 'SE' },
  meetingChairSlots: [
    { gx: 2, gy: 4, facing: 'SE' },
    { gx: 3, gy: 5, facing: 'NE' },
    { gx: 4, gy: 5, facing: 'NE' },
    { gx: 5, gy: 4, facing: 'NW' },
    { gx: 5, gy: 3, facing: 'SW' },
  ],
  gamingSlots: [
    { gx: 7, gy: 11, facing: 'SE' },
    { gx: 8, gy: 11, facing: 'NE' },
  ],
  loungeSeatSlots: [
    { gx: 2, gy: 12, facing: 'SE' },
    { gx: 3, gy: 12, facing: 'SW' },
    { gx: 1, gy: 11, facing: 'SE' },
    { gx: 5, gy: 12, facing: 'SW' },
  ],
  coffeeSlots: [{ gx: 1, gy: 10, facing: 'SE' }],
  watercoolerSlots: [
    { gx: 10, gy: 9, facing: 'SE' },
    { gx: 9, gy: 8, facing: 'SW' },
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
const MASCOTS: MascotKind[] = ['none', 'tabby_cat', 'robo_vac', 'office_dog', 'tuxedo_cat'];

export function getFloorLayout(
  floorId: string,
  floorNumber: number,
  layoutSeed = 0,
): FloorLayout {
  const h = hashString(floorId);
  const blueprintIndex = Math.abs(h + floorNumber + layoutSeed) % 5;
  const themeIndex = Math.abs(h * 3 + floorNumber * 2 + layoutSeed * 2) % 5;
  const mascotKind = MASCOTS[blueprintIndex];

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
