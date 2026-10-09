/** Betaflight 風格 expo：中心較鈍、末端保持滿舵。s ∈ [-1, 1] */
export function rateCurve(s: number, expo: number): number {
  return s * (1 - expo) + s * s * s * expo;
}

export const DEG = Math.PI / 180;
