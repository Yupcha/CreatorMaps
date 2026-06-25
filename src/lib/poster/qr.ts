/**
 * Minimal, dependency-free QR Code generator (byte mode, ECC level M).
 *
 * Implements enough of ISO/IEC 18004 to encode short URLs (our `?scene=` share
 * links) into a scannable matrix. Kept self-contained and presentation-free so
 * `composePoster`/`buildPosterSvg` only consume the resulting matrix.
 *
 * Public API:
 *   - {@link makeQrMatrix}  → boolean[][] (true = dark module)
 *   - {@link makeQrCanvas}  → HTMLCanvasElement at the requested pixel size
 *   - {@link makeQrSvgPaths}→ SVG path `d` string (1 unit per module)
 *
 * Supports QR versions 1–10 (up to ~271 byte-mode chars at ECC-M), which covers
 * our base64url scene links comfortably.
 */

// ─── Galois field GF(256) tables for Reed–Solomon ──────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < gen.length; i++) {
      res[i] ^= gfMul(gen[i], factor);
    }
  }
  return res;
}

// ─── Capacity / EC tables (ECC level M only) ────────────────────────────────
// [version]: { total codewords, ec codewords per block, [numBlocksG1, dataG1, numBlocksG2, dataG2] }
interface VersionInfo {
  totalCodewords: number;
  ecPerBlock: number;
  groups: [number, number, number, number];
}
const VERSIONS_M: Record<number, VersionInfo> = {
  1: { totalCodewords: 26, ecPerBlock: 10, groups: [1, 16, 0, 0] },
  2: { totalCodewords: 44, ecPerBlock: 16, groups: [1, 28, 0, 0] },
  3: { totalCodewords: 70, ecPerBlock: 26, groups: [1, 44, 0, 0] },
  4: { totalCodewords: 100, ecPerBlock: 18, groups: [2, 32, 0, 0] },
  5: { totalCodewords: 134, ecPerBlock: 24, groups: [2, 43, 0, 0] },
  6: { totalCodewords: 172, ecPerBlock: 16, groups: [4, 27, 0, 0] },
  7: { totalCodewords: 196, ecPerBlock: 18, groups: [4, 31, 0, 0] },
  8: { totalCodewords: 242, ecPerBlock: 22, groups: [2, 38, 2, 39] },
  9: { totalCodewords: 292, ecPerBlock: 22, groups: [3, 36, 2, 37] },
  10: { totalCodewords: 346, ecPerBlock: 26, groups: [4, 43, 1, 44] }
};

function dataCapacityBytes(v: number): number {
  const info = VERSIONS_M[v];
  const dataCw = info.groups[0] * info.groups[1] + info.groups[2] * info.groups[3];
  // byte-mode overhead: 4 bits mode + char-count (8 bits v1-9, 16 bits v10+) + terminator
  const ccBits = v >= 10 ? 16 : 8;
  return Math.floor((dataCw * 8 - 4 - ccBits) / 8);
}

function pickVersion(len: number): number {
  for (let v = 1; v <= 10; v++) {
    if (dataCapacityBytes(v) >= len) return v;
  }
  return 10; // best effort; URL may be truncated by caller upstream
}

// ─── Bit buffer ─────────────────────────────────────────────────────────────
class BitBuffer {
  bits: number[] = [];
  put(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1);
  }
  get length() {
    return this.bits.length;
  }
}

// ─── Alignment pattern centers per version ──────────────────────────────────
const ALIGN_POS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50]
};

const FORMAT_INFO_M: Record<number, number> = {
  // mask 0..7 → 15-bit format info for ECC-M (0b00 << ... already baked)
  0: 0x5412,
  1: 0x5125,
  2: 0x5e7c,
  3: 0x5b4b,
  4: 0x45f9,
  5: 0x40ce,
  6: 0x4f97,
  7: 0x4aa0
};

