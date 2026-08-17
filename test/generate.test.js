import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMatrix, matrixToRgba } from "../src/qr/generate.js";
import { decodeQR } from "../src/qr/decode.js";

test("generateMatrix: 生成可解码的矩阵（闭环）", () => {
  const { size, matrix } = generateMatrix("T2 CLOSED LOOP");
  assert.ok(size >= 21, "QR 至少 21 模块");
  const { rgba, width } = matrixToRgba(matrix, size, 4);
  assert.equal(decodeQR(rgba, width, width), "T2 CLOSED LOOP");
});

test("matrixToRgba: 任意分辨率可解码（modulePx=8）", () => {
  const { size, matrix } = generateMatrix("HIGH RES 8");
  const { rgba, width } = matrixToRgba(matrix, size, 8);
  assert.equal(width, size * 8);
  assert.equal(decodeQR(rgba, width, width), "HIGH RES 8");
});

test("generateMatrix: 不同数据产生不同矩阵", () => {
  const a = generateMatrix("AAA").matrix;
  const b = generateMatrix("BBB").matrix;
  let diff = 0;
  for (let r = 0; r < a.length; r++) {
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) diff++;
    }
  }
  assert.ok(diff > 10, "不同数据的矩阵应显著不同");
});
