import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSvg } from "../src/svg.js";
import { generateMatrix } from "../src/qr/generate.js";

test("buildSvg: 生成含正确模块数与配色的 SVG", () => {
  const { matrix } = generateMatrix("SVG TEST", 4);
  const n = matrix.length;
  const style = { fg: [0, 90, 200], bg: [250, 245, 225], moduleRadius: 0.15, moduleFill: 0.85 };
  const svg = buildSvg(matrix, n, style);
  // 结构
  assert.ok(svg.startsWith("<svg"), "SVG 开头");
  assert.ok(svg.endsWith("</svg>"), "SVG 结尾");
  // dark 模块数 = rect 数（不含背景）
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (matrix[r][c]) dark++;
  const rectCount = (svg.match(/<rect/g) || []).length;
  assert.equal(rectCount, dark + 1, "rect 数 = 模块数 + 背景");
  // 配色
  assert.ok(svg.includes(`rgb(0,90,200)`), "前景色");
  assert.ok(svg.includes(`rgb(250,245,225)`), "背景色");
  // 圆角（数据区模块 rx>0）
  assert.ok(svg.includes(`rx="1.5"`), "圆角 rx=1.5（modulePx10*0.15）");
});

test("buildSvg: 嵌入 logo", () => {
  const { matrix } = generateMatrix("SVG LOGO", 4);
  const n = matrix.length;
  const svg = buildSvg(matrix, n, null, "data:image/png;base64,AAAA", 0.22);
  assert.ok(svg.includes("<image"), "含 logo image");
  assert.ok(svg.includes("data:image/png;base64,AAAA"), "logo data URL");
});
