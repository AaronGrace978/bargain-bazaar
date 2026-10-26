import {
  BufferAttribute,
  Color,
  Pressed,
  RayInteractable,
  Vector3,
  VisibilityState,
  createSystem,
} from '@iwsdk/core';
import { SHIFT_SECONDS } from '../game/catalog.js';
import { classifyGesture, createGestureTracker, stepGestureTracker } from '../game/gestures.js';
import type { GestureId } from '../game/types.js';
import {
  presentDialogue,
  presentMarket,
  presentSpirit,
} from '../game/present.js';
import { persistSession, loadReturningSession } from '../game/save.js';
import {
  catchUp,
  chooseMerchant,
  closeStall,
  handshake,
  nudgeOffer,
  offerBounds,
  openPalm,
  pinchOffer,
  returnToStall,
  setOffer,
  walkAway,
  type Session,
} from '../game/session.js';
import { createStallAudio, type StallAudio } from '../render/audio.js';
import { paintDialogue, paintMarket, paintSpirit } from '../render/canvas-panel.js';
import { LAYOUT } from '../render/layout.js';
import {
  buildStall,
  offerFromWorldX,
  placeBead,
  refreshPlaques,
  showArtifact,
  type StallView,
} from '../render/stall.js';
import { bindDock, syncDock } from '../ui/dock.js';
import { HandReader } from '../xr/hands.js';

const REVIEW_SECONDS = 8;

