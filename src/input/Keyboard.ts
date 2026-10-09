import type { AxisSource, InputState } from './InputState';

const RAMP_UP = 1.5; // 每秒，約 0.67 s 到滿舵；輕點只會小幅打桿
const RAMP_DOWN = 6;
const THROTTLE_SPEED = 0.5;

/** W/S 油門、A/D yaw、↑/↓ pitch、←/→ roll，按住期間漸增到滿舵 */
export class Keyboard {
  private down = new Set<string>();
  private src: AxisSource;
  private actions = new Map<string, () => void>();

  constructor(private input: InputState) {
    this.src = input.addSource();
    window.addEventListener('keydown', (e) => {
      if (isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      if (!e.repeat) this.actions.get(k)?.();
      this.down.add(k);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.down.clear());
  }

  /** 單次觸發的快捷鍵（R reset、P 暫停…） */
  on(key: string, fn: () => void) {
    this.actions.set(key, fn);
  }

  update(dt: number) {
    const axis = (pos: string, neg: string) => (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0);
    this.ramp('yaw', axis('d', 'a'), dt);
    this.ramp('pitch', axis('arrowup', 'arrowdown'), dt);
    this.ramp('roll', axis('arrowright', 'arrowleft'), dt);
    const t = axis('w', 's');
    if (t !== 0) this.input.setThrottle(this.input.throttle + t * THROTTLE_SPEED * dt);
  }

  private ramp(axis: keyof AxisSource, target: number, dt: number) {
    const cur = this.src[axis];
    const rate = target === 0 || Math.sign(target) !== Math.sign(cur) ? RAMP_DOWN : RAMP_UP;
    const d = target - cur;
    this.src[axis] = Math.abs(d) <= rate * dt ? target : cur + Math.sign(d) * rate * dt;
  }
}

function isTyping(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
}
