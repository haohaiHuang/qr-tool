// 方案 B：逐模块采样 → 原模块矩阵 — 纯函数，node 可测
// 每模块用网格映射定位中心，3x3 邻域多数投票判定 dark/light

export function sampleModules(gray, width, height, grid) {
  const { n, toPixel } = grid;
  const matrix = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      const [x, y] = toPixel(r, c);
      // 邻域自适应：模块小（<4px）用中心点+4邻，模块大用 3x3（按 modulePx）
      const half = grid.modulePx >= 4 ? 1 : 0;
      let dark = 0, total = 0;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const px = Math.round(x + dx);
          const py = Math.round(y + dy);
          if (px >= 0 && px < width && py >= 0 && py < height) {
            total++;
            if (gray[py * width + px] < 128) dark++;
          }
        }
      }
      row.push(dark * 2 >= total); // 多数投票（≥50% 暗 → dark）
    }
    matrix.push(row);
  }
  return matrix;
}
