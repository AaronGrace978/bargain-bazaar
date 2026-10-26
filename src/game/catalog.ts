import type { Artifact, MerchantState } from './types.js';

export const ARTIFACTS: readonly Artifact[] = [
  {
    id: 'moonglass',
    name: 'Moonglass Teapot',
    fairValue: 120,
    buyerValue: 176,
    blurb: 'Holds a night of rain and never clouds.',
    form: 'teapot',
  },
  {
    id: 'ember-silk',
    name: 'Ember Silk Bolt',
    fairValue: 86,
    buyerValue: 128,
    blurb: 'Woven where the lanterns run hottest.',
    form: 'silk',
  },
  {
    id: 'astrolabe',
    name: 'Star-Chart Astrolabe',
    fairValue: 210,
    buyerValue: 304,
    blurb: 'Points at a sky this market has never seen.',
    form: 'astrolabe',
  },
  {
    id: 'cage',
    name: 'Nightingale Cage',
    fairValue: 94,
    buyerValue: 138,
    blurb: 'Empty, and still singing in the brass.',
    form: 'cage',
  },
  {
    id: 'pearl',
    name: 'Salt-Lantern Pearl',
    fairValue: 150,
    buyerValue: 218,
    blurb: 'A tide-light you can bargain by.',
    form: 'pearl',
  },
];

export function createRoster(): MerchantState[] {
  return [
    {
      id: 'mei',
      name: 'Mei Lantern',
      strategy: 'stock-pressure',
      epithet: 'Stock Pressure',
      tells: 'Her hidden floor falls the longer a piece sits unsold.',
      robe: '#8d2e32',
      accent: '#ffb15a',
      baseFloorRatio: 0.62,
      stockPressure: 0.2,
      temper: 0.92,
      insultCount: 0,
      askRatio: 1.25,
      memoryMarkup: 0,
    },
    {
      id: 'calder',
      name: 'Calder Voss',
      strategy: 'floor-hawk',
      epithet: 'Floor Hawk',
      tells: 'A high floor. Two insults and he leaves. Concessions are tiny.',
      robe: '#243044',
      accent: '#e4d2a4',
      baseFloorRatio: 0.9,
      stockPressure: 0,
      temper: 0.7,
      insultCount: 0,
      askRatio: 1.58,
      memoryMarkup: 0,
    },
    {
      id: 'quill',
      name: 'Quill Vesper',
      strategy: 'walkaway-temper',
      epithet: 'Walk-away Temper',
      tells: 'A dramatic cut, then a freeze. Push once more and she is gone.',
      robe: '#5a1438',
      accent: '#ff4d6d',
      baseFloorRatio: 0.74,
      stockPressure: 0,
      temper: 0.86,
      insultCount: 0,
      askRatio: 1.36,
      memoryMarkup: 0,
    },
  ];
}

export const SHIFT_SECONDS = 10 * 60;
