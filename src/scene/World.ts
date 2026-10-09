import * as THREE from 'three';

const GRID_SIZE = 600;
const GRID_CELL = 10; // m，跟圖例一致
const HORIZON = 0xcfe4f2;
const SUN_DIR = new THREE.Vector3(-0.45, 0.7, -0.55).normalize();

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 草地貼圖：canvas 隨機斑點，重複鋪滿 */
function grassTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#6f9a4a';
  ctx.fillRect(0, 0, size, size);
  const rand = mulberry32(3);
  const tones = ['#628c40', '#7aa553', '#83ad5a', '#5a8239', '#8bb262'];
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = tones[(rand() * tones.length) | 0];
    const r = 1 + rand() * 5;
    ctx.globalAlpha = 0.35 + rand() * 0.4;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(400, 400); // 8000 m / 400 = 每張 20 m
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ── 兩個 scene 共用的幾何與材質 ───────────────────────────────────────────
const groundGeo = new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2);
// 地面層（草地 → 跑道 → 起飛圈）都在 y = 0、不寫深度，靠 renderOrder 依序疊上去。
// 共平面的東西不比深度，就不可能 z-fighting；地面上方的物體照常寫深度，一定畫在地面之上。
// （鏡頭不會進到地面以下：追蹤鏡頭有高度下限、軌道鏡頭限制仰角）
const groundLayer = { depthWrite: false };
const groundMat = new THREE.MeshLambertMaterial({ map: grassTexture(), ...groundLayer });
const runwayGeo = new THREE.PlaneGeometry(14, 480).rotateX(-Math.PI / 2);
const runwayMat = new THREE.MeshLambertMaterial({ color: 0xc8b48a, ...groundLayer });
const padGeo = new THREE.RingGeometry(1.2, 1.6, 40).rotateX(-Math.PI / 2);
const padMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, ...groundLayer });

const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1, 6).translate(0, 0.5, 0);
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
const pineGeo = new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0);
const leafGeo = new THREE.IcosahedronGeometry(1, 1);
const foliageMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // 用 instanceColor 上色

const houseGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const houseMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const roofGeo = new THREE.ConeGeometry(0.75, 0.5, 4).rotateY(Math.PI / 4).translate(0, 0.25, 0);
const roofMat = new THREE.MeshLambertMaterial({ color: 0xb4533a });

const mountainGeo = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
const mountainMat = new THREE.MeshLambertMaterial({ color: 0x7f9a8a });
const cloudGeo = new THREE.IcosahedronGeometry(1, 2);
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa6b2 });

const gateBarGeo = new THREE.BoxGeometry(1, 1, 1);
const gateMat = new THREE.MeshLambertMaterial({ color: 0xff8a1f, emissive: 0x401800 });
const gateStripeMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });

/** 天空：漸層球（天頂藍 → 地平線淡藍）+ 太陽光暈，不受霧影響 */
function makeSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3d8fd9) },
      horizon: { value: new THREE.Color(HORIZON) },
      sunDir: { value: SUN_DIR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // 永遠在最遠處
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.95, 0.8) * (pow(s, 900.0) * 1.2 + pow(s, 12.0) * 0.25);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  sky.scale.setScalar(3500);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}

/** 外景：天空、草地、跑道、樹林、房子、遠山、雲、門框。每台機各有一個 World（各自的 scene） */
export class World {
  readonly scene = new THREE.Scene();
  private sky: THREE.Mesh;
  private grid: THREE.GridHelper;

