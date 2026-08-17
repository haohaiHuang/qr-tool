// 风格保留：从原码图检测配色，重生时还原 — 纯函数，node 可测
// 方案：Otsu 阈值分割 → 暗像素均值 = 前景色，亮像素均值 = 背景色
// 不依赖 jsQR location / 模块定位（对噪声/留白/拍摄差异鲁棒）

import { toGrayImage } from "../shared/pixels.js";

/** Otsu 全局阈值（256 级灰度），返回阈值 t（0-255） */
export function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0, wB = 0, maxVar = -1, best = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) { maxVar = between; best = t; }
  }
  return best;
}

/**
 * 从原图检测前景/背景色（增强而非替换：保留品牌色）
 * 返回 { fg: [r,g,b], bg: [r,g,b] }
 */
export function detectStyle(rgba, width, height) {
  const gray = toGrayImage(rgba, width, height);
  const t = otsuThreshold(gray);
  let fgSum = [0, 0, 0], fgCount = 0;
  let bgSum = [0, 0, 0], bgCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const g = gray[y * width + x];
      const i = (y * width + x) * 4;
      if (g <= t) { // 暗 → 前景
        fgSum[0] += rgba[i]; fgSum[1] += rgba[i + 1]; fgSum[2] += rgba[i + 2]; fgCount++;
      } else {
        bgSum[0] += rgba[i]; bgSum[1] += rgba[i + 1]; bgSum[2] += rgba[i + 2]; bgCount++;
      }
    }
  }
  const avg = (s, cnt) => (cnt > 0 ? Math.round(s / cnt) : 0);
  return {
    fg: [avg(fgSum[0], fgCount), avg(fgSum[1], fgCount), avg(fgSum[2], fgCount)],
    bg: [avg(bgSum[0], bgCount), avg(bgSum[1], bgCount), avg(bgSum[2], bgCount)],
  };
}

/** 用风格（前景/背景色）渲染模块矩阵 → RGBA（任意分辨率） */
export function renderStyled(matrix, size, style, modulePx = 4) {
  const px = size * modulePx;
  const rgba = new Uint8ClampedArray(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dark = matrix[Math.floor(y / modulePx)][Math.floor(x / modulePx)];
      const [r, g, b] = dark ? style.fg : style.bg;
      const i = (y * px + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
  return { rgba, width: px, height: px };
}