export class BazaarSystem extends createSystem({
  pressed: { required: [Pressed] },
}) {
  private session!: Session;
  private stall!: StallView;
  private audio!: StallAudio;
  private readonly hands = new HandReader();
  private tracker = createGestureTracker();
  private readonly merchantPoint = new Vector3(LAYOUT.merchant.x, 1.25, LAYOUT.merchant.z);
  private readonly beadWorld = new Vector3();
  private readonly tip = new Vector3();
  private readonly controlPoint = new Vector3();
  private readonly boltStart = new Vector3();
  private readonly boltEnd = new Vector3();
  private readonly aggressive = new Color('#ff5a3c');
  private readonly fairColor = new Color('#3ee0c5');
  private readonly tint = new Color();
  private controls: { name: string; mesh: StallView['bead'] }[] = [];
  private queue: string[] = [];
  private acted = false;
  private shiftLeft = SHIFT_SECONDS;
  private shiftClosed = false;
  private reviewLeft = 0;
  private lightning = 0;
  private shownArtifact = '';
  private handReadout = 'Keys F C H X M, or press the plaques.';
  private fontEpoch = 0;
  private persistIn = 0;
  private lastHands: unknown = null;

  init(): void {
    (window as unknown as { bazaar?: unknown }).bazaar = {
      state: () => ({
        phase: this.session.phase,
        merchant: this.session.active.id,
        offer: this.session.offer,
        ask: this.session.ask,
        gesture: this.tracker.gesture,
        hands: this.lastHands,
        spirit: this.session.spirit,
        lastScore: this.session.lastScore,
      }),
    };
    this.session = loadReturningSession();
    this.shiftClosed = this.session.phase === 'report';
    this.shiftLeft = this.shiftClosed ? 0 : SHIFT_SECONDS;
    this.stall = buildStall(this.scene);
    this.audio = createStallAudio();
    this.controls = [
      ...this.stall.sigils.map((sigil) => ({ name: sigil.name, mesh: sigil.mesh })),
      ...this.stall.merchantLamps.map((lamp) => ({ name: lamp.id, mesh: lamp.mesh })),
    ];
    for (const control of this.controls) {
      this.world.createTransformEntity(control.mesh).addComponent(RayInteractable);
    }
    this.cleanupFuncs.push(
      this.queries.pressed.subscribe('qualify', (entity) => {
        const action = actionFromName(entity.object3D?.name ?? '');
        if (action) this.queue.push(action);
      }),
    );
    bindDock({
      launch: () => this.world.launchXR(),
      act: (action) => this.queue.push(action),
      onOffer: (value) => {
        this.audio.resume();
        this.session = setOffer(this.session, value);
      },
    });
    const enter = document.getElementById('enter-xr');
    if (enter && !this.world.xrEnabled) enter.hidden = true;
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        document.body.classList.toggle('xr', state !== VisibilityState.NonImmersive);
      }),
    );
    const onVisibility = () => this.onDocumentVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    const onHide = () => persistSession(this.session);
    window.addEventListener('pagehide', onHide);
    this.cleanupFuncs.push(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
    });
    void document.fonts.ready.then(() => {
      this.fontEpoch += 1;
      refreshPlaques(this.stall);
    });
  }

  update(delta: number, time: number): void {
    const dt = Math.min(0.05, Math.max(0, delta));
    this.stall.root.updateMatrixWorld(true);
    const next = this.queue.shift();
    this.queue.length = 0;
    if (next) this.dispatch(next);
    this.consumeKeyboard();
    this.consumeHands(dt);
    if (this.session.phase === 'review' && !this.acted) {
      this.reviewLeft -= dt;
      if (this.reviewLeft <= 0) this.dispatch('offer');
    }
    this.tickShift(dt);
    this.animate(dt, time);
    this.redraw();
    this.syncReadout();
    this.persistIn += dt;
    if (this.persistIn >= 5) {
      this.persistIn = 0;
      persistSession(this.session);
    }
    this.acted = false;
  }

  private consumeKeyboard(): void {
    if (this.acted) return;
    const keyboard = this.input.keyboard;
    const coarse = keyboard.getKeyPressed('ShiftLeft') || keyboard.getKeyPressed('ShiftRight');
    if (keyboard.getKeyDown('ArrowLeft') || keyboard.getKeyDown('KeyA')) {
      this.dispatch(coarse ? 'minus5' : 'minus');
      return;
    }
    if (keyboard.getKeyDown('ArrowRight') || keyboard.getKeyDown('KeyD')) {
      this.dispatch(coarse ? 'plus5' : 'plus');
      return;
    }
    if (keyboard.getKeyDown('KeyF') || keyboard.getKeyDown('Enter')) {
      this.dispatch('offer');
      return;
    }
    if (keyboard.getKeyDown('KeyC')) {
      this.dispatch('palm');
      return;
    }
    if (keyboard.getKeyDown('KeyH')) {
      this.dispatch('seal');
      return;
    }
    if (keyboard.getKeyDown('KeyX')) {
      this.dispatch('walk');
      return;
    }
    if (keyboard.getKeyDown('KeyM')) {
      this.dispatch('away');
      return;
    }
    if (keyboard.getKeyDown('KeyR')) {
      this.dispatch('return');
      return;
    }
    if (keyboard.getKeyDown('Digit1')) this.dispatch('merchant-mei');
    else if (keyboard.getKeyDown('Digit2')) this.dispatch('merchant-calder');
    else if (keyboard.getKeyDown('Digit3')) this.dispatch('merchant-quill');
  }

  private consumeHands(dt: number): void {
    this.stall.bead.getWorldPosition(this.beadWorld);
    const frame = this.hands.read(this.player, this.input, this.merchantPoint, this.beadWorld);
    this.lastHands = frame;
    this.handReadout = this.describeHands(frame.left.pinch, frame.right.pinch, frame.left.curl, frame.right.curl, frame.left.palmFacing, frame.right.palmFacing, frame.left.tracked, frame.right.tracked);
    if (this.acted) return;
    if (frame.dragX != null) {
      const bounds = offerBounds(this.session);
      this.session = setOffer(this.session, offerFromWorldX(frame.dragX, bounds.min, bounds.max));
    }
    const gesture = classifyGesture(frame.left, frame.right);
    const step = stepGestureTracker(
      this.tracker,
      gesture,
      dt,
      frame.dragX != null || this.pinchHitsControl(),
    );
    this.tracker = step.state;
    const action = step.fired ? gestureAction(step.fired) : null;
    if (action) this.dispatch(action);
  }

  private describeHands(
    leftPinch: number,
    rightPinch: number,
    leftCurl: number,
    rightCurl: number,
    leftPalm: number,
    rightPalm: number,
    leftTracked: boolean,
    rightTracked: boolean,
  ): string {
    const pose = this.tracker.gesture === 'none' ? 'open' : this.tracker.gesture;
    if (this.world.xrSession == null) return 'Keys F C H X M, or press the plaques.';
    if (!leftTracked && !rightTracked) return 'Hands not tracking. Press the plaques.';
    const pinch = Math.max(leftPinch, rightPinch);
    const curl = leftTracked ? leftCurl : rightCurl;
    const palm = Math.abs(leftPalm) > Math.abs(rightPalm) ? leftPalm : rightPalm;
    return `Hand sense pinch ${pinch.toFixed(2)} curl ${curl.toFixed(2)} palm ${palm.toFixed(2)} ${pose}`;
  }

  private pinchHitsControl(): boolean {
    for (const side of ['left', 'right'] as const) {
      if (!this.input.xr.isPrimary('hand', side)) continue;
      const tipSpace = this.player.indexTipSpaces[side];
      tipSpace.updateWorldMatrix(true, false);
      tipSpace.getWorldPosition(this.tip);
      for (const control of this.controls) {
        control.mesh.getWorldPosition(this.controlPoint);
        if (this.tip.distanceTo(this.controlPoint) < 0.11) return true;
      }
    }
    return false;
  }

  private dispatch(action: string): void {
    this.acted = true;
    this.audio.resume();
    const beforeVeto = this.session.vetoSeq;
    const beforePhase = this.session.phase;
    const beforePurse = this.session.purse;
    this.session = reduce(this.session, action);
    if (this.session.phase === 'report') {
      this.shiftClosed = true;
      this.shiftLeft = 0;
    } else if (beforePhase === 'report') {
      this.shiftClosed = false;
      this.shiftLeft = SHIFT_SECONDS;
    }
    if (beforePhase !== 'review' && this.session.phase === 'review') this.reviewLeft = REVIEW_SECONDS;
    else if (this.session.phase !== 'review') this.reviewLeft = 0;
    if (this.session.vetoSeq > beforeVeto) {
      this.lightning = 1.25;
      this.audio.thunder();
    } else if (beforePhase !== 'review' && this.session.phase === 'review' && this.session.purse !== beforePurse) {
      this.audio.chime();
    } else if ((action === 'offer' || action === 'palm') && beforePhase !== 'review') {
      this.audio.knock();
    }
  }

  private tickShift(dt: number): void {
    if (this.shiftClosed) return;
    if (this.session.phase === 'report') return;
    this.shiftLeft = Math.max(0, this.shiftLeft - dt);
    if (this.shiftLeft > 0) return;
    this.session = closeStall(this.session, Date.now() % 100000, 12);
    this.shiftClosed = true;
  }

  private animate(dt: number, time: number): void {
    for (const lantern of this.stall.lanterns) {
      lantern.group.position.y = lantern.base + Math.sin(time * 1.3 + lantern.phase) * 0.045;
    }
    this.stall.referee.rotation.y += dt * 0.7;
    this.stall.motes.rotation.y += dt * 0.03;
    const spirit = this.session.spirit;
    const calm = clamp((spirit.openingRatio - 0.4) / 0.55, 0, 1);
    this.tint.copy(this.aggressive).lerp(this.fairColor, calm);
    this.stall.spiritMat.color.copy(this.tint);
    this.stall.spiritMat.emissive.copy(this.tint);
    this.stall.spiritMat.opacity = 0.25 + Math.min(0.6, spirit.dealsSeen * 0.08);
    this.stall.spirit.position.y = 1.18 + Math.sin(time * 1.5) * 0.035;
    this.stall.spirit.rotation.y += dt * 0.45;
    this.stall.robe.color.set(this.session.active.robe);
    this.stall.accent.color.set(this.session.active.accent);
    this.stall.accent.emissive.set(this.session.active.accent);
    const tempered = this.session.active.strategy === 'walkaway-temper';
    this.stall.flame.visible = tempered;
    if (tempered) this.stall.flame.scale.setScalar(0.45 + this.session.active.temper);
    const activeLamp = `merchant-${this.session.active.id}`;
    for (const lamp of this.stall.merchantLamps) {
      lamp.material.emissiveIntensity = lamp.id === activeLamp ? 0.95 : 0.12;
    }
    if (this.shownArtifact !== this.session.artifact.id) {
      showArtifact(this.stall.artifactRoot, this.session.artifact);
      this.shownArtifact = this.session.artifact.id;
    }
    const bounds = offerBounds(this.session);
    placeBead(this.stall.bead, this.session.offer, bounds.min, bounds.max);
    this.paintReferee();
    if (this.lightning > 0) {
      this.lightning = Math.max(0, this.lightning - dt);
      this.bolt();
    } else {
      this.stall.lightning.visible = false;
      this.stall.lightningMat.opacity = 0;
    }
  }

  private paintReferee(): void {
    const score = this.session.lastScore;
    if (this.lightning > 0) {
      this.stall.refereeCore.color.set('#f4fbff');
      this.stall.refereeLight.color.set('#d7ecff');
      this.stall.refereeLight.intensity = 4.5;
      this.stall.ring.emissive.set('#9ecbff');
      this.stall.ring.emissiveIntensity = 2.2;
      return;
    }
    if (score?.veto) {
      this.stall.refereeCore.color.set('#ffd0d0');
      this.stall.refereeLight.color.set('#ff6b6b');
      this.stall.refereeLight.intensity = 1.5;
      this.stall.ring.emissive.set('#ff4d4d');
      this.stall.ring.emissiveIntensity = 1.7;
      return;
    }
    this.stall.refereeCore.color.set('#fff4d2');
    this.stall.refereeLight.color.set('#ffe1a8');
    this.stall.refereeLight.intensity = score ? 0.7 + score.jain : 0.8;
    this.stall.ring.emissive.set(score && score.jain >= 0.9 ? '#9af0dd' : '#e7c27a');
    this.stall.ring.emissiveIntensity = score ? 0.5 + score.jain : 0.7;
  }

  private bolt(): void {
    const attribute = this.stall.lightning.geometry.getAttribute('position');
    if (!(attribute instanceof BufferAttribute)) return;
    this.stall.referee.getWorldPosition(this.boltStart);
    this.stall.bead.getWorldPosition(this.boltEnd);
    const segments = 8;
    let x = this.boltStart.x;
    let y = this.boltStart.y;
    let z = this.boltStart.z;
    for (let index = 0; index < segments; index += 1) {
      const t = (index + 1) / segments;
      const end = index === segments - 1;
      const nx = this.boltStart.x + (this.boltEnd.x - this.boltStart.x) * t + (end ? 0 : (Math.random() - 0.5) * 0.1);
      const ny = this.boltStart.y + (this.boltEnd.y - this.boltStart.y) * t + (end ? 0 : (Math.random() - 0.5) * 0.1);
      const nz = this.boltStart.z + (this.boltEnd.z - this.boltStart.z) * t;
      attribute.setXYZ(index * 2, x, y, z);
      attribute.setXYZ(index * 2 + 1, nx, ny, nz);
      x = nx;
      y = ny;
      z = nz;
    }
    attribute.needsUpdate = true;
    this.stall.lightning.visible = true;
    this.stall.lightningMat.opacity = Math.min(1, this.lightning / 0.35);
  }

  private redraw(): void {
    const dialogue = presentDialogue(this.session, this.shiftLeft, this.handReadout);
    const spirit = presentSpirit(this.session);
    const market = presentMarket(this.session);
    const stamp = String(this.fontEpoch);
    this.stall.dialogue.redraw(`${JSON.stringify(dialogue)}|${stamp}`, (ctx, width, height) => {
      paintDialogue(ctx, width, height, dialogue);
    });
    this.stall.spiritPanel.redraw(`${JSON.stringify(spirit)}|${stamp}`, (ctx, width, height) => {
      paintSpirit(ctx, width, height, spirit);
    });
    this.stall.marketPanel.redraw(`${JSON.stringify(market)}|${stamp}`, (ctx, width, height) => {
      paintMarket(ctx, width, height, market);
    });
  }

  private syncReadout(): void {
    const bounds = offerBounds(this.session);
    const score = this.session.lastScore;
    syncDock({
      offer: this.session.offer,
      min: bounds.min,
      max: bounds.max,
      shift: this.session.phase === 'report' ? 'Shift closed' : `Shift ${formatClock(this.shiftLeft)}`,
      jain: score ? `Jain ${score.jain.toFixed(2)}${score.veto ? ' VETO' : ''}` : 'Jain --',
      phase: presentDialogue(this.session, this.shiftLeft, '').phase,
    });
  }

  private onDocumentVisibility(): void {
    if (document.hidden) {
      persistSession(this.session);
      return;
    }
    const saved = readLastSeen();
    if (saved == null) return;
    const away = Date.now() - saved;
    if (away < 20_000) return;
    const minutes = Math.min(90, Math.max(1, Math.floor(away / 60_000)));
    this.session = catchUp(
      this.session,
      minutes,
      (saved % 100000) + 1,
      `While the headset was off (${minutes} min), the market kept negotiating.`,
    );
    this.shiftClosed = true;
    this.shiftLeft = 0;
  }
}

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readLastSeen(): number | null {
  try {
    const raw = localStorage.getItem('bargain-bazaar-v1');
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as { lastSeen?: unknown };
    return typeof parsed.lastSeen === 'number' ? parsed.lastSeen : null;
  } catch {
    return null;
  }
}

