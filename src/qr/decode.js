// 标准 QR 解码封装 — 基于 jsQR（纯 JS，node 可测）
// 输入：RGBA 像素数组（Uint8ClampedArray）+ 宽高

import jsQR from "jsqr";

/** 返回解码文本或 null */
export function decodeQR(rgba, width, height) {
  try {
    const result = jsQR(rgba, width, height);
    return result ? result.data : null;
  } catch {
    return null;
  }
}

/** 返回完整 jsQR result（含 location 用于精确定位模块网格），失败返回 null */
export function decodeResult(rgba, width, height) {
  try {
    return jsQR(rgba, width, height);
  } catch {
    return null;
  }
}
