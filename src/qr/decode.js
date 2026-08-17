// 标准 QR 解码封装 — jsQR（优先）+ zxing（fallback，对 logo/损坏码更鲁棒）

import jsQR from "jsqr";
import { RGBLuminanceSource, BinaryBitmap, HybridBinarizer, QRCodeReader } from "@zxing/library";

/** jsQR 解码（返回文本或 null） */
function decodeJsQR(rgba, width, height) {
  try {
    const result = jsQR(rgba, width, height);
    return result ? result.data : null;
  } catch {
    return null;
  }
}

/** zxing 解码（对带 logo/对齐图案损坏的码更鲁棒） */
function decodeZxing(rgba, width, height) {
  try {
    const luminances = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      luminances[j] = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
    }
    const source = new RGBLuminanceSource(luminances, width, height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const result = new QRCodeReader().decode(bitmap);
    return result ? result.getText() : null;
  } catch {
    return null;
  }
}

/** 返回解码文本（jsQR → zxing fallback）或 null */
export function decodeQR(rgba, width, height) {
  return decodeJsQR(rgba, width, height) ?? decodeZxing(rgba, width, height);
}

/** 返回完整 jsQR result（含 location），失败返回 null */
export function decodeResult(rgba, width, height) {
  try {
    return jsQR(rgba, width, height);
  } catch {
    return null;
  }
}
