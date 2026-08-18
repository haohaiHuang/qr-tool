// SVG 矢量生成（方案 B 数据：原矩阵 + 配色 + 间隙圆角 + logo）— 纯函数，node 可测

/**
 * 生成二维码 SVG
 * @param matrix 模块矩阵 [row][col]
 * @param n 模块数
 * @param style { fg, bg, moduleRadius, moduleFill }
 * @param logoDataUrl 可选：logo 图片 data URL（浏览器端裁剪生成）
 * @param logoRatio 可选：logo 占码宽比例
 * @returns SVG 字符串
 */
export function buildSvg(matrix, n, style, logoDataUrl = null, logoRatio = 0) {
  const modulePx = 10;
  const total = n * modulePx;
  const { fg, bg, moduleRadius = 0, moduleFill = 1 } = style || {};
  const half = (modulePx * moduleFill) / 2;
  const radius = modulePx * moduleRadius;
  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const bgC = bg ? `rgb(${bg[0]},${bg[1]},${bg[2]})` : "#fff";
  const fgC = fg ? `rgb(${fg[0]},${fg[1]},${fg[2]})` : "#000";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">`;
  svg += `<rect width="${total}" height="${total}" fill="${bgC}"/>`;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c]) continue;
      const solid = inFinder(r, c);
      const h = solid ? modulePx / 2 : half;
      const rr = solid ? 0 : radius;
      const x = c * modulePx + modulePx / 2 - h;
      const y = r * modulePx + modulePx / 2 - h;
      svg += `<rect x="${x}" y="${y}" width="${h * 2}" height="${h * 2}" rx="${rr}" fill="${fgC}"/>`;
    }
  }
  if (logoDataUrl && logoRatio > 0) {
    const logoSize = total * logoRatio;
    svg += `<image x="${(total - logoSize) / 2}" y="${(total - logoSize) / 2}" width="${logoSize}" height="${logoSize}" href="${logoDataUrl}"/>`;
  }
  svg += "</svg>";
  return svg;
}
