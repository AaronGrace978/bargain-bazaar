import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  jainIndex,
  jainIndexRounded,
  minimumFairPrice,
  scoreDeal,
  surplusUtility,
  UTILITY_CEILING,
  UTILITY_FLOOR,
} from '../src/game/fairness.ts';

test('jain index is 1 when every utility is equal', () => {
  assert.equal(jainIndex([40, 40, 40, 40]), 1);
  assert.equal(jainIndexRounded([15, 100, 15, 100]), jainIndexRounded([15, 100, 15, 100]));
});

test('jain index matches the skyline-consensus ratio to 4 decimals', () => {
  const utilities = [72.5, 88.25, 64, 91, 70];
  const count = utilities.length;
  const sum = utilities.reduce((total, value) => total + value, 0);
  const sumSquares = utilities.reduce((total, value) => total + value * value, 0);
  const expected = Number(((sum * sum) / (count * sumSquares)).toFixed(4));
  assert.equal(jainIndexRounded(utilities), expected);
});

test('surplus utilities stay inside the positive band', () => {
  assert.equal(surplusUtility(-2), UTILITY_FLOOR);
  assert.equal(surplusUtility(0), UTILITY_FLOOR);
  assert.equal(surplusUtility(1), UTILITY_CEILING);
  assert.equal(surplusUtility(4), UTILITY_CEILING);
  assert.ok(surplusUtility(0.5) > UTILITY_FLOOR);
  assert.ok(surplusUtility(0.5) < UTILITY_CEILING);
});

test('an even surplus split scores Jain 1 and is not vetoed', () => {
  const score = scoreDeal({ price: 100, sellerReservation: 70, buyerValue: 130 });
  assert.equal(score.jain, 1);
  assert.equal(score.veto, false);
  assert.equal(score.sellerShare, 0.5);
});

test('an exploitative lowball is vetoed and an overpay is only scored', () => {
  const lowball = scoreDeal({ price: 74, sellerReservation: 70, buyerValue: 150 });
  assert.equal(lowball.veto, true);
  assert.equal(lowball.exploitativeLowball, true);
  assert.match(lowball.verdict, /VETO/);

  const overpay = scoreDeal({ price: 146, sellerReservation: 70, buyerValue: 150 });
  assert.equal(overpay.veto, false);
  assert.match(overpay.verdict, /larger half/);
});

test('the veto line leaves the seller 18 percent of the zone', () => {
  const line = minimumFairPrice(70, 150);
  const score = scoreDeal({ price: line, sellerReservation: 70, buyerValue: 150 });
  assert.ok(score.sellerShare >= 0.18 - 0.02);
  const under = scoreDeal({ price: line - 2, sellerReservation: 70, buyerValue: 150 });
  assert.equal(under.veto, true);
});
