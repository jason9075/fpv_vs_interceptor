import { Vector3 } from 'three';
import { BODY_UP, type Dynamics } from './DroneModel';

/** 四軸穿越機：推力沿機體 up，靠傾斜機身取得水平分量 */
export const fpvDynamics: Dynamics = {
  thrustAxis: new Vector3().copy(BODY_UP),
  extraForce: (_state, _p, out) => out.set(0, 0, 0),
  anglePitchRef: () => 0,
  spawn: () => {
    // 預設：水平懸停
  },
};
