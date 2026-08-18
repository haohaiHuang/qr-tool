// 原图清晰度检测 — 决定"像素级保真（放大）"还是"语义级重建（重绘）"
// 清晰码：黑白边界锐利（梯度大）→ 保真即可；模糊码：边界过渡（梯度小）→ 需重建锐化

import { toGrayImage } from "./shared/pixels.js";

/**
 * 检测图像清晰度（平均边缘梯度）
 * @returns 平均梯度（0-255；清晰码通常 >100，模糊码 <80）
 */
export function detectSharpness(rgba, width, height) {
  const gray = toGrayImage(rgba, width, height);
  // 只统计"边缘像素"（梯度 > 30）的梯度均值——清晰码边缘近 255，模糊码过渡 ~85
  let sum = 0, count = 0;
  for (let y = 1; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const dx = Math.abs(gray[y * width + x] - gray[y * width + x - 1]);
      const dy = Math.abs(gray[y * width + x] - gray[(y - 1) * width + x]);
      const g = Math.max(dx, dy);
      if (g > 30) { sum += g; count++; }
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * 判断码图是否需要重建（模糊 → true）
 * @param sharpness 可选：detectSharpness 结果（避免重复计算）
 */
export function needsRebuild(rgba, width, height, sharpness = null) {
  const s = sharpness ?? detectSharpness(rgba, width, height);
  return s < 90; // 平均梯度 < 90 → 边缘过渡 → 模糊 → 重建
}
