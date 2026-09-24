import fs from 'fs';
import zlib from 'zlib';

function readPNG(filePath: string) {
  const buf = fs.readFileSync(filePath);
  let offset = 8;
  let width = 0, height = 0, colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const pixels = new Uint8Array(width * height * 4);

  let inPos = 0;
  const prevRow = new Uint8Array(stride);
  const currRow = new Uint8Array(stride);

  function paeth(a: number, b: number, c: number) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  for (let y = 0; y < height; y++) {
    const filter = raw[inPos++];
    for (let i = 0; i < stride; i++) {
      const x = raw[inPos++];
      const a = i >= bpp ? currRow[i - bpp] : 0;
      const b = prevRow[i];
      const c = i >= bpp ? prevRow[i - bpp] : 0;
      if (filter === 0) currRow[i] = x;
      else if (filter === 1) currRow[i] = (x + a) & 0xff;
      else if (filter === 2) currRow[i] = (x + b) & 0xff;
      else if (filter === 3) currRow[i] = (x + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) currRow[i] = (x + paeth(a, b, c)) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4;
      pixels[dst] = currRow[x * bpp];
      pixels[dst + 1] = currRow[x * bpp + 1];
      pixels[dst + 2] = currRow[x * bpp + 2];
      pixels[dst + 3] = bpp === 4 ? currRow[x * bpp + 3] : 255;
    }
    prevRow.set(currRow);
  }

  return { width, height, pixels };
}

const png = readPNG('public/Rothirsch.png');

// Downsample deer region [95..622, 10..615] -> 180 x 206 grid
const X0 = 95, Y0 = 10, W0 = 528, H0 = 605;
const GW = 180, GH = 206;
const grid = new Uint8Array(GW * GH);

for (let gy = 0; gy < GH; gy++) {
  for (let gx = 0; gx < GW; gx++) {
    const px = Math.floor(X0 + (gx / GW) * W0);
    const py = Math.floor(Y0 + (gy / GH) * H0);
    const idx = (py * png.width + px) * 4;
    const r = png.pixels[idx], g = png.pixels[idx + 1], a = png.pixels[idx + 3];
    if (a > 110 && r > 100 && g < 80) {
      grid[gy * GW + gx] = 1;
    }
  }
}

// Trace directed boundary edges of all 1-cells and stitch them into closed polygons
interface Edge { x1: number; y1: number; x2: number; y2: number; used?: boolean }
const edges: Edge[] = [];
const startMap = new Map<string, Edge[]>();

function addEdge(x1: number, y1: number, x2: number, y2: number) {
  const e: Edge = { x1, y1, x2, y2 };
  edges.push(e);
  const k = `${x1},${y1}`;
  if (!startMap.has(k)) startMap.set(k, []);
  startMap.get(k)!.push(e);
}

const getCell = (x: number, y: number) => (x >= 0 && x < GW && y >= 0 && y < GH) ? grid[y * GW + x] : 0;

for (let y = 0; y < GH; y++) {
  for (let x = 0; x < GW; x++) {
    if (getCell(x, y) === 1) {
      if (getCell(x, y - 1) === 0) addEdge(x, y, x + 1, y);       // top
      if (getCell(x + 1, y) === 0) addEdge(x + 1, y, x + 1, y + 1); // right
      if (getCell(x, y + 1) === 0) addEdge(x + 1, y + 1, x, y + 1); // bottom
      if (getCell(x - 1, y) === 0) addEdge(x, y + 1, x, y);       // left
    }
  }
}

const loops: [number, number][][] = [];
for (const e of edges) {
  if (e.used) continue;
  const loop: [number, number][] = [];
  let curr: Edge | undefined = e;
  while (curr && !curr.used) {
    curr.used = true;
    loop.push([curr.x1, curr.y1]);
    const nextKey = `${curr.x2},${curr.y2}`;
    const candidates = startMap.get(nextKey);
    curr = candidates?.find(c => !c.used);
  }
  if (loop.length >= 8) loops.push(loop);
}

// Simplify polygon with Ramer-Douglas-Peucker
function simplify(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length <= 3) return pts;
  let maxDist = 0, idx = 0;
  const [x1, y1] = pts[0];
  const [x2, y2] = pts[pts.length - 1];
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    let d = 0;
    if (lenSq === 0) {
      d = Math.hypot(px - x1, py - y1);
    } else {
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
      d = Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }
    if (d > maxDist) { maxDist = d; idx = i; }
  }

  if (maxDist > eps) {
    const left = simplify(pts.slice(0, idx + 1), eps);
    const right = simplify(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}

// Convert loops to SVG path in 0..90 x 0..103 coordinate space
const scale = 90 / GW;
let svgPath = '';
for (const loop of loops) {
  const closed = [...loop, loop[0]];
  const simp = simplify(closed, 0.85);
  if (simp.length < 4) continue;
  svgPath += simp.map((pt, i) => `${i === 0 ? 'M' : 'L'}${(pt[0] * scale).toFixed(1)} ${(pt[1] * scale).toFixed(1)}`).join(' ') + ' Z ';
}

console.log('Loops count:', loops.length, 'Path length:', svgPath.length);
fs.writeFileSync('scripts/deer-path.txt', svgPath.trim());
