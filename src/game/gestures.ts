import type { GestureId } from './types.js';

export interface HandSample {
  tracked: boolean;
  /** 0 open pinch, 1 fingertips touching. */
  pinch: number;
  /** 0 fingers extended, 1 fist. */
  curl: number;
  /** 1 palm faces the merchant, -1 palm faces the player. */
  palmFacing: number;
  wristX: number;
  wristY: number;
  wristZ: number;
}

export interface GestureTracker {
  gesture: GestureId;
  hold: number;
  cooldown: number;
}

const HOLD_SECONDS: Record<Exclude<GestureId, 'pinch' | 'none'>, number> = {
  'open-palm': 0.28,
  handshake: 0.32,
  'walk-away': 0.4,
};

/** Metres above the floor; the cloth sits at 0.74 in a seated local-floor space. */
export const RAISED_WRIST_Y = 0.86;

export function createGestureTracker(): GestureTracker {
  return { gesture: 'none', hold: 0, cooldown: 0 };
}

export function classifyGesture(left: HandSample, right: HandSample): GestureId {
  if (left.tracked && right.tracked) {
    const distance = Math.hypot(
      left.wristX - right.wristX,
      left.wristY - right.wristY,
      left.wristZ - right.wristZ,
    );
    if (distance < 0.18 && left.curl > 0.5 && right.curl > 0.5) {
      return 'handshake';
    }
  }

  const hands = [left, right].filter((hand) => hand.tracked);
  // Palm gestures only count above the cloth, so a hand resting in the lap
  // cannot storm off or counter by accident.
  const raised = hands.filter((hand) => hand.wristY > RAISED_WRIST_Y);
  if (raised.some((hand) => hand.curl < 0.45 && hand.pinch < 0.55 && hand.palmFacing < -0.6)) {
    return 'walk-away';
  }
  if (raised.some((hand) => hand.curl < 0.45 && hand.pinch < 0.5 && hand.palmFacing > 0.6)) {
    return 'open-palm';
  }
  if (hands.some((hand) => hand.pinch > 0.82)) return 'pinch';
  return 'none';
}

/**
 * Pinch fires on the rising edge. The other three gestures must be held
 * so a passing pose does not storm off by accident.
 */
export function stepGestureTracker(
  state: GestureTracker,
  next: GestureId,
  dt: number,
  suppressPinch = false,
): { state: GestureTracker; fired: GestureId | null } {
  const cooldown = Math.max(0, state.cooldown - dt);
  if (next !== state.gesture) {
    if (next === 'pinch' && !suppressPinch && cooldown === 0) {
      return {
        state: { gesture: next, hold: 0, cooldown: 0.65 },
        fired: 'pinch',
      };
    }
    return { state: { gesture: next, hold: 0, cooldown }, fired: null };
  }

  const hold = state.hold + dt;
  if (next === 'pinch' || next === 'none') {
    return { state: { gesture: next, hold, cooldown }, fired: null };
  }
  const needed = HOLD_SECONDS[next];
  // A pose that has not fired yet only starts counting once the cooldown is
  // over; otherwise it crosses its threshold during the cooldown and never fires.
  if (cooldown > 0) {
    return { state: { gesture: next, hold: state.hold >= needed ? hold : 0, cooldown }, fired: null };
  }
  if (state.hold < needed && hold >= needed) {
    return {
      state: { gesture: next, hold, cooldown: 0.75 },
      fired: next,
    };
  }
  return { state: { gesture: next, hold, cooldown }, fired: null };
}
