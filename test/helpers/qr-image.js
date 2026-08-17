// 测试辅助：用 qrcode-generator 生成二维码的 RGBA 像素数组（供解码测试）
import qrcode from "qrcode-generator";

/** 生成包含指定文本的 QR 图，返回 { rgba, width, height }
 *  fg/bg：前景/背景色 [r,g,b]（默认黑/白），带 quiet zone */
export function buildQrImage(text, modulePx = 4, quiet = 4, fg = [0, 0, 0], bg = [255, 255, 255]) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = (n + quiet * 2) * modulePx;
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const modX = Math.floor(x / modulePx) - quiet;
      const modY = Math.floor(y / modulePx) - quiet;
      const dark = modX >= 0 && modX < n && modY >= 0 && modY < n && qr.isDark(modY, modX);
      const [r, g, b] = dark ? fg : bg;
      const i = (y * size + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
  return { rgba, width: size, height: size };
}
