/* ================================================================
   BEAST MERGE – game.js (نسخة مستقرة ومحسنة)
   جميع حقوق اللعبة ومنطق الذكاء الاصطناعي
   ================================================================ */

/* ----------------------------------------------------------------
   بيانات الحيوانات
   ---------------------------------------------------------------- */
const IMG_V = '2'; // غيّر هذا الرقم عند تغيير الصور

const ANIMALS = [
  null,
  { name: '', img: `image/Camel.png?v=${IMG_V}`,    color: '#4caf50' }, // 1
  { name: '', img: `image/Eagle.png?v=${IMG_V}`,    color: '#00bcd4' }, // 2
  { name: '', img: `image/Panther.png?v=${IMG_V}`,  color: '#2196f3' }, // 3
  { name: '', img: `image/Lion.png?v=${IMG_V}`,     color: '#3f51b5' }, // 4
  { name: '', img: `image/Wolf.png?v=${IMG_V}`,     color: '#9c27b0' }, // 5
  { name: '', img: `image/Seahorse.png?v=${IMG_V}`, color: '#673ab7' }, // 6
  { name: '', img: `image/Horse.png?v=${IMG_V}`,    color: '#ff8f00' }, // 7
  { name: '', img: `image/Bear.png?v=${IMG_V}`,     color: '#f4511e' }, // 8
  { name: '', img: `image/Elephant.png?v=${IMG_V}`, color: '#e53935' }, // 9
  { name: '', img: `image/Bull.png?v=${IMG_V}`,     color: '#c2185b' }, // 10
  { name: '', img: `image/Spirit.png?v=${IMG_V}`,   color: '#ffd700' }, // 11
];

/* ----------------------------------------------------------------
   منطق اللعبة الأساسي (نقي)
   ---------------------------------------------------------------- */

// دمج صف نحو اليسار مع قاعدة n+n → n+1 (بدون حدود خاطئة)
function slideRowLeft(row) {
  // إزالة الأصفار
  let tiles = row.filter(v => v !== 0);
  let merged = [];
  let i = 0;
  while (i < tiles.length) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      // دمج: n + n = n + 1 (إذا كانت النتيجة 11 فإنها ستُزال لاحقاً)
      merged.push(tiles[i] + 1);
      i += 2;
    } else {
      merged.push(tiles[i]);
      i++;
    }
  }
  // إعادة تعبئة الصف حتى 4 عناصر
  while (merged.length < 4) merged.push(0);
  return merged;
}

// تطبيق حركة على اللوحة (المصفوفة مسطحة بطول 16)
// تُرجع { board: المصفوفة الجديدة, changed: هل تغيرت, level11Count: عدد 11 التي أزيلت }
function applyMove(board, direction) {
  let newBoard = board.slice(); // نسخ
  let changed = false;

  if (direction === 'left' || direction === 'right') {
    for (let r = 0; r < 4; r++) {
      const idx = r * 4;
      const row = newBoard.slice(idx, idx + 4);
      let newRow;
      if (direction === 'left') {
        newRow = slideRowLeft(row);
      } else { // right
        newRow = slideRowLeft(row.slice().reverse()).reverse();
      }
      // التحقق من التغيير
      for (let c = 0; c < 4; c++) {
        if (newRow[c] !== newBoard[idx + c]) {
          changed = true;
          newBoard[idx + c] = newRow[c];
        }
      }
    }
  } else { // up / down
    for (let c = 0; c < 4; c++) {
      const col = [
        newBoard[c],
        newBoard[4 + c],
        newBoard[8 + c],
        newBoard[12 + c]
      ];
      let newCol;
      if (direction === 'up') {
        newCol = slideRowLeft(col);
      } else { // down
        newCol = slideRowLeft(col.slice().reverse()).reverse();
      }
      for (let r = 0; r < 4; r++) {
        if (newCol[r] !== newBoard[r * 4 + c]) {
          changed = true;
          newBoard[r * 4 + c] = newCol[r];
        }
      }
    }
  }

  // إزالة المستوى 11 فوراً (وفقاً للقواعد)
  let level11Count = 0;
  for (let i = 0; i < 16; i++) {
    if (newBoard[i] === 11) {
      newBoard[i] = 0;
      level11Count++;
      changed = true;
    }
  }

  return { board: newBoard, changed, level11Count };
}

