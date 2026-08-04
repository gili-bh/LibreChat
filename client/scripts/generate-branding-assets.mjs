import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const brandingDirectory = path.resolve(scriptDirectory, '../public/assets/branding');
const sourcePdf = path.join(brandingDirectory, 'source/company-logo.pdf');
const brandRed = '#ff321a';

const round = (value) => Number(value.toFixed(3));

const multiplyMatrices = ([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) => [
  a1 * a2 + c1 * b2,
  b1 * a2 + d1 * b2,
  a1 * c2 + c1 * d2,
  b1 * c2 + d1 * d2,
  a1 * e2 + c1 * f2 + e1,
  b1 * e2 + d1 * f2 + f1,
];

const transformPoint = ([a, b, c, d, e, f], x, y) => [a * x + c * y + e, b * x + d * y + f];

const transformBounds = (matrix, bounds) => {
  const [x1, y1, x2, y2] = bounds;
  const points = [
    transformPoint(matrix, x1, y1),
    transformPoint(matrix, x1, y2),
    transformPoint(matrix, x2, y1),
    transformPoint(matrix, x2, y2),
  ];
  return [
    Math.min(...points.map(([x]) => x)),
    Math.min(...points.map(([, y]) => y)),
    Math.max(...points.map(([x]) => x)),
    Math.max(...points.map(([, y]) => y)),
  ];
};

const mergeBounds = (items) => [
  Math.min(...items.map(({ bounds }) => bounds[0])),
  Math.min(...items.map(({ bounds }) => bounds[1])),
  Math.max(...items.map(({ bounds }) => bounds[2])),
  Math.max(...items.map(({ bounds }) => bounds[3])),
];

const toPathData = (encodedPath) => {
  const values = Array.isArray(encodedPath)
    ? encodedPath.flatMap((segment) => Array.from(segment))
    : Array.from(encodedPath);
  const commands = [];
  let index = 0;

  while (index < values.length) {
    const operation = values[index++];
    if (operation === 0) {
      commands.push(`M${round(values[index++])} ${round(values[index++])}`);
    } else if (operation === 1) {
      commands.push(`L${round(values[index++])} ${round(values[index++])}`);
    } else if (operation === 2) {
      commands.push(
        `C${round(values[index++])} ${round(values[index++])} ${round(values[index++])} ${round(values[index++])} ${round(values[index++])} ${round(values[index++])}`,
      );
    } else if (operation === 3) {
      const x2 = round(values[index++]);
      const y2 = round(values[index++]);
      const x3 = round(values[index++]);
      const y3 = round(values[index++]);
      commands.push(`S${x2} ${y2} ${x3} ${y3}`);
    } else if (operation === 4) {
      commands.push('Z');
    } else if (operation === 5) {
      const x = round(values[index++]);
      const y = round(values[index++]);
      const width = round(values[index++]);
      const height = round(values[index++]);
      commands.push(`M${x} ${y}h${width}v${height}h${-width}Z`);
    } else {
      throw new Error(`Unsupported PDF path operation: ${operation}`);
    }
  }

  return commands.join('');
};

const readVectorPaths = async () => {
  const data = new Uint8Array(await fs.readFile(sourcePdf));
  const document = await getDocument({ data }).promise;
  const page = await document.getPage(1);
  const operatorList = await page.getOperatorList();
  const paths = [];
  const stack = [];
  let fill = '#000000';
  let matrix = [1, 0, 0, 1, 0, 0];

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operation = operatorList.fnArray[index];
    const args = operatorList.argsArray[index];

    if (operation === OPS.save) {
      stack.push({ fill, matrix: [...matrix] });
    } else if (operation === OPS.restore) {
      const state = stack.pop();
      if (state) {
        ({ fill, matrix } = state);
      }
    } else if (operation === OPS.transform) {
      matrix = multiplyMatrices(matrix, args);
    } else if (operation === OPS.setFillRGBColor) {
      [fill] = args;
    } else if (
      operation === OPS.constructPath &&
      (args[0] === OPS.fill || args[0] === OPS.eoFill)
    ) {
      const rawBounds = Array.from(args[2]);
      paths.push({
        bounds: transformBounds(matrix, rawBounds),
        data: toPathData(args[1]),
        fill: fill.toLowerCase(),
        fillRule: args[0] === OPS.eoFill ? 'evenodd' : 'nonzero',
        matrix: matrix.map(round),
      });
    }
  }

  await document.destroy();
  return paths;
};

const createSvg = (paths, bounds, title, background) => {
  const [minX, minY, maxX, maxY] = bounds;
  const width = round(maxX - minX);
  const height = round(maxY - minY);
  const elements = paths
    .map(
      ({ data, fill, fillRule, matrix }) =>
        `<path d="${data}" fill="${fill}" fill-rule="${fillRule}" transform="matrix(${matrix.join(' ')})"/>`,
    )
    .join('');

  return {
    height,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">${title}</title>${background ? `<rect width="100%" height="100%" fill="${background}"/>` : ''}<g transform="translate(${-round(minX)} ${round(maxY)}) scale(1 -1)">${elements}</g></svg>`,
    width,
  };
};

const createSquareSvg = (paths, paddingRatio) => {
  const [minX, minY, maxX, maxY] = mergeBounds(paths);
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const side = Math.max(contentWidth, contentHeight) / (1 - paddingRatio * 2);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return createSvg(
    paths,
    [centerX - side / 2, centerY - side / 2, centerX + side / 2, centerY + side / 2],
    'Ehud Leviathan Engineering symbol',
  ).markup;
};

const writePng = async (svg, filename, width, height = width) => {
  await sharp(Buffer.from(svg)).resize({ width, height, fit: 'fill' }).png().toFile(filename);
};

const paths = await readVectorPaths();
const redPaths = paths.filter(({ fill }) => fill === brandRed);

if (paths.length === 0 || redPaths.length === 0) {
  throw new Error('The source PDF did not contain the expected vector paths.');
}

const logo = createSvg(paths, mergeBounds(paths), 'Ehud Leviathan Engineering', '#ffffff');
const logoSvgPath = path.join(brandingDirectory, 'logo.svg');
await fs.writeFile(logoSvgPath, `${logo.markup}\n`);
await writePng(
  logo.markup,
  path.join(brandingDirectory, 'logo.png'),
  Math.ceil(logo.width),
  Math.ceil(logo.height),
);

const iconAssets = [
  ['favicon-16x16.png', 16, 0.06],
  ['favicon-32x32.png', 32, 0.06],
  ['apple-touch-icon-180x180.png', 180, 0.1],
  ['icon-192x192.png', 192, 0.1],
  ['maskable-icon.png', 512, 0.2],
];

for (const [filename, size, paddingRatio] of iconAssets) {
  await writePng(
    createSquareSvg(redPaths, paddingRatio),
    path.join(brandingDirectory, filename),
    size,
  );
}

console.log(`Generated ${logoSvgPath} and ${iconAssets.length + 1} PNG assets.`);
