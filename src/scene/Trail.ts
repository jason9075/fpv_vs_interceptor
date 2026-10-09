import * as THREE from 'three';

const SAMPLE_HZ = 30;

/** 最近 N 秒的軌跡，顏色依速度漸層（慢 = 藍、快 = 洋紅） */
export class Trail {
  readonly line: THREE.Line;
  private positions: Float32Array;
  private colors: Float32Array;
  private count = 0;
  private acc = 0;
  private slow = new THREE.Color(0x3b82f6);
  private fast = new THREE.Color(0xf0abfc);
  private c = new THREE.Color();

  constructor(private max = 900, private maxSpeed = 40) {
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setDrawRange(0, 0);
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
    this.line.frustumCulled = false;
  }

  clear() {
    this.count = 0;
    this.line.geometry.setDrawRange(0, 0);
  }

  update(pos: THREE.Vector3, speed: number, dt: number) {
    this.acc += dt;
    if (this.acc < 1 / SAMPLE_HZ) return;
    this.acc = 0;
    if (this.count === this.max) {
      this.positions.copyWithin(0, 3);
      this.colors.copyWithin(0, 3);
      this.count--;
    }
    const i = this.count * 3;
    this.positions[i] = pos.x;
    this.positions[i + 1] = pos.y;
    this.positions[i + 2] = pos.z;
    this.c.copy(this.slow).lerp(this.fast, Math.min(1, speed / this.maxSpeed));
    this.colors[i] = this.c.r;
    this.colors[i + 1] = this.c.g;
    this.colors[i + 2] = this.c.b;
    this.count++;
    const geo = this.line.geometry;
    geo.setDrawRange(0, this.count);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
}
