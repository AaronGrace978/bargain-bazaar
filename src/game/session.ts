import { ARTIFACTS, createRoster } from './catalog.js';
import { minimumFairPrice, scoreDeal } from './fairness.js';
import { runNightMarket } from './market.js';
import {
  concedeToPalm,
  floorCoins,
  greetLine,
  merchantStatus,
  openingAsk,
  respondToOffer,
} from './merchants.js';
import { createSpirit, observeDeal, spiritDelta } from './spirit.js';
import type {
  Artifact,
  FairnessScore,
  MarketReport,
  MerchantState,
  ObservedDeal,
  Phase,
  SpiritStyle,
} from './types.js';

export interface Session {
  roster: MerchantState[];
  merchantIndex: number;
  artifactIndex: number;
  active: MerchantState;
  artifact: Artifact;
  ask: number;
  initialAsk: number;
  offer: number;
  phase: Phase;
  rounds: number;
  offerRatios: number[];
  touched: boolean;
  lastScore: FairnessScore | null;
  line: string;
  lesson: string;
  spirit: SpiritStyle;
  previousSpirit: SpiritStyle;
  purse: number;
  spiritNet: number;
  report: MarketReport | null;
  reportBanner: string;
  vetoSeq: number;
  readyPrice: number | null;
}

export function offerBounds(session: Session): { min: number; max: number } {
  const min = Math.max(1, Math.round(session.artifact.fairValue * 0.45));
  const max = Math.max(session.ask, session.artifact.buyerValue, min + 1);
  return { min, max };
}

export function vetoLine(session: Session): number {
  return minimumFairPrice(floorCoins(session.active, session.artifact.fairValue), session.artifact.buyerValue);
}

export function createSession(): Session {
  const roster = createRoster();
  const spirit = createSpirit();
  const blank: Session = {
    roster,
    merchantIndex: 0,
    artifactIndex: 0,
    active: roster[0],
    artifact: ARTIFACTS[0],
    ask: 1,
    initialAsk: 1,
    offer: 1,
    phase: 'haggling',
    rounds: 0,
    offerRatios: [],
    touched: false,
    lastScore: null,
    line: '',
    lesson: 'Your spirit has not studied a deal yet.',
    spirit,
    previousSpirit: spirit,
    purse: 0,
    spiritNet: 0,
    report: null,
    reportBanner: '',
    vetoSeq: 0,
    readyPrice: null,
  };
  return beginDeal(blank, { merchantIndex: 0, artifactIndex: 0 });
}

export function setOffer(session: Session, offer: number): Session {
  if (session.phase === 'report' || session.phase === 'review') return session;
  const bounds = offerBounds(session);
  const next = Math.round(Math.min(bounds.max, Math.max(bounds.min, offer)));
  return {
    ...session,
    offer: next,
    phase: 'haggling',
    readyPrice: null,
  };
}

export function nudgeOffer(session: Session, delta: number): Session {
  return setOffer(session, session.offer + delta);
}

export function pinchOffer(session: Session): Session {
  if (session.phase === 'report') return session;
  if (session.phase === 'review') return advance(session);
  const price = session.offer;
  const scored = judge(session, price);
  const ratios = [...session.offerRatios, price / session.initialAsk];
  let next: Session = {
    ...session,
    rounds: session.rounds + 1,
    offerRatios: ratios,
    touched: true,
    lastScore: scored,
    phase: 'haggling',
    readyPrice: null,
  };
  if (scored.veto) {
    return applyVeto(next, price, scored);
  }
  const response = respondToOffer(next.active, next.artifact.fairValue, next.ask, price);
  next = writeMerchant(next, response.merchant);
  next = { ...next, ask: response.ask, line: response.line };
  if (response.kind === 'walk') return finish(next, false, true, false);
  if (response.kind === 'accept') {
    return {
      ...next,
      phase: 'ready',
      readyPrice: price,
      ask: price,
      line: response.line,
    };
  }
  return next;
}

export function openPalm(session: Session): Session {
  if (session.phase === 'report') return session;
  if (session.phase === 'review') return advance(session);
  const response = concedeToPalm(session.active, session.artifact.fairValue, session.ask);
  let next = writeMerchant(
    { ...session, rounds: session.rounds + 1, touched: true, phase: 'haggling', readyPrice: null },
    response.merchant,
  );
  next = { ...next, ask: response.ask, line: response.line };
  if (response.kind === 'walk') return finish(next, false, true, false);
  return next;
}

