import type { Axis } from '../config';
import { NEUTRAL_INPUT, type ControlInput } from '../physics/DroneModel';

export type CenteredAxis = Exclude<Axis, 'throttle'>;
export const CENTERED_AXES: CenteredAxis[] = ['yaw', 'pitch', 'roll'];

/** 自動回中的軸由各輸入來源各自提供，最後取絕對值最大者 */
export type AxisSource = Record<CenteredAxis, number>;

export class InputState {
  /** 油門不回中，所有來源共用同一個值 */
  throttle = 0.5;
  private sources: AxisSource[] = [];
  private out: ControlInput = { ...NEUTRAL_INPUT };

  addSource(): AxisSource {
    const s: AxisSource = { yaw: 0, pitch: 0, roll: 0 };
    this.sources.push(s);
    return s;
  }

  setThrottle(v: number) {
    this.throttle = Math.min(1, Math.max(0, v));
  }

  read(): Readonly<ControlInput> {
    this.out.throttle = this.throttle;
    for (const axis of CENTERED_AXES) {
      let best = 0;
      for (const s of this.sources) if (Math.abs(s[axis]) > Math.abs(best)) best = s[axis];
      this.out[axis] = Math.max(-1, Math.min(1, best));
    }
    return this.out;
  }
}
