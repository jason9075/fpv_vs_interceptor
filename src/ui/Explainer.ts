import { settings, type DroneKind } from '../config';
import type { ControlInput } from '../physics/DroneModel';
import { angleDiff, type Telemetry } from '../physics/telemetry';

const ACTIVE = 0.05;
const f1 = (n: number) => n.toFixed(1);
const f0 = (n: number) => Math.round(n).toString();
const tag = (axis: string, text: string) => `<b class="ax-${axis}">${text}</b>`;
const side = (v: number) => (v > 0 ? '右' : '左');

/** 依目前輸入與狀態產生一句說明（guideline §3.4） */
export function explain(kind: DroneKind, input: Readonly<ControlInput>, t: Telemetry): string {
  const sticks = (['pitch', 'roll', 'yaw'] as const)
    .filter((a) => Math.abs(input[a]) > ACTIVE)
    .sort((a, b) => Math.abs(input[b]) - Math.abs(input[a]));
  const main = sticks[0];
  const thr = input.throttle - 0.5;
  return kind === 'fpv' ? fpv(main, input, thr, t) : interceptor(main, input, thr, t);
}

function fpv(main: string | undefined, input: Readonly<ControlInput>, thr: number, t: Telemetry) {
  const sinking = t.vVertical < -0.8 ? '，<em>高度下降中（需加油門）</em>' : '';
  switch (main) {
    case 'pitch':
      return input.pitch > 0
        ? `${tag('pitch', '推 Pitch')} → 機身前傾 ${f0(Math.max(0, -t.pitchDeg))}° → 推力的水平分量向前 → 前向加速 ${f1(t.aForwardH)} m/s²${sinking}`
        : `${tag('pitch', '拉 Pitch')} → 機身後仰 ${f0(Math.max(0, t.pitchDeg))}° → 推力向後 → 減速／後退，前向速度 ${f1(t.vForwardH)} m/s${sinking}`;
    case 'roll':
      return `${tag('roll', `推 Roll ${side(input.roll)}`)} → 機身${side(input.roll)}傾 ${f0(Math.abs(t.rollDeg))}° → 推力偏${side(input.roll)} → 側移 ${f1(Math.abs(t.vRightH))} m/s，機頭方向不變`;
    case 'yaw': {
      let s = `${tag('yaw', `推 Yaw ${side(input.yaw)}`)} → 機頭${side(input.yaw)}轉（航向 ${f0(t.headingDeg)}°）→ 本身<em>不產生速度</em>`;
      if (t.velHeadingDeg !== null && t.vHorizontal > 1) {
        s += `；原速度仍朝 ${f0(t.velHeadingDeg)}° 滑行（drift ${f0(Math.abs(angleDiff(t.velHeadingDeg, t.headingDeg)))}°）`;
      }
      return s;
    }
  }
  if (Math.abs(thr) > 0.02) {
    return `${tag('throttle', `油門 ${f0(input.throttle * 100)}%`)} → 推力 ${f1(t.thrustRatio)}×mg 沿機體 up → ${
      t.vVertical >= 0 ? '爬升' : '下降'
    } ${f1(Math.abs(t.vVertical))} m/s`;
  }
  if (settings.angleMode) return '無輸入：Angle 模式自動回水平，油門中點 = 懸停';
  if (t.speed > 1 && t.tiltDeg < 3) return `無輸入：機身水平，沒有水平推力 → 靠慣性以 ${f1(t.speed)} m/s 滑行，阻力慢慢減速`;
  return t.speed > 1
    ? `無輸入：Acro 模式姿態維持，傾角 ${f0(t.tiltDeg)}° 帶著機身以 ${f1(t.speed)} m/s 移動`
    : '無輸入：Acro 模式姿態維持不變（不會自動回正），油門中點 = 懸停';
}

function interceptor(main: string | undefined, input: Readonly<ControlInput>, thr: number, t: Telemetry) {
  const kmh = f0(t.speed * 3.6);
  switch (main) {
    case 'pitch':
      return input.pitch > 0
        ? `${tag('pitch', '推 Pitch')} → 機頭下壓 → 速度向量跟著轉向下 → 俯衝，路徑角 γ ${f0(t.gammaDeg)}°`
        : `${tag('pitch', '拉 Pitch')} → 機頭上仰 → 速度向量跟著轉向上 → 爬升，路徑角 γ ${f0(t.gammaDeg)}°`;
    case 'roll':
      return `${tag('roll', `推 Roll ${side(input.roll)}`)} → 繞機頭軸自轉（${f0(t.rollDeg)}°）→ 推力仍朝機頭，<em>速度方向不變</em>，只改變「哪邊是上」`;
    case 'yaw':
      return `${tag('yaw', `推 Yaw ${side(input.yaw)}`)} → 機頭轉向${side(input.yaw)} → 速度向量跟隨 → 向${side(input.yaw)}轉彎，側滑角 ${f0(t.sideslipDeg)}°`;
  }
  if (Math.abs(thr) > 0.02) {
    return `${tag('throttle', `油門 ${f0(input.throttle * 100)}%`)} → 推力 ${f1(t.thrustRatio)}×mg 沿<em>機頭方向</em> → 速度 ${kmh} km/h`;
  }
  return `無輸入：沿機頭方向巡航 ${kmh} km/h，路徑角 γ ${f0(t.gammaDeg)}°${
    settings.angleMode ? '（Angle 模式回到巡航姿態）' : ''
  }`;
}
