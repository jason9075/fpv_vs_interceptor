import GUI from 'lil-gui';
import * as THREE from 'three';
import {
  FPV_PARAMS,
  INTERCEPTOR_PARAMS,
  MAX_FRAME_DT,
  PHYSICS_DT,
  settings,
  type CamMode,
} from './config';
import { GamepadInput, gamepadMap } from './input/Gamepad';
import { InputState } from './input/InputState';
import { Keyboard } from './input/Keyboard';
import { VirtualSticks } from './input/VirtualSticks';
import { fpvDynamics } from './physics/fpvDynamics';
import { interceptorDynamics } from './physics/interceptorDynamics';
import { DroneView } from './scene/DroneView';
import { InputBars } from './ui/InputBars';
import './styles.css';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

// ── Renderer：單一 canvas，用 scissor 切成兩個 viewport ──────────────────
const stage = $('#stage');
const canvas = $<HTMLCanvasElement>('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
new ResizeObserver(() => renderer.setSize(stage.clientWidth, stage.clientHeight, false)).observe(stage);

const fpv = new DroneView(FPV_PARAMS, fpvDynamics, $('.view[data-drone="fpv"]'));
const itc = new DroneView(INTERCEPTOR_PARAMS, interceptorDynamics, $('.view[data-drone="interceptor"]'));
const views = [fpv, itc];

// ── 輸入 ───────────────────────────────────────────────────────────────
const input = new InputState();
const keyboard = new Keyboard(input);
const gamepad = new GamepadInput(input);
const sticks = new VirtualSticks($('#stick-left'), $('#stick-right'), input);
const bars = new InputBars($('#input-bars'));

function resetAll() {
  input.throttle = 0.5;
  fpv.reset();
  itc.reset();
}

// ── 頂部設定列（segmented buttons 綁 settings） ──────────────────────────
type SegKey = 'layout' | 'single' | 'camMode' | 'angleMode' | 'stickMode';
function setSetting(key: SegKey | 'paused' | 'theme', raw: string | boolean) {
  switch (key) {
    case 'layout':
      settings.layout = raw as typeof settings.layout;
      break;
    case 'single':
      settings.single = raw as typeof settings.single;
      break;
    case 'camMode':
      settings.camMode = raw as CamMode;
      views.forEach((v) => v.setCamMode(settings.camMode));
      break;
    case 'angleMode':
      settings.angleMode = raw === true || raw === 'true';
      break;
    case 'stickMode':
      settings.stickMode = Number(raw) === 1 ? 1 : 2;
      sticks.applyMode();
      break;
    case 'paused':
      settings.paused = Boolean(raw);
      $('#btn-pause').textContent = settings.paused ? '繼續' : '暫停';
      $('#paused-badge').hidden = !settings.paused;
      break;
    case 'theme':
      settings.theme = raw as typeof settings.theme;
      document.documentElement.dataset.theme = settings.theme;
      break;
  }
  syncControls();
}

function syncControls() {
  document.querySelectorAll<HTMLElement>('.seg[data-setting]').forEach((seg) => {
    const key = seg.dataset.setting as SegKey;
    const cur = String(settings[key]);
    seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === cur)));
  });
  $('.seg[data-setting="single"]').hidden = settings.layout !== 'single';
  stage.dataset.layout = settings.layout;
  stage.dataset.single = settings.single;
}

document.querySelectorAll<HTMLElement>('.seg[data-setting]').forEach((seg) =>
  seg.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-value]');
    if (b) setSetting(seg.dataset.setting as SegKey, b.dataset.value!);
  }),
);
$('#btn-reset').addEventListener('click', resetAll);
$('#btn-pause').addEventListener('click', () => setSetting('paused', !settings.paused));
$('#btn-theme').addEventListener('click', () => setSetting('theme', settings.theme === 'dark' ? 'light' : 'dark'));
$('#btn-gui').addEventListener('click', () => ($('#gui-host').hidden = !$('#gui-host').hidden));

