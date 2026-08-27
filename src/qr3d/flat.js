// 模块矩阵 → 扁平可扫的彩色 2D 码像素（纯函数，node 可测）
// 深色模块按区域着色；配色 = 所选树种的 3D 配色加深（与 3D 树观感一致，且保证与白底的扫码对比度）

import { T, TRUNK_R, CANOPY_R_FACTOR } from "./layout.js";

// 默认扁平配色（无树种时）：白/深玫红/深棕/深绿
export const PALETTE_FLAT = [0xffffff, 0x99244e, 0x4a2f1a, 0x2f6b34];

// 把颜色加深到目标亮度（亮色 → 深色，保证与白底的可扫对比度）
function toScannable(hex, targetLum = 80) {
  let r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum <= targetLum) return hex;
  const k = targetLum / lum;
  return ((Math.round(r * k)) << 16) | ((Math.round(g * k)) << 8) | Math.round(b * k);
}

/**
 * @param {{ size:number, m:boolean[][] }} matrix
 * @param {number} qrPx 每模块像素
 * @param {{ palette:number[] }} [tree] 树种（扁平配色 = 该树 3D 配色加深，与 3D 一致）
 * @returns {{ rgba:Uint8ClampedArray, width:number, height:number }}
 */
export function matrixToColoredRgba({ size, m }, qrPx = 8, tree) {
  // 有树种 → 用其 3D 配色加深；否则默认深色
  const flat = tree
    ? [0xffffff, toScannable(tree.palette[1]), toScannable(tree.palette[2]), toScannable(tree.palette[3])]
    : PALETTE_FLAT;
  const px = size * qrPx;
  const rgba = new Uint8ClampedArray(px * px * 4);
  rgba.fill(255);
  const cx = (size - 1) / 2, canopyR = size * CANOPY_R_FACTOR;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!m[r][c]) continue;
    const d = Math.hypot(c - cx, r - cx);
    const t = d <= TRUNK_R ? T.TRUNK : (d <= canopyR ? T.CHERRY : T.GRASS);
    const col = flat[t];
    const rr = (col >> 16) & 255, gg = (col >> 8) & 255, bb = col & 255;
    for (let dy = 0; dy < qrPx; dy++) for (let dx = 0; dx < qrPx; dx++) {
      const i = ((r * qrPx + dy) * px + (c * qrPx + dx)) * 4;
      rgba[i] = rr; rgba[i + 1] = gg; rgba[i + 2] = bb; rgba[i + 3] = 255;
    }
  }
  return { rgba, width: px, height: px };
}
