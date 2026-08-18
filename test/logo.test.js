import { test } from "node:test";
import assert from "node:assert/strict";
import { detectGrid, detectLogoBounds } from "../src/detect/grid.js";
import { toGrayImage } from "../src/shared/pixels.js";
import { buildQrImage } from "./helpers/qr-image.js";

const QUIET = 4;

// 构造带白环 logo 的码：中心黑底方形 + 白环 + 外围模块
function drawLogoWithRing(rgba, width, height, half, ringW) {
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  for (let y = cy - half - ringW; y <= cy + half + ringW; y++) {
    for (let x = cx - half - ringW; x <= cx + half + ringW; x++) {
      const inRing = Math.abs(x - cx) <= half + ringW && Math.abs(y - cy) <= half + ringW
        && (Math.abs(x - cx) > half || Math.abs(y - cy) > half);
      const i = (y * width + x) * 4;
      if (inRing) { rgba[i] = 255; rgba[i+1] = 255; rgba[i+2] = 255; } // 白环
      else if (Math.abs(x - cx) <= half && Math.abs(y - cy) <= half) {
        rgba[i] = 30; rgba[i+1] = 40; rgba[i+2] = 90; // 黑底（模拟深色 logo）
      }
    }
  }
}

// TC-L1: 白环 logo → 检测边界 ≈ 黑底半宽
test("TC-L1: 白环 logo 边界检测", () => {
  const { rgba, width, height } = buildQrImage("LOGO RING L1", 4, QUIET);
  const half = Math.floor(width * 0.12); // 黑底半宽
  drawLogoWithRing(rgba, width, height, half, 3); // 3px 白环
  const gray = toGrayImage(rgba, width, height);
  const grid = detectGrid(gray, width, height);
  assert.ok(grid);
  const b = detectLogoBounds(gray, width, height, grid);
  assert.ok(b, "应检测到 logo 边界");
  // 半宽 ≈ 黑底半宽（容差 1 模块）
  assert.ok(Math.abs(b.halfW - half) <= grid.modulePx, `halfW≈${half}，实际 ${b.halfW}`);
  // 中心 ≈ 码中心
  const [ecx, ecy] = grid.toPixel((grid.n - 1) / 2, (grid.n - 1) / 2);
  assert.ok(Math.abs(b.cx - ecx) <= 3);
});

// TC-L2: 无 logo（普通码）→ 即使检测误判，enhance2 仍成功（自检兜底，贴片无害）
test("TC-L2: 无 logo 码处理成功（误判无害）", async () => {
  const { enhance2 } = await import("../src/qr/enhance2.js");
  const { decodeQR } = await import("../src/qr/decode.js");
  const text = "LOGO RING L2";
  const { rgba, width, height } = buildQrImage(text, 4, QUIET);
  const r = enhance2(rgba, width, height, 8);
  assert.equal(r.ok, true, `无 logo 码应成功：${r.reason ?? ""}`);
  assert.equal(decodeQR(r.rgba, r.width, r.height), text, "扫码内容一致");
});
