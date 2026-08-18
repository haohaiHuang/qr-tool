// 微信圆形码处理 — 高清放大（保留原样 + 清晰）
// 微信码是彩色创意码（中心品牌区/绿角标/自由放射线段），重绘不做结构重建，
// 用高质量插值放大（视觉=原图，清晰度提升）。扫码成功率不保证（诚实标注）。

/** Catmull-Rom 三次插值（比双线性锐利） */
function cubic(v0, v1, v2, v3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    2 * v1 + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 + (-v0 + 3 * v1 - 3 * v2 + v3) * t3
  );
}

function sampleCatmull(rgba, w, h, sx, sy) {
  const x = Math.min(w - 1, Math.max(0, sx));
  const y = Math.min(h - 1, Math.max(0, sy));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const out = [];
  for (let ch = 0; ch < 4; ch++) {
    // 4x4 邻域
    const col = [];
    for (let j = -1; j <= 2; j++) {
      const yy = Math.min(h - 1, Math.max(0, y0 + j));
      const v = [];
      for (let i = -1; i <= 2; i++) {
        const xx = Math.min(w - 1, Math.max(0, x0 + i));
        v.push(rgba[(yy * w + xx) * 4 + ch]);
      }
      col.push(cubic(v[0], v[1], v[2], v[3], fx));
    }
    out[ch] = Math.round(cubic(col[0], col[1], col[2], col[3], fy));
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
      const [r, g, b, a] = sampleCatmull(rgba, width, height, sx, sy);
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

/** 3x3 高斯模糊（unsharp 用） */
function blur3x3(rgba, width, height) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += rgba[((y + dy) * width + (x + dx)) * 4 + ch];
          }
        }
        out[(y * width + x) * 4 + ch] = Math.round(sum / 9);
      }
    }
  }
  // 边缘复制
  for (let x = 0; x < width; x++) {
    for (let ch = 0; ch < 4; ch++) {
      out[x * 4 + ch] = rgba[x * 4 + ch];
      out[((height - 1) * width + x) * 4 + ch] = rgba[((height - 1) * width + x) * 4 + ch];
    }
  }
  for (let y = 0; y < height; y++) {
    for (let ch = 0; ch < 4; ch++) {
      out[(y * width) * 4 + ch] = rgba[(y * width) * 4 + ch];
      out[(y * width + width - 1) * 4 + ch] = rgba[(y * width + width - 1) * 4 + ch];
    }
  }
  return out;
}

/**
 * Unsharp mask 锐化（放大后增强边缘）
 * @param amount 锐化强度（0-1；过大产生光晕）
 */
export function sharpen(rgba, width, height, amount = 0.6) {
  const blur = blur3x3(rgba, width, height);
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i++) {
    const v = rgba[i] + amount * (rgba[i] - blur[i]);
    out[i] = Math.max(0, Math.min(255, Math.round(v)));
  }
  return { rgba: out, width, height };
}

/**
 * 放大 + 锐化（微信码/兜底高清输出）
 */
export function enlargeSharp(rgba, width, height, targetWidth = null) {
  const big = enlarge(rgba, width, height, null, targetWidth);
  return sharpen(big.rgba, big.width, big.height, 0.6);
}
