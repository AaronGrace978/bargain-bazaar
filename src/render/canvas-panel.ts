import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import type { DialogueModel, MarketModel, SpiritModel } from '../game/present.js';

export class LivePanel {
  readonly mesh: Mesh;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;
  private key = '';

  constructor(widthPx: number, heightPx: number, worldWidth: number, worldHeight: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = widthPx;
    this.canvas.height = heightPx;
    const context = this.canvas.getContext('2d');
    if (context == null) throw new Error('2D canvas is unavailable');
    this.context = context;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 8;
    const material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(worldWidth, worldHeight), material);
    this.mesh.renderOrder = 2;
  }

  redraw(key: string, draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void): void {
    if (key === this.key) return;
    this.key = key;
    draw(this.context, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }
}

export function paintDialogue(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  model: DialogueModel,
): void {
  paintCard(ctx, width, height);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e7c27a';
  ctx.font = '600 24px Fraunces, Georgia, serif';
  ctx.fillText(model.kicker.toUpperCase(), 40, 28);
  ctx.fillStyle = '#f7f1e4';
  ctx.font = '600 46px Fraunces, Georgia, serif';
  ctx.fillText(model.title, 40, 54);
  ctx.fillStyle = '#f0d7a2';
  ctx.font = '500 28px Outfit, sans-serif';
  ctx.fillText(model.artifact, 40, 112);
  ctx.fillStyle = '#d9d0c4';
  ctx.font = '500 22px Outfit, sans-serif';
  wrapText(ctx, model.blurb, 40, 148, width - 80, 26, 1);
  ctx.fillStyle = '#f7f1e4';
  ctx.font = '500 24px Outfit, sans-serif';
  ctx.fillText(`${model.worth}    ${model.ask}    ${model.bead}`, 40, 190);
  ctx.fillStyle = '#ffb15a';
  ctx.fillText(`${model.veto}    ${model.status}`, 40, 224);
  ctx.fillStyle = model.jain.startsWith('VETO') ? '#ff8d8d' : '#b7f3df';
  ctx.font = '600 26px Fraunces, Georgia, serif';
  wrapText(ctx, model.jain, 40, 262, width - 80, 30, 2);
  ctx.fillStyle = '#f7f1e4';
  ctx.font = '500 24px Outfit, sans-serif';
  wrapText(ctx, model.line, 40, 328, width - 80, 28, 2);
  ctx.fillStyle = '#c8bfb2';
  ctx.font = '500 20px Outfit, sans-serif';
  ctx.fillText(`${model.shift}    ${model.phase}`, 40, height - 58);
  ctx.fillText(model.hands, 40, height - 32);
}

export function paintSpirit(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  model: SpiritModel,
): void {
  paintCard(ctx, width, height);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#9af0dd';
  ctx.font = '600 26px Fraunces, Georgia, serif';
  ctx.fillText('DEMONSTRATION', 40, 32);
  ctx.fillStyle = '#f7f1e4';
  ctx.font = '600 46px Fraunces, Georgia, serif';
  ctx.fillText(model.title, 40, 66);
  ctx.fillStyle = '#d9d0c4';
  ctx.font = '500 28px Outfit, sans-serif';
  wrapText(ctx, model.studied, 40, 126, width - 80, 34, 2);
  let y = 200;
  for (const bar of model.bars) {
    ctx.fillStyle = '#f3eadc';
    ctx.font = '500 28px Outfit, sans-serif';
    ctx.fillText(bar.label, 40, y);
    ctx.fillStyle = '#e7c27a';
    ctx.fillText(bar.value, width - 130, y);
    y += 36;
    paintBar(ctx, 40, y, width - 80, 20, bar.amount, '#3ee0c5');
    y += 44;
  }
  ctx.fillStyle = '#f7f1e4';
  ctx.font = '500 28px Outfit, sans-serif';
  y = wrapText(ctx, model.echo, 40, y + 10, width - 80, 36, 3);
  ctx.fillStyle = '#ffb15a';
  wrapText(ctx, model.delta, 40, y + 16, width - 80, 36, 3);
}

export function paintMarket(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  model: MarketModel,
): void {
  paintCard(ctx, width, height);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e7c27a';
  ctx.font = '600 26px Fraunces, Georgia, serif';
  ctx.fillText('ASYNC MARKET', 40, 32);
  ctx.fillStyle = '#f7f1e4';
  ctx.font = '600 42px Fraunces, Georgia, serif';
  wrapText(ctx, model.title, 40, 68, width - 80, 48, 2);
  ctx.fillStyle = '#d9d0c4';
  ctx.font = '500 28px Outfit, sans-serif';
  let y = wrapText(ctx, model.banner, 40, 176, width - 80, 36, 3);
  ctx.fillStyle = '#b7f3df';
  y = wrapText(ctx, model.stats, 40, y + 10, width - 80, 36, 4);
  ctx.fillStyle = '#f0d7a2';
  y = wrapText(ctx, model.purse, 40, y + 10, width - 80, 36, 2);
  ctx.fillStyle = '#f7f1e4';
  ctx.font = '500 26px Outfit, sans-serif';
  y += 18;
  for (const line of model.lines) {
    if (y > height - 60) break;
    y = wrapText(ctx, line, 40, y, width - 80, 34, 3);
    y += 10;
  }
}

export function plaqueTexture(title: string, subtitle: string, hot = false): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx == null) throw new Error('2D canvas is unavailable');
  ctx.fillStyle = hot ? '#3a2412' : '#1a1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#e7c27a';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.fillStyle = '#f7f1e4';
  ctx.font = '600 54px Fraunces, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, 96);
  ctx.fillStyle = '#e7c27a';
  ctx.font = '500 32px Outfit, sans-serif';
  ctx.fillText(subtitle, canvas.width / 2, 164);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function paintCard(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(16, 9, 20, 0.9)';
  roundRect(ctx, 12, 12, width - 24, height - 24, 32);
  ctx.fill();
  ctx.strokeStyle = 'rgba(231, 194, 122, 0.9)';
  ctx.lineWidth = 6;
  roundRect(ctx, 12, 12, width - 24, height - 24, 32);
  ctx.stroke();
}

function paintBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  amount: number,
  color: string,
): void {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, x, y, width, height, 8);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x, y, Math.max(8, width * Math.min(1, Math.max(0, amount))), height, 8);
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.split(/\s+/u).filter((word) => word.length > 0);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const trial = line.length > 0 ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = word;
      if (lines >= maxLines - 1) break;
    } else {
      line = trial;
    }
  }
  if (line.length > 0 && lines < maxLines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}
