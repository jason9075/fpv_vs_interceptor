import { Euler, Vector3 } from 'three';
import { GRAVITY, type DroneParams } from '../config';
import { BODY_FORWARD, BODY_RIGHT, BODY_UP, type DroneState } from './DroneModel';

const RAD = 180 / Math.PI;

export interface Telemetry {
  rollDeg: number; // + = 右傾
  pitchDeg: number; // + = 機頭上
  headingDeg: number; // 0 = 起始方向，順時針 +
  tiltDeg: number; // 機體 up 與世界 up 的夾角
  rollRate: number; // deg/s，+ = 向右
  pitchRate: number; // deg/s，+ = 機頭上
  yawRate: number; // deg/s，+ = 機頭向右
  speed: number; // m/s
  vForward: number; // 機體座標分量
  vRight: number;
  vUp: number;
  vHorizontal: number; // 世界座標
  vVertical: number;
  velHeadingDeg: number | null; // 水平速度方向，太慢時為 null
  gammaDeg: number; // 飛行路徑角
  sideslipDeg: number; // 機頭與速度向量夾角
  altitude: number;
  thrustRatio: number; // T / (m·g)
  /** 水平加速度在機頭水平方向、右方的分量 */
  aForwardH: number;
  aRightH: number;
  /** 水平速度在機頭水平方向、右方的分量（看 drift 用） */
  vForwardH: number;
  vRightH: number;
}

const _e = new Euler();
const _f = new Vector3();
const _r = new Vector3();
const _u = new Vector3();

export function telemetry(s: DroneState, p: DroneParams): Telemetry {
  _e.setFromQuaternion(s.attitude, 'YXZ');
  _f.copy(BODY_FORWARD).applyQuaternion(s.attitude);
  _r.copy(BODY_RIGHT).applyQuaternion(s.attitude);
  _u.copy(BODY_UP).applyQuaternion(s.attitude);
  const v = s.velocity;
  const speed = v.length();
  const vh = Math.hypot(v.x, v.z);

  // 機頭水平方向；機頭幾乎垂直時退回用機體 up 的反方向（tailsitter 懸停）
  let hx = _f.x;
  let hz = _f.z;
  if (Math.hypot(hx, hz) < 0.15) {
    hx = -_u.x;
    hz = -_u.z;
  }
  const hl = Math.hypot(hx, hz) || 1;
  hx /= hl;
  hz /= hl;
  // 右方 = forward × up = (-hz, 0, hx)
  const rx = -hz;
  const rz = hx;

  const wrap360 = (d: number) => ((d % 360) + 360) % 360;
  return {
    rollDeg: -_e.z * RAD,
    pitchDeg: _e.x * RAD,
    headingDeg: wrap360(Math.atan2(hx, -hz) * RAD),
    tiltDeg: Math.acos(Math.min(1, Math.max(-1, _u.y))) * RAD,
    rollRate: -s.angularVel.z * RAD,
    pitchRate: s.angularVel.x * RAD,
    yawRate: -s.angularVel.y * RAD,
    speed,
    vForward: v.dot(_f),
    vRight: v.dot(_r),
    vUp: v.dot(_u),
    vHorizontal: vh,
    vVertical: v.y,
    velHeadingDeg: vh > 0.5 ? wrap360(Math.atan2(v.x, -v.z) * RAD) : null,
    gammaDeg: speed > 0.5 ? Math.atan2(v.y, vh) * RAD : 0,
    sideslipDeg: speed > 0.5 ? Math.acos(Math.min(1, Math.max(-1, v.dot(_f) / speed))) * RAD : 0,
    altitude: s.position.y,
    thrustRatio: s.thrust / (p.mass * GRAVITY),
    aForwardH: s.accel.x * hx + s.accel.z * hz,
    aRightH: s.accel.x * rx + s.accel.z * rz,
    vForwardH: v.x * hx + v.z * hz,
    vRightH: v.x * rx + v.z * rz,
  };
}

/** 角度差，回傳 (-180, 180] */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}