export function handshake(session: Session): Session {
  if (session.phase === 'report') return session;
  if (session.phase === 'review') return advance(session);
  const price = session.phase === 'ready' && session.readyPrice != null ? session.readyPrice : session.ask;
  const scored = judge(session, price);
  let next: Session = { ...session, lastScore: scored, touched: true };
  if (scored.veto) {
    const ratios = [...session.offerRatios, price / session.initialAsk];
    return applyVeto({ ...next, offerRatios: ratios, rounds: session.rounds + 1 }, price, scored);
  }
  if (session.offerRatios.length === 0) {
    next = { ...next, offerRatios: [price / session.initialAsk] };
  }
  next = {
    ...next,
    ask: price,
    line: 'Hands clasped. The stall records the price.',
    purse: session.purse + (session.artifact.buyerValue - price),
  };
  return finish(next, true, false, false);
}

export function walkAway(session: Session): Session {
  if (session.phase === 'report') return session;
  if (session.phase === 'review') return advance(session);
  let active = { ...session.active };
  if (active.strategy === 'stock-pressure') {
    active = { ...active, stockPressure: Math.min(1, active.stockPressure + 0.15) };
  } else if (active.strategy === 'floor-hawk') {
    active = { ...active, insultCount: 0 };
  } else {
    active = { ...active, temper: Math.min(1, active.temper + 0.05) };
  }
  const next = writeMerchant(
    {
      ...session,
      touched: true,
      line: 'You turn a palm to your chest and leave the piece on the cloth.',
    },
    active,
  );
  return finish(next, false, false, true);
}

export function chooseMerchant(session: Session, index: number): Session {
  if (session.phase !== 'haggling' || session.touched) return session;
  if (index < 0 || index >= session.roster.length || index === session.merchantIndex) return session;
  return beginDeal(session, { merchantIndex: index, artifactIndex: session.artifactIndex });
}

export function closeStall(session: Session, seed: number, minutes = 12): Session {
  const night = runNightMarket({
    spirit: session.spirit,
    roster: session.roster,
    minutes,
    seed,
  });
  return {
    ...session,
    roster: night.roster,
    report: night.report,
    reportBanner: 'You stepped away. The spirit kept trading.',
    spiritNet: session.spiritNet + night.report.net,
    phase: 'report',
    line: 'The stall goes quiet. Your spirit stays.',
    readyPrice: null,
  };
}

export function returnToStall(session: Session): Session {
  if (session.phase !== 'report') return session;
  return beginDeal(session, { advance: true });
}

export function catchUp(session: Session, minutes: number, seed: number, banner: string): Session {
  if (minutes <= 0) return session;
  const night = runNightMarket({
    spirit: session.spirit,
    roster: session.roster,
    minutes,
    seed,
  });
  return {
    ...session,
    roster: night.roster,
    report: night.report,
    reportBanner: banner,
    spiritNet: session.spiritNet + night.report.net,
    phase: 'report',
    line: banner,
    readyPrice: null,
  };
}

function advance(session: Session): Session {
  return beginDeal(session, { advance: true });
}

export function beginDeal(
  session: Session,
  options: { advance?: boolean; merchantIndex?: number; artifactIndex?: number },
): Session {
  const merchantIndex =
    options.merchantIndex ??
    (options.advance ? (session.merchantIndex + 1) % session.roster.length : session.merchantIndex);
  const artifactIndex =
    options.artifactIndex ??
    (options.advance ? (session.artifactIndex + 1) % ARTIFACTS.length : session.artifactIndex);
  const artifact = ARTIFACTS[artifactIndex];
  let active = { ...session.roster[merchantIndex] };
  if (active.strategy === 'walkaway-temper') {
    active = { ...active, temper: Math.min(1, active.temper + 0.12) };
  }
  const ask = openingAsk(active, artifact.fairValue);
  const boundsMin = Math.max(1, Math.round(artifact.fairValue * 0.45));
  const boundsMax = Math.max(ask, artifact.buyerValue, boundsMin + 1);
  const offer = Math.round(Math.min(boundsMax, Math.max(boundsMin, ask * 0.84)));
  return {
    ...session,
    merchantIndex,
    artifactIndex,
    artifact,
    active,
    ask,
    initialAsk: ask,
    offer,
    phase: 'haggling',
    rounds: 0,
    offerRatios: [],
    touched: false,
    lastScore: null,
    readyPrice: null,
    line: greetLine(active.strategy, artifact.name),
  };
}

