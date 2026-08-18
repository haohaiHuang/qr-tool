// 微信圆形码处理 — 高清放大（保留原样 + 清晰）
// 微信码是彩色创意码（中心品牌区/绿角标/自由放射线段），重绘不做结构重建，
// 用高质量插值放大（视觉=原图，清晰度提升）。扫码成功率不保证（诚实标注）。

/** 双线性采样 */
function sampleBilinear(rgba, w, h, sx, sy) {
  const x0 = Math.min(w - 1, Math.max(0, Math.floor(sx)));
  const y0 = Math.min(h - 1, Math.max(0, Math.floor(sy)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = sx - x0, fy = sy - y0;
  const out = [];
  for (let ch = 0; ch < 4; ch++) {
    const v00 = rgba[(y0 * w + x0) * 4 + ch];
    const v10 = rgba[(y0 * w + x1) * 4 + ch];
    const v01 = rgba[(y1 * w + x0) * 4 + ch];
    const v11 = rgba[(y1 * w + x1) * 4 + ch];
    out[ch] = Math.round(v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy);
  }
  return out;
}

/**
 * 高清放大（双线性插值）
 * @param rgba 原图 RGBA
 * @param width height 尺寸
 * @param scale 放大倍数（或 targetWidth 指定目标宽）
 * @param targetWidth 可选：目标宽度（优先于 scale）
 * @returns { rgba, width, height }
 */
export function enlarge(rgba, width, height, scale = 3, targetWidth = null) {
  const outW = targetWidth || Math.round(width * scale);
  const outH = Math.round(outW * height / width);
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      // 格子中心映射（避免整数采样错过细线）
      const sx = (x + 0.5) * width / outW;
      const sy = (y + 0.5) * height / outH;
      const [r, g, b, a] = sampleBilinear(rgba, width, height, sx, sy);
      const i = (y * outW + x) * 4;
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a;
    }
  }
  return { rgba: out, width: outW, height: outH };
}

/**
 * 检测微信圆形码（圆环定位）— 供 UI 识别确认
 * @returns { cx, cy, outerRadius } | null
 */
export function detectWechatCircle(rgba, width, height) {
  // 简化：质心 + 径向最远深色（外环半径）
  let sx = 0, sy = 0, count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const g = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      if (g < 128) { sx += x; sy += y; count++; }
    }
  }
  if (count < 500) return null;
  const cx = sx / count, cy = sy / count;
  // 径向最远深色（外环）
  let maxR = 0;
  for (let a = 0; a < 72; a++) {
    const th = (a / 72) * 2 * Math.PI;
    for (let r = 1; r < Math.max(width, height); r++) {
      const x = Math.round(cx + Math.cos(th) * r);
      const y = Math.round(cy + Math.sin(th) * r);
      if (x < 0 || x >= width || y < 0 || y >= height) break;
      const i = (y * width + x) * 4;
      if (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2] < 128) maxR = r;
    }
  }
  return { cx, cy, outerRadius: maxR };
}
