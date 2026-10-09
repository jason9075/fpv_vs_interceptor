import { Euler, Vector3 } from 'three';
import { GRAVITY, type DroneParams } from '../config';
import { BODY_FORWARD, type Dynamics } from './DroneModel';

const _nose = new Vector3();

/**
 * 油門中點 (T = m·g) 時的定高巡航配平：機頭上仰 θ、速度 v 水平。
 * 沿水平：T·cosθ = k·v² + c·v·sin²θ
 * 沿垂直：T·sinθ + c·v·sinθ·cosθ = m·g   （側向阻力在有攻角時提供「升力」）
 */
export function solveCruiseTrim(p: DroneParams): { pitch: number; speed: number } {
  const mg = p.mass * GRAVITY;
  const speedAt = (th: number) => {
    const b = p.align * Math.sin(th) ** 2;
    if (p.drag < 1e-9) return b > 1e-9 ? (mg * Math.cos(th)) / b : Infinity;
    return (-b + Math.sqrt(b * b + 4 * p.drag * mg * Math.cos(th))) / (2 * p.drag);
  };
  const residual = (th: number) => {
    const v = speedAt(th);
    return mg * Math.sin(th) + p.align * v * Math.sin(th) * Math.cos(th) - mg;
  };
  let lo = 0.005;
  let hi = 0.8;
  if (residual(hi) <= 0 || !Number.isFinite(speedAt(lo))) return { pitch: Math.PI / 2, speed: 0 };
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (residual(mid) > 0) hi = mid;
    else lo = mid;
  }
  const pitch = (lo + hi) / 2;
  return { pitch, speed: speedAt(pitch) };
}

let cacheKey = '';
let cacheVal = { pitch: 0, speed: 0 };
export function cruiseTrim(p: DroneParams) {
  const key = `${p.mass}|${p.drag}|${p.align}`;
  if (key !== cacheKey) {
    cacheKey = key;
    cacheVal = solveCruiseTrim(p);
  }
  return cacheVal;
}

/** Tailsitter 式攔截機：推力沿機頭，細長機身讓速度向量追隨機頭 */
export const interceptorDynamics: Dynamics = {
  thrustAxis: new Vector3().copy(BODY_FORWARD),
  extraForce: (state, p, out) => {
    _nose.copy(BODY_FORWARD).applyQuaternion(state.attitude);
    const v = state.velocity;
    // v_perp = v − (v·n)n，側向阻力 F = −c·v_perp
    return out.copy(v).addScaledVector(_nose, -v.dot(_nose)).multiplyScalar(-p.align);
  },
  anglePitchRef: (p) => cruiseTrim(p).pitch,
  spawn: (state, p) => {
    // 從定高巡航開始，油門中點即可維持
    const trim = cruiseTrim(p);
    state.attitude.setFromEuler(new Euler(trim.pitch, 0, 0, 'YXZ'));
    state.velocity.set(0, 0, -trim.speed);
  },
};
