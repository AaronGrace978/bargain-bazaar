/**
 * Referee fairness.
 *
 * The index itself is Jain's fairness index, in the form skyline-consensus
 * already proved out on neighborhood utilities:
 *
 *   J = (sum u_i)^2 / (n * sum u_i^2)
 *
 * skyline-consensus clamps each utility into a positive band [15, 100] before
 * the ratio, so a starved party is not encoded as a hard zero. Bargain Bazaar
 * reimplements that math for a two-person surplus split. It does not reuse the
 * aviation noise model. See AaronGrace978/skyline-consensus
 * backend/engine/acousticsAndPhysics.js for the reference ratio only.
 */

import type { FairnessScore } from './types.js';

/** Same positive band skyline-consensus uses before the index. */
export const UTILITY_FLOOR = 15;
export const UTILITY_CEILING = 100;

/**
 * Seller share of the bargaining zone below this is an exploitative lowball.
 * With the 15..100 map, that split lands near Jain 0.82.
 */
export const LOW_BALL_SELLER_SHARE = 0.18;
export const LOW_BALL_JAIN = 0.82;

export function jainIndex(values: readonly number[]): number {
  const count = values.length;
  if (count === 0) return 1;
  let sum = 0;
  let sumSquares = 0;
  for (const value of values) {
    sum += value;
    sumSquares += value * value;
  }
  if (sumSquares <= 0) return 1;
  return (sum * sum) / (count * sumSquares);
}

/** Match skyline-consensus, which publishes the index to 4 decimal places. */
export function jainIndexRounded(values: readonly number[]): number {
  return Number(jainIndex(values).toFixed(4));
}

export function surplusUtility(share: number): number {
  const clamped = Math.min(1, Math.max(0, share));
  return UTILITY_FLOOR + clamped * (UTILITY_CEILING - UTILITY_FLOOR);
}

export interface DealSlice {
  price: number;
  sellerReservation: number;
  buyerValue: number;
}

export function minimumFairPrice(sellerReservation: number, buyerValue: number): number {
  const zone = buyerValue - sellerReservation;
  if (zone <= 0) return Math.ceil(sellerReservation);
  return Math.ceil(sellerReservation + LOW_BALL_SELLER_SHARE * zone);
}

export function scoreDeal(deal: DealSlice): FairnessScore {
  const zone = deal.buyerValue - deal.sellerReservation;
  if (zone <= 0) {
    return {
      jain: 0.5,
      buyerShare: 0,
      sellerShare: 0,
      buyerUtility: UTILITY_FLOOR,
      sellerUtility: UTILITY_FLOOR,
      buyerSurplus: deal.buyerValue - deal.price,
      sellerSurplus: deal.price - deal.sellerReservation,
      exploitativeLowball: true,
      veto: true,
      verdict: 'VETO. There is no honest room between their floor and your value.',
    };
  }

  const sellerSurplus = deal.price - deal.sellerReservation;
  const buyerSurplus = deal.buyerValue - deal.price;
  const sellerShare = sellerSurplus / zone;
  const buyerShare = buyerSurplus / zone;
  const sellerUtility = surplusUtility(sellerShare);
  const buyerUtility = surplusUtility(buyerShare);
  const jain = jainIndexRounded([buyerUtility, sellerUtility]);
  const exploitativeLowball =
    sellerShare < LOW_BALL_SELLER_SHARE ||
    (jain < LOW_BALL_JAIN && sellerShare < buyerShare);
  const sellerPercent = Math.round(Math.min(1, Math.max(0, sellerShare)) * 100);

  let verdict: string;
  if (exploitativeLowball) {
    verdict = `VETO ${jain.toFixed(2)}. The seller would keep ${sellerPercent}% of the surplus.`;
  } else if (buyerShare < LOW_BALL_SELLER_SHARE) {
    verdict = `Jain ${jain.toFixed(2)}. You are handing them the larger half. Allowed.`;
  } else if (jain >= 0.95) {
    verdict = `Jain ${jain.toFixed(2)}. A balanced split. The night allows it.`;
  } else {
    verdict = `Jain ${jain.toFixed(2)}. Allowed. Seller keeps ${sellerPercent}% of the surplus.`;
  }

  return {
    jain,
    buyerShare,
    sellerShare,
    buyerUtility,
    sellerUtility,
    buyerSurplus,
    sellerSurplus,
    exploitativeLowball,
    veto: exploitativeLowball,
    verdict,
  };
}