keyboard.on('r', resetAll);
keyboard.on('p', () => setSetting('paused', !settings.paused));
keyboard.on('c', () => {
  const modes: CamMode[] = ['chase', 'fpv', 'orbit'];
  setSetting('camMode', modes[(modes.indexOf(settings.camMode) + 1) % modes.length]);
});

// ── 參數面板（guideline §4.3） ──────────────────────────────────────────
const gui = new GUI({ container: $('#gui-host'), title: '參數 (dev)' });
for (const p of [FPV_PARAMS, INTERCEPTOR_PARAMS]) {
  const f = gui.addFolder(p.label).close();
  f.add(p, 'mass', 0.2, 3, 0.05).name('質量 kg');
  f.add(p, 'twr', 2, 15, 0.5).name('推重比');
  f.add(p, 'drag', 0.001, 0.08, 0.001).name('阻力 k');
  f.add(p, 'align', 0, 4, 0.05).name('側向阻力 c');
  for (const ax of ['pitch', 'roll', 'yaw'] as const) {
    f.add(p[ax], 'maxRateDeg', 50, 1200, 10).name(`${ax} rate °/s`);
    f.add(p[ax], 'tau', 0.01, 0.3, 0.005).name(`${ax} τ s`);
  }
  f.add(p, 'maxAngleDeg', 10, 80, 1).name('Angle 最大角');
  f.add(p, 'camTiltDeg', -45, 60, 1).name('FPV 鏡頭仰角');
}
const fShow = gui.addFolder('顯示').close();
fShow.add(settings, 'showGravity').name('重力箭頭');
fShow.add(settings, 'showComponents').name('速度分量');
fShow.add(settings, 'showTrail').name('軌跡');
fShow.add(settings, 'expo', 0, 1, 0.05).name('Expo');
const fPad = gui.addFolder('Gamepad').close();
for (const a of ['throttle', 'yaw', 'pitch', 'roll'] as const) {
  fPad.add(gamepadMap[a], 'axis', 0, 7, 1).name(`${a} 軸`);
  fPad.add(gamepadMap[a], 'invert').name(`${a} 反向`);
}
fPad.add(gamepadMap, 'deadband', 0, 0.2, 0.01).name('死區');

// ── 主迴圈：固定 dt 物理 + 每幀渲染 ─────────────────────────────────────
let last = performance.now();
let acc = 0;
document.addEventListener('visibilitychange', () => {
  // 回到分頁時不補跑累積時間
  last = performance.now();
  acc = 0;
});

function render() {
  const c = canvas.getBoundingClientRect();
  renderer.setScissorTest(true);
  for (const v of views) {
    if (!v.visible) continue;
    const r = v.el.getBoundingClientRect();
    const x = r.left - c.left;
    const y = c.bottom - r.bottom;
    renderer.setViewport(x, y, r.width, r.height);
    renderer.setScissor(x, y, r.width, r.height);
    const cam = v.rig.camera;
    const aspect = r.width / r.height;
    if (Math.abs(cam.aspect - aspect) > 1e-3) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }
    renderer.render(v.world.scene, cam);
  }
}

let padLabel = '';
function frame(now: number) {
  const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
  last = now;
  keyboard.update(dt);
  gamepad.update();
  const cmd = input.read();
  sticks.update(cmd);
  bars.update(cmd);

  if (!settings.paused) {
    acc += dt;
    while (acc >= PHYSICS_DT) {
      for (const v of views) v.physics(cmd, PHYSICS_DT);
      acc -= PHYSICS_DT;
    }
  }
  for (const v of views) v.frame(cmd, dt);

  const label = gamepad.connected ? `· 🎮 ${gamepad.connected.slice(0, 24)}` : '';
  if (label !== padLabel) $('#pad-status').textContent = padLabel = label;

  render();
  requestAnimationFrame(frame);
}

// 3D 場景固定為白天外景；主題只切換 UI 面板，預設淺色
setSetting('theme', 'light');
syncControls();
requestAnimationFrame(frame);
