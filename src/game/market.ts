import { ARTIFACTS } from './catalog.js';
import { minimumFairPrice, scoreDeal } from './fairness.js';
import { floorCoins, openingAsk, respondToOffer } from './merchants.js';
import { mulberry32 } from './rng.js';
import type { Artifact, MarketReport, MerchantState, SpiritStyle, TradeRecord } from './types.js';

export interface NightInput {
  spirit: SpiritStyle;
  roster: MerchantState[];
  minutes: number;
  seed: number;
}

export interface SpiritNegotiation {
  merchant: MerchantState;
  trade: TradeRecord;
}

function tradeBase(
  merchant: MerchantState,
  artifact: Artifact,
  price: number,
  jain: number,
  flags: { vetoed?: boolean; sealed?: boolean; walked?: boolean },
  line: string,
): TradeRecord {
  const sealed = flags.sealed === true;
  return {
    who: 'spirit',
    merchantId: merchant.id,
    merchantName: merchant.name,
    strategy: merchant.strategy,
    artifactName: artifact.name,
    price,
    jain,
    vetoed: flags.vetoed === true,
    sealed,
    walked: flags.walked === true,
    surplus: sealed ? artifact.buyerValue - price : 0,
    line,
  };
}

/** One buyer-spirit versus one merchant, using the same rules as the stall. */
export function spiritNegotiate(
  spirit: SpiritStyle,
  merchant: MerchantState,
  artifact: Artifact,
): SpiritNegotiation {
  let current = { ...merchant };
  let ask = openingAsk(current, artifact.fairValue);
  const bid = Math.max(1, Math.round(ask * spirit.openingRatio));
  const floor = () => floorCoins(current, artifact.fairValue);
  const openingScore = scoreDeal({
    price: bid,
    sellerReservation: floor(),
    buyerValue: artifact.buyerValue,
  });

  if (openingScore.veto) {
    return {
      merchant: anger(current),
      trade: tradeBase(
        current,
        artifact,
        bid,
        openingScore.jain,
        { vetoed: true },
        `${current.name} heard ${bid} c. The Referee vetoed it. Jain ${openingScore.jain.toFixed(2)}.`,
      ),
    };
  }

  const maxRounds = Math.max(1, Math.round(spirit.patienceRounds));
  let offer = bid;
  for (let round = 0; round < maxRounds; round += 1) {
    const response = respondToOffer(current, artifact.fairValue, ask, offer);
    current = response.merchant;
    ask = response.ask;
    if (response.kind === 'walk') {
      const score = scoreDeal({
        price: offer,
        sellerReservation: floor(),
        buyerValue: artifact.buyerValue,
      });
      return {
        merchant: current,
        trade: tradeBase(current, artifact, offer, score.jain, { walked: true }, response.line),
      };
    }
    if (response.kind === 'accept') {
      const score = scoreDeal({
        price: offer,
        sellerReservation: floor(),
        buyerValue: artifact.buyerValue,
      });
      if (score.veto) {
        return {
          merchant: current,
          trade: tradeBase(
            current,
            artifact,
            offer,
            score.jain,
            { vetoed: true },
            `The Referee blocked the clasp at ${offer} c.`,
          ),
        };
      }
      return {
        merchant: current,
        trade: tradeBase(
          current,
          artifact,
          offer,
          score.jain,
          { sealed: true },
          `${current.name} and your spirit sealed ${artifact.name} at ${offer} c.`,
        ),
      };
    }

    const counterScore = scoreDeal({
      price: ask,
      sellerReservation: floor(),
      buyerValue: artifact.buyerValue,
    });
    const lastRound = round >= maxRounds - 1;
    const fairEnough = counterScore.jain >= spirit.targetJain - 0.06;
    const canAfford = ask <= artifact.buyerValue;
    if (!counterScore.veto && canAfford && (fairEnough || (lastRound && spirit.walkawayBias < 0.45))) {
      const accepted = respondToOffer(current, artifact.fairValue, ask, ask);
      return {
        merchant: accepted.merchant,
        trade: tradeBase(
          accepted.merchant,
          artifact,
          ask,
          counterScore.jain,
          { sealed: true },
          `${current.name} and your spirit met at ${ask} c.`,
        ),
      };
    }
    if (counterScore.veto && lastRound) {
      return {
        merchant: current,
        trade: tradeBase(
          current,
          artifact,
          ask,
          counterScore.jain,
          { vetoed: true },
          `Their counter at ${ask} c failed the Referee.`,
        ),
      };
    }
    if (lastRound || (spirit.walkawayBias > 0.62 && !fairEnough)) {
      return {
        merchant: current,
        trade: tradeBase(
          current,
          artifact,
          offer,
          counterScore.jain,
          { walked: true },
          `Your spirit left ${current.name} holding ${artifact.name}.`,
        ),
      };
    }

    const gap = ask - offer;
    const step = Math.max(1, Math.round(Math.abs(gap) * spirit.concessionPerRound + Math.abs(gap) * 0.12));
    offer = gap >= 0 ? Math.min(ask, offer + step) : Math.max(ask, offer - step);
    // Never knowingly step under the veto line once the opening was legal.
    const line = minimumFairPrice(floor(), artifact.buyerValue);
    if (offer < line) offer = line;
  }

  const score = scoreDeal({
    price: offer,
    sellerReservation: floor(),
    buyerValue: artifact.buyerValue,
  });
  return {
    merchant: current,
    trade: tradeBase(current, artifact, offer, score.jain, { walked: true }, 'The spirit ran out of patience.'),
  };
}

