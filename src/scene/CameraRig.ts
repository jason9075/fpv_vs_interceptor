import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { type CamMode, type DroneParams } from '../config';
import { BODY_FORWARD, type DroneState } from '../physics/DroneModel';

/**
 * 追蹤：機體後上方，只跟航向不跟 roll，方便看姿態。
 * FPV：綁在機體上，含鏡頭仰角。
 * 軌道：OrbitControls，target 跟著機體。
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(65, 1, 0.05, 4000);
  readonly controls: OrbitControls;
  mode: CamMode = 'chase';
  private heading = 0; // rad，平滑後
  private lastPos = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private tiltQ = new THREE.Quaternion();

  constructor(domElement: HTMLElement) {
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49; // 不鑽到地面以下（地面層不寫深度）
  }

  setMode(mode: CamMode, s: DroneState) {
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
    if (mode === 'orbit') {
      this.controls.target.copy(s.position);
      this.lastPos.copy(s.position);
    }
  }

  snap(s: DroneState, p: DroneParams) {
    this.heading = this.targetHeading(s, this.heading);
    this.update(s, p, 1);
  }

  private targetHeading(s: DroneState, fallback: number) {
    // 機頭水平投影；機頭接近垂直時改用水平速度方向
    this.fwd.copy(BODY_FORWARD).applyQuaternion(s.attitude);
    const v = s.velocity;
    if (Math.hypot(this.fwd.x, this.fwd.z) > 0.2) return Math.atan2(this.fwd.x, -this.fwd.z);
    if (Math.hypot(v.x, v.z) > 1) return Math.atan2(v.x, -v.z);
    return fallback;
  }

  update(s: DroneState, p: DroneParams, dt: number) {
    const pos = s.position;
    if (this.mode === 'chase') {
      const target = this.targetHeading(s, this.heading);
      let d = target - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * (1 - Math.exp(-dt * 4));
      const fx = Math.sin(this.heading);
      const fz = -Math.cos(this.heading);
      // 鏡頭在斜後方（偏左），看得到機頭方向的向量
      const camA = this.heading - (p.chaseSideDeg * Math.PI) / 180;
      this.camera.position.set(
        pos.x - Math.sin(camA) * p.chaseDistance,
        pos.y + p.chaseHeight,
        pos.z + Math.cos(camA) * p.chaseDistance,
      );
      this.camera.position.y = Math.max(0.3, this.camera.position.y);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(pos.x + fx * 2, pos.y + 0.3, pos.z + fz * 2);
    } else if (this.mode === 'fpv') {
      this.tiltQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (p.camTiltDeg * Math.PI) / 180);
      this.camera.quaternion.copy(s.attitude).multiply(this.tiltQ);
      this.camera.position.copy(this.fwd.copy(BODY_FORWARD).multiplyScalar(0.3).applyQuaternion(s.attitude)).add(pos);
    } else {
      // 跟著機體平移，使用者可自由繞看
      this.camera.position.add(this.fwd.copy(pos).sub(this.lastPos));
      this.controls.target.copy(pos);
      this.lastPos.copy(pos);
      this.controls.update();
    }
  }
}
