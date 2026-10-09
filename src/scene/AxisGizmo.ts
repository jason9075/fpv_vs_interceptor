import * as THREE from 'three';
import { COLORS } from '../config';
import type { ControlInput } from '../physics/DroneModel';
import { makeLabel } from './labels';
import { FatArrow } from './VectorArrows';

interface AxisVis {
  arrow: FatArrow;
  arc: THREE.Group;
  spin: THREE.Group;
  mats: THREE.MeshBasicMaterial[];
  label: THREE.Sprite;
}

/**
 * 掛在機體上的 RGB 座標軸：Roll（紅，機頭軸）、Pitch（綠，右方軸）、Yaw（藍，上方軸）。
 * 被搖桿驅動的軸高亮，並顯示旋轉方向的弧形箭頭。
 */
export class AxisGizmo {
  readonly group = new THREE.Group();
  private axes: Record<'pitch' | 'yaw' | 'roll', AxisVis>;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(size: number) {
    this.axes = {
      // body x = pitch、y = yaw、z = roll；roll 軸畫在機頭方向 (-Z)
      pitch: this.makeAxis(new THREE.Vector3(1, 0, 0), new THREE.Euler(0, Math.PI / 2, 0), COLORS.pitch, 'Pitch', size),
      yaw: this.makeAxis(new THREE.Vector3(0, 1, 0), new THREE.Euler(-Math.PI / 2, 0, 0), COLORS.yaw, 'Yaw', size),
      roll: this.makeAxis(new THREE.Vector3(0, 0, -1), new THREE.Euler(0, 0, 0), COLORS.roll, 'Roll', size),
    };
  }

  private makeAxis(dir: THREE.Vector3, arcRot: THREE.Euler, color: number, name: string, size: number): AxisVis {
    const arrow = new FatArrow(color, 0.008);
    arrow.set(new THREE.Vector3(), dir, size);
    const mats = arrow.children.map((c) => (c as THREE.Mesh).material as THREE.MeshBasicMaterial);
    for (const m of mats) m.transparent = true;

    // 弧形箭頭：在 local XY 平面從 0 掃到 270°，箭頭指向「繞 local +Z 正轉」
    const r = size * 0.28;
    const arcMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    const spin = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.07, 6, 40, Math.PI * 1.5), arcMat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * 0.5, 12).rotateZ(-Math.PI / 2), arcMat);
    head.position.set(0, -r, 0);
    spin.add(torus, head);
    const arc = new THREE.Group();
    arc.add(spin);
    arc.rotation.copy(arcRot);
    // 弧的中心放在軸線 0.7 處；roll 軸畫在 -Z 但旋轉正向仍是 +Z
    arc.position.copy(dir).multiplyScalar(size * 0.7);
    arc.visible = false;

    const label = makeLabel(name, color, size * 0.22);
    label.position.copy(dir).multiplyScalar(size + 0.08);
    this.group.add(arrow, arc, label);
    return { arrow, arc, spin, mats, label };
  }

  /** stick 決定高亮；角速度符號決定弧形箭頭方向 */
  update(input: Readonly<ControlInput>, angularVel: THREE.Vector3, dt: number) {
    const entries: [keyof typeof this.axes, number, number][] = [
      ['pitch', input.pitch, angularVel.x],
      ['yaw', input.yaw, angularVel.y],
      ['roll', input.roll, angularVel.z],
    ];
    for (const [k, stick, w] of entries) {
      const a = this.axes[k];
      const active = Math.abs(stick) > 0.05;
      for (const m of a.mats) m.opacity = active ? 1 : 0.45;
      a.arrow.scale.setScalar(active ? 1.25 : 1);
      a.arc.visible = active && Math.abs(w) > 0.05;
      a.label.material.opacity = active ? 1 : 0.6;
      if (a.arc.visible) {
        // 鏡射 Y 讓掃描方向反轉 → 負角速度
        a.arc.scale.set(1, Math.sign(w), 1);
        if (!this.reducedMotion) a.spin.rotation.z += Math.min(Math.abs(w), 6) * dt * 0.6;
      }
    }
  }
}