// التحقق من نهاية اللعبة (لا حركات ممكنة)
function isGameOver(board) {
  return ['left', 'right', 'up', 'down'].every(dir => !applyMove(board, dir).changed);
}

// توليد لوحة عشوائية بمستويات 1-6 (مع ضمان وجود 5 أو 6)
function generateRandomBoard() {
  const board = new Array(16).fill(0);
  const count = 5 + Math.floor(Math.random() * 4); // 5-8 tiles
  const positions = [...Array(16).keys()].sort(() => Math.random() - 0.5).slice(0, count);
  const highCount = 1 + Math.floor(Math.random() * 2); // 1-2 tiles من 5 أو 6
  positions.slice(0, highCount).forEach(p => board[p] = 5 + Math.floor(Math.random() * 2));
  positions.slice(highCount).forEach(p => board[p] = 1 + Math.floor(Math.random() * 6));
  return board;
}

/* ----------------------------------------------------------------
   الذكاء الاصطناعي (مضمن داخل Web Worker)
   ---------------------------------------------------------------- */
const WORKER_SOURCE = `
"use strict";

// إعدادات ثابتة
const CFG = {
  TARGET: 11,
  SPAWN_LEVELS: [1,2,3,4,5],
  ENDGAME_EMPTY: 3,
  MC_MAX_STEPS: 80
};

const DIR_NAMES = ['left','right','up','down'];

// دالة احتمالات spawn تعتمد على أكبر رقم في اللوحة
function getSpawnProbs(maxTile) {
  if (maxTile >= 10) return [0.15, 0.35, 0.30, 0.15, 0.05]; // 1 نادر، 2,3,4 كثير
  if (maxTile >= 8) return [0.20, 0.30, 0.25, 0.15, 0.10];
  if (maxTile >= 6) return [0.25, 0.30, 0.20, 0.15, 0.10];
  if (maxTile >= 4) return [0.35, 0.30, 0.20, 0.10, 0.05];
  return [0.50, 0.25, 0.15, 0.07, 0.03];
}

function randomSpawnLevel(maxTile) {
  const probs = getSpawnProbs(maxTile);
  const r = Math.random();
  let cum = 0;
  for (let i=0; i<CFG.SPAWN_LEVELS.length; i++) {
    cum += probs[i];
    if (r < cum) return CFG.SPAWN_LEVELS[i];
  }
  return 1;
}

// جداول الانزلاق المحسوبة مسبقاً (bitboard)
const ROW_LEFT = new Uint16Array(65536);
const ROW_REV = new Uint16Array(65536);
const ROW_CHGD = new Uint8Array(65536);
const ROW_CRTD = new Uint8Array(65536);
(function buildRowTables() {
  for (let row=0; row<65536; row++) {
    const c0 = row & 0xF, c1 = (row>>4)&0xF, c2 = (row>>8)&0xF, c3 = (row>>12)&0xF;
    ROW_REV[row] = c3 | (c2<<4) | (c1<<8) | (c0<<12);
    const tiles = [];
    if (c0) tiles.push(c0); if (c1) tiles.push(c1); if (c2) tiles.push(c2); if (c3) tiles.push(c3);
    const out = []; let created=false; let i=0;
    while (i<tiles.length) {
      if (i+1 < tiles.length && tiles[i] === tiles[i+1]) {
        const m = tiles[i] + 1;
        if (m >= CFG.TARGET) { out.push(0); created=true; } else out.push(m);
        i += 2;
      } else { out.push(tiles[i]); i++; }
    }
    while (out.length < 4) out.push(0);
    const res = out[0] | (out[1]<<4) | (out[2]<<8) | (out[3]<<12);
    ROW_LEFT[row] = res;
    ROW_CHGD[row] = (res !== row) ? 1 : 0;
    ROW_CRTD[row] = created ? 1 : 0;
  }
})();

// Zobrist hashing
const Z_LO = new Int32Array(192);
const Z_HI = new Int32Array(192);
for (let i=0; i<192; i++) {
  Z_LO[i] = (Math.random() * 0x100000000) | 0;
  Z_HI[i] = (Math.random() * 0x100000000) | 0;
}
function boardHash(board) {
  let lo=0, hi=0;
  for (let i=0; i<16; i++) {
    const k = i*12 + board[i];
    lo ^= Z_LO[k]; hi ^= Z_HI[k];
  }
  return {lo,hi};
}

// جدول التحويل (Transposition Table) بذاكرة 262144 خانة
const TT_SIZE = 1<<18, TT_MASK = TT_SIZE-1;
const TT_HLO = new Int32Array(TT_SIZE);
const TT_HHI = new Int32Array(TT_SIZE);
const TT_SCORE = new Float64Array(TT_SIZE);
const TT_DEPTH = new Int8Array(TT_SIZE);
const TT_USED = new Uint8Array(TT_SIZE);
function ttClear() { TT_USED.fill(0); }
function ttProbe(lo,hi,depth) {
  const idx = (lo>>>0) & TT_MASK;
  return (TT_USED[idx] && TT_HLO[idx]===lo && TT_HHI[idx]===hi && TT_DEPTH[idx]>=depth) ? TT_SCORE[idx] : null;
}
function ttStore(lo,hi,score,depth) {
  const idx = (lo>>>0) & TT_MASK;
  if (!TT_USED[idx] || TT_DEPTH[idx] <= depth) {
    TT_HLO[idx]=lo; TT_HHI[idx]=hi; TT_SCORE[idx]=score; TT_DEPTH[idx]=depth; TT_USED[idx]=1;
  }
}

// أوزان snake (8 اتجاهات)
const SNAKE_W = [65536,32768,16384,8192,4096,2048,1024,512,256,128,64,32,16,8,4,2];
const SNAKE_ORDERS = [
  [0,1,2,3,7,6,5,4,8,9,10,11,15,14,13,12],
  [0,4,8,12,13,9,5,1,2,6,10,14,15,11,7,3],
  [3,2,1,0,4,5,6,7,11,10,9,8,12,13,14,15],
  [3,7,11,15,14,10,6,2,1,5,9,13,12,8,4,0],
  [12,13,14,15,11,10,9,8,4,5,6,7,3,2,1,0],
  [12,8,4,0,1,5,9,13,14,10,6,2,3,7,11,15],
  [15,14,13,12,8,9,10,11,7,6,5,4,0,1,2,3],
  [15,11,7,3,2,6,10,14,13,9,5,1,0,4,8,12]
];
const WEIGHT_MAPS = SNAKE_ORDERS.map(order => {
  const m = new Array(16).fill(0);
  for (let i=0; i<16; i++) m[order[i]] = SNAKE_W[i];
  return m;
});
const POS_IMP = new Array(16).fill(0);
for (let i=0; i<16; i++) for (const wm of WEIGHT_MAPS) if (wm[i] > POS_IMP[i]) POS_IMP[i] = wm[i];

// تطبيق الحركة على مصفوفة Uint8Array (تعديل في المكان)
function applyDir(b, dir) {
  let changed=false, created=false;
  if (dir===0 || dir===1) { // left/right
    for (let r=0; r<4; r++) {
      const o = r*4;
      const p = b[o] | (b[o+1]<<4) | (b[o+2]<<8) | (b[o+3]<<12);
      const rp = dir===0 ? p : ROW_REV[p];
      if (!ROW_CHGD[rp]) continue;
      const res = dir===0 ? ROW_LEFT[rp] : ROW_REV[ROW_LEFT[rp]];
      b[o] = res & 0xF; b[o+1] = (res>>4)&0xF; b[o+2] = (res>>8)&0xF; b[o+3] = (res>>12)&0xF;
      changed = true;
      if (ROW_CRTD[rp]) created = true;
    }
  } else { // up/down
    for (let c=0; c<4; c++) {
      const p = b[c] | (b[c+4]<<4) | (b[c+8]<<8) | (b[c+12]<<12);
      const rp = dir===2 ? p : ROW_REV[p];
      if (!ROW_CHGD[rp]) continue;
      const res = dir===2 ? ROW_LEFT[rp] : ROW_REV[ROW_LEFT[rp]];
      b[c] = res & 0xF; b[c+4] = (res>>4)&0xF; b[c+8] = (res>>8)&0xF; b[c+12] = (res>>12)&0xF;
      changed = true;
      if (ROW_CRTD[rp]) created = true;
    }
  }
  return {changed, created};
}

// التحقق من إمكانية الحركة
function canMove(b, dir) {
  if (dir===0 || dir===1) {
    for (let r=0; r<4; r++) {
      const o = r*4;
      const p = b[o] | (b[o+1]<<4) | (b[o+2]<<8) | (b[o+3]<<12);
      if (ROW_CHGD[dir===0 ? p : ROW_REV[p]]) return true;
    }
  } else {
    for (let c=0; c<4; c++) {
      const p = b[c] | (b[c+4]<<4) | (b[c+8]<<8) | (b[c+12]<<12);
      if (ROW_CHGD[dir===2 ? p : ROW_REV[p]]) return true;
    }
  }
  return false;
}

// دالة التقييم (مشابهة للنسخة السابقة ولكنها مختصرة)
function evaluate(b) {
  let empty=0, maxTile=0, maxIdx=-1;
  const cnt = new Array(12).fill(0);
  for (let i=0; i<16; i++) {
    const v = b[i];
    if (v===0) empty++;
    else { cnt[v]++; if (v>maxTile) { maxTile=v; maxIdx=i; } }
  }
  if (empty===0) return -1e9;

  // أساس البقاء: الخلايا الفارغة
  let score = empty * 20000;

  // snake gradient
  let bestSnake = -Infinity;
  for (let p=0; p<8; p++) {
    const w = WEIGHT_MAPS[p];
    let s=0;
    for (let i=0; i<16; i++) s += b[i] * w[i];
    if (s > bestSnake) bestSnake = s;
  }
  score += bestSnake;

  // مكافأة الزاوية لأكبر رقم
  if (maxIdx===0 || maxIdx===3 || maxIdx===12 || maxIdx===15) score += 300000;
  else if (maxIdx>=0) {
    const mr = maxIdx>>2, mc = maxIdx&3;
    score -= Math.min(mr+mc, mr+(3-mc), (3-mr)+mc, (3-mr)+(3-mc)) * 80000;
  }

  // مكافآت للدمجات القريبة من 11
  for (let r=0; r<4; r++) {
    for (let c=0; c<3; c++) {
      const a = b[r*4+c], bv = b[r*4+c+1];
      if (a>0 && a===bv) {
        if (a===10) score += 4000000;
        else if (a===9) score += 600000;
        else if (a===8) score += 120000;
        else score += a*a*200;
      }
    }
  }
  for (let c=0; c<4; c++) {
    for (let r=0; r<3; r++) {
      const a = b[r*4+c], bv = b[(r+1)*4+c];
      if (a>0 && a===bv) {
        if (a===10) score += 4000000;
        else if (a===9) score += 600000;
        else if (a===8) score += 120000;
        else score += a*a*200;
      }
    }
  }

  return score;
}

// متغير الوقت المتبقي
let deadline = 0;

// Expectimax مع جدول التحويل
function expectimax(b, depth, isMax, hlo, hhi) {
  if (Date.now() >= deadline) return evaluate(b);

  const klo = isMax ? (hlo ^ 0x5A5A5A5A) : hlo;
  const khi = isMax ? (hhi ^ 0xA5A5A5A5) : hhi;
  const cached = ttProbe(klo, khi, depth);
  if (cached !== null) return cached;

  let score;
  if (isMax) {
    score = -Infinity;
    for (let d=0; d<4; d++) {
      const nb = b.slice();
      if (!applyDir(nb, d).changed) continue;
      let nhlo=0, nhhi=0;
      for (let i=0; i<16; i++) {
        const k = i*12 + nb[i]; nhlo ^= Z_LO[k]; nhhi ^= Z_HI[k];
      }
      const s = expectimax(nb, depth, false, nhlo, nhhi);
      if (s > score) score = s;
    }
    if (score === -Infinity) score = -1e6;
  } else {
    const empty = [];
    for (let i=0; i<16; i++) if (b[i]===0) empty.push(i);
    if (empty.length===0 || depth<=0) {
      score = evaluate(b);
    } else {
      let maxTile = 0;
      for (let i=0; i<16; i++) if (b[i] > maxTile) maxTile = b[i];
      const probs = getSpawnProbs(maxTile);
      const sample = empty.length <= 10 ? empty : empty.slice().sort((a,bi)=>POS_IMP[bi]-POS_IMP[a]).slice(0,5);
      const posW = 1 / sample.length;
      score = 0;
      for (const idx of sample) {
        const baseHlo = hlo ^ Z_LO[idx*12];
        const baseHhi = hhi ^ Z_HI[idx*12];
        let ps = 0;
        for (let si=0; si<CFG.SPAWN_LEVELS.length; si++) {
          const lv = CFG.SPAWN_LEVELS[si];
          const wt = probs[si];
          b[idx] = lv;
          const nhlo = baseHlo ^ Z_LO[idx*12 + lv];
          const nhhi = baseHhi ^ Z_HI[idx*12 + lv];
          const s = depth<=1 ? evaluate(b) : expectimax(b, depth-1, true, nhlo, nhhi);
          ps += wt * s;
        }
        b[idx] = 0;
        score += posW * ps;
      }
    }
  }
  ttStore(klo, khi, score, depth);
  return score;
}

// IDS (Iterative Deepening Search)
function runIDS(board, budgetMs) {
  deadline = Date.now() + budgetMs;
  const safe = deadline - 150;
  let bestDir=-1, bestScore=-Infinity, reachedDepth=0;
  const scores = {};
  const ordDirs = [0,1,2,3];

  for (let depth=1; Date.now()<safe; depth++) {
    let iterBest=-1, iterScore=-Infinity, timedOut=false;
    const iterScores = {};
    for (const dir of ordDirs) {
      if (Date.now() >= safe) { timedOut=true; break; }
      const nb = board.slice();
      if (!applyDir(nb, dir).changed) continue;
      let nhlo=0, nhhi=0;
      for (let i=0; i<16; i++) {
        const k = i*12 + nb[i]; nhlo ^= Z_LO[k]; nhhi ^= Z_HI[k];
      }
      const s = expectimax(nb, depth, false, nhlo, nhhi);
      iterScores[dir] = s;
      if (s > iterScore) { iterScore = s; iterBest = dir; }
    }
    if (!timedOut && iterBest !== -1) {
      bestDir = iterBest; bestScore = iterScore; reachedDepth = depth;
      for (const [d,s] of Object.entries(iterScores)) scores[DIR_NAMES[+d]] = s;
      const ix = ordDirs.indexOf(iterBest);
      if (ix>0) { ordDirs.splice(ix,1); ordDirs.unshift(iterBest); }
    } else break;
  }
  return { bestDir, bestScore, scores, reachedDepth };
}

// Monte Carlo rollouts
const MC_BUF = new Uint8Array(16);
const MC_EMPTY = new Uint8Array(16);
function mcRollout(startBoard) {
  MC_BUF.set(startBoard);
  let maxTile = 0;
  for (let i=0; i<16; i++) if (MC_BUF[i] > maxTile) maxTile = MC_BUF[i];
  for (let step=0; step<CFG.MC_MAX_STEPS; step++) {
    let ne=0;
    for (let i=0; i<16; i++) if (MC_BUF[i]===0) MC_EMPTY[ne++] = i;
    if (ne===0) break;
    const sd = (Math.random()*4)|0;
    let moved = false;
    for (let di=0; di<4; di++) {
      const dir = (sd+di) & 3;
      if (canMove(MC_BUF, dir)) {
        applyDir(MC_BUF, dir);
        moved = true; break;
      }
    }
    if (!moved) break;
    maxTile = 0;
    for (let i=0; i<16; i++) if (MC_BUF[i] > maxTile) maxTile = MC_BUF[i];
    ne=0;
    for (let i=0; i<16; i++) if (MC_BUF[i]===0) MC_EMPTY[ne++] = i;
    if (ne===0) break;
    MC_BUF[MC_EMPTY[(Math.random()*ne)|0]] = randomSpawnLevel(maxTile);
  }
  return evaluate(MC_BUF);
}

function runMC(board, validDirs, budgetMs, targetSims) {
  const t0 = Date.now(), n = validDirs.length;
  if (!n) return { wins:{}, rolls:{}, total:0 };
  const postB = validDirs.map(d => {
    const b = board.slice(); return applyDir(b, d).changed ? b : null;
  });
  const rolls = new Array(n).fill(0);
  const wins = new Array(n).fill(0);
  let total = 0;
  while (Date.now()-t0 < budgetMs && total < targetSims) {
    for (let di=0; di<n; di++) {
      if (!postB[di]) continue;
      wins[di] += mcRollout(postB[di]);
      rolls[di]++; total++;
    }
  }
  const winsMap={}, rollsMap={};
  for (let di=0; di<n; di++) {
    const d = DIR_NAMES[validDirs[di]];
    winsMap[d] = rolls[di] ? wins[di]/rolls[di] : 0;
    rollsMap[d] = rolls[di];
  }
  return { wins: winsMap, rolls: rollsMap, total };
}

// نقطة الدخول الرئيسية للـ Worker
self.onmessage = function(e) {
  const boardArr = e.data.board;
  const board = new Uint8Array(boardArr);
  const emptyCount = board.filter(v=>v===0).length;
  const maxTile = board.reduce((m,v)=>v>m?v:m,0);

  // تحقق من الفوز الفوري (إنشاء 11)
  for (let d=0; d<4; d++) {
    const nb = board.slice();
    const {changed, created} = applyDir(nb, d);
    if (changed && created) {
      self.postMessage({ direction: DIR_NAMES[d], confidence: 100 });
      return;
    }
  }

  const isEndgame = emptyCount <= CFG.ENDGAME_EMPTY;
  const egBonus = maxTile>=9 ? 1500 : maxTile>=8 ? 700 : 0;
  const baseTime = emptyCount>10 ? 600 : emptyCount>7 ? 1200 : emptyCount>4 ? 2500 : emptyCount>2 ? 4000 : 6000;
  const totalMs = baseTime + egBonus;
  const idsFrac = isEndgame ? 0.25 : 0.60;
  const idsBudget = Math.floor(totalMs * idsFrac);
  const mcBudget = totalMs - idsBudget;
  const mcTarget = isEndgame ? 180000 : 25000;

  ttClear();
  const ids = runIDS(board, idsBudget);

  const validDirs = [0,1,2,3].filter(d => { const nb=board.slice(); return applyDir(nb, d).changed; });
  const mc = runMC(board, validDirs, mcBudget, mcTarget);

  let bestDir = ids.bestDir !== -1 ? DIR_NAMES[ids.bestDir] : null;
  if (isEndgame && mc.total >= 200 && bestDir) {
    let mcBest = bestDir, mcBestW = mc.wins[bestDir] ?? 0;
    for (const d of DIR_NAMES) {
      const w = mc.wins[d] ?? -1;
      if (w > mcBestW) { mcBestW = w; mcBest = d; }
    }
    if (mcBest !== bestDir && mcBestW > (mc.wins[bestDir]??0)*1.15) bestDir = mcBest;
  }
  if (!bestDir) {
    for (let d=0; d<4; d++) {
      const nb = board.slice();
      if (applyDir(nb, d).changed) { bestDir = DIR_NAMES[d]; break; }
    }
  }

  let confidence = 50;
  const vals = Object.values(ids.scores).filter(v=>isFinite(v));
  if (vals.length > 1) {
    const mx = Math.max(...vals), mn = Math.min(...vals);
    const bs = ids.scores[bestDir] ?? mn;
    if (mx > mn) confidence = Math.round(((bs - mn) / (mx - mn)) * 75 + 25);
  } else if (vals.length === 1) confidence = 90;

  self.postMessage({ direction: bestDir, confidence });
};
`;

