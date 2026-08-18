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

/** 区域平均采样（对缩小贴片抗混叠；输出像素覆盖原图 [sx0,sx1]×[sy0,sy1] 区域取平均） */
function sampleArea(rgba, w, h, sx0, sy0, sx1, sy1) {
  const x0 = Math.min(w - 1, Math.max(0, Math.floor(sx0)));
  const y0 = Math.min(h - 1, Math.max(0, Math.floor(sy0)));
  const x1 = Math.min(w - 1, Math.max(0, Math.ceil(sx1)));
  const y1 = Math.min(h - 1, Math.max(0, Math.ceil(sy1)));
  let sum = [0, 0, 0], n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      sum[0] += rgba[i]; sum[1] += rgba[i + 1]; sum[2] += rgba[i + 2]; n++;
    }
  }
  return n > 0 ? [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)] : [255, 255, 255];
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

  // logo 区域：输出中心方形（黑底 + 白环外扩；内部全贴保持 icon/白环）
  const logoHalf = original ? px * (original.logoRatio || 0.22) / 2 : 0;
  const logoCx = px / 2, logoCy = px / 2;
  const inLogo = (x, y) => Math.abs(x - logoCx) <= logoHalf && Math.abs(y - logoCy) <= logoHalf;

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

  // 2) 贴原图 logo 区域（方形 = 黑底+白环，内部全贴保持 icon/白环；边缘羽化）
  if (original) {
    const { rgba: orig, width: ow, height: oh, cx, cy, srcHalf } = original;
    const fade = Math.max(2, Math.round(px * 0.01)); // 羽化宽度
    for (let dy = -Math.floor(logoHalf); dy <= Math.floor(logoHalf); dy++) {
      for (let dx = -Math.floor(logoHalf); dx <= Math.floor(logoHalf); dx++) {
        // 方形边缘羽化
        const dEdge = Math.max(
          Math.abs(dx) - (logoHalf - fade),
          Math.abs(dy) - (logoHalf - fade),
        );
        let alpha = 255;
        if (dEdge > 0) alpha = Math.max(0, Math.round(255 * (1 - dEdge / fade)));
        // 原图源步长（缩小 >1 时区域平均抗混叠）
        const srcStep = srcHalf / logoHalf;
        const sx = cx + (dx / logoHalf) * srcHalf;
        const sy = cy + (dy / logoHalf) * srcHalf;
        const [r, g, b] = sampleArea(orig, ow, oh, sx, sy, sx + srcStep, sy + srcStep);
        const oy = Math.floor(logoCy) + dy;
        const ox = Math.floor(logoCx) + dx;
        const di = (oy * px + ox) * 4;
        if (alpha >= 255) {
          rgba[di] = r; rgba[di + 1] = g; rgba[di + 2] = b; rgba[di + 3] = 255;
        } else if (alpha > 0) {
          const t = alpha / 255;
          rgba[di] = Math.round(r * t + rgba[di] * (1 - t));
          rgba[di + 1] = Math.round(g * t + rgba[di + 1] * (1 - t));
          rgba[di + 2] = Math.round(b * t + rgba[di + 2] * (1 - t));
        }
      }
    }
  }

  return { rgba, width: px, height: px };
}
