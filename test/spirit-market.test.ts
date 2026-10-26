import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoster } from '../src/game/catalog.ts';
import { runNightMarket } from '../src/game/market.ts';
import {
  closeStall,
  createSession,
  handshake,
  nudgeOffer,
  openPalm,
  pinchOffer,
  setOffer,
  walkAway,
} from '../src/game/session.ts';
import { createSpirit, observeDeal, spiritOpeningPrice } from '../src/game/spirit.ts';
import type { ObservedDeal } from '../src/game/types.ts';

function observed(patch: Partial<ObservedDeal>): ObservedDeal {
  return {
    openingRatio: 0.8,
    offerRatios: [0.8],
    rounds: 2,
    walkedAway: false,
    merchantLeft: false,
    vetoed: false,
    sealed: true,
    jain: 0.95,
    lowestRatio: 0.8,
    ...patch,
  };
}

test('the spirit copies a low opening and a walk-away', () => {
  const spirit = createSpirit();
  const before = spiritOpeningPrice(spirit, 100);
  const aggressive = observeDeal(
    spirit,
    observed({ openingRatio: 0.48, offerRatios: [0.48, 0.55], lowestRatio: 0.48, sealed: true }),
  );
  assert.ok(spiritOpeningPrice(aggressive, 100) < before);
  assert.ok(aggressive.dealsSeen === 1);

  const walked = observeDeal(spirit, observed({ walkedAway: true, sealed: false }));
  assert.ok(walked.walkawayBias > spirit.walkawayBias);

  const vetoed = observeDeal(spirit, observed({ vetoed: true, sealed: false, jain: 0.71 }));
  assert.ok(vetoed.targetJain > spirit.targetJain);
});

test('a player lowball is vetoed and still trains the spirit', () => {
  const session = createSession();
  const dealt = pinchOffer(setOffer(session, Math.round(session.artifact.fairValue * 0.45)));
  assert.equal(dealt.phase, 'haggling');
  assert.equal(dealt.vetoSeq, 1);
  assert.match(dealt.line, /Lightning/);
  assert.equal(dealt.spirit.dealsSeen, 1);
  assert.ok(dealt.spirit.openingRatio < session.spirit.openingRatio);
  assert.ok(dealt.lastScore?.veto);
});

test('a fair clasp seals, pays surplus, and moves the echo price', () => {
  let session = createSession();
  const echoBefore = spiritOpeningPrice(session.spirit, session.initialAsk);
  session = pinchOffer(setOffer(session, session.ask));
  assert.equal(session.phase, 'ready');
  assert.equal(session.spirit.dealsSeen, 0);
  session = handshake(session);
  assert.equal(session.phase, 'review');
  assert.equal(session.spirit.dealsSeen, 1);
  assert.equal(session.purse, session.artifact.buyerValue - session.ask);
  assert.ok(session.lastScore != null && session.lastScore.veto === false);
  const echoAfter = spiritOpeningPrice(session.spirit, session.initialAsk);
  assert.notEqual(echoBefore, echoAfter);
});

test('open palm moves Mei farther than a fresh Calder would, inside a session', () => {
  const session = createSession();
  assert.equal(session.active.strategy, 'stock-pressure');
  const moved = openPalm(session);
  assert.ok(moved.ask < session.ask);
  assert.equal(moved.phase, 'haggling');
});

test('walking away raises walk bias and review can start the next merchant', () => {
  const session = walkAway(createSession());
  assert.equal(session.phase, 'review');
  assert.ok(session.spirit.walkawayBias > 0.12);
  const next = pinchOffer(session);
  assert.equal(next.phase, 'haggling');
  assert.equal(next.active.strategy, 'floor-hawk');
  assert.equal(next.rounds, 0);
});

test('closing the stall runs a scored night market with rumors', () => {
  const session = closeStall(createSession(), 7, 12);
  assert.equal(session.phase, 'report');
  const report = session.report;
  assert.ok(report);
  assert.equal(report.trades.length, 12);
  assert.equal(report.sealed + report.vetoed + report.walked, 12);
  assert.ok(report.rumors.length > 0);
  assert.ok(report.meanJain > 0);
  assert.equal(session.spiritNet, report.net);
});

test('an aggressive spirit is vetoed more often than a fair one', () => {
  const roster = createRoster();
  const fair = runNightMarket({
    spirit: {
      ...createSpirit(),
      openingRatio: 0.92,
      concessionPerRound: 0.2,
      patienceRounds: 5,
      walkawayBias: 0.05,
      targetJain: 0.9,
    },
    roster,
    minutes: 12,
    seed: 11,
  });
  const aggressive = runNightMarket({
    spirit: {
      ...createSpirit(),
      openingRatio: 0.42,
      concessionPerRound: 0.03,
      patienceRounds: 2,
      walkawayBias: 0.2,
      targetJain: 0.75,
    },
    roster,
    minutes: 12,
    seed: 11,
  });
  assert.ok(aggressive.report.vetoed > fair.report.vetoed);
  assert.ok(fair.report.trades.some((trade) => trade.sealed || trade.walked || trade.vetoed));
});

test('nudging the bead stays inside the offer range', () => {
  const session = createSession();
  const high = nudgeOffer(session, 10_000);
  const low = nudgeOffer(session, -10_000);
  assert.ok(high.offer >= session.offer);
  assert.ok(low.offer < session.offer);
  assert.ok(low.offer >= Math.round(session.artifact.fairValue * 0.45));
});
