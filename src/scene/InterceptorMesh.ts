import * as THREE from 'three';
import { makeProp, mat, type DroneMesh } from './meshParts';

/** 子彈型攔截機：機身沿 Z，馬達在尾部朝後吹（推力 = 機頭 -Z），背鰭標示機體 +Y */
export function createInterceptorMesh(): DroneMesh {
  const g = new THREE.Group();
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.7, 20).rotateX(Math.PI / 2), mat.frame);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 20).rotateX(-Math.PI / 2), mat.accent);
  nose.position.z = -0.45;
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), mat.dark);
  lens.position.set(0, 0.0, -0.52);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.5), mat.battery);
  stripe.position.set(0, 0.06, -0.02);
  // 背鰭：讓 roll 一眼看得出來
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.12, 0.2), mat.propFront);
  fin.position.set(0, 0.11, 0.2);
  g.add(fuselage, nose, lens, stripe, fin);

  // 尾部 X 型支架 + 四顆朝後的馬達
  const tailZ = 0.33;
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.03), mat.frame);
    arm.rotation.z = a;
    arm.position.z = tailZ;
    g.add(arm);
  }
  const props: THREE.Object3D[] = [];
  const propDir: number[] = [];
  const d = 0.17;
  const corners: [number, number, number][] = [
    [-d, d, 1],
    [d, d, -1],
    [-d, -d, -1],
    [d, -d, 1],
  ];
  for (const [x, y, dir] of corners) {
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 16).rotateX(Math.PI / 2), mat.motor);
    motor.position.set(x, y, tailZ + 0.02);
    // 螺旋槳盤面垂直於 Z：外層轉 90°，內層 prop 繞自身 Y 轉
    const holder = new THREE.Group();
    holder.position.set(x, y, tailZ + 0.05);
    holder.rotation.x = Math.PI / 2;
    const prop = makeProp(0.11, y > 0 ? mat.propFront : mat.propBack);
    holder.add(prop);
    g.add(motor, holder);
    props.push(prop);
    propDir.push(dir);
  }
  return { group: g, props, propDir, gizmoSize: 0.7 };
}
