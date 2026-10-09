// 所有可調參數集中在這裡（guideline §4.3）。dev 面板 (lil-gui) 直接改這些物件。

export type DroneKind = 'fpv' | 'interceptor';
export type Axis = 'throttle' | 'yaw' | 'pitch' | 'roll';
export type CamMode = 'chase' | 'fpv' | 'orbit';

export interface AxisRate {
  /** 滿舵角速度 (deg/s) */
  maxRateDeg: number;
  /** 一階響應時間常數 (s) */
  tau: number;
}

export interface DroneParams {
  kind: DroneKind;
  label: string;
  tagline: string;
  mass: number; // kg
  twr: number; // 推重比 T_max / (m·g)
  drag: number; // 二次阻力 k，F = k·v²
  align: number; // 垂直於機頭方向的側向阻力 c_align
  pitch: AxisRate;
  roll: AxisRate;
  yaw: AxisRate;
  maxAngleDeg: number; // angle mode 最大角度
  angleKp: number; // angle mode 角度誤差 → 角速度增益
  spawnAltitude: number; // m
  groundClearance: number; // 機體中心離地高度 (m)
  velArrowScale: number; // 速度箭頭：每 m/s 幾公尺
  thrustArrowScale: number; // 推力箭頭：每 1 倍 m·g 幾公尺
  camTiltDeg: number; // FPV 鏡頭相對機體的仰角
  chaseDistance: number;
  chaseHeight: number;
  chaseSideDeg: number; // 追蹤鏡頭偏離正後方的角度，讓前進向量不被透視壓扁
}

export const GRAVITY = 9.81;
export const PHYSICS_DT = 1 / 240;
export const MAX_FRAME_DT = 0.1;

export const FPV_PARAMS: DroneParams = {
  kind: 'fpv',
  label: 'FPV Drone',
  tagline: '推力朝上 · 傾斜去前進',
  mass: 0.65,
  twr: 6,
  drag: 0.02,
  align: 0,
  pitch: { maxRateDeg: 670, tau: 0.03 },
  roll: { maxRateDeg: 670, tau: 0.03 },
  yaw: { maxRateDeg: 400, tau: 0.08 }, // 反扭力 → 較慢
  maxAngleDeg: 55,
  angleKp: 8,
  spawnAltitude: 10,
  groundClearance: 0.06,
  velArrowScale: 0.3,
  thrustArrowScale: 1.2,
  camTiltDeg: 30,
  chaseDistance: 4,
  chaseHeight: 1.4,
  chaseSideDeg: 30,
};

export const INTERCEPTOR_PARAMS: DroneParams = {
  kind: 'interceptor',
  label: 'Interceptor',
  tagline: '推力朝前 · 指哪飛哪',
  mass: 0.9,
  twr: 8,
  drag: 0.006,
  align: 1.2,
  pitch: { maxRateDeg: 400, tau: 0.04 },
  roll: { maxRateDeg: 250, tau: 0.08 }, // 反扭力 → 較慢
  yaw: { maxRateDeg: 400, tau: 0.04 },
  maxAngleDeg: 60,
  angleKp: 6,
  spawnAltitude: 30,
  groundClearance: 0.08,
  velArrowScale: 0.08,
  thrustArrowScale: 1.2,
  camTiltDeg: -10, // 鏡頭略朝下，抵銷巡航時的機頭上仰
  chaseDistance: 6,
  chaseHeight: 1.8,
  chaseSideDeg: 35,
};

/** 全站共用的執行期設定 */
export const settings = {
  expo: 0.3,
  angleMode: false,
  stickMode: 2 as 1 | 2,
  layout: 'split' as 'split' | 'single',
  single: 'fpv' as DroneKind,
  camMode: 'chase' as CamMode,
  paused: false,
  showGravity: true,
  showComponents: true,
  showTrail: true,
  theme: 'light' as 'dark' | 'light',
};

export const COLORS = {
  roll: 0xef4444,
  pitch: 0x22c55e,
  yaw: 0x3b82f6,
  thrust: 0xfacc15,
  velocity: 0x22d3ee,
  gravity: 0x9ca3af,
};
