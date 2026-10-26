import { spiritDelta, spiritOpeningPrice } from './spirit.js';
import { statusLine, vetoLine, type Session } from './session.js';
import type { MarketReport } from './types.js';

export interface DialogueModel {
  kicker: string;
  title: string;
  artifact: string;
  blurb: string;
  worth: string;
  ask: string;
  bead: string;
  veto: string;
  status: string;
  jain: string;
  line: string;
  lesson: string;
  shift: string;
  hands: string;
  phase: string;
}

export interface SpiritModel {
  title: string;
  studied: string;
  bars: { label: string; value: string; amount: number }[];
  echo: string;
  delta: string;
  lesson: string;
}

export interface MarketModel {
  title: string;
  banner: string;
  stats: string;
  purse: string;
  lines: string[];
}

export function formatShift(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

export function presentDialogue(session: Session, shiftSeconds: number, hands: string): DialogueModel {
  const score = session.lastScore;
  return {
    kicker: session.active.epithet,
    title: session.active.name,
    artifact: session.artifact.name,
    blurb: session.artifact.blurb,
    worth: `Whispered worth ${session.artifact.fairValue} c`,
    ask: `Their price ${session.ask} c`,
    bead: `Your bead ${session.offer} c`,
    veto: `Referee veto under ${vetoLine(session)} c`,
    status: statusLine(session),
    jain: score ? score.verdict : 'Jain --  make an offer',
    line: session.line,
    lesson: session.lesson,
    shift: session.phase === 'report' ? 'Shift closed' : `Shift ${formatShift(shiftSeconds)}`,
    hands,
    phase:
      session.phase === 'ready'
        ? 'Clasp to seal'
        : session.phase === 'review'
          ? 'Next merchant'
          : session.phase === 'report'
            ? 'Night report'
            : 'Make an offer',
  };
}

export function presentSpirit(session: Session): SpiritModel {
  const spirit = session.spirit;
  const before = session.previousSpirit;
  return {
    title: 'Merchant Spirit',
    studied: spirit.dealsSeen === 0 ? 'Watching. No deals studied yet.' : `Studied ${spirit.dealsSeen} deal${spirit.dealsSeen === 1 ? '' : 's'} from your hands.`,
    bars: [
      {
        label: 'Opening',
        value: spirit.openingRatio.toFixed(2),
        amount: clamp01((spirit.openingRatio - 0.35) / 0.7),
      },
      {
        label: 'Concede',
        value: spirit.concessionPerRound.toFixed(2),
        amount: clamp01(spirit.concessionPerRound / 0.3),
      },
      {
        label: 'Patience',
        value: spirit.patienceRounds.toFixed(1),
        amount: clamp01((spirit.patienceRounds - 1) / 7),
      },
      {
        label: 'Walk bias',
        value: spirit.walkawayBias.toFixed(2),
        amount: clamp01(spirit.walkawayBias),
      },
      {
        label: 'Fair target',
        value: spirit.targetJain.toFixed(2),
        amount: clamp01((spirit.targetJain - 0.7) / 0.29),
      },
    ],
    echo: `On this ask your spirit would open at ${spiritOpeningPrice(spirit, session.initialAsk)} c.`,
    delta: spirit.dealsSeen === 0 ? 'Make a deal and the bars move.' : spiritDelta(before, spirit),
    lesson: session.lesson,
  };
}

export function presentMarket(session: Session): MarketModel {
  const report = session.report;
  if (report == null) {
    return {
      title: 'Night Ledger',
      banner: 'The market keeps bargaining after the headset comes off.',
      stats: `Your surplus ${session.purse} c`,
      purse: 'Step away and the spirit trades this roster.',
      lines: [
        'Profits, losses, and rumors wait on the other side of the stall.',
        'Every spirit trade is scored by the same Referee.',
        'A lowball the spirit learned from you can still be vetoed.',
      ],
    };
  }
  return {
    title: 'While You Were Away',
    banner: session.reportBanner,
    stats: reportStats(report),
    purse: `Your surplus ${session.purse} c    Spirit net ${session.spiritNet} c`,
    lines: report.rumors.length > 0 ? report.rumors : ['The night was quiet.'],
  };
}

function reportStats(report: MarketReport): string {
  return `Sealed ${report.sealed}   Vetoed ${report.vetoed}   Walked ${report.walked}   Profit ${report.profit} c   Loss ${report.loss} c   Mean Jain ${report.meanJain.toFixed(2)}`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
