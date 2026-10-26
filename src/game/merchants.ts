import type { MerchantState, StrategyId } from './types.js';

export type ReplyKind = 'accept' | 'counter' | 'insult' | 'walk';

export interface OfferResponse {
  merchant: MerchantState;
  ask: number;
  kind: ReplyKind;
  line: string;
}

const QUILL_PALM_WALK = 0.32;
const QUILL_PALM_COST = 0.28;
const QUILL_INSULT_COST = 0.36;
const QUILL_DRAMATIC_TEMPER = 0.7;
const CALDER_INSULTS_BEFORE_WALK = 2;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Hidden reservation in coins, before the referee's fairness line. */
export function floorCoins(merchant: MerchantState, fairValue: number): number {
  return Math.ceil(reservationRatio(merchant) * fairValue);
}

export function reservationRatio(merchant: MerchantState): number {
  if (merchant.strategy === 'stock-pressure') {
    return merchant.baseFloorRatio * (1 - 0.42 * clamp01(merchant.stockPressure));
  }
  if (merchant.strategy === 'walkaway-temper') {
    return merchant.baseFloorRatio + merchant.memoryMarkup;
  }
  return merchant.baseFloorRatio;
}

export function concessionFraction(merchant: MerchantState): number {
  if (merchant.strategy === 'stock-pressure') {
    return 0.2 + clamp01(merchant.stockPressure) * 0.25;
  }
  if (merchant.strategy === 'floor-hawk') return 0.04;
  return merchant.temper > QUILL_DRAMATIC_TEMPER ? 0.28 : 0.035;
}

export function merchantStatus(merchant: MerchantState): string {
  if (merchant.strategy === 'stock-pressure') {
    return `Stock pressure ${Math.round(merchant.stockPressure * 100)}%`;
  }
  if (merchant.strategy === 'floor-hawk') {
    return `Insults ${merchant.insultCount}/${CALDER_INSULTS_BEFORE_WALK}`;
  }
  return `Temper ${Math.round(clamp01(merchant.temper) * 100)}%`;
}

function dropAsk(ask: number, floor: number, fraction: number): number {
  if (ask <= floor) return floor;
  const drop = Math.max(1, Math.round((ask - floor) * fraction));
  return Math.max(floor, ask - drop);
}

function acceptLine(strategy: StrategyId): string {
  if (strategy === 'stock-pressure') return 'Take it. The stall needs the room. Clasp hands.';
  if (strategy === 'floor-hawk') return 'On my number, and not a hair under. Clasp.';
  return 'Fine. Clasp before I change my mind.';
}

function counterLine(strategy: StrategyId): string {
  if (strategy === 'stock-pressure') return 'Another hour on the table and the price softens.';
  if (strategy === 'floor-hawk') return 'A coin. Maybe two. Do not expect a third.';
  return 'There. A cut. Do not ask me to repeat the drama.';
}

function palmLine(strategy: StrategyId): string {
  if (strategy === 'stock-pressure') return 'Open palm received. The night is heavy. I move.';
  if (strategy === 'floor-hawk') return 'You may look at my palm. The floor does not move.';
  return 'One concession. My temper is the price of the next.';
}

export function openingAsk(merchant: MerchantState, fairValue: number): number {
  return Math.max(floorCoins(merchant, fairValue) + 1, Math.round(fairValue * merchant.askRatio));
}

