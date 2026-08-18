import { detectFinderPatterns } from "./finder.js";
import { detectCircle } from "./circle.js";
import { detectGrid } from "./grid.js";

import { sampleModules } from "./sampler.js";

/** 验证 finder 区域（7x7 应匹配 1:1:3:1:1：边框黑、中心 3x3 黑、其余白） */
function finderRegionMatch(matrix, n) {
  const positions = [[0, 0], [0, n - 7], [n - 7, 0]]; // 左上/右上/左下
  let total = 0, match = 0;
  for (const [fr, fc] of positions) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const expect = (r === 0 || r === 6 || c === 0 || c === 6) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        if (matrix[fr + r] && matrix[fr + r][fc + c] === expect) match++;
        total++;
      }
    }
  }
  return total > 0 ? match / total : 0;
}

/** 微信码特征：中心深色 + 外围放射（外环不可靠时的组合判定） */
function isWechatLike(gray, width, height) {
  let cDark = 0, cTotal = 0, oDark = 0, oTotal = 0;
  const maxR = Math.min(width, height) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - width / 2, y - height / 2);
      const isDark = gray[y * width + x] < 128;
      if (d <= maxR * 0.19) { cTotal++; if (isDark) cDark++; }       // 中心（~19% 半径）
      if (d >= maxR * 0.47 && d <= maxR * 0.93) { oTotal++; if (isDark) oDark++; } // 外围放射带
    }
  }
  return cTotal > 0 && oTotal > 0 && cDark / cTotal > 0.2 && oDark / oTotal > 0.04;
}

/**
 * 分类码类型
 * 优先：严格 QR（3 finder 边长一致的正方形三角）→ 圆形码（detectCircle）→ 微信码特征 → 宽松 QR → unknown
 */
export function classifyCode(gray, width, height) {
  const finders = detectFinderPatterns(gray, width, height);

  // 严格 QR：3 finder + 三角 + finder 区域结构验证（微信码误报 finder 区域不匹配）
  if (finders.length >= 3) {
    const grid = detectGrid(gray, width, height);
    if (grid) {
      const matrix = sampleModules(gray, width, height, grid);
      if (finderRegionMatch(matrix, grid.n) >= 0.8) {
        return { type: "qr", finders, grid };
      }
    }
  }

  // 圆形码（同心圆环）
  const circle = detectCircle(gray, width, height);
  if (circle) return { type: "wechat", circle };

  // 微信码特征（中心深 + 外围放射）
  if (isWechatLike(gray, width, height)) return { type: "wechat" };

  // 宽松 QR（finder 存在但三角略不齐）
  if (finders.length >= 3) return { type: "qr", finders };

  return { type: "unknown" };
}