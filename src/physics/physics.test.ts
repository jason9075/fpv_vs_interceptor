import { Euler, Quaternion } from 'three';
import { describe, expect, it } from 'vitest';
import { FPV_PARAMS, GRAVITY, INTERCEPTOR_PARAMS, PHYSICS_DT } from '../config';
import { DEG } from '../input/rates';
import { createState, NEUTRAL_INPUT, resetState, step, thrustFromThrottle, type ControlInput } from './DroneModel';
import { fpvDynamics } from './fpvDynamics';
import { interceptorDynamics, solveCruiseTrim } from './interceptorDynamics';
import { telemetry } from './telemetry';

const fpv = { ...FPV_PARAMS };
const itc = { ...INTERCEPTOR_PARAMS };

function run(state: ReturnType<typeof createState>, input: ControlInput, p: typeof fpv, dyn: typeof fpvDynamics, seconds: number) {
  const n = Math.round(seconds / PHYSICS_DT);
  for (let i = 0; i < n; i++) step(state, input, p, dyn, PHYSICS_DT);
}

describe('throttle mapping', () => {
  it('mid stick = hover thrust, full stick = TWR', () => {
    expect(thrustFromThrottle(0.5, fpv)).toBeCloseTo(fpv.mass * GRAVITY);
    expect(thrustFromThrottle(1, fpv)).toBeCloseTo(fpv.mass * GRAVITY * fpv.twr);
    expect(thrustFromThrottle(0, fpv)).toBe(0);
  });
});

describe('FPV drone', () => {
  it('hovers in place at mid throttle', () => {
    const s = createState();
    resetState(s, fpv, fpvDynamics);
    run(s, NEUTRAL_INPUT, fpv, fpvDynamics, 3);
    expect(s.velocity.length()).toBeLessThan(1e-6);
    expect(s.position.y).toBeCloseTo(fpv.spawnAltitude);
  });

  it('throttle up climbs straight up', () => {
    const s = createState();
    resetState(s, fpv, fpvDynamics);
    run(s, { ...NEUTRAL_INPUT, throttle: 0.7 }, fpv, fpvDynamics, 1);
    expect(s.velocity.y).toBeGreaterThan(5);
    expect(Math.hypot(s.velocity.x, s.velocity.z)).toBeLessThan(1e-6);
  });

  it('tilted θ with T = mg/cosθ gives horizontal accel g·tanθ and no vertical accel', () => {
    const theta = 25 * DEG;
    const s = createState();
    resetState(s, fpv, fpvDynamics);
    s.attitude.setFromEuler(new Euler(-theta, 0, 0, 'YXZ')); // 機頭向下
    const throttle = 0.5 + (1 / Math.cos(theta) - 1) / (fpv.twr - 1) / 2;
    step(s, { ...NEUTRAL_INPUT, throttle }, fpv, fpvDynamics, PHYSICS_DT);
    expect(-s.accel.z).toBeCloseTo(GRAVITY * Math.tan(theta), 3); // 往前 (-Z)
    expect(s.accel.y).toBeCloseTo(0, 3);
  });

  it('reaches v_max = sqrt(m·g·tanθ / k) when holding altitude at tilt θ', () => {
    const theta = 30 * DEG;
    const s = createState();
    resetState(s, fpv, fpvDynamics);
    s.attitude.setFromEuler(new Euler(-theta, 0, 0, 'YXZ'));
    const throttle = 0.5 + (1 / Math.cos(theta) - 1) / (fpv.twr - 1) / 2;
    run(s, { ...NEUTRAL_INPUT, throttle }, fpv, fpvDynamics, 30);
    const vmax = Math.sqrt((fpv.mass * GRAVITY * Math.tan(theta)) / fpv.drag);
    expect(Math.hypot(s.velocity.x, s.velocity.z)).toBeCloseTo(vmax, 1);
  });

  it('pitch stick forward → nose down → moves forward and loses altitude', () => {
    const s = createState();
    resetState(s, fpv, fpvDynamics);
    run(s, { ...NEUTRAL_INPUT, pitch: 0.3 }, fpv, fpvDynamics, 0.15);
    run(s, NEUTRAL_INPUT, fpv, fpvDynamics, 1);
    const t = telemetry(s, fpv);
    expect(t.pitchDeg).toBeLessThan(-10);
    expect(t.vForwardH).toBeGreaterThan(1);
    expect(s.position.y).toBeLessThan(fpv.spawnAltitude);
  });

  it('roll stick right → banks right → slides right with heading unchanged', () => {
    const s = createState();
    resetState(s, fpv, fpvDynamics);
    run(s, { ...NEUTRAL_INPUT, roll: 0.3 }, fpv, fpvDynamics, 0.15);
    run(s, NEUTRAL_INPUT, fpv, fpvDynamics, 1);
    const t = telemetry(s, fpv);
    expect(t.rollDeg).toBeGreaterThan(10);
    expect(t.vRightH).toBeGreaterThan(1);
    expect(Math.abs(t.vForwardH)).toBeLessThan(0.05);
  });

  it('yaw only turns the nose, existing velocity keeps drifting', () => {
    const s = createState();
    resetState(s, fpv, fpvDynamics);
    s.velocity.set(0, 0, -8);
    run(s, { ...NEUTRAL_INPUT, yaw: 1 }, fpv, fpvDynamics, 0.4);
    const t = telemetry(s, fpv);
    expect(t.headingDeg).toBeGreaterThan(60);
    expect(t.velHeadingDeg!).toBeCloseTo(0, 3); // 速度仍朝原方向
  });
});