/* ----------------------------------------------------------------
   حالة اللعبة و DOM
   ---------------------------------------------------------------- */
const state = {
  board: new Array(16).fill(0),
  mode: 'idle', // 'idle' | 'spawn' | 'edit'
  isEditMode: false,
  spawnTile: -1,
  editTile: -1,
  worker: null,
  aiResult: null,
  aiRunning: false
};

// دوال الترجمة (مختصرة)
const _T_AR = {
  ready: 'جاهز – اضغط تحليل أو قم بحركة',
  aiThinking: 'استشارة العراف…',
  aiError: 'خطأ في العراف',
  waitSpawn: 'في انتظار وضع الوحش…',
  modeSpawn: '⚡ وضع الإنبات – انقر على خلية فارغة لوضع وحش',
  boardLocked: '⚔ اللوحة مغلقة – لا توجد حركات متبقية!',
  boardLocked2: '⚔ اللوحة مغلقة – لا توجد حركات!',
  clearConfirm: 'هل تريد مسح اللوحة؟',
  boardCleared: 'تم مسح اللوحة',
  modeEdit: '✎ وضع التعديل – انقر على أي بلاطة',
  survival: 'البقاء: {c}٪',
  bestMove: 'أفضل حركة: {a}  (ثقة {c}٪)',
  noMove: 'لا توجد حركة صالحة',
};
function t(key) { return _T_AR[key] ?? key; }

