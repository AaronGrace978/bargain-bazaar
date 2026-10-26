import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyGesture,
  createGestureTracker,
  stepGestureTracker,
  type HandSample,
} from '../src/game/gestures.ts';

function hand(patch: Partial<HandSample>): HandSample {
  return {
    tracked: true,
    pinch: 0,
    curl: 0.1,
    palmFacing: 0,
    wristX: 0,
    wristY: 1,
    wristZ: 0,
    ...patch,
  };
}

const idle = hand({ tracked: false });

test('palm gestures ignore a hand resting below the cloth', () => {
  assert.equal(classifyGesture(idle, hand({ palmFacing: -0.8, wristY: 0.6 })), 'none');
  assert.equal(classifyGesture(idle, hand({ palmFacing: 0.8, wristY: 0.6 })), 'none');
});

test('classifies the four stall gestures', () => {
  assert.equal(classifyGesture(idle, hand({ pinch: 0.9, curl: 0.4 })), 'pinch');
  assert.equal(
    classifyGesture(idle, hand({ pinch: 0.1, curl: 0.1, palmFacing: 0.8 })),
    'open-palm',
  );
  assert.equal(
    classifyGesture(idle, hand({ pinch: 0.1, curl: 0.1, palmFacing: -0.8 })),
    'walk-away',
  );
  assert.equal(
    classifyGesture(
      hand({ curl: 0.8, pinch: 0.2, wristX: -0.04 }),
      hand({ curl: 0.8, pinch: 0.9, wristX: 0.04 }),
    ),
    'handshake',
  );
  assert.equal(classifyGesture(idle, idle), 'none');
});

test('pinch fires once on the rising edge and a held palm fires once', () => {
  let tracker = createGestureTracker();
  let step = stepGestureTracker(tracker, 'pinch', 0.016);
  assert.equal(step.fired, 'pinch');
  step = stepGestureTracker(step.state, 'pinch', 0.016);
  assert.equal(step.fired, null);

  tracker = createGestureTracker();
  step = stepGestureTracker(tracker, 'open-palm', 0.1);
  assert.equal(step.fired, null);
  step = stepGestureTracker(step.state, 'open-palm', 0.3);
  assert.equal(step.fired, 'open-palm');
  step = stepGestureTracker(step.state, 'open-palm', 0.2);
  assert.equal(step.fired, null);
});

test('a new pose held through the cooldown still fires once', () => {
  let step = stepGestureTracker(createGestureTracker(), 'open-palm', 0.3);
  step = stepGestureTracker(step.state, 'open-palm', 0.3);
  assert.equal(step.fired, 'open-palm');
  step = stepGestureTracker(step.state, 'walk-away', 0.1);
  const fired: (string | null)[] = [];
  for (let i = 0; i < 30; i++) {
    step = stepGestureTracker(step.state, 'walk-away', 0.1);
    fired.push(step.fired);
  }
  assert.deepEqual(fired.filter(Boolean), ['walk-away']);
});

test('a suppressed pinch does not offer while the bead is held', () => {
  const tracker = createGestureTracker();
  const step = stepGestureTracker(tracker, 'pinch', 0.016, true);
  assert.equal(step.fired, null);
  assert.equal(step.state.gesture, 'pinch');
});
