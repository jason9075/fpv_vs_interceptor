import * as THREE from 'three';
import { COLORS, GRAVITY, settings, type DroneParams } from '../config';
import type { Dynamics, DroneState } from '../physics/DroneModel';

const UP = new THREE.Vector3(0, 1, 0);
const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
const headGeo = new THREE.ConeGeometry(1, 1, 14).translate(0, -0.5, 0); // 尖端在 y = 0

/** 有粗細的箭頭（ArrowHelper 只有 1px 線） */
export class FatArrow extends THREE.Group {
  private shaft: THREE.Mesh;
  private head: THREE.Mesh;

  constructor(color: number, private radius = 0.025, opacity = 1) {
    super();
    const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    this.shaft = new THREE.Mesh(shaftGeo, m);
    this.head = new THREE.Mesh(headGeo, m);
    this.add(this.shaft, this.head);
  }

  /** dir 不需正規化；長度 = len（公尺） */
  set(origin: THREE.Vector3, dir: THREE.Vector3, len: number) {
    const l = dir.length();
    this.visible = len > 0.03 && l > 1e-6;
    if (!this.visible) return;
    this.position.copy(origin);
    this.quaternion.setFromUnitVectors(UP, _d.copy(dir).divideScalar(l));
    const headLen = Math.min(len * 0.4, this.radius * 7);
    this.shaft.scale.set(this.radius, Math.max(1e-4, len - headLen), this.radius);
    this.head.scale.set(this.radius * 2.6, headLen, this.radius * 2.6);
    this.head.position.y = len;
  }
}
const _d = new THREE.Vector3();

/** 推力（黃）、速度（青）、速度水平/垂直分量（淡青）、重力（灰），畫在世界座標 */
export class VectorArrows {
  readonly group = new THREE.Group();
  private thrust = new FatArrow(COLORS.thrust, 0.022);
  private vel = new FatArrow(COLORS.velocity, 0.03);
  private velH = new FatArrow(COLORS.velocity, 0.016, 0.35);
  private velV = new FatArrow(COLORS.velocity, 0.016, 0.35);
  private gravity = new FatArrow(COLORS.gravity, 0.018, 0.7);
  private tmp = new THREE.Vector3();
  private tip = new THREE.Vector3();

  constructor() {
    this.group.add(this.thrust, this.vel, this.velH, this.velV, this.gravity);
  }

  update(s: DroneState, p: DroneParams, dyn: Dynamics) {
    const o = s.position;
    const mg = p.mass * GRAVITY;
    this.tmp.copy(dyn.thrustAxis).applyQuaternion(s.attitude);
    this.thrust.set(o, this.tmp, (s.thrust / mg) * p.thrustArrowScale);

    const v = s.velocity;
    this.vel.set(o, v, v.length() * p.velArrowScale);
    this.velH.visible = this.velV.visible = settings.showComponents;
    if (settings.showComponents) {
      this.tmp.set(v.x, 0, v.z);
      this.velH.set(o, this.tmp, this.tmp.length() * p.velArrowScale);
      // 垂直分量畫在水平分量的末端，組成直角三角形
      this.tip.copy(o).addScaledVector(this.tmp, p.velArrowScale);
      this.tmp.set(0, v.y, 0);
      this.velV.set(this.tip, this.tmp, Math.abs(v.y) * p.velArrowScale);
    }
    this.gravity.visible = settings.showGravity;
    if (settings.showGravity) this.gravity.set(o, this.tmp.set(0, -1, 0), p.thrustArrowScale);
  }
}
