// 方案 B：高清矢量重绘 — 纯函数，node 可测
// 模块支持圆角+间隙（微信码虚线感）；logo 区域不画模块（原样贴原图，双线性平滑）

function inRoundedRect(x, y, cx, cy, half, radius) {
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  if (dx > half || dy > half) return false;
  if (radius <= 0) return true;
  if (dx <= half - radius || dy <= half - radius) return true;
  const ex = dx - (half - radius), ey = dy - (half - radius);
  return ex * ex + ey * ey <= radius * radius;
}

/** 双线性采样原图像素 */
function sampleBilinear(rgba, w, h, sx, sy) {
  const x0 = Math.min(w - 1, Math.max(0, Math.floor(sx)));
  const y0 = Math.min(h - 1, Math.max(0, Math.floor(sy)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = sx - x0, fy = sy - y0;
  const out = [];
  for (let ch = 0; ch < 3; ch++) {
    const v00 = rgba[(y0 * w + x0) * 4 + ch];
    const v10 = rgba[(y0 * w + x1) * 4 + ch];
    const v01 = rgba[(y1 * w + x0) * 4 + ch];
    const v11 = rgba[(y1 * w + x1) * 4 + ch];
    out[ch] = Math.round(v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy);
  }
  return out;
}

/**
 * 重绘模块矩阵为高清 RGBA
 * @param matrix 模块矩阵 [row][col]（dark=true）
 * @param n 模块数
 * @param style { fg, bg, moduleRadius?（圆角占格子比例）, moduleFill?（模块填充比例，<1 留间隙） }
 * @param modulePx 每模块像素
 * @param original 可选 { rgba, width, height, cx, cy, radius } → 中心 logo 原样（双线性）叠加
 */
export function redraw(matrix, n, style, modulePx = 8, original = null) {
  const { fg, bg, moduleRadius = 0, moduleFill = 1 } = style;
  const px = n * modulePx;
  const rgba = new Uint8ClampedArray(px * px * 4);
  const half = (modulePx * moduleFill) / 2;
  const radius = modulePx * moduleRadius;

  // logo 输出圆（中心）
  const logoOutR = original ? px * 0.14 : 0;
  const logoCx = px / 2, logoCy = px / 2;
  const inLogo = (x, y) => Math.hypot(x - logoCx, y - logoCy) <= logoOutR;

  // 1) 画模块（logo 区域跳过；finder 区实心保证定位，数据区用间隙/圆角样式）
  const inFinder = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      if (inLogo(x, y)) continue;
      const modR = Math.min(n - 1, Math.floor(y / modulePx));
      const modC = Math.min(n - 1, Math.floor(x / modulePx));
      const i = (y * px + x) * 4;
      if (!matrix[modR][modC]) {
        rgba[i] = bg[0]; rgba[i + 1] = bg[1]; rgba[i + 2] = bg[2]; rgba[i + 3] = 255;
        continue;
      }
      const solid = inFinder(modR, modC); // finder 区实心
      const effHalf = solid ? modulePx / 2 : half;
      const effRadius = solid ? 0 : radius;
      const cellCx = (modC + 0.5) * modulePx;
      const cellCy = (modR + 0.5) * modulePx;
      if (inRoundedRect(x, y, cellCx, cellCy, effHalf, effRadius)) {
        rgba[i] = fg[0]; rgba[i + 1] = fg[1]; rgba[i + 2] = fg[2]; rgba[i + 3] = 255;
      } else {
        rgba[i] = bg[0]; rgba[i + 1] = bg[1]; rgba[i + 2] = bg[2]; rgba[i + 3] = 255;
      }
    }
  }

  // 2) 贴原图 logo（双线性平滑）
  if (original) {
    const { rgba: orig, width: ow, height: oh, cx, cy, radius: srcR } = original;
    for (let dy = -Math.floor(logoOutR); dy <= Math.floor(logoOutR); dy++) {
      for (let dx = -Math.floor(logoOutR); dx <= Math.floor(logoOutR); dx++) {
        if (Math.hypot(dx, dy) > logoOutR) continue;
        const sx = cx + (dx / logoOutR) * srcR;
        const sy = cy + (dy / logoOutR) * srcR;
        const [r, g, b] = sampleBilinear(orig, ow, oh, sx, sy);
        const oy = Math.floor(logoCy) + dy;
        const ox = Math.floor(logoCx) + dx;
        const di = (oy * px + ox) * 4;
        rgba[di] = r; rgba[di + 1] = g; rgba[di + 2] = b; rgba[di + 3] = 255;
      }
    }
  }

  return { rgba, width: px, height: px };
}
