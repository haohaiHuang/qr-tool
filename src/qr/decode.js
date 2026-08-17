// 标准 QR 解码封装 — 基于 jsQR（纯 JS，node 可测）
// 输入：RGBA 像素数组（Uint8ClampedArray）+ 宽高；输出：解码文本或 null

import jsQR from "jsqr";

export function decodeQR(rgba, width, height) {
  try {
    const result = jsQR(rgba, width, height);
    return result ? result.data : null;
  } catch {
    return null; // 解码异常视为不可解码
  }
}
