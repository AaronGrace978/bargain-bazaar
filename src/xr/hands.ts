import { Matrix4, Quaternion, Vector3 } from '@iwsdk/core';
import type { InputManager } from '@iwsdk/core';
import type { XROrigin } from '@iwsdk/core';
import type { HandSample } from '../game/gestures.js';

export interface HandFrame {
  left: HandSample;
  right: HandSample;
  /** World X of a pinching index fingertip, when one is near the offer bead. */
  dragX: number | null;
}

const idle = (): HandSample => ({
  tracked: false,
  pinch: 0,
  curl: 0,
  palmFacing: 0,
  wristX: 0,
  wristY: 0,
  wristZ: 0,
});

/** Reads IWSDK hand joints into gesture samples. */
export class HandReader {
  private readonly wrist = new Vector3();
  private readonly tip = new Vector3();
  private readonly palm = new Vector3();
  private readonly toMerchant = new Vector3();
  private readonly quat = new Quaternion();
  private readonly jointWrist = new Vector3();
  private readonly jointIndex = new Vector3();
  private readonly jointPinky = new Vector3();

  read(
    player: XROrigin,
    input: InputManager,
    merchant: Vector3,
    bead: Vector3,
  ): HandFrame {
    const left = this.sample(player, input, 'left', merchant);
    const right = this.sample(player, input, 'right', merchant);
    let dragX: number | null = null;
    for (const side of ['right', 'left'] as const) {
      const hand = side === 'right' ? right : left;
      if (!hand.tracked || hand.pinch < 0.75) continue;
      const tipSpace = player.indexTipSpaces[side];
      tipSpace.updateWorldMatrix(true, false);
      tipSpace.getWorldPosition(this.tip);
      if (this.tip.distanceTo(bead) < 0.12) dragX = this.tip.x;
    }
    return { left, right, dragX };
  }

  private sample(
    player: XROrigin,
    input: InputManager,
    side: 'left' | 'right',
    merchant: Vector3,
  ): HandSample {
    if (!input.xr.isPrimary('hand', side)) return idle();
    const grip = player.gripSpaces[side];
    const tip = player.indexTipSpaces[side];
    grip.updateWorldMatrix(true, false);
    tip.updateWorldMatrix(true, false);
    grip.getWorldPosition(this.wrist);
    grip.getWorldQuaternion(this.quat);
    tip.getWorldPosition(this.tip);
    const reach = this.wrist.distanceTo(this.tip);
    const curl = 1 - clamp((reach - 0.045) / 0.1, 0, 1);
    const adapter = input.xr.visualAdapters.hand[side];
    if (!this.palmFromJoints(adapter.jointTransforms, grip.matrixWorld, side)) {
      this.palm.set(0, -1, 0).applyQuaternion(this.quat);
    }
    this.toMerchant.copy(merchant).sub(this.wrist);
    const facing = this.toMerchant.lengthSq() < 1e-6 ? 0 : this.palm.dot(this.toMerchant.normalize());
    const pinch = adapter.getPinchStrength();
    return {
      tracked: true,
      pinch,
      curl,
      palmFacing: facing,
      wristX: this.wrist.x,
      wristY: this.wrist.y,
      wristZ: this.wrist.z,
    };
  }

  /** Palm normal from wrist, index and pinky metacarpals. Joint matrices are grip-relative. */
  private palmFromJoints(joints: Float32Array | undefined, grip: Matrix4, side: 'left' | 'right'): boolean {
    if (joints == null || joints.length < 25 * 16) return false;
    this.jointAt(joints, WRIST, grip, this.jointWrist);
    this.jointAt(joints, INDEX_METACARPAL, grip, this.jointIndex);
    this.jointAt(joints, PINKY_METACARPAL, grip, this.jointPinky);
    this.jointIndex.sub(this.jointWrist);
    this.jointPinky.sub(this.jointWrist);
    this.palm.crossVectors(this.jointIndex, this.jointPinky);
    if (side === 'left') this.palm.negate();
    if (this.palm.lengthSq() < 1e-10) return false;
    this.palm.normalize();
    return true;
  }

  private jointAt(joints: Float32Array, index: number, grip: Matrix4, out: Vector3): void {
    const offset = index * 16;
    out.set(joints[offset + 12], joints[offset + 13], joints[offset + 14]).applyMatrix4(grip);
  }
}

const WRIST = 0;
const INDEX_METACARPAL = 5;
const PINKY_METACARPAL = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
