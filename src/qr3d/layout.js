// QR 模块矩阵 → 3D 树方块布局（纯函数，node 可测，不依赖 DOM/Canvas）
// 每个 QR 模块 1:1 对应方块；深色模块按区域：中心→树干（堆叠）、冠区→树冠（按距离分层）、冠外→草地
// 浅色模块 → 地面。方块坐标 = 世界坐标（原点居中，CELL 为模块间距）。
// 多树种：TREE_TYPES 定义配色 + 树冠形状 + 冠幅；canopyLayers 返回 [{y, s}]（s=方块缩放，默认 1）

export const T = { DIRT: 0, CHERRY: 1, TRUNK: 2, GRASS: 3 };

export const TRUNK_R = 2.5;          // 树干半径（模块）
export const CANOPY_R_FACTOR = 0.46;  // 冠区半径基准 = size * 0.46
export const TRUNK_LAYERS = 14;       // 树干层数
export const CANOPY_BASE = 13;        // 圆顶起始层（高于树干顶，冠不吞树干）
export const MAX_CANOPY_LAYERS = 12;
export const CELL = 0.05;             // 模块间距（世界单位）
export const BLOCK = 0.048;           // 方块边长（留缝）

// 树种配置：name 显示名 / palette 3D 配色（奶油地/树冠/树干/草地）/ shape 树冠形状 / canopyFactor 冠幅倍率
const P = { D: 0xf6ead0, T: 0x7a4a2b, G: 0x8cc469 }; // 公共：奶油地/棕干/绿草
export const TREE_TYPES = {
  sakura: { name: "樱花", palette: [P.D, 0xf2a7c0, P.T, P.G], shape: "dome", canopyFactor: 1.0 },
  maple:  { name: "枫树", palette: [P.D, 0xe0703a, 0x6b3a22, P.G], shape: "flat", canopyFactor: 1.2 },
  pine:   { name: "松树", palette: [P.D, 0x2f7a3f, 0x6b4a2b, P.G], shape: "cone", canopyFactor: 0.85 },
  ginkgo: { name: "银杏", palette: [P.D, 0xe3c32a, 0x6b4a2b, P.G], shape: "pagoda", canopyFactor: 0.7 },
  palm:   { name: "棕榈", palette: [P.D, 0x4c9a5a, 0x8a6a3a, P.G], shape: "palm", canopyFactor: 0.5, trunkLayers: 24, trunkR: 0.8 },
};

// 按树形计算冠区堆叠层（t = 1-距中心/冠半径，中心 1 / 边缘 0；tree 供树干高度等使用）
// 返回 [{ y: 层索引, s: 方块缩放 }]
function canopyLayers(shape, t, tree) {
  switch (shape) {
    case "cone": // 松树：高圆锥——覆盖整个冠区（buildBlocks 处理中心），底座低近地面，树冠高
      return Array.from(
        { length: Math.max(2, Math.round(18 * (0.1 + 0.9 * t))) },
        (_, i) => ({ y: 2 + i, s: 1 }),
      );
    case "flat": // 枫树：平顶伞——内 70% 满层平顶，边缘一圈薄边，冠幅宽
      return Array.from(
        { length: t > 0.3 ? MAX_CANOPY_LAYERS : 4 },
        (_, i) => ({ y: CANOPY_BASE - 2 + i, s: 1 }),
      );
    case "pagoda": // 银杏：窄高塔——满层竖柱，底座高，冠幅窄（直立感）
      return Array.from(
        { length: MAX_CANOPY_LAYERS },
        (_, i) => ({ y: CANOPY_BASE + 3 + i, s: 1 }),
      );
    case "palm": // 棕榈：高细棕干裸露 + 顶部大叶冠（2 层大块叶，微下垂）
      {
        const base = tree?.trunkLayers ?? TRUNK_LAYERS;
        const droop = Math.round((1 - t) * 5); // 叶子微下垂 5 层
        const s = 2.0; // 大片叶子
        return Array.from({ length: 2 }, (_, i) => ({ y: Math.max(0, base - droop) + i, s }));
      }
    default: // dome 樱花：圆顶——中心高边缘低（二次曲线 + 圆顶偏移）
      return Array.from(
        { length: Math.max(2, Math.round(MAX_CANOPY_LAYERS * (0.25 + 0.75 * t * t))) },
        (_, i) => ({ y: CANOPY_BASE + Math.floor(t * 4) + i, s: 1 }),
      );
  }
}

/**
 * 模块矩阵 → 3D 方块布局
 * @param {{ size:number, m:boolean[][] }} matrix 矩阵（含静区）
 * @param {{ name:string, palette:number[], shape:string, canopyFactor:number }} [tree] 树种（默认樱花）
 * @returns {{ x:number, y:number, z:number, type:number, s?:number }[]} 方块（世界坐标）
 */
export function buildBlocks({ size, m }, tree = TREE_TYPES.sakura) {
  const cx = (size - 1) / 2, canopyR = size * CANOPY_R_FACTOR * (tree?.canopyFactor ?? 1), out = [];
  const shape = tree?.shape ?? "dome";
  const trunkR = tree?.trunkR ?? TRUNK_R;
  const trunkLayers = tree?.trunkLayers ?? TRUNK_LAYERS;
  const coneFull = shape === "cone"; // 松树：圆锥覆盖整个冠区（含中心，树干被锥体包裹）
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const dist = Math.hypot(c - cx, r - cx), dark = m[r][c];
    let type, layers;
    if (!dark) { type = T.DIRT; layers = [{ y: 0, s: 1 }]; }
    else if (coneFull && dist <= canopyR) {
      // 松树：中心也长松针；中心另叠短树干（锥底露出棕色）
      type = T.CHERRY;
      layers = canopyLayers(shape, 1 - dist / canopyR, tree);
      if (dist <= trunkR) {
        for (let i = 0; i < 6; i++)
          out.push({ x: (c - cx) * CELL, y: (i + 0.5) * CELL, z: (r - cx) * CELL, type: T.TRUNK, s: 1 });
      }
    }
    else if (dist <= trunkR) { type = T.TRUNK; layers = Array.from({ length: trunkLayers }, (_, i) => ({ y: i, s: 1 })); }
    else if (dist <= canopyR) { type = T.CHERRY; layers = canopyLayers(shape, 1 - dist / canopyR, tree); }
    else { type = T.GRASS; layers = [{ y: 0, s: 1 }]; }
    for (const ly of layers)
      out.push({ x: (c - cx) * CELL, y: (ly.y + 0.5) * CELL, z: (r - cx) * CELL, type, s: ly.s });
  }
  // 棕榈：中心强制树干（QR 中心模块可能是浅色 → 不依赖暗色也保证有高细树干）
  if (shape === "palm") {
    for (let i = 0; i < trunkLayers; i++)
      out.push({ x: 0, y: (i + 0.5) * CELL, z: 0, type: T.TRUNK, s: 1 });
  }
  return out;
}