/** Build the QR boolean matrix for the given text. true = dark. */
export function makeQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const info = VERSIONS_M[version];
  const size = version * 4 + 17;

  // 1. Encode data bits.
  const bb = new BitBuffer();
  bb.put(0b0100, 4); // byte mode
  bb.put(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) bb.put(b, 8);

  const dataCw = info.groups[0] * info.groups[1] + info.groups[2] * info.groups[3];
  const capacityBits = dataCw * 8;
  // terminator
  const term = Math.min(4, capacityBits - bb.length);
  bb.put(0, term);
  // pad to byte boundary
  while (bb.length % 8 !== 0) bb.bits.push(0);
  // pad bytes
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (bb.length < capacityBits) {
    bb.put(padBytes[pi % 2], 8);
    pi++;
  }

  // 2. Split into data codewords.
  const allData: number[] = [];
  for (let i = 0; i < bb.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bb.bits[i + j];
    allData.push(byte);
  }

  // 3. Build blocks + RS error correction.
  const blocks: { data: number[]; ec: number[] }[] = [];
  let offset = 0;
  const layout: [number, number][] = [
    [info.groups[0], info.groups[1]],
    [info.groups[2], info.groups[3]]
  ];
  for (const [count, dlen] of layout) {
    for (let b = 0; b < count; b++) {
      const data = allData.slice(offset, offset + dlen);
      offset += dlen;
      blocks.push({ data, ec: rsEncode(data, info.ecPerBlock) });
    }
  }

  // 4. Interleave codewords.
  const finalBytes: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) {
    for (const blk of blocks) if (i < blk.data.length) finalBytes.push(blk.data[i]);
  }
  for (let i = 0; i < info.ecPerBlock; i++) {
    for (const blk of blocks) finalBytes.push(blk.ec[i]);
  }

  // 5. Build module matrix with function patterns.
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  const setF = (r: number, c: number, val: boolean) => {
    matrix[r][c] = val;
    reserved[r][c] = true;
  };

  // Finder patterns + separators.
  const placeFinder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inRing =
          dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
            ? dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)
            : false;
        setF(rr, cc, inRing);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setF(6, i, i % 2 === 0);
    if (!reserved[i][6]) setF(i, 6, i % 2 === 0);
  }

  // Alignment patterns.
  const aligns = ALIGN_POS[version];
  for (const ar of aligns) {
    for (const ac of aligns) {
      if (reserved[ar][ac]) continue; // overlaps finder
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          setF(ar + dr, ac + dc, ring !== 1);
        }
      }
    }
  }

  // Dark module.
  setF(size - 8, 8, true);

  // Reserve format info areas.
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) reserved[8][i] = true;
    if (!reserved[i][8]) reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  // 6. Place data bits in zig-zag.
  let bitIdx = 0;
  const totalBits = finalBytes.length * 8;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip timing column
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (reserved[row][cc]) continue;
        let dark = false;
        if (bitIdx < totalBits) {
          const byte = finalBytes[bitIdx >> 3];
          dark = ((byte >> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
        matrix[row][cc] = dark;
      }
    }
    upward = !upward;
  }

  // 7. Apply mask 0 (checkerboard) — simplest that always validates for scanners.
  const mask = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      if ((r + c) % 2 === 0) matrix[r][c] = !matrix[r][c];
    }
  }

  // 8. Format information (ECC-M, mask 0).
  const fmt = FORMAT_INFO_M[mask];
  const fmtBits: number[] = [];
  for (let i = 14; i >= 0; i--) fmtBits.push((fmt >> i) & 1);
  // around top-left finder
  const fmtCoords1: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  fmtCoords1.forEach(([r, c], i) => {
    matrix[r][c] = fmtBits[i] === 1;
  });
  // around top-right + bottom-left finders
  const fmtCoords2: [number, number][] = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]
  ];
  fmtCoords2.forEach(([r, c], i) => {
    matrix[r][c] = fmtBits[i] === 1;
  });

  return matrix.map((row) => row.map((v) => v === true));
}

/** Render a QR matrix to an HTMLCanvasElement at ~sizePx (with quiet zone). */
export function makeQrCanvas(text: string, sizePx: number): HTMLCanvasElement {
  const matrix = makeQrMatrix(text);
  const modules = matrix.length;
  const quiet = 4;
  const total = modules + quiet * 2;
  const scale = Math.max(1, Math.floor(sizePx / total));
  const dim = total * scale;

  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (matrix[r][c]) {
        ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
  }
  return canvas;
}

/**
 * Build an SVG path `d` for dark modules, 1 user-unit per module, offset by a
 * 4-module quiet zone. Returns the path data plus the viewbox dimension.
 */
export function makeQrSvgPaths(text: string): { d: string; size: number } {
  const matrix = makeQrMatrix(text);
  const modules = matrix.length;
  const quiet = 4;
  const size = modules + quiet * 2;
  let d = '';
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (matrix[r][c]) {
        d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
      }
    }
  }
  return { d, size };
}