export function respondToOffer(
  merchant: MerchantState,
  fairValue: number,
  ask: number,
  price: number,
): OfferResponse {
  let next: MerchantState = { ...merchant };
  const floor = floorCoins(next, fairValue);
  const insultRatio =
    next.strategy === 'stock-pressure' ? 0.5 : next.strategy === 'floor-hawk' ? 0.94 : 0.9;

  if (price < floor * insultRatio) {
    if (next.strategy === 'floor-hawk') {
      next = { ...next, insultCount: next.insultCount + 1 };
      if (next.insultCount >= CALDER_INSULTS_BEFORE_WALK) {
        return { merchant: next, ask, kind: 'walk', line: 'I am done being tested.' };
      }
      return {
        merchant: next,
        ask,
        kind: 'insult',
        line: 'Bring me a number that can stand up.',
      };
    }
    if (next.strategy === 'walkaway-temper') {
      next = { ...next, temper: next.temper - QUILL_INSULT_COST };
      if (next.temper <= 0) {
        next = { ...next, memoryMarkup: Math.min(0.1, next.memoryMarkup + 0.04) };
        return {
          merchant: next,
          ask,
          kind: 'walk',
          line: 'The night can keep you. I will not.',
        };
      }
      const raised = Math.round(Math.min(fairValue * 1.75, ask * 1.03));
      return {
        merchant: next,
        ask: raised,
        kind: 'insult',
        line: 'You are spending my temper, not my coin.',
      };
    }
    next = { ...next, stockPressure: Math.min(1, next.stockPressure + 0.12) };
    return {
      merchant: next,
      ask: dropAsk(ask, floorCoins(next, fairValue), 0.08),
      kind: 'insult',
      line: 'That is not a price. That is a rumor. I move a little, because the goods are heavy.',
    };
  }

  const acceptSlack =
    next.strategy === 'stock-pressure'
      ? 0.08 + next.stockPressure * 0.12
      : next.strategy === 'floor-hawk'
        ? 0.015
        : next.temper > 0.6
          ? 0.1
          : 0.03;

  if (price >= ask - 1 || (price >= floor && price >= ask * (1 - acceptSlack))) {
    return acceptAt(next, price);
  }

  const fraction = concessionFraction(next);
  const toward = Math.max(price, floor);
  const gap = ask - toward;
  const drop = Math.max(1, Math.round(gap * fraction));
  let newAsk = Math.max(floor, ask - drop);
  if (price >= floor && newAsk <= price) {
    return acceptAt(next, price);
  }
  if (next.strategy === 'stock-pressure') {
    next = { ...next, stockPressure: Math.min(1, next.stockPressure + 0.04) };
  }
  return { merchant: next, ask: newAsk, kind: 'counter', line: counterLine(next.strategy) };
}

function acceptAt(merchant: MerchantState, price: number): OfferResponse {
  let next = { ...merchant };
  if (next.strategy === 'stock-pressure') {
    next = { ...next, stockPressure: Math.max(0, next.stockPressure - 0.2) };
  } else if (next.strategy === 'floor-hawk') {
    next = { ...next, insultCount: 0 };
  } else {
    next = { ...next, temper: Math.min(1, next.temper + 0.08) };
  }
  return {
    merchant: next,
    ask: Math.round(price),
    kind: 'accept',
    line: acceptLine(next.strategy),
  };
}

/** Open palm: ask them to move, without naming a new number. */
export function concedeToPalm(
  merchant: MerchantState,
  fairValue: number,
  ask: number,
): OfferResponse {
  let next: MerchantState = { ...merchant };
  if (next.strategy === 'walkaway-temper' && next.temper <= QUILL_PALM_WALK) {
    next = {
      ...next,
      temper: 0,
      memoryMarkup: Math.min(0.1, next.memoryMarkup + 0.04),
    };
    return {
      merchant: next,
      ask,
      kind: 'walk',
      line: 'Do not coax me. I am already gone.',
    };
  }

  const fraction = concessionFraction(next);
  if (next.strategy === 'walkaway-temper') {
    next = { ...next, temper: next.temper - QUILL_PALM_COST };
  } else if (next.strategy === 'stock-pressure') {
    next = { ...next, stockPressure: Math.min(1, next.stockPressure + 0.08) };
  }

  const floor = floorCoins(next, fairValue);
  const newAsk = dropAsk(ask, floor, fraction);
  if (newAsk >= ask) {
    return { merchant: next, ask, kind: 'counter', line: 'That is as far as I go.' };
  }
  return { merchant: next, ask: newAsk, kind: 'counter', line: palmLine(next.strategy) };
}

export function greetLine(strategy: StrategyId, artifactName: string): string {
  if (strategy === 'stock-pressure') {
    return `${artifactName} has waited all night. I would rather it leave with you.`;
  }
  if (strategy === 'floor-hawk') {
    return `${artifactName}. The floor is the floor. I do not decorate it.`;
  }
  return `${artifactName}. Admire it quickly. My patience is a thin cloth.`;
}
