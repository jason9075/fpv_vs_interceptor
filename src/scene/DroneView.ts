import * as THREE from 'three';
import { GRAVITY, settings, type CamMode, type DroneParams } from '../config';
import { createState, resetState, step, type ControlInput, type Dynamics, type DroneState } from '../physics/DroneModel';
import { telemetry, type Telemetry } from '../physics/telemetry';
import { Hud } from '../ui/Hud';
import { AxisGizmo } from './AxisGizmo';
import { CameraRig } from './CameraRig';
import { createFpvMesh } from './FpvMesh';
import { createInterceptorMesh } from './InterceptorMesh';
import type { DroneMesh } from './meshParts';
import { Trail } from './Trail';
import { VectorArrows } from './VectorArrows';
import { World } from './World';

const shadowGeo = new THREE.CircleGeometry(0.4, 24).rotateX(-Math.PI / 2);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 一台機 + 它自己的 scene、鏡頭、HUD；並排模式下有兩個 */
export class DroneView {
  readonly world = new World();
  readonly state: DroneState = createState();
  readonly rig: CameraRig;
  readonly hud: Hud;
  tele: Telemetry;
  private mesh: DroneMesh;
  private gizmo: AxisGizmo;
  private arrows = new VectorArrows();
  private trail: Trail;
  private shadow: THREE.Mesh;

  constructor(
    readonly params: DroneParams,
    readonly dyn: Dynamics,
    readonly el: HTMLElement,
  ) {
    this.mesh = params.kind === 'fpv' ? createFpvMesh() : createInterceptorMesh();
    this.gizmo = new AxisGizmo(this.mesh.gizmoSize);
    this.mesh.group.add(this.gizmo.group);
    this.trail = new Trail(900, params.kind === 'fpv' ? 30 : 80);
    this.shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.world.scene.add(this.mesh.group, this.arrows.group, this.trail.line, this.shadow);
    this.rig = new CameraRig(el);
    this.hud = new Hud(el, params);
    this.reset();
    this.tele = telemetry(this.state, params);
  }

  get visible() {
    return this.el.offsetWidth > 0 && this.el.offsetHeight > 0;
  }

  reset() {
    resetState(this.state, this.params, this.dyn);
    this.trail.clear();
    this.syncMesh();
    this.rig.snap(this.state, this.params);
    if (this.rig.mode === 'orbit') this.rig.setMode('orbit', this.state);
  }

  setCamMode(mode: CamMode) {
    this.rig.setMode(mode, this.state);
    if (mode === 'chase') this.rig.snap(this.state, this.params);
  }

  physics(input: Readonly<ControlInput>, dt: number) {
    step(this.state, input, this.params, this.dyn, dt, settings.angleMode);
  }

  frame(input: Readonly<ControlInput>, dt: number) {
    const s = this.state;
    this.tele = telemetry(s, this.params);
    this.syncMesh();

    const fpvCam = this.rig.mode === 'fpv';
    this.mesh.group.visible = !fpvCam;
    if (!reducedMotion) {
      const load = s.thrust / (this.params.mass * GRAVITY * this.params.twr);
      const w = 6 + 18 * Math.sqrt(Math.max(0, load));
      this.mesh.props.forEach((p, i) => (p.rotation.y += this.mesh.propDir[i] * w * dt));
    }
    this.gizmo.update(input, s.angularVel, dt);
    this.arrows.group.visible = !fpvCam;
    this.arrows.update(s, this.params, this.dyn);

    this.trail.line.visible = settings.showTrail;
    if (!settings.paused) this.trail.update(s.position, this.tele.speed, dt);

    const alt = Math.max(0, s.position.y);
    this.shadow.position.set(s.position.x, 0.02, s.position.z);
    this.shadow.scale.setScalar(1 + alt * 0.04);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * Math.max(0, 1 - alt / 60);

    this.rig.update(s, this.params, dt);
    this.world.update(this.rig.camera.position);
    this.hud.update(this.tele, input, dt);
  }

  private syncMesh() {
    this.mesh.group.position.copy(this.state.position);
    this.mesh.group.quaternion.copy(this.state.attitude);
  }
}
