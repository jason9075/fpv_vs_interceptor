import type { Axis } from '../config';
import type { AxisSource, InputState } from './InputState';

export interface AxisMap {
  axis: number;
  invert: boolean;
}

/** 預設對應標準手把（Xbox / PS）：左搖桿 = 油門/yaw，右搖桿 = pitch/roll（Mode 2） */
export const gamepadMap: Record<Axis, AxisMap> & { deadband: number; throttleCentered: boolean } = {
  throttle: { axis: 1, invert: true },
  yaw: { axis: 0, invert: false },
  pitch: { axis: 3, invert: true },
  roll: { axis: 2, invert: false },
  deadband: 0.03,
  // 手把搖桿會回中 → 中點 = 懸停；實體遙控器的油門不回中時改成 false（-1..1 → 0..1 仍成立）
  throttleCentered: true,
};

export class GamepadInput {
  private src: AxisSource;
  private lastThrottle: number | null = null;
  connected = '';

  constructor(private input: InputState) {
    this.src = input.addSource();
    window.addEventListener('gamepadconnected', (e) => (this.connected = e.gamepad.id));
    window.addEventListener('gamepaddisconnected', () => (this.connected = ''));
  }

  update() {
    const pad = navigator.getGamepads?.().find((g) => g && g.connected);
    if (!pad) {
      this.src.yaw = this.src.pitch = this.src.roll = 0;
      return;
    }
    const read = (m: AxisMap) => {
      const v = pad.axes[m.axis] ?? 0;
      return m.invert ? -v : v;
    };
    const dz = (v: number) => (Math.abs(v) < gamepadMap.deadband ? 0 : v);
    this.src.yaw = dz(read(gamepadMap.yaw));
    this.src.pitch = dz(read(gamepadMap.pitch));
    this.src.roll = dz(read(gamepadMap.roll));
    // 油門只在手把真的有動時才覆寫，避免蓋掉鍵盤／虛擬搖桿
    const t = (read(gamepadMap.throttle) + 1) / 2;
    if (this.lastThrottle === null || Math.abs(t - this.lastThrottle) > 0.005) {
      this.input.setThrottle(t);
      this.lastThrottle = t;
    }
  }
}
