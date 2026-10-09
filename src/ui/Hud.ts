import type { DroneParams } from '../config';
import type { ControlInput } from '../physics/DroneModel';
import type { Telemetry } from '../physics/telemetry';
import { explain } from './Explainer';

const HZ = 10;
const sgn = (n: number, d = 0) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d);

/** 每個 viewport 左上角的數據面板 + 底部說明列 */
export class Hud {
  private cells = new Map<string, HTMLElement>();
  private explainEl: HTMLElement;
  private acc = 1;
  private lastHtml = '';

  constructor(
    el: HTMLElement,
    private p: DroneParams,
  ) {
    const extra =
      p.kind === 'interceptor'
        ? `<tr><th>側滑角</th><td colspan="3"><span data-k="slip"></span></td></tr>
           <tr><th>路徑角 γ</th><td colspan="3"><span data-k="gamma"></span></td></tr>`
        : '';
    el.insertAdjacentHTML(
      'beforeend',
      `<div class="hud">
        <div class="hud-title"><b>${p.label}</b><span>${p.tagline}</span></div>
        <table>
          <tr><th>姿態</th><td class="ax-roll">R <span data-k="roll"></span></td><td class="ax-pitch">P <span data-k="pitch"></span></td><td class="ax-yaw">Y <span data-k="yaw"></span></td></tr>
          <tr><th>角速度</th><td class="ax-roll"><span data-k="p"></span></td><td class="ax-pitch"><span data-k="q"></span></td><td class="ax-yaw"><span data-k="r"></span></td></tr>
          <tr><th>速度</th><td colspan="3" class="vel"><span data-k="speed"></span></td></tr>
          <tr><th>機體分量</th><td>前 <span data-k="vf"></span></td><td>右 <span data-k="vr"></span></td><td>上 <span data-k="vu"></span></td></tr>
          <tr><th>世界分量</th><td colspan="3">水平 <span data-k="vh"></span> · 垂直 <span data-k="vv"></span></td></tr>
          <tr><th>高度 / 推力</th><td colspan="3"><span data-k="alt"></span> · <span class="thr" data-k="thr"></span></td></tr>
          ${extra}
        </table>
      </div>
      <div class="explain" aria-live="off"></div>`,
    );
    el.querySelectorAll<HTMLElement>('[data-k]').forEach((c) => this.cells.set(c.dataset.k!, c));
    this.explainEl = el.querySelector('.explain')!;
  }

  update(t: Telemetry, input: Readonly<ControlInput>, dt: number) {
    this.acc += dt;
    if (this.acc < 1 / HZ) return;
    this.acc = 0;
    const set = (k: string, v: string) => {
      const c = this.cells.get(k);
      if (c && c.textContent !== v) c.textContent = v;
    };
    set('roll', `${sgn(t.rollDeg)}°`);
    set('pitch', `${sgn(t.pitchDeg)}°`);
    set('yaw', `${t.headingDeg.toFixed(0)}°`);
    set('p', `${sgn(t.rollRate)}°/s`);
    set('q', `${sgn(t.pitchRate)}°/s`);
    set('r', `${sgn(t.yawRate)}°/s`);
    set('speed', `${(t.speed * 3.6).toFixed(0)} km/h（${t.speed.toFixed(1)} m/s）`);
    set('vf', sgn(t.vForward, 1));
    set('vr', sgn(t.vRight, 1));
    set('vu', sgn(t.vUp, 1));
    set('vh', `${t.vHorizontal.toFixed(1)} m/s`);
    set('vv', `${sgn(t.vVertical, 1)} m/s`);
    set('alt', `${t.altitude.toFixed(1)} m`);
    set('thr', `${t.thrustRatio.toFixed(2)}×mg`);
    if (this.p.kind === 'interceptor') {
      set('slip', `${t.sideslipDeg.toFixed(1)}°`);
      set('gamma', `${sgn(t.gammaDeg, 1)}°`);
    }
    const html = explain(this.p.kind, input, t);
    if (html !== this.lastHtml) this.explainEl.innerHTML = this.lastHtml = html;
  }
}