// تهيئة الـ Worker
function initWorker() {
  try {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    state.worker = new Worker(url);
    state.worker.onmessage = handleWorkerMessage;
    state.worker.onerror = (e) => {
      console.error('Worker error:', e);
      state.aiRunning = false;
      setAIStatus(t('aiError'));
    };
  } catch (err) {
    console.warn('Web Worker unavailable:', err);
  }
}

function requestSolve() {
  if (!state.worker || state.aiRunning) return;
  state.aiRunning = true;
  setAIStatus(t('aiThinking'));
  setAIArrow('⟳', false);
  state.worker.postMessage({ board: state.board.slice() });
}

function handleWorkerMessage(e) {
  state.aiRunning = false;
  state.aiResult = e.data;
  renderAIPanel(e.data);
}

// تطبيق حركة المستخدم
function handleMove(direction) {
  if (state.mode !== 'idle') return;
  const { board, changed, level11Count } = applyMove(state.board, direction);
  if (!changed) return;
  state.board = board;
  if (level11Count > 0) showMergeBanner();
  const empties = state.board.map((v,i)=>v===0?i:-1).filter(i=>i>=0);
  if (empties.length > 0) {
    state.mode = 'spawn';
    state.aiResult = null;
    setAIArrow('…', false);
    setAIStatus(t('waitSpawn'));
    setModeBar(t('modeSpawn'));
  } else {
    if (isGameOver(state.board)) setTimeout(() => alert(t('boardLocked')), 80);
    else requestSolve();
  }
  renderBoard();
}

