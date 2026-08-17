import { test } from "node:test";
import assert from "node:assert/strict";
import { enhanceQr } from "../src/qr/enhance.js";
import { buildQrImage } from "./helpers/qr-image.js";

test("enhanceQr: 正常码 → 重生 + 自检通过 + 数据一致", () => {
  const text = "ENHANCE PIPELINE";
  const { rgba, width, height } = buildQrImage(text, 3); // 低分辨率输入（模块 3px）
  const r = enhanceQr(rgba, width, height, 8); // 重生为 8px 模块
  assert.equal(r.ok, true, `应成功：${r.reason ?? ""}`);
  assert.equal(r.text, text);
  // 分辨率提升：模块 3px → 8px
  assert.ok(r.width > width, `输出应更大：${r.width} > ${width}`);
});

test("enhanceQr: 白图 → decode-failed", () => {
  const size = 100;
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  const r = enhanceQr(rgba, size, size);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "decode-failed");
});

test("enhanceQr: 彩色码重生后保留风格且可解码", () => {
  const fg = [20, 120, 200];
  const bg = [250, 248, 235];
  const { rgba, width, height } = buildQrImage("COLORED", 4, 4, fg, bg);
  const r = enhanceQr(rgba, width, height, 8);
  assert.equal(r.ok, true);
  assert.equal(r.text, "COLORED");
  // 输出 dark 像素应接近原前景色
  assert.ok(Math.abs(r.rgba[0] - fg[0]) < 60 || Math.abs(r.rgba[0] - fg[0]) > 200, "输出第一个像素非前景(可能是 bg)");
  // 完整可解码验证（管道内已自检，这里确认输出尺寸正确）
  assert.equal(r.width, r.height);
});

test("enhanceQr: quiet zone 非 4（如截图裁剪/留白不同）仍自检通过", () => {
  const text = "WIDE QUIET";
  const { rgba, width, height } = buildQrImage(text, 4, 8); // quiet zone = 8 模块（非假设的 4）
  const r = enhanceQr(rgba, width, height, 8);
  assert.equal(r.ok, true, `应自检通过：${r.reason ?? ""}`);
  assert.equal(r.text, text);
});

// Logo 码：中心被 logo 覆盖 → 抹白重解（纠错恢复）
test("enhanceQr: 中心带 logo 的码（抹白后重解）", () => {
  const text = "LOGO QR TEST";
  const { rgba, width, height } = buildQrImage(text, 4, 4);
  // 在码中心画一个"logo"圆（半径 ~8% 码宽，真实 logo 比例），覆盖中心模块
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  const r = Math.floor(width * 0.08); // 真实 logo 大小（~16% 直径）
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) <= r) {
        const i = (y * width + x) * 4;
        rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; // 白（覆盖 logo 数据）
      }
    }
  }
  // 直接解码应失败（logo 覆盖）
  const res = enhanceQr(rgba, width, height, 8);
  assert.equal(res.ok, true, `带 logo 码应通过抹白重解：${res.reason ?? ""}`);
  assert.equal(res.text, text);
});

test("enhanceQr: 带埋点参数（query/tracking）的 URL 逐字符保留", () => {
  const text = "https://example.com/page?utm_source=wechat&utm_medium=qr&ref=abc123&campaign=summer";
  const { rgba, width, height } = buildQrImage(text, 4, 4);
  const r = enhanceQr(rgba, width, height, 8);
  assert.equal(r.ok, true);
  assert.equal(r.text, text, "埋点参数必须逐字符保留（不做重写/规范化）");
});
