import type { ObservedDeal, SpiritStyle } from './types.js';

export const LEARNING_ALPHA = 0.55;

export function createSpirit(): SpiritStyle {
  return {
    dealsSeen: 0,
    openingRatio: 0.8,
    concessionPerRound: 0.06,
    patienceRounds: 4,
    walkawayBias: 0.12,
    targetJain: 0.94,
    lowestRatio: 0.8,
  };
}

export function spiritOpeningPrice(spirit: SpiritStyle, ask: number): number {
  return Math.max(1, Math.round(ask * spirit.openingRatio));
}

function ema(previous: number, sample: number, alpha = LEARNING_ALPHA): number {
  return previous * (1 - alpha) + sample * alpha;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function averageConcession(ratios: readonly number[]): number {
  if (ratios.length < 2) return 0.06;
  let total = 0;
  for (let index = 1; index < ratios.length; index += 1) {
    total += Math.abs(ratios[index] - ratios[index - 1]);
  }
  return total / (ratios.length - 1);
}

/**
 * Behavioral cloning by exponential moving average.
 * One deal is enough to move the bars. The spirit copies opening ratio,
 * concession size, patience, and whether you walked. A referee veto
 * still copies the aggression, and it also lifts the fairness target.
 */
export function observeDeal(spirit: SpiritStyle, deal: ObservedDeal): SpiritStyle {
  const ratios = deal.offerRatios.length > 0 ? deal.offerRatios : [deal.openingRatio];
  const opening = clamp(deal.openingRatio, 0.3, 1.2);
  const walked = deal.walkedAway || deal.merchantLeft ? 1 : 0;
  const targetSample = deal.vetoed
    ? Math.max(spirit.targetJain, 0.97)
    : deal.sealed
      ? deal.jain
      : spirit.targetJain;

  return {
    dealsSeen: spirit.dealsSeen + 1,
    openingRatio: clamp(ema(spirit.openingRatio, opening), 0.35, 1.05),
    concessionPerRound: clamp(
      ema(spirit.concessionPerRound, averageConcession(ratios)),
      0.02,
      0.35,
    ),
    patienceRounds: clamp(ema(spirit.patienceRounds, Math.max(1, deal.rounds)), 1, 8),
    walkawayBias: clamp(ema(spirit.walkawayBias, walked), 0, 1),
    targetJain: clamp(ema(spirit.targetJain, targetSample), 0.7, 0.99),
    lowestRatio: clamp(ema(spirit.lowestRatio, deal.lowestRatio), 0.3, 1.2),
  };
}

export function spiritDelta(before: SpiritStyle, after: SpiritStyle): string {
  const change = after.openingRatio - before.openingRatio;
  const direction = change < -0.008 ? 'sharper' : change > 0.008 ? 'softer' : 'steady';
  return `Opening ${before.openingRatio.toFixed(2)} -> ${after.openingRatio.toFixed(2)} (${direction}). Deals studied: ${after.dealsSeen}.`;
}