// النقر على بلاطة
function handleTileClick(index) {
  if (state.mode === 'spawn') {
    if (state.board[index] !== 0) return;
    state.spawnTile = index;
    openModal('spawn');
  } else if (state.isEditMode) {
    state.editTile = index;
    openModal('edit');
  }
}

// تأكيد spawn
function confirmSpawn(level) {
  closeModal('spawn');
  if (state.spawnTile < 0) return;
  state.board[state.spawnTile] = level;
  state.spawnTile = -1;
  state.mode = 'idle';
  setModeBar('');
  renderBoard();
  if (isGameOver(state.board)) setTimeout(() => alert(t('boardLocked2')), 80);
  else requestSolve();
}
function cancelSpawn() { closeModal('spawn'); }

// تأكيد تعديل
function confirmEdit(level) {
  closeModal('edit');
  if (state.editTile < 0) return;
  if (level === 11) {
    showMergeBanner();
    state.board[state.editTile] = 0;
  } else {
    state.board[state.editTile] = level;
  }
  state.editTile = -1;
  renderBoard();
  requestSolve();
}
function cancelEdit() { closeModal('edit'); }

// مسح اللوحة
function clearBoard() {
  if (!confirm(t('clearConfirm'))) return;
  state.board.fill(0);
  state.mode = 'idle';
  state.aiResult = null;
  setModeBar('');
  renderBoard();
  setAIArrow('?', false);
  setAIStatus(t('boardCleared'));
}
function randomBoard() {
  state.board = generateRandomBoard();
  state.mode = 'idle';
  setModeBar('');
  renderBoard();
  requestSolve();
}
function toggleEditMode() {
  state.isEditMode = !state.isEditMode;
  document.getElementById('btn-edit-mode')?.classList.toggle('active', state.isEditMode);
  if (state.isEditMode) {
    state.mode = 'idle';
    setModeBar(t('modeEdit'));
  } else {
    setModeBar('');
  }
  renderBoard();
}