function anger(merchant: MerchantState): MerchantState {
  if (merchant.strategy === 'walkaway-temper') {
    return { ...merchant, temper: merchant.temper - 0.12 };
  }
  if (merchant.strategy === 'floor-hawk') {
    return { ...merchant, insultCount: merchant.insultCount + 1 };
  }
  return { ...merchant, stockPressure: Math.min(1, merchant.stockPressure + 0.05) };
}

export function summarizeTrades(trades: readonly TradeRecord[], minutes: number): MarketReport {
  let profit = 0;
  let loss = 0;
  let jainSum = 0;
  let sealed = 0;
  let vetoed = 0;
  let walked = 0;
  for (const trade of trades) {
    if (trade.sealed) {
      sealed += 1;
      if (trade.surplus >= 0) profit += trade.surplus;
      else loss += -trade.surplus;
    }
    if (trade.vetoed) vetoed += 1;
    if (trade.walked) walked += 1;
    jainSum += trade.jain;
  }
  return {
    minutes,
    trades: [...trades],
    sealed,
    vetoed,
    walked,
    profit,
    loss,
    net: profit - loss,
    meanJain: trades.length === 0 ? 1 : Number((jainSum / trades.length).toFixed(4)),
    rumors: buildRumors(trades),
  };
}

function buildRumors(trades: readonly TradeRecord[]): string[] {
  const rumors: string[] = [];
  const veto = trades.find((trade) => trade.vetoed);
  const walk = trades.find((trade) => trade.walked);
  const sealed = trades.filter((trade) => trade.sealed);
  const best = [...sealed].sort((a, b) => b.jain - a.jain)[0];
  const worst = [...sealed].sort((a, b) => a.surplus - b.surplus)[0];
  if (veto) {
    rumors.push(
      `The Referee split a ${veto.artifactName} deal with ${veto.merchantName}. Jain ${veto.jain.toFixed(2)}.`,
    );
  }
  if (walk) {
    rumors.push(`${walk.merchantName} walked. Your spirit did not chase ${walk.artifactName}.`);
  }
  if (best) {
    rumors.push(
      `A fair ${best.artifactName} changed hands at ${best.price} c. Jain ${best.jain.toFixed(2)}.`,
    );
  }
  if (worst && worst.surplus < 0) {
    rumors.push(
      `Your spirit overpaid for ${worst.artifactName}. The night took ${-worst.surplus} c.`,
    );
  } else if (worst && best && worst !== best) {
    rumors.push(`${worst.merchantName} held the line on ${worst.artifactName} at ${worst.price} c.`);
  }
  const mei = trades.find((trade) => trade.strategy === 'stock-pressure' && trade.sealed);
  if (mei) rumors.push('Mei Lantern is discounting. Stock is heavy tonight.');
  const quill = trades.find((trade) => trade.strategy === 'walkaway-temper' && (trade.walked || trade.vetoed));
  if (quill) rumors.push('Quill Vesper\'s temper is the gossip of the row.');
  return rumors.slice(0, 6);
}

export function runNightMarket(input: NightInput): { roster: MerchantState[]; report: MarketReport } {
  const roster = input.roster.map((merchant) => ({ ...merchant }));
  const minutes = Math.max(0, Math.floor(input.minutes));
  const rng = mulberry32(input.seed);
  const trades: TradeRecord[] = [];
  for (let minute = 0; minute < minutes; minute += 1) {
    const merchantIndex = minute % roster.length;
    const artifact = ARTIFACTS[Math.floor(rng() * ARTIFACTS.length) % ARTIFACTS.length];
    const result = spiritNegotiate(input.spirit, roster[merchantIndex], artifact);
    roster[merchantIndex] = result.merchant;
    trades.push(result.trade);
  }
  return { roster, report: summarizeTrades(trades, minutes) };
}
