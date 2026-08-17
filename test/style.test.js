import { test } from "node:test";
import assert from "node:assert/strict";
import { detectStyle, renderStyled } from "../src/qr/style.js";
import { generateMatrix } from "../src/qr/generate.js";
import { decodeQR } from "../src/qr/decode.js";
import { buildQrImage } from "./helpers/qr-image.js";

test("detectStyle: 从彩色二维码检测前景/背景色", () => {
  const fg = [200, 30, 30]; // 暗红
  const bg = [245, 240, 220]; // 米白
  const { rgba, width } = buildQrImage("STYLE TEST", 4, 4, fg, bg);
  const style = detectStyle(rgba, width, width);
  assert.ok(Math.abs(style.fg[0] - fg[0]) < 30, `fg R≈${fg[0]}，实际 ${style.fg[0]}`);
  assert.ok(Math.abs(style.fg[1] - fg[1]) < 30);
  assert.ok(Math.abs(style.bg[0] - bg[0]) < 30, `bg R≈${bg[0]}，实际 ${style.bg[0]}`);
  assert.ok(Math.abs(style.bg[1] - bg[1]) < 30);
});

test("renderStyled: 用检测风格重生，颜色保留且可解码", () => {
  const fg = [0, 80, 200]; // 蓝
  const bg = [255, 250, 230]; // 浅黄
  const { rgba, width } = buildQrImage("BLUE QR", 4, 4, fg, bg);
  const style = detectStyle(rgba, width, width);
  const { size, matrix } = generateMatrix("BLUE QR");
  const out = renderStyled(matrix, size, style, 4);
  // 颜色：找第一个 dark 模块位置，其像素应 = 前景色
  let darkIdx = -1;
  for (let y = 0; y < size && darkIdx < 0; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x]) { darkIdx = y * size + x; break; }
    }
  }
  const py = Math.floor(darkIdx / size) * 4;
  const pxx = (darkIdx % size) * 4;
  assert.ok(
    Math.abs(out.rgba[(py * out.width + pxx) * 4] - fg[0]) < 40,
    `输出 dark 像素 R≈${fg[0]}，实际 ${out.rgba[(py * out.width + pxx) * 4]}`,
  );
  // 可解码
  assert.equal(decodeQR(out.rgba, out.width, out.height), "BLUE QR");
});

test("renderStyled: 黑白默认也可解码", () => {
  const { size, matrix } = generateMatrix("MONO");
  const out = renderStyled(matrix, size, { fg: [0, 0, 0], bg: [255, 255, 255] }, 4);
  assert.equal(decodeQR(out.rgba, out.width, out.height), "MONO");
});