// عرض اللوحة
function renderBoard() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  for (let i=0; i<16; i++) {
    const tile = boardEl.children[i];
    const val = state.board[i];
    tile.dataset.level = val;
    tile.classList.remove('spawn-target','edit-highlight');
    const img = tile.querySelector('.tile-img');
    if (val > 0 && val <= 11) {
      const animal = ANIMALS[val];
      img.src = animal.img;
      img.alt = animal.name;
      img.style.display = '';
      tile.querySelector('.tile-num').textContent = val;
    } else {
      img.src = '';
      img.alt = '';
      img.style.display = 'none';
      tile.querySelector('.tile-num').textContent = '';
    }
    if (state.mode === 'spawn' && val === 0) tile.classList.add('spawn-target');
    if (state.isEditMode) tile.classList.add('edit-highlight');
  }
  highlightSuggestedBtn();
}

function highlightSuggestedBtn() {
  document.querySelectorAll('.dir-btn').forEach(b=>b.classList.remove('suggested'));
  if (state.aiResult && state.aiResult.direction) {
    const btn = document.querySelector(`.dir-btn[data-dir="${state.aiResult.direction}"]`);
    if (btn) btn.classList.add('suggested');
  }
}

function renderAIPanel(result) {
  const arrows = { left:'⬅', right:'➡', up:'⬆', down:'⬇' };
  const arrow = result.direction ? arrows[result.direction] : '✕';
  setAIArrow(arrow, !!result.direction);
  const conf = result.confidence || 0;
  const fill = document.getElementById('confidence-fill');
  if (fill) fill.style.width = conf + '%';
  const label = document.getElementById('confidence-label');
  if (label) label.textContent = t('survival').replace('{c}', conf);
  setAIStatus(result.direction
    ? t('bestMove').replace('{a}', arrow).replace('{c}', conf)
    : t('noMove'));
}

