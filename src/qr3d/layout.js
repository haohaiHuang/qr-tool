// QR 模块矩阵 → 3D 樱花树方块布局（纯函数，node 可测，不依赖 DOM/Canvas）
// 每个 QR 模块 1:1 对应方块；深色模块按区域：中心→树干（堆叠）、冠区→樱花穹顶（按距离分层）、冠外→草地
// 浅色模块 → 地面。方块坐标 = 世界坐标（原点居中，CELL 为模块间距）。

export const T = { DIRT: 0, CHERRY: 1, TRUNK: 2, GRASS: 3 };

export const TRUNK_R = 2.5;          // 树干半径（模块）
export const CANOPY_R_FACTOR = 0.46;  // 冠区半径 = size * 0.46
export const TRUNK_LAYERS = 14;       // 树干层数
export const CANOPY_BASE = 13;        // 穹顶起始层（高于树干顶，冠不吞树干）
export const MAX_CANOPY_LAYERS = 12;
export const CELL = 0.05;             // 模块间距（世界单位）
export const BLOCK = 0.048;           // 方块边长（留缝）

/**
 * 模块矩阵 → 3D 方块布局
 * @param {{ size:number, m:boolean[][] }} matrix 矩阵（含静区）
 * @returns {{ x:number, y:number, z:number, type:number }[]} 方块（世界坐标）
 */
export function buildBlocks({ size, m }) {
  const cx = (size - 1) / 2, canopyR = size * CANOPY_R_FACTOR, out = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const dist = Math.hypot(c - cx, r - cx), dark = m[r][c];
    let type, ys;
    if (!dark) { type = T.DIRT; ys = [0]; }
    else if (dist <= TRUNK_R) { type = T.TRUNK; ys = Array.from({ length: TRUNK_LAYERS }, (_, i) => i); }
    else if (dist <= canopyR) {
      type = T.CHERRY;
      const t = 1 - dist / canopyR;
      const layers = Math.max(2, Math.round(MAX_CANOPY_LAYERS * (0.25 + 0.75 * t * t)));
      const dome = Math.floor(t * 4);
      ys = Array.from({ length: layers }, (_, i) => CANOPY_BASE + dome + i);
    } else { type = T.GRASS; ys = [0]; }
    for (const y of ys) out.push({ x: (c - cx) * CELL, y: (y + 0.5) * CELL, z: (r - cx) * CELL, type });
  }
  return out;
}
