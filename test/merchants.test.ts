import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoster } from '../src/game/catalog.ts';
import {
  concedeToPalm,
  concessionFraction,
  floorCoins,
  respondToOffer,
} from '../src/game/merchants.ts';

test('the roster has three distinct strategies', () => {
  const roster = createRoster();
  const strategies = new Set(roster.map((merchant) => merchant.strategy));
  assert.deepEqual([...strategies].sort(), ['floor-hawk', 'stock-pressure', 'walkaway-temper']);
  const fractions = roster.map((merchant) => concessionFraction(merchant));
  assert.ok(new Set(fractions).size === 3);
});

test('Mei drops her floor as stock pressure rises and concedes more than Calder', () => {
  const [mei, calder] = createRoster();
  const rested = floorCoins(mei, 100);
  const tired = floorCoins({ ...mei, stockPressure: 0.9 }, 100);
  assert.ok(tired < rested);
  assert.equal(floorCoins(calder, 100), floorCoins({ ...calder, stockPressure: 0.9 }, 100));

  const meiPalm = concedeToPalm(mei, 100, 160);
  const calderPalm = concedeToPalm(calder, 100, 160);
  assert.equal(meiPalm.kind, 'counter');
  assert.equal(calderPalm.kind, 'counter');
  assert.ok(160 - meiPalm.ask > (160 - calderPalm.ask) * 2);
});

test('Calder walks on the second insult and barely moves his ask', () => {
  const calder = createRoster()[1];
  const first = respondToOffer(calder, 100, 150, 1);
  assert.equal(first.kind, 'insult');
  assert.equal(first.ask, 150);
  const second = respondToOffer(first.merchant, 100, first.ask, 1);
  assert.equal(second.kind, 'walk');
});

test('Quill concedes hard, then freezes, then leaves', () => {
  const quill = createRoster()[2];
  const first = concedeToPalm(quill, 100, 160);
  const second = concedeToPalm(first.merchant, 100, first.ask);
  const firstDrop = 160 - first.ask;
  const secondDrop = first.ask - second.ask;
  assert.ok(firstDrop > secondDrop * 2);
  const third = concedeToPalm(second.merchant, 100, second.ask);
  assert.equal(third.kind, 'walk');
});

test('three lowballs make Quill storm off and Mei stay', () => {
  const mei = createRoster()[0];
  const quill = createRoster()[2];
  let meiState = respondToOffer(mei, 100, 150, 1);
  meiState = respondToOffer(meiState.merchant, 100, meiState.ask, 1);
  meiState = respondToOffer(meiState.merchant, 100, meiState.ask, 1);
  assert.notEqual(meiState.kind, 'walk');

  let quillState = respondToOffer(quill, 100, 150, 1);
  quillState = respondToOffer(quillState.merchant, 100, quillState.ask, 1);
  quillState = respondToOffer(quillState.merchant, 100, quillState.ask, 1);
  assert.equal(quillState.kind, 'walk');
  assert.ok(quillState.merchant.memoryMarkup > 0);
});
