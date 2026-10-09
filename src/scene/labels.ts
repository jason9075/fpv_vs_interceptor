import * as THREE from 'three';

/** 文字 sprite（固定世界尺寸），用於軸標籤 */
export function makeLabel(text: string, color: number, height = 0.09): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const font = '600 48px system-ui, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w;
  c.height = 64;
  ctx.font = font;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(0, 4, w, 56, 14);
  ctx.fill();
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set((height * w) / 64, height, 1);
  sprite.renderOrder = 10;
  return sprite;
}
