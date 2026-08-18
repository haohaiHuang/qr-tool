// 圆环检测（微信圆形小程序码定位）— 纯函数，node 可测
// 思路：二值化 → 前景质心 → 径向扫描找各方向最远黑像素 → 半径取中位数 → 一致性检查
// 一致性差（方形/不规则）→ 返回 null（非圆）

import { binarize } from "../shared/pixels.js";

export function detectCircle(gray, width, height, threshold = 128) {
  const bin = binarize(gray, threshold); // 黑=0，白=255

  // 1) 前景质心（初步中心）
  let sx = 0, sy = 0, count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bin[y * width + x] === 0) { sx += x; sy += y; count++; }
    }
  }
  if (count < 100) return null;
  const cx = sx / count;
  const cy = sy / count;

  // 2) 外环检测：从图边缘向内，每方向第一个深色 = 外环边界
  const DIRS = 72;
  const dists = [];
  const maxDim = Math.max(width, height);
  for (let d = 0; d < DIRS; d++) {
    const theta = (d / DIRS) * 2 * Math.PI;
    const dx = Math.cos(theta), dy = Math.sin(theta);
    // 从边缘向内扫
    let found = 0;
    for (let r = maxDim; r > 1; r--) {
      const x = Math.round(cx + dx * r);
      const y = Math.round(cy + dy * r);
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (bin[y * width + x] === 0) { found = r; break; }
    }
    dists.push(found);
  }

  // 3) CV（变异系数）：外环是规则圆 → 各方向半径极一致（角标在环内不干扰外环检测）
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  const variance = dists.reduce((a, b) => a + (b - mean) ** 2, 0) / dists.length;
  const cv = Math.sqrt(variance) / mean;
  if (mean < 10 || cv > 0.06) return null; // 方形/不规则 → 非圆

  return { x: Math.round(cx), y: Math.round(cy), radius: Math.round(mean) };
}
