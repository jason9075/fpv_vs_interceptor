import * as THREE from 'three';

export interface DroneMesh {
  group: THREE.Group;
  /** 每個螺旋槳的旋轉軸心 group，繞自身 local Y 旋轉 */
  props: THREE.Object3D[];
  propDir: number[];
  /** gizmo 軸線長度 */
  gizmoSize: number;
}

export const mat = {
  frame: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 }),
  motor: new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.3, metalness: 0.8 }),
  propFront: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 }),
  propBack: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 }),
  blur: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }),
  accent: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 }),
  battery: new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.7 }),
  led: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
  ledBack: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
};

/** 單支螺旋槳：葉片 + 半透明轉動盤，繞 local Y 旋轉 */
export function makeProp(radius: number, material: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(radius * 2, 0.004, radius * 0.22), material);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.002, 28), mat.blur);
  g.add(blade, disc);
  return g;
}
