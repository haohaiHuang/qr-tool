import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMatrix } from "../src/qr/generate.js";
import { decodeQR } from "../src/qr/decode.js";
import { buildBlocks, T, TRUNK_LAYERS } from "../src/qr3d/layout.js";
import { matrixToColoredRgba } from "../src/qr3d/flat.js";

// 合成矩阵：控制各区域模块
function synth(size) {
  const m = Array.from({ length: size }, () => Array(size).fill(false));
  const c = Math.floor(size / 2);
  return { size, m, c };
}

test("layout: 浅色模块 → 单个 DIRT 方块", () => {
  const s = synth(21);
  const blocks = buildBlocks({ size: s.size, m: s.m });
  assert.equal(blocks.length, 21 * 21);
  assert.ok(blocks.every((b) => b.type === T.DIRT));
});

test("layout: 中心深色模块 → TRUNK 堆叠 TRUNK_LAYERS 层", () => {
  const s = synth(21);
  s.m[s.c][s.c] = true;
  const blocks = buildBlocks({ size: s.size, m: s.m });
  const trunk = blocks.filter((b) => b.type === T.TRUNK);
  assert.equal(trunk.length, TRUNK_LAYERS);
});

test("layout: 冠区深色模块 → CHERRY 穹顶（≥2 层）", () => {
  const s = synth(21);
  s.m[s.c][s.c + 5] = true; // 距离 5：在冠区（TRUNK_R=2.5 < 5 ≤ canopyR≈9.66）
  const blocks = buildBlocks({ size: s.size, m: s.m });
  const cherry = blocks.filter((b) => b.type === T.CHERRY);
  assert.ok(cherry.length >= 2, `期望 ≥2 层，实际 ${cherry.length}`);
});

test("layout: 冠外深色模块 → 单个 GRASS 方块", () => {
  const s = synth(21);
  s.m[s.c][s.c + 10] = true; // 距离 10 > canopyR≈9.66
  const blocks = buildBlocks({ size: s.size, m: s.m });
  const grass = blocks.filter((b) => b.type === T.GRASS);
  assert.equal(grass.length, 1);
});

test("layout: 每个模块至少 1 个方块", () => {
  const { size, matrix } = generateMatrix("3D TREE", 4, "M");
  const blocks = buildBlocks({ size, m: matrix });
  assert.ok(blocks.length >= size * size);
});

test("flat: 输出尺寸 = size×qrPx", () => {
  const s = synth(21);
  const { width, height } = matrixToColoredRgba({ size: s.size, m: s.m }, 8);
  assert.equal(width, 21 * 8);
  assert.equal(height, 21 * 8);
});

test("flat: 浅色模块白底 / 深色模块着色", () => {
  const s = synth(21);
  s.m[s.c][s.c] = true;
  const { rgba, width } = matrixToColoredRgba({ size: s.size, m: s.m }, 2);
  const qrPx = 2;
  const at = (r, col) => {
    const i = (r * qrPx * width + col * qrPx) * 4;
    return [rgba[i], rgba[i + 1], rgba[i + 2]];
  };
  assert.deepEqual(at(0, 0), [255, 255, 255]); // 浅色 → 白
  assert.ok(at(s.c, s.c)[0] < 200, "深色模块应明显暗于白色"); // 深棕
});

test("flat: 真实 QR 扁平彩色码可解码（闭环）", () => {
  const text = "https://enzo.fyi";
  const { size, matrix } = generateMatrix(text, 4, "M");
  const { rgba, width } = matrixToColoredRgba({ size, m: matrix }, 8);
  assert.equal(decodeQR(rgba, width, width), text);
});
