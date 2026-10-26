import { createRoster } from './catalog.js';
import { beginDeal, catchUp, createSession, type Session } from './session.js';
import { createSpirit } from './spirit.js';
import type { MarketReport, MerchantState, SpiritStyle } from './types.js';

const KEY = 'bargain-bazaar-v1';

interface SaveData {
  version: 1;
  spirit: SpiritStyle;
  purse: number;
  spiritNet: number;
  lastSeen: number;
  roster: MerchantState[];
  report: MarketReport | null;
  reportBanner: string;
}

export function loadReturningSession(now = Date.now()): Session {
  const session = createSession();
  const saved = readSave();
  if (saved == null) return session;
  const restored = beginDeal(
    {
      ...session,
      spirit: saved.spirit,
      previousSpirit: saved.spirit,
      purse: saved.purse,
      spiritNet: saved.spiritNet,
      roster: saved.roster.length === 3 ? saved.roster : session.roster,
      report: saved.report,
      reportBanner: saved.reportBanner,
    },
    { merchantIndex: 0, artifactIndex: 0 },
  );
  const awayMs = now - saved.lastSeen;
  if (awayMs < 20_000) return restored;
  const minutes = Math.min(90, Math.max(1, Math.floor(awayMs / 60_000)));
  return catchUp(
    restored,
    minutes,
    (saved.lastSeen % 100000) + 1,
    `While the headset was off (${minutes} min), the market kept negotiating.`,
  );
}

export function persistSession(session: Session, now = Date.now()): void {
  const data: SaveData = {
    version: 1,
    spirit: session.spirit,
    purse: session.purse,
    spiritNet: session.spiritNet,
    lastSeen: now,
    roster: session.roster,
    report: session.report,
    reportBanner: session.reportBanner,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private mode and file:// previews can refuse storage. The stall still runs.
  }
}

function readSave(): SaveData | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1 || parsed.spirit == null || !Array.isArray(parsed.roster)) return null;
    return {
      version: 1,
      spirit: { ...createSpirit(), ...parsed.spirit },
      purse: typeof parsed.purse === 'number' ? parsed.purse : 0,
      spiritNet: typeof parsed.spiritNet === 'number' ? parsed.spiritNet : 0,
      lastSeen: typeof parsed.lastSeen === 'number' ? parsed.lastSeen : Date.now(),
      roster: parsed.roster.length === 3 ? parsed.roster : createRoster(),
      report: parsed.report ?? null,
      reportBanner: typeof parsed.reportBanner === 'string' ? parsed.reportBanner : '',
    };
  } catch {
    return null;
  }
}
