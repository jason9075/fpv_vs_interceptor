import { Euler, Quaternion, Vector3 } from 'three';
import { GRAVITY, settings, type DroneParams } from '../config';
import { DEG, rateCurve } from '../input/rates';

export interface ControlInput {
  throttle: number; // [0, 1]，0.5 = 懸停推力 (T = m·g)
  yaw: number; // [-1, 1]，+ = 機頭向右
  pitch: number; // [-1, 1]，+ = 推桿 = 機頭向下
  roll: number; // [-1, 1]，+ = 向右滾
}

export const NEUTRAL_INPUT: Readonly<ControlInput> = { throttle: 0.5, yaw: 0, pitch: 0, roll: 0 };

export interface DroneState {
  position: Vector3; // world, m
  velocity: Vector3; // world, m/s
  attitude: Quaternion; // body → world
  /** body frame rad/s：x = pitch（+ 機頭上）、y = yaw（+ 機頭左）、z = roll（+ 左滾） */
  angularVel: Vector3;
  thrust: number; // N
  accel: Vector3; // world, m/s²（上一步的結果，給 HUD / 說明用）
  onGround: boolean;
}

/** 兩種機型唯一不同的地方：推力軸、額外外力、angle mode 參考姿態、出生狀態 */
export interface Dynamics {
  thrustAxis: Vector3; // body frame
  extraForce(state: DroneState, p: DroneParams, out: Vector3): Vector3;
  anglePitchRef(p: DroneParams): number; // rad，機頭上仰為 +
  spawn(state: DroneState, p: DroneParams): void;
}

// three.js 機體座標：forward = -Z、right = +X、up = +Y
export const BODY_FORWARD: Readonly<Vector3> = new Vector3(0, 0, -1);
export const BODY_RIGHT: Readonly<Vector3> = new Vector3(1, 0, 0);
export const BODY_UP: Readonly<Vector3> = new Vector3(0, 1, 0);

export function createState(): DroneState {
  return {
    position: new Vector3(),
    velocity: new Vector3(),
    attitude: new Quaternion(),
    angularVel: new Vector3(),
    thrust: 0,
    accel: new Vector3(),
    onGround: false,
  };
}

/** 油門中點 = 懸停推力，讓兩台機共用同一根油門時都從「平衡」出發 */
export function thrustFromThrottle(throttle: number, p: DroneParams): number {
  const t = Math.min(1, Math.max(0, throttle));
  const ratio = t < 0.5 ? 2 * t : 1 + (p.twr - 1) * (2 * t - 1);
  return p.mass * GRAVITY * ratio;
}

const _euler = new Euler();
const _qTarget = new Quaternion();
const _qErr = new Quaternion();

export function computeTargetRates(
  input: ControlInput,
  state: DroneState,
  p: DroneParams,
  dyn: Dynamics,
  angleMode: boolean,
  out: Vector3,
): Vector3 {
  const expo = settings.expo;
  const yawRate = -rateCurve(input.yaw, expo) * p.yaw.maxRateDeg * DEG;
  if (!angleMode) {
    // 搖桿量 = 角速度。正負號見 DroneState.angularVel 註解
    return out.set(
      -rateCurve(input.pitch, expo) * p.pitch.maxRateDeg * DEG,
      yawRate,
      -rateCurve(input.roll, expo) * p.roll.maxRateDeg * DEG,
    );
  }
  // 搖桿量 = 目標角度；保留目前航向，只控制俯仰與滾轉
  _euler.setFromQuaternion(state.attitude, 'YXZ');
  const maxA = p.maxAngleDeg * DEG;
  _euler.set(dyn.anglePitchRef(p) - input.pitch * maxA, _euler.y, -input.roll * maxA, 'YXZ');
  _qTarget.setFromEuler(_euler);
  _qErr.copy(state.attitude).invert().multiply(_qTarget);
  if (_qErr.w < 0) _qErr.set(-_qErr.x, -_qErr.y, -_qErr.z, -_qErr.w);
  const s = Math.sqrt(Math.max(1e-12, 1 - _qErr.w * _qErr.w));
  const angle = 2 * Math.acos(Math.min(1, _qErr.w));
  const k = (angle / s) * p.angleKp;
  const clamp = (v: number, maxDeg: number) => Math.max(-maxDeg * DEG, Math.min(maxDeg * DEG, v));
  return out.set(
    clamp(_qErr.x * k, p.pitch.maxRateDeg),
    clamp(_qErr.y * k, p.yaw.maxRateDeg) + yawRate,
    clamp(_qErr.z * k, p.roll.maxRateDeg),
  );
}

const _wTarget = new Vector3();
const _dq = new Quaternion();
const _axis = new Vector3();
const _force = new Vector3();
const _tmp = new Vector3();

export function step(
  state: DroneState,
  input: ControlInput,
  p: DroneParams,
  dyn: Dynamics,
  dt: number,
  angleMode = false,
): void {
  // 1–2. 目標角速度 + 每軸一階響應
  computeTargetRates(input, state, p, dyn, angleMode, _wTarget);
  const w = state.angularVel;
  w.x += (_wTarget.x - w.x) * (1 - Math.exp(-dt / p.pitch.tau));
  w.y += (_wTarget.y - w.y) * (1 - Math.exp(-dt / p.yaw.tau));
  w.z += (_wTarget.z - w.z) * (1 - Math.exp(-dt / p.roll.tau));

  // 3. 姿態積分（body frame 角速度 → 右乘）
  const wLen = w.length();
  if (wLen > 1e-9) {
    _dq.setFromAxisAngle(_axis.copy(w).divideScalar(wLen), wLen * dt);
    state.attitude.multiply(_dq).normalize();
  }

  // 4–6. 推力 + 重力 + 二次阻力 + 機型額外外力
  state.thrust = thrustFromThrottle(input.throttle, p);
  _force.copy(dyn.thrustAxis).applyQuaternion(state.attitude).multiplyScalar(state.thrust);
  _force.y -= p.mass * GRAVITY;
  const v = state.velocity;
  _force.addScaledVector(v, -p.drag * v.length());
  _force.add(dyn.extraForce(state, p, _tmp));

  // 7–8. 半隱式 Euler
  state.accel.copy(_force).divideScalar(p.mass);
  v.addScaledVector(state.accel, dt);
  state.position.addScaledVector(v, dt);

  // 9. 地面
  state.onGround = state.position.y <= p.groundClearance;
  if (state.onGround) {
    state.position.y = p.groundClearance;
    if (v.y < 0) v.y = 0;
    const friction = Math.exp(-4 * dt);
    v.x *= friction;
    v.z *= friction;
  }
}

export function resetState(state: DroneState, p: DroneParams, dyn: Dynamics): void {
  state.position.set(0, p.spawnAltitude, 0);
  state.velocity.set(0, 0, 0);
  state.attitude.identity();
  state.angularVel.set(0, 0, 0);
  state.accel.set(0, 0, 0);
  state.thrust = p.mass * GRAVITY;
  state.onGround = false;
  dyn.spawn(state, p);
}
