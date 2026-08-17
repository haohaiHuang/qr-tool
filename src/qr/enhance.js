// 标准 QR 增强管道：解码 → 重生（风格保留）→ 闭环自检 → 输出
// 自检：重生结果再解码，数据一致才 ok（绝不输出未验证的码）

import { decodeQR } from "./decode.js";
import { generateMatrix } from "./generate.js";
import { detectStyle, renderStyled } from "./style.js";

/**
 * 增强标准 QR 码
 * @param rgba 原图 RGBA
 * @param width height 原图尺寸
 * @param modulePx 输出每模块像素（分辨率）
 * @returns { ok: true, text, rgba, width, height } | { ok: false, reason }
 */
export function enhanceQr(rgba, width, height, modulePx = 8) {
  // 1) 解码
  const text = decodeQR(rgba, width, height);
  if (!text) return { ok: false, reason: "decode-failed" };
  // 2) 重生矩阵
  const { size, matrix } = generateMatrix(text);
  // 3) 风格保留（从原图检测配色）
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
