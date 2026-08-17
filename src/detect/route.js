// 识别路由：根据检测结果分类码类型 — 纯函数，node 可测

import { detectFinderPatterns } from "./finder.js";
import { detectCircle } from "./circle.js";

/**
 * 分类输入图像中的码类型
 * 优先：三回字定位符（标准 QR，含 Logo 码）→ 同心圆环（微信码）→ unknown
 * 返回：{ type: "qr", finders } | { type: "wechat", circle } | { type: "unknown" }
 */
export function classifyCode(gray, width, height) {
  // 1) 标准 QR：找 3 个 Finder Pattern
  const finders = detectFinderPatterns(gray, width, height);
  if (finders.length >= 3) {
    return { type: "qr", finders };
  }
  // 2) 微信码：同心圆环
  const circle = detectCircle(gray, width, height);
  if (circle) {
    return { type: "wechat", circle };
  }
  // 3) 无法识别
  return { type: "unknown" };
}