describe('Interceptor', () => {
  it('cruise trim is an equilibrium at mid throttle', () => {
    const trim = solveCruiseTrim(itc);
    expect(trim.pitch).toBeGreaterThan(0);
    expect(trim.pitch).toBeLessThan(45 * DEG);
    const s = createState();
    resetState(s, itc, interceptorDynamics);
    step(s, NEUTRAL_INPUT, itc, interceptorDynamics, PHYSICS_DT);
    expect(s.accel.length()).toBeLessThan(1e-6);
    expect(s.velocity.length()).toBeCloseTo(trim.speed, 6);
  });

  it('throttle accelerates along the nose, not straight up', () => {
    const s = createState();
    resetState(s, itc, interceptorDynamics);
    const v0 = s.velocity.length();
    run(s, { ...NEUTRAL_INPUT, throttle: 0.8 }, itc, interceptorDynamics, 1);
    const t = telemetry(s, itc);
    expect(t.speed).toBeGreaterThan(v0 + 5);
    expect(t.sideslipDeg).toBeLessThan(15);
    expect(t.vForward).toBeGreaterThan(Math.abs(t.vUp) * 3);
  });

  it('pitch stick forward → dives', () => {
    const s = createState();
    resetState(s, itc, interceptorDynamics);
    run(s, { ...NEUTRAL_INPUT, pitch: 0.4 }, itc, interceptorDynamics, 0.3);
    run(s, NEUTRAL_INPUT, itc, interceptorDynamics, 1);
    expect(telemetry(s, itc).gammaDeg).toBeLessThan(-10);
  });

  it('roll only spins around the nose; velocity direction unchanged', () => {
    const s = createState();
    resetState(s, itc, interceptorDynamics);
    const v0 = s.velocity.clone().normalize();
    run(s, { ...NEUTRAL_INPUT, roll: 1 }, itc, interceptorDynamics, 0.5);
    const t = telemetry(s, itc);
    expect(Math.abs(t.rollDeg)).toBeGreaterThan(60);
    expect(s.velocity.clone().normalize().angleTo(v0)).toBeLessThan(1e-6);
  });

  it('yaw stick right → turns right', () => {
    const s = createState();
    resetState(s, itc, interceptorDynamics);
    run(s, { ...NEUTRAL_INPUT, yaw: 0.5 }, itc, interceptorDynamics, 0.5);
    run(s, NEUTRAL_INPUT, itc, interceptorDynamics, 2);
    const vh = telemetry(s, itc).velHeadingDeg!;
    expect(vh).toBeGreaterThan(20);
    expect(vh).toBeLessThan(180);
  });

  it('roll is slower than FPV roll, FPV yaw is slower than interceptor yaw', () => {
    const measure = (p: typeof fpv, dyn: typeof fpvDynamics, input: ControlInput) => {
      const s = createState();
      resetState(s, p, dyn);
      s.attitude.copy(new Quaternion());
      run(s, input, p, dyn, 0.1);
      return s.angularVel.length();
    };
    expect(measure(itc, interceptorDynamics, { ...NEUTRAL_INPUT, roll: 1 })).toBeLessThan(
      measure(fpv, fpvDynamics, { ...NEUTRAL_INPUT, roll: 1 }),
    );
    expect(measure(fpv, fpvDynamics, { ...NEUTRAL_INPUT, yaw: 1 })).toBeLessThan(
      measure(itc, interceptorDynamics, { ...NEUTRAL_INPUT, yaw: 1 }),
    );
  });
});

describe('angle mode', () => {
  it('returns FPV to level when sticks are released', () => {
    const s = createState();
    resetState(s, fpv, fpvDynamics);
    s.attitude.setFromEuler(new Euler(-0.5, 0.3, 0.4, 'YXZ'));
    for (let i = 0; i < 480; i++) step(s, NEUTRAL_INPUT, fpv, fpvDynamics, PHYSICS_DT, true);
    const t = telemetry(s, fpv);
    expect(Math.abs(t.pitchDeg)).toBeLessThan(0.5);
    expect(Math.abs(t.rollDeg)).toBeLessThan(0.5);
  });

  it('holds the commanded bank angle', () => {
    const s = createState();
    resetState(s, fpv, fpvDynamics);
    for (let i = 0; i < 480; i++) step(s, { ...NEUTRAL_INPUT, roll: 0.5 }, fpv, fpvDynamics, PHYSICS_DT, true);
    expect(telemetry(s, fpv).rollDeg).toBeCloseTo(fpv.maxAngleDeg * 0.5, 0);
  });
});