function setAIArrow(text, hasResult) {
  const el = document.getElementById('ai-direction');
  if (el) { el.textContent = text; el.classList.toggle('has-result', hasResult); }
}
function setAIStatus(text) {
  const el = document.getElementById('ai-status');
  if (el) el.textContent = text;
}
function setModeBar(text) {
  const el = document.getElementById('mode-bar');
  if (el) el.textContent = text;
}

// النوافذ المنبثقة
function openModal(type) {
  document.getElementById(type==='spawn'?'spawn-overlay':'edit-overlay')?.classList.remove('hidden');
}
function closeModal(type) {
  document.getElementById(type==='spawn'?'spawn-overlay':'edit-overlay')?.classList.add('hidden');
}
function buildPicker(containerId, levels) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  levels.forEach(lv => {
    const btn = document.createElement('button');
    btn.className = 'level-btn';
    btn.dataset.level = lv;
    if (lv === 0) {
      btn.textContent = '✕';
      btn.title = 'Empty';
    } else {
      const animal = ANIMALS[lv];
      btn.innerHTML = `<img src="${animal.img}" alt="" class="picker-img"><span class="lbnum">${lv}</span>`;
      btn.style.background = `radial-gradient(circle at 38% 38%, ${lighten(animal.color)}, ${animal.color})`;
    }
    el.appendChild(btn);
  });
}
function lighten(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const mix = (c,t=220)=> Math.round(c + (t-c)*0.45);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function showMergeBanner() {
  const banner = document.getElementById('merge-banner');
  if (!banner) return;
  banner.classList.add('hidden');
  void banner.offsetWidth;
  banner.classList.remove('hidden');
  clearTimeout(showMergeBanner._timer);
  showMergeBanner._timer = setTimeout(()=>banner.classList.add('hidden'), 1900);
}

// دعم لوحة المفاتيح
const KEY_MAP = {
  ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down',
  a:'left', d:'right', w:'up', s:'down',
  A:'left', D:'right', W:'up', S:'down',
};

// تهيئة DOM اللوحة
function initBoardDOM() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  boardEl.innerHTML = '';
  for (let i=0; i<16; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.level = '0';
    tile.innerHTML = `<img class="tile-img" src="" alt="" draggable="false"><span class="tile-num"></span>`;
    tile.addEventListener('click', ()=>handleTileClick(i));
    boardEl.appendChild(tile);
  }
}