function gestureAction(gesture: GestureId): string | null {
  if (gesture === 'pinch') return 'offer';
  if (gesture === 'open-palm') return 'palm';
  if (gesture === 'handshake') return 'seal';
  if (gesture === 'walk-away') return 'walk';
  return null;
}

function actionFromName(name: string): string | null {
  switch (name) {
    case 'sigil-minus':
      return 'minus';
    case 'sigil-plus':
      return 'plus';
    case 'sigil-offer':
      return 'offer';
    case 'sigil-palm':
      return 'palm';
    case 'sigil-seal':
      return 'seal';
    case 'sigil-walk':
      return 'walk';
    case 'sigil-away':
      return 'away';
    case 'merchant-mei':
    case 'merchant-calder':
    case 'merchant-quill':
      return name;
    default:
      return null;
  }
}

function reduce(session: Session, action: string): Session {
  if (action === 'offer') return pinchOffer(session);
  if (action === 'palm') return openPalm(session);
  if (action === 'seal') return handshake(session);
  if (action === 'walk') return walkAway(session);
  if (action === 'minus') return nudgeOffer(session, -1);
  if (action === 'minus5') return nudgeOffer(session, -5);
  if (action === 'plus') return nudgeOffer(session, 1);
  if (action === 'plus5') return nudgeOffer(session, 5);
  if (action === 'merchant-mei') return chooseMerchant(session, 0);
  if (action === 'merchant-calder') return chooseMerchant(session, 1);
  if (action === 'merchant-quill') return chooseMerchant(session, 2);
  if (action === 'return') return returnToStall(session);
  if (action === 'away') {
    if (session.phase === 'report') return returnToStall(session);
    return closeStall(session, Date.now() % 100000, 12);
  }
  return session;
}
