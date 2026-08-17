// 圆环检测（微信圆形小程序码定位）— 纯函数，node 可测
// 思路：二值化 → 前景质心 → 径向扫描找各方向最远黑像素 → 半径取中位数 → 一致性检查
// 一致性差（方形/不规则）→ 返回 null（非圆）

import { binarize } from "../shared/pixels.js";

export function detectCircle(gray, width, height, threshold = 128) {
  const bin = binarize(gray, threshold); // 黑=0，白=255

  // 1) 前景（黑）质心 + 数量
  let sx = 0, sy = 0, count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bin[y * width + x] === 0) { sx += x; sy += y; count++; }
    }
  }
  if (count < 100) return null; // 前景太少（噪声/空图）
  const cx = sx / count;
  const cy = sy / count;

  // 2) 径向扫描：36 方向，每方向找**最远**黑像素距离（外环外缘）
  const DIRS = 36;
  const dists = [];
  const maxDim = Math.max(width, height);
  for (let d = 0; d < DIRS; d++) {
    const theta = (d / DIRS) * 2 * Math.PI;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    let maxR = 0;
    for (let r = 1; r <= maxDim; r++) {
      const x = Math.round(cx + dx * r);
      const y = Math.round(cy + dy * r);
      if (x < 0 || x >= width || y < 0 || y >= height) break;
      if (bin[y * width + x] === 0) maxR = r;
    }
    dists.push(maxR);
  }

  // 3) 一致性检查：用变异系数 CV=std/mean（圆环各方向均匀；方形/不规则离散大）
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  const variance = dists.reduce((a, b) => a + (b - mean) ** 2, 0) / dists.length;
  const cv = Math.sqrt(variance) / mean;
  if (mean < 5 || cv > 0.06) return null; // 太小或离散度过大 → 非圆
  const radius = Math.round(mean);

  // 4) 返回圆心 + 半径（外环 = 均值）
  return { x: Math.round(cx), y: Math.round(cy), radius };
}
