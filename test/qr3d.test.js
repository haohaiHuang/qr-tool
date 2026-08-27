import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMatrix } from "../src/qr/generate.js";
import { decodeQR } from "../src/qr/decode.js";
import { buildBlocks, T, TRUNK_LAYERS, TREE_TYPES } from "../src/qr3d/layout.js";
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

test("TREE_TYPES: 5 个树种，树形与冠幅各异", () => {
  assert.equal(Object.keys(TREE_TYPES).length, 5);
  for (const t of Object.values(TREE_TYPES)) {
    assert.ok(t.name);
    assert.equal(t.palette.length, 4);
    assert.ok(["dome", "flat", "cone", "pagoda", "palm"].includes(t.shape), `${t.name} 树形应合法`);
    assert.equal(typeof t.canopyFactor, "number");
  }
});

test("layout: 5 个树种树冠布局互不相同", () => {
  const { size, matrix } = generateMatrix("SPECIES", 4, "M");
  const fp = (blocks) => {
    const cherry = blocks.filter((b) => b.type === T.CHERRY);
    const xs = cherry.map((b) => b.x), ys = cherry.map((b) => b.y);
    return {
      cherry: cherry.length, total: blocks.length,
      minY: Math.min(...ys).toFixed(3), maxY: Math.max(...ys).toFixed(3),
      span: (Math.max(...xs) - Math.min(...xs)).toFixed(3),
    };
  };
  const fps = Object.values(TREE_TYPES).map((t) => JSON.stringify(fp(buildBlocks({ size, m: matrix }, t))));
  assert.equal(new Set(fps).size, fps.length, "每个树种树冠指纹应互不相同");
});

test("layout: 树形不同 → 冠区堆叠不同（cone vs dome）", () => {
  const s = synth(21);
  s.m[s.c][s.c + 5] = true; // 距离 5：冠区
  const dome = buildBlocks({ size: s.size, m: s.m }, TREE_TYPES.sakura).filter((b) => b.type === T.CHERRY);
  const cone = buildBlocks({ size: s.size, m: s.m }, TREE_TYPES.pine).filter((b) => b.type === T.CHERRY);
  assert.notEqual(cone.length, dome.length, "圆锥与圆顶层数应不同");
  const minY = (arr) => Math.min(...arr.map((b) => b.y));
  assert.ok(minY(cone) < minY(dome), "圆锥底座更低（针叶从近地面开始）");
});

test("layout: 圆顶类树种（同树形）树干/地面不变", () => {
  const s = synth(21);
  s.m[s.c][s.c] = true;      // 树干
  s.m[s.c][s.c + 10] = true; // 草地（冠外）
  const count = (blocks, type) => blocks.filter((b) => b.type === type).length;
  const sakura = buildBlocks({ size: s.size, m: s.m }, TREE_TYPES.sakura);
  const maple = buildBlocks({ size: s.size, m: s.m }, TREE_TYPES.maple);
  assert.equal(count(maple, T.TRUNK), count(sakura, T.TRUNK));
  assert.equal(count(maple, T.DIRT), count(sakura, T.DIRT));
});

test("layout: 松树圆锥覆盖中心（树干只露底部）", () => {
  const s = synth(21);
  s.m[s.c][s.c] = true; // 中心深色
  const pine = buildBlocks({ size: s.size, m: s.m }, TREE_TYPES.pine);
  const cherry = pine.filter((b) => b.type === T.CHERRY);
  const trunk = pine.filter((b) => b.type === T.TRUNK);
  assert.ok(cherry.length > 0, "中心应被圆锥（松针）覆盖");
  assert.ok(trunk.length < TRUNK_LAYERS, `松树树干应矮于通用 ${TRUNK_LAYERS} 层（锥底露出），实际 ${trunk.length}`);
});

test("layout: 棕榈冠紧贴树干顶端且外层叶放大下垂", () => {
  const s = synth(21);
  s.m[s.c][s.c + 4] = true; // 冠区外层深色模块（窄冠内，t<0.55 → 下垂放大叶）
  const palm = buildBlocks({ size: s.size, m: s.m }, TREE_TYPES.palm);
  const cherry = palm.filter((b) => b.type === T.CHERRY);
  assert.ok(cherry.length > 0);
  const minY = Math.min(...cherry.map((b) => b.y));
  assert.ok(minY >= 0, "冠层不应低于地面");
  assert.ok(cherry.some((b) => (b.s || 1) > 1.2), "外层下垂叶应放大（大片叶）");
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