function judge(session: Session, price: number): FairnessScore {
  return scoreDeal({
    price,
    sellerReservation: floorCoins(session.active, session.artifact.fairValue),
    buyerValue: session.artifact.buyerValue,
  });
}

function applyVeto(session: Session, price: number, scored: FairnessScore): Session {
  let active = { ...session.active };
  if (active.strategy === 'walkaway-temper') {
    active = { ...active, temper: active.temper - 0.2 };
    if (active.temper <= 0) {
      active = { ...active, memoryMarkup: Math.min(0.1, active.memoryMarkup + 0.04) };
    }
  } else if (active.strategy === 'floor-hawk') {
    active = { ...active, insultCount: active.insultCount + 1 };
  } else {
    active = { ...active, stockPressure: Math.min(1, active.stockPressure + 0.08) };
  }
  const next = writeMerchant(
    { ...session, lastScore: scored, line: `Lightning. ${scored.verdict}` },
    active,
  );
  const merchantLeft =
    (active.strategy === 'floor-hawk' && active.insultCount >= 2) ||
    (active.strategy === 'walkaway-temper' && active.temper <= 0);
  if (merchantLeft) {
    return finish({ ...next, vetoSeq: session.vetoSeq + 1 }, false, true, false, true);
  }
  const trained = learn(next, {
    vetoed: true,
    sealed: false,
    walkedAway: false,
    merchantLeft: false,
    jain: scored.jain,
  });
  return {
    ...trained,
    phase: 'haggling',
    readyPrice: null,
    lastScore: scored,
    vetoSeq: session.vetoSeq + 1,
    line: `Lightning. ${scored.verdict}`,
    lesson: `Lesson: a ${price} c lowball drew the veto. The spirit copied your opening anyway.`,
  };
}

function finish(
  session: Session,
  sealed: boolean,
  merchantLeft: boolean,
  walkedAway: boolean,
  vetoed = false,
): Session {
  const jain = session.lastScore?.jain ?? 1;
  const trained = learn(session, {
    vetoed,
    sealed,
    walkedAway,
    merchantLeft,
    jain,
  });
  let lesson = 'Lesson: the deal ended before a clasp.';
  if (sealed) lesson = `Lesson: clasped at ${session.ask} c. Jain ${jain.toFixed(2)}.`;
  else if (walkedAway) lesson = 'Lesson: you left. Walk-away bias rose.';
  else if (merchantLeft) lesson = 'Lesson: the merchant left. The spirit felt that temper.';
  return {
    ...trained,
    phase: 'review',
    readyPrice: null,
    lesson,
    line: session.line,
  };
}

function learn(
  session: Session,
  flags: {
    vetoed: boolean;
    sealed: boolean;
    walkedAway: boolean;
    merchantLeft: boolean;
    jain: number;
  },
): Session {
  const ratios =
    session.offerRatios.length > 0
      ? session.offerRatios
      : [session.ask / Math.max(1, session.initialAsk)];
  const observed: ObservedDeal = {
    openingRatio: ratios[0],
    offerRatios: ratios,
    rounds: Math.max(1, session.rounds),
    walkedAway: flags.walkedAway,
    merchantLeft: flags.merchantLeft,
    vetoed: flags.vetoed,
    sealed: flags.sealed,
    jain: flags.jain,
    lowestRatio: Math.min(...ratios),
  };
  const nextSpirit = observeDeal(session.spirit, observed);
  return {
    ...session,
    previousSpirit: session.spirit,
    spirit: nextSpirit,
    lesson: spiritDelta(session.spirit, nextSpirit),
  };
}

function writeMerchant(session: Session, merchant: MerchantState): Session {
  const roster = session.roster.slice();
  roster[session.merchantIndex] = merchant;
  return { ...session, roster, active: merchant };
}

export function statusLine(session: Session): string {
  return merchantStatus(session.active);
}