// بدء التشغيل
function init() {
  initBoardDOM();
  buildPicker('spawn-picker', [1,2,3,4,5]);
  buildPicker('edit-picker', [0,1,2,3,4,5,6,7,8,9,10,11]);

  document.getElementById('spawn-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.level-btn');
    if (btn) confirmSpawn(parseInt(btn.dataset.level));
  });
  document.getElementById('edit-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.level-btn');
    if (btn) confirmEdit(parseInt(btn.dataset.level));
  });
  document.getElementById('spawn-cancel')?.addEventListener('click', cancelSpawn);
  document.getElementById('edit-cancel')?.addEventListener('click', cancelEdit);

  document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.addEventListener('click', () => handleMove(btn.dataset.dir));
  });

  document.getElementById('btn-edit-mode')?.addEventListener('click', toggleEditMode);
  document.getElementById('btn-clear')?.addEventListener('click', clearBoard);
  document.getElementById('btn-random')?.addEventListener('click', randomBoard);
  document.getElementById('btn-analyze')?.addEventListener('click', requestSolve);

  document.addEventListener('keydown', e => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault();
    const dir = KEY_MAP[e.key];
    if (dir) handleMove(dir);
  });

  initWorker();
  renderBoard();
  setAIStatus(t('ready'));
}

document.addEventListener('DOMContentLoaded', init);