  constructor() {
    const s = this.scene;
    s.background = new THREE.Color(HORIZON);
    s.fog = new THREE.Fog(HORIZON, 150, 3300);

    s.add(new THREE.HemisphereLight(0xcfe8ff, 0x5d7a3a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    sun.position.copy(SUN_DIR);
    s.add(sun);

    this.sky = makeSky();
    s.add(this.sky);

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.renderOrder = -5;
    s.add(ground);
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.position.set(0, 0, -200);
    runway.renderOrder = -4;
    s.add(runway);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.renderOrder = -3;
    s.add(pad);

    // 淡淡的 10 m 格線：保留速度感與距離參考
    this.grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE / GRID_CELL, 0xffffff, 0xffffff);
    const gm = this.grid.material as THREE.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0.16;
    gm.depthWrite = false;
    this.grid.position.y = 0.05;
    s.add(this.grid);

    this.addTrees();
    this.addHouses();
    this.addMountains();
    this.addClouds();
    this.addGates();
  }

  private addTrees() {
    const rand = mulberry32(7);
    const count = 1400;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const pines = new THREE.InstancedMesh(pineGeo, foliageMat, count);
    const leafy = new THREE.InstancedMesh(leafGeo, foliageMat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // 群聚分布：先挑樹林中心再散開
      const cx = Math.floor(rand() * 40);
      const r2 = mulberry32(cx + 100);
      const gx = (r2() * 2 - 1) * 1800;
      const gz = (r2() * 2 - 1) * 1800;
      let x = gx + (rand() * 2 - 1) * 90;
      let z = gz + (rand() * 2 - 1) * 90;
      if (Math.abs(x) < 30 && z < 40 && z > -480) x += 80 * Math.sign(x || 1); // 起飛走廊留空
      const h = 6 + rand() * 14;
      const w = h * (0.25 + rand() * 0.12);
      const trunkH = h * 0.35;
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1 + w * 0.1, trunkH, 1 + w * 0.1));
      trunks.setMatrixAt(i, m);
      const isPine = rand() < 0.5;
      col.setHSL(0.27 + rand() * 0.08, 0.45 + rand() * 0.2, isPine ? 0.22 + rand() * 0.06 : 0.3 + rand() * 0.08);
      if (isPine) {
        m.compose(new THREE.Vector3(x, trunkH * 0.6, z), q, new THREE.Vector3(w, h - trunkH * 0.6, w));
        pines.setMatrixAt(i, m);
        pines.setColorAt(i, col);
        leafy.setMatrixAt(i, zero);
        leafy.setColorAt(i, col);
      } else {
        m.compose(new THREE.Vector3(x, trunkH + w * 0.8, z), q, new THREE.Vector3(w * 1.2, w * 1.1, w * 1.2));
        leafy.setMatrixAt(i, m);
        leafy.setColorAt(i, col);
        pines.setMatrixAt(i, zero);
        pines.setColorAt(i, col);
      }
    }
    this.scene.add(trunks, pines, leafy);
  }

  private addHouses() {
    const rand = mulberry32(11);
    const count = 60;
    const walls = new THREE.InstancedMesh(houseGeo, houseMat, count);
    const roofs = new THREE.InstancedMesh(roofGeo, roofMat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    const wallTones = [0xf1e9da, 0xe8dcc4, 0xd9e2e8, 0xf5f0e6];
    for (let i = 0; i < count; i++) {
      let x = (rand() * 2 - 1) * 1200;
      const z = (rand() * 2 - 1) * 1200;
      if (Math.abs(x) < 40) x += 120;
      const w = 6 + rand() * 6;
      const d = 6 + rand() * 6;
      const h = 4 + rand() * 4;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, h, d));
      walls.setMatrixAt(i, m);
      walls.setColorAt(i, col.set(wallTones[i % wallTones.length]));
      m.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(w * 1.05, h * 0.9, d * 1.05));
      roofs.setMatrixAt(i, m);
    }
    this.scene.add(walls, roofs);
  }

  private addMountains() {
    const rand = mulberry32(19);
    const count = 36;
    const mts = new THREE.InstancedMesh(mountainGeo, mountainMat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.15;
      const r = 2300 + rand() * 500;
      const h = 220 + rand() * 380;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
      m.compose(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r), q, new THREE.Vector3(h * 1.8, h, h * 1.8));
      mts.setMatrixAt(i, m);
    }
    this.scene.add(mts);
  }

  private addClouds() {
    const rand = mulberry32(23);
    const clusters = 45;
    const puffs = 7;
    const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, clusters * puffs);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let k = 0;
    for (let c = 0; c < clusters; c++) {
      const cx = (rand() * 2 - 1) * 2200;
      const cz = (rand() * 2 - 1) * 2200;
      const cy = 260 + rand() * 160;
      const size = 25 + rand() * 30;
      for (let p = 0; p < puffs; p++) {
        const r = size * (0.5 + rand() * 0.6);
        m.compose(
          new THREE.Vector3(cx + (rand() * 2 - 1) * size * 1.6, cy + rand() * size * 0.4, cz + (rand() * 2 - 1) * size * 0.8),
          q,
          new THREE.Vector3(r * 1.3, r * 0.6, r),
        );
        clouds.setMatrixAt(k++, m);
      }
    }
    this.scene.add(clouds);
  }

  /** 起飛前方的門框，給 FPV 練習與速度參考 */
  private addGates() {
    for (let i = 1; i <= 6; i++) {
      const g = new THREE.Group();
      const w = 5;
      const bar = (sx: number, sy: number, x: number, y: number, mat: THREE.Material) => {
        const b = new THREE.Mesh(gateBarGeo, mat);
        b.scale.set(sx, sy, 0.3);
        b.position.set(x, y, 0);
        g.add(b);
      };
      const cy = i % 2 ? 10 : 14;
      bar(0.3, cy + w / 2, -w / 2, (cy + w / 2) / 2, gateMat);
      bar(0.3, cy + w / 2, w / 2, (cy + w / 2) / 2, gateMat);
      bar(w, 0.3, 0, cy + w / 2, gateMat);
      bar(w, 0.3, 0, cy - w / 2, gateStripeMat);
      g.position.set((i % 3) * 6 - 6, 0, -40 * i);
      this.scene.add(g);
    }
  }

  /** 天空跟著鏡頭；格線對齊格點跟著移動，看起來像無限格線 */
  update(focus: THREE.Vector3) {
    this.sky.position.copy(focus);
    this.grid.position.x = Math.round(focus.x / GRID_CELL) * GRID_CELL;
    this.grid.position.z = Math.round(focus.z / GRID_CELL) * GRID_CELL;
  }
}
