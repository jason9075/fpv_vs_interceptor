import * as THREE from 'three';
import { makeProp, mat, type DroneMesh } from './meshParts';

/** X 型四軸：機身水平，螺旋槳朝上（推力 = 機體 +Y），機頭 = -Z */
export function createFpvMesh(): DroneMesh {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.24), mat.frame);
  const battery = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.15), mat.battery);
  battery.position.set(0, 0.05, 0.01);
  g.add(body, battery);

  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.02, 0.045), mat.frame);
    arm.rotation.y = a;
    g.add(arm);
  }

  // 鏡頭：機頭前方、上仰 30°
  const cam = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), mat.dark);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 16).rotateX(Math.PI / 2), mat.accent);
  lens.position.z = -0.03;
  cam.add(housing, lens);
  cam.position.set(0, 0.025, -0.13);
  cam.rotation.x = (30 * Math.PI) / 180;
  g.add(cam);

  const ledF = new THREE.Mesh(new THREE.SphereGeometry(0.012), mat.led);
  ledF.position.set(0, -0.03, -0.12);
  const ledB = new THREE.Mesh(new THREE.SphereGeometry(0.012), mat.ledBack);
  ledB.position.set(0, -0.03, 0.12);
  g.add(ledF, ledB);

  const props: THREE.Object3D[] = [];
  const propDir: number[] = [];
  const d = 0.226;
  const corners: [number, number, number][] = [
    [-d, -d, 1], // 左前
    [d, -d, -1], // 右前
    [-d, d, -1], // 左後
    [d, d, 1], // 右後
  ];
  for (const [x, z, dir] of corners) {
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.035, 16), mat.motor);
    motor.position.set(x, 0.02, z);
    const prop = makeProp(0.125, z < 0 ? mat.propFront : mat.propBack);
    prop.position.set(x, 0.045, z);
    g.add(motor, prop);
    props.push(prop);
    propDir.push(dir);
  }
  return { group: g, props, propDir, gizmoSize: 0.55 };
}
