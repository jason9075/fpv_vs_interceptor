import { settings, type Axis } from '../config';
import type { ControlInput } from '../physics/DroneModel';
import type { AxisSource, InputState } from './InputState';

type StickAxes = { x: Axis; y: Axis };

const AXIS_NAME: Record<Axis, string> = {
  throttle: 'Throttle',
  pitch: 'Pitch（推 = 低頭）',
  roll: 'Roll',
  yaw: 'Yaw',
};

/** Mode 2：左 = Yaw/Throttle、右 = Roll/Pitch；Mode 1：左 = Yaw/Pitch、右 = Roll/Throttle */
export function stickLayout(mode: 1 | 2): { left: StickAxes; right: StickAxes } {
  return mode === 2
    ? { left: { x: 'yaw', y: 'throttle' }, right: { x: 'roll', y: 'pitch' } }
    : { left: { x: 'yaw', y: 'pitch' }, right: { x: 'roll', y: 'throttle' } };
}

class Stick {
  x = 0;
  y = 0;
  dragging = false;
  private knob: HTMLElement;
  private pad: HTMLElement;
  private arrows: HTMLElement[];
  private caption: HTMLElement;
  axes: StickAxes = { x: 'yaw', y: 'throttle' };

  constructor(public el: HTMLElement) {
    el.innerHTML = `
      <div class="stick-pad">
        <div class="stick-cross"></div>
        <span class="stick-arrow top">↑</span><span class="stick-arrow bottom">↓</span>
        <span class="stick-arrow left">←</span><span class="stick-arrow right">→</span>
        <div class="stick-knob"></div>
      </div>
      <div class="stick-caption"></div>`;
    this.pad = el.querySelector('.stick-pad')!;
    this.knob = el.querySelector('.stick-knob')!;
    this.arrows = [...el.querySelectorAll<HTMLElement>('.stick-arrow')];
    this.caption = el.querySelector('.stick-caption')!;

    const move = (e: PointerEvent) => {
      const r = this.pad.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
      this.x = Math.max(-1, Math.min(1, nx));
      this.y = Math.max(-1, Math.min(1, ny));
    };
    this.pad.addEventListener('pointerdown', (e) => {
      this.pad.setPointerCapture(e.pointerId);
      this.dragging = true;
      move(e);
    });
    this.pad.addEventListener('pointermove', (e) => this.dragging && move(e));
    const end = () => {
      this.dragging = false;
      this.x = 0;
      if (this.axes.y !== 'throttle') this.y = 0;
    };
    this.pad.addEventListener('pointerup', end);
    this.pad.addEventListener('pointercancel', end);
  }

  setAxes(axes: StickAxes) {
    this.axes = axes;
    for (const a of this.arrows) {
      const vertical = a.classList.contains('top') || a.classList.contains('bottom');
      a.dataset.axis = vertical ? axes.y : axes.x;
    }
    this.caption.innerHTML =
      `<span class="ax-${axes.y}" data-dir="y">↕ ${AXIS_NAME[axes.y]}</span>` +
      `<span class="ax-${axes.x}" data-dir="x">↔ ${AXIS_NAME[axes.x]}</span>`;
  }

  render(vx: number, vy: number) {
    this.knob.style.left = `${50 + vx * 50}%`;
    this.knob.style.top = `${50 - vy * 50}%`;
    this.el.classList.toggle('active-x', Math.abs(vx) > 0.05);
    this.el.classList.toggle('active-y', this.axes.y !== 'throttle' && Math.abs(vy) > 0.05);
  }
}

/** 兩根虛擬搖桿：拖曳時寫入輸入，平常顯示最終輸入（鍵盤／手把也會帶動 knob） */
export class VirtualSticks {
  private left: Stick;
  private right: Stick;
  private src: AxisSource;

  constructor(leftEl: HTMLElement, rightEl: HTMLElement, private input: InputState) {
    this.left = new Stick(leftEl);
    this.right = new Stick(rightEl);
    this.src = input.addSource();
    this.applyMode();
  }

  applyMode() {
    const l = stickLayout(settings.stickMode);
    this.left.setAxes(l.left);
    this.right.setAxes(l.right);
  }

  update(out: Readonly<ControlInput>) {
    this.src.yaw = this.src.pitch = this.src.roll = 0;
    for (const s of [this.left, this.right]) {
      if (!s.dragging) continue;
      this.write(s.axes.x, s.x);
      this.write(s.axes.y, s.y);
    }
    for (const s of [this.left, this.right]) {
      const val = (a: Axis) => (a === 'throttle' ? out.throttle * 2 - 1 : out[a]);
      const vx = s.dragging ? s.x : val(s.axes.x);
      const vy = s.dragging ? s.y : val(s.axes.y);
      s.render(vx, vy);
    }
  }

  private write(axis: Axis, v: number) {
    if (axis === 'throttle') this.input.setThrottle((v + 1) / 2);
    else this.src[axis] = v;
  }
}
