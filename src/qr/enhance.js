// 标准 QR 增强管道：解码 → 重生（风格保留）→ 闭环自检 → 输出
// Logo 码：解码失败时按多档半径抹白中心重解（纠错恢复被 logo 覆盖的数据）

import { decodeQR } from "./decode.js";
import { generateMatrix } from "./generate.js";
import { detectStyle, renderStyled } from "./style.js";
import { maskCenter } from "./mask.js";

/** 解码，支持 Logo 码 fallback（中心抹白重解） */
function decodeWithFallback(rgba, width, height) {
  let text = decodeQR(rgba, width, height);
  if (text) return text;
  // Logo 码：抹白中心圆形区域，半径递增尝试（logo 大小未知）
  for (const ratio of [0.12, 0.16, 0.2, 0.24]) {
    const masked = maskCenter(rgba, width, height, ratio);
    text = decodeQR(masked, width, height);
    if (text) return text;
  }
  return null;
}

/**
 * 增强标准 QR 码
 * @param rgba 原图 RGBA
 * @param width height 原图尺寸
 * @param modulePx 输出每模块像素（分辨率）
 * @returns { ok: true, text, rgba, width, height } | { ok: false, reason }
 */
export function enhanceQr(rgba, width, height, modulePx = 8) {
  // 1) 解码（含 Logo fallback）
  const text = decodeWithFallback(rgba, width, height);
  if (!text) return { ok: false, reason: "decode-failed" };
  // 2) 重生矩阵
  const { size, matrix } = generateMatrix(text);
  // 3) 风格保留（从原图检测配色；用抹白后重解的输入避免 logo 干扰）
  const style = detectStyle(rgba, width, height);
  // 4) 渲染
  const out = renderStyled(matrix, size, style, modulePx);
  // 5) 闭环自检：再解码比对
  const reDecoded = decodeQR(out.rgba, out.width, out.height);
  if (reDecoded !== text) {
    return { ok: false, reason: "self-check-failed" };
  }
  return { ok: true, text, rgba: out.rgba, width: out.width, height: out.height };
}
