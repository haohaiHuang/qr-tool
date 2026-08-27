// QR 模块矩阵 → 3D 树方块布局（纯函数，node 可测，不依赖 DOM/Canvas）
// 每个 QR 模块 1:1 对应方块；深色模块按区域：中心→树干（堆叠）、冠区→树冠（按距离分层）、冠外→草地
// 浅色模块 → 地面。方块坐标 = 世界坐标（原点居中，CELL 为模块间距）。
// 多树种：TREE_TYPES 定义配色 + 树冠形状（dome 圆顶 / flat 平顶伞 / cone 圆锥 / pagoda 窄高塔 / weep 垂枝）+ 冠幅系数

export const T = { DIRT: 0, CHERRY: 1, TRUNK: 2, GRASS: 3 };

export const TRUNK_R = 2.5;          // 树干半径（模块）
export const CANOPY_R_FACTOR = 0.46;  // 冠区半径基准 = size * 0.46
export const TRUNK_LAYERS = 14;       // 树干层数
export const CANOPY_BASE = 13;        // 圆顶起始层（高于树干顶，冠不吞树干）
export const MAX_CANOPY_LAYERS = 12;
export const CELL = 0.05;             // 模块间距（世界单位）
export const BLOCK = 0.048;           // 方块边长（留缝）

// 树种配置：name 显示名 / palette 3D 配色（奶油地/树冠/树干/草地）/ shape 树冠形状 / canopyFactor 冠幅倍率
// 形状要显著不同：dome 圆顶 / flat 平顶伞 / cone 圆锥 / pagoda 窄高塔 / weep 垂枝
const P = { D: 0xf6ead0, T: 0x7a4a2b, G: 0x8cc469 }; // 公共：奶油地/棕干/绿草
export const TREE_TYPES = {
  sakura: { name: "樱花", palette: [P.D, 0xf2a7c0, P.T, P.G], shape: "dome", canopyFactor: 1.0 },
  maple:  { name: "枫树", palette: [P.D, 0xe0703a, 0x6b3a22, P.G], shape: "flat", canopyFactor: 1.2 },
  pine:   { name: "松树", palette: [P.D, 0x2f7a3f, 0x6b4a2b, P.G], shape: "cone", canopyFactor: 0.85 },
  ginkgo: { name: "银杏", palette: [P.D, 0xe3c32a, 0x6b4a2b, P.G], shape: "pagoda", canopyFactor: 0.7 },
  willow: { name: "棕榈", palette: [P.D, 0x4c9a5a, 0x8a6a3a, P.G], shape: "palm", canopyFactor: 0.7 },
};

// 按树形计算冠区堆叠层索引（t = 1-距中心/冠半径，中心 1 / 边缘 0）
function canopyLayers(shape, t) {
  switch (shape) {
    case "cone": // 松树：圆锥——中心高边缘低（线性），底座低（针叶从近地面开始）
      return Array.from(
        { length: Math.max(2, Math.round(MAX_CANOPY_LAYERS * (0.15 + 0.85 * t))) },
        (_, i) => Math.round(CANOPY_BASE * 0.45) + i,
      );
    case "flat": // 枫树：平顶伞——内 70% 满层平顶，边缘一圈薄边，冠幅宽
      return Array.from(
        { length: t > 0.3 ? MAX_CANOPY_LAYERS : 4 },
        (_, i) => CANOPY_BASE - 2 + i,
      );
    case "pagoda": // 银杏：窄高塔——满层竖柱，底座高，冠幅窄（直立感）
      return Array.from(
        { length: MAX_CANOPY_LAYERS },
        (_, i) => CANOPY_BASE + 3 + i,
      );
    case "palm": // 棕榈：高干 + 顶部小冠——冠只在高处（窄小），下方树干裸露
      {
        const layers = Math.max(2, Math.round(MAX_CANOPY_LAYERS * 0.45 * (0.5 + 0.5 * t)));
        const base = CANOPY_BASE + 10;
        return Array.from({ length: layers }, (_, i) => base + i);
      }
    default: // dome 樱花：圆顶——中心高边缘低（二次曲线 + 圆顶偏移）
      return Array.from(
        { length: Math.max(2, Math.round(MAX_CANOPY_LAYERS * (0.25 + 0.75 * t * t))) },
        (_, i) => CANOPY_BASE + Math.floor(t * 4) + i,
      );
  }
}

/**
 * 模块矩阵 → 3D 方块布局
 * @param {{ size:number, m:boolean[][] }} matrix 矩阵（含静区）
 * @param {{ name:string, palette:number[], shape:string, canopyFactor:number }} [tree] 树种（默认樱花）
 * @returns {{ x:number, y:number, z:number, type:number }[]} 方块（世界坐标）
 */
export function buildBlocks({ size, m }, tree = TREE_TYPES.sakura) {
  const cx = (size - 1) / 2, canopyR = size * CANOPY_R_FACTOR * (tree?.canopyFactor ?? 1), out = [];
  const shape = tree?.shape ?? "dome";
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const dist = Math.hypot(c - cx, r - cx), dark = m[r][c];
    let type, ys;
    if (!dark) { type = T.DIRT; ys = [0]; }
    else if (dist <= TRUNK_R) { type = T.TRUNK; ys = Array.from({ length: TRUNK_LAYERS }, (_, i) => i); }
    else if (dist <= canopyR) {
      type = T.CHERRY;
      ys = canopyLayers(shape, 1 - dist / canopyR);
    } else { type = T.GRASS; ys = [0]; }
    for (const y of ys) out.push({ x: (c - cx) * CELL, y: (y + 0.5) * CELL, z: (r - cx) * CELL, type });
  }
  return out;
}
