import type { Axis } from '../config';
import type { ControlInput } from '../physics/DroneModel';

const ROWS: [Axis, string][] = [
  ['throttle', 'Throttle'],
  ['yaw', 'Yaw'],
  ['pitch', 'Pitch'],
  ['roll', 'Roll'],
];

/** 中央的輸入量條：油門 0–100%（中點 = 懸停），其他軸 -1..1 */
export class InputBars {
  private fills = new Map<Axis, HTMLElement>();
  private vals = new Map<Axis, HTMLElement>();

  constructor(el: HTMLElement) {
    el.innerHTML = ROWS.map(
      ([a, name]) => `<div class="ibar" data-axis="${a}">
        <span class="ax-${a}">${name}</span>
        <span class="track${a === 'throttle' ? ' thr' : ''}"><i></i></span>
        <span class="val"></span></div>`,
    ).join('');
    for (const [a] of ROWS) {
      const row = el.querySelector<HTMLElement>(`[data-axis="${a}"]`)!;
      this.fills.set(a, row.querySelector('i')!);
      this.vals.set(a, row.querySelector('.val')!);
    }
  }

  update(input: Readonly<ControlInput>) {
    for (const [a] of ROWS) {
      const v = input[a];
      const fill = this.fills.get(a)!;
      if (a === 'throttle') {
        fill.style.left = '0%';
        fill.style.width = `${v * 100}%`;
        this.vals.get(a)!.textContent = `${Math.round(v * 100)}%`;
      } else {
        fill.style.left = `${50 + Math.min(0, v) * 50}%`;
        fill.style.width = `${Math.abs(v) * 50}%`;
        this.vals.get(a)!.textContent = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
      }
    }
  }
}
