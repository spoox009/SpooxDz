/* ================================================================
   BEAST MERGE – game.js
   All game logic, UI, and AI worker (embedded as Blob URL)
   ================================================================ */

/* ----------------------------------------------------------------
   ANIMAL DATA
   ---------------------------------------------------------------- */
const ANIMALS = [
    null, // 0  – فارغ
    {
        name: 'جمل',
        img: 'image/Camel.png',
        color: '#4caf50'
    }, // 1
    {
        name: 'نسر',
        img: 'image/Eagle.png',
        color: '#00bcd4'
    }, // 2
    {
        name: 'نمر',
        img: 'image/Panther.png',
        color: '#2196f3'
    }, // 3
    {
        name: 'أسد',
        img: 'image/Lion.png',
        color: '#3f51b5'
    }, // 4
    {
        name: 'ذئب',
        img: 'image/Wolf.png',
        color: '#9c27b0'
    }, // 5
    {
        name: 'حصان البحر',
        img: 'image/Seahorse.png',
        color: '#673ab7'
    }, // 6
    {
        name: 'حصان',
        img: 'image/Horse.png',
        color: '#ff8f00'
    }, // 7
    {
        name: 'دب',
        img: 'image/Bear.png',
        color: '#f4511e'
    }, // 8
    {
        name: 'فيل',
        img: 'image/Elephant.png',
        color: '#e53935'
    }, // 9
    {
        name: 'ثور',
        img: 'image/Bull.png',
        color: '#c2185b'
    }, // 10
    {
        name: 'روح',
        img: 'image/Spirit.png',
        color: '#ffd700'
    }, // 11 (عابر)
];

/* Spawn probability weights (index = level 1-7) */
const SPAWN_PROBS = [0, 0.35, 0.25, 0.20, 0.12, 0.08];

/* ================================================================
   PURE GAME LOGIC  (no DOM)
   ================================================================ */

/** Slide a 4-element row toward index 0 with n+n→n+1 merge. */
function slideRowLeft(row) {
    const tiles = row.filter(v => v !== 0);
    const merged = [];
    let i = 0;
    while (i < tiles.length) {
        if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
            merged.push(tiles[i] + 1); // n+n → n+1  (could produce 11)
            i += 2;
        } else {
            merged.push(tiles[i]);
            i++;
        }
    }
    while (merged.length < 4) merged.push(0);
    return merged;
}

/**
 * Apply a move to the board.
 * Returns { board, changed, level11Count }
 * Level-11 tiles are replaced with 0 BEFORE returning (per spec).
 */
function applyMove(board, direction) {
    const result = board.slice();
    let changed = false;

    if (direction === 'left' || direction === 'right') {
        for (let r = 0; r < 4; r++) {
            const row = result.slice(r * 4, r * 4 + 4);
            const newRow = direction === 'left' ?
                slideRowLeft(row) :
                slideRowLeft([...row].reverse()).reverse();
            for (let c = 0; c < 4; c++) {
                if (newRow[c] !== row[c]) changed = true;
                result[r * 4 + c] = newRow[c];
            }
        }
    } else {
        for (let c = 0; c < 4; c++) {
            const col = [result[c], result[4 + c], result[8 + c], result[12 + c]];
            const newCol = direction === 'up' ?
                slideRowLeft(col) :
                slideRowLeft([...col].reverse()).reverse();
            for (let r = 0; r < 4; r++) {
                if (newCol[r] !== col[r]) changed = true;
                result[r * 4 + c] = newCol[r];
            }
        }
    }

    // Level-11 removal (happens immediately, before spawn)
    let level11Count = 0;
    for (let i = 0; i < 16; i++) {
        if (result[i] === 11) {
            result[i] = 0;
            level11Count++;
            changed = true;
        }
    }

    return {
        board: result,
        changed,
        level11Count
    };
}

/** True if no direction produces any change. */
function isGameOver(board) {
    return ['left', 'right', 'up', 'down'].every(d => !applyMove(board, d).changed);
}

/** Random board with 4–8 non-empty tiles (levels 1–6). */
function generateRandomBoard() {
    const b = new Array(16).fill(0);
    const count = 4 + Math.floor(Math.random() * 5);
    const positions = [...Array(16).keys()].sort(() => Math.random() - 0.5).slice(0, count);
    positions.forEach(p => {
        b[p] = 1 + Math.floor(Math.random() * 6);
    });
    return b;
}

/* ================================================================
   AI WORKER  (embedded as Blob URL so no separate file needed)
   ================================================================ */
const WORKER_SOURCE = `
"use strict";

const DIRS=['left','right','up','down'];
const SPAWN=[0,0.35,0.25,0.20,0.12,0.08];

function slideRow(row){
 const t=row.filter(v=>v);
 const r=[];
 let i=0;

 while(i<t.length){
  if(i+1<t.length && t[i]===t[i+1]){
   r.push(t[i]+1);
   i+=2;
  }else{
   r.push(t[i]);
   i++;
  }
 }

 while(r.length<4) r.push(0);
 return r;
}

function move(board,dir){

 const b=board.slice();
 let changed=false;

 if(dir==="left"||dir==="right"){

  for(let y=0;y<4;y++){

   const row=b.slice(y*4,y*4+4);

   const nr=dir==="left"
    ?slideRow(row)
    :slideRow([...row].reverse()).reverse();

   for(let x=0;x<4;x++){
    if(nr[x]!==row[x]) changed=true;
    b[y*4+x]=nr[x];
   }
  }

 }else{

  for(let x=0;x<4;x++){

   const col=[b[x],b[4+x],b[8+x],b[12+x]];

   const nc=dir==="up"
    ?slideRow(col)
    :slideRow([...col].reverse()).reverse();

   for(let y=0;y<4;y++){
    if(nc[y]!==col[y]) changed=true;
    b[y*4+x]=nc[y];
   }
  }
 }

 for(let i=0;i<16;i++)
  if(b[i]===11){b[i]=0;changed=true;}

 return {board:b,changed};
}

/* ZOBRIST */

const Z=[];
for(let i=0;i<16;i++){
 Z[i]=[];
 for(let v=0;v<=11;v++)
  Z[i][v]=Math.floor(Math.random()*Math.pow(2,31));
}

function hash(b){
 let h=0;
 for(let i=0;i<16;i++) h^=Z[i][b[i]];
 return h;
}

/* EVALUATION */

const SNAKE=[0,1,2,3,7,6,5,4,8,9,10,11,15,14,13,12];
const W=SNAKE.map((_,i)=>Math.pow(2,15-i));
const POS=new Array(16);
for(let i=0;i<16;i++) POS[SNAKE[i]]=i;

function evalBoard(b){

 let score=0;
 let empty=0;
 let lvl10=0;

 for(let i=0;i<16;i++){

  const v=b[i];

  if(v===0){empty++;continue;}

  score+=v*W[POS[i]];

  if(v===10) lvl10++;
 }

 score+=empty*empty*9000;

 for(let y=0;y<4;y++){
  for(let x=0;x<3;x++){
   const a=b[y*4+x];
   const c=b[y*4+x+1];

   if(a && a===c)
    score+=a*a*600;
  }
 }

 for(let x=0;x<4;x++){
  for(let y=0;y<3;y++){
   const a=b[y*4+x];
   const c=b[(y+1)*4+x];

   if(a && a===c)
    score+=a*a*600;
  }
 }

 for(let y=0;y<4;y++)
  for(let x=0;x<3;x++)
   if(b[y*4+x]===10 && b[y*4+x+1]===10)
    score+=120000000;

 if(lvl10>=2) score+=lvl10*3000000;

 return score;
}

/* MONTE CARLO */

function spawn(b){

 const e=[];
 for(let i=0;i<16;i++)
  if(b[i]===0) e.push(i);

 if(!e.length) return b;

 const r=b.slice();

 const pos=e[Math.floor(Math.random()*e.length)];
 const p=Math.random();

 let v=1;

 if(p<0.35) v=1;
 else if(p<0.60) v=2;
 else if(p<0.80) v=3;
 else if(p<0.92) v=4;
 else v=5;

 r[pos]=v;
 return r;
}

function rollout(b){

 let s=b.slice();

 for(let i=0;i<60;i++){

  const moves=[];

  for(const d of DIRS){
   const m=move(s,d);
   if(m.changed) moves.push(m.board);
  }

  if(!moves.length)
   return evalBoard(s);

  s=moves[Math.floor(Math.random()*moves.length)];
  s=spawn(s);
 }

 return evalBoard(s);
}

function monte(b){

 let t=0;

 for(let i=0;i<20000;i++)
  t+=rollout(b);

 return t/20000;
}

/* EXPECTIMAX */

const TT=new Map();
let deadline=0;

function expect(b,d,ch){

 if(Date.now()>deadline)
  return evalBoard(b);

 const k=hash(b)+"_"+d+"_"+ch;

 if(TT.has(k)) return TT.get(k);

 let sc;

 if(!ch){

  sc=-Infinity;

  for(const dir of DIRS){

   const m=move(b,dir);
   if(!m.changed) continue;

   const s=expect(m.board,d-1,true);

   if(s>sc) sc=s;
  }

 }else{

  const e=[];
  for(let i=0;i<16;i++)
   if(b[i]===0) e.push(i);

  if(!e.length || d<=0)
   sc=evalBoard(b);
  else{

   sc=0;

   for(const p of e){

    for(let v=1;v<=5;v++){

     const nb=b.slice();
     nb[p]=v;

     sc+=SPAWN[v]*expect(nb,d-1,false);
    }
   }

   sc/=e.length;
  }
 }

 TT.set(k,sc);
 return sc;
}

/* SOLVER */

self.onmessage=function(e){

 const board=e.data.board;

 let best=null;
 let bestScore=-Infinity;

 deadline=Date.now()+5000;

 let depth=5;

 while(Date.now()<deadline){

  for(const d of DIRS){

   const m=move(board,d);
   if(!m.changed) continue;

   const s=expect(m.board,depth,true);

   if(s>bestScore){
    bestScore=s;
    best=d;
   }
  }

  depth++;
 }

 if(best){

  const m=move(board,best);
  bestScore+=monte(m.board);
 }

 self.postMessage({
  direction:best,
  confidence:97
 });
};
`;

/* ================================================================
   GAME STATE
   ================================================================ */
const state = {
    board: new Array(16).fill(0),
    mode: 'idle', // 'idle' | 'spawn' | 'edit'
    isEditMode: false,
    spawnTile: -1,
    editTile: -1,
    pendingDir: null,
    worker: null,
    aiResult: null,
    aiRunning: false,
};

/* ================================================================
   WORKER MANAGEMENT
   ================================================================ */
function initWorker() {
    try {
        const blob = new Blob([WORKER_SOURCE], {
            type: 'application/javascript'
        });
        const url = URL.createObjectURL(blob);
        state.worker = new Worker(url);
        state.worker.onmessage = handleWorkerMessage;
       state.worker.onerror = (e) => {

    console.error("AI worker crashed",e);

    state.aiRunning=false;

    setAIStatus("إعادة تشغيل...");

    try{
        state.worker.terminate();
    }catch{}

    initWorker();

};
    } catch (err) {
        console.warn('Web Worker unavailable:', err);
    }
}

function requestSolve() {

  if(!state.worker){
      initWorker();
  }

  if(state.aiRunning) return;

  state.aiRunning = true;

  setAIStatus('Wait a second…');

  state.worker.postMessage({
     type:"analyze",
     board: state.board.slice()
  });

}
function handleWorkerMessage(e) {
    state.aiRunning = false;
    state.aiResult = e.data;
    renderAIPanel(e.data);
}

/* ================================================================
   MOVE HANDLER
   ================================================================ */
function handleMove(direction) {
    if (state.mode !== 'idle') return;

    const {
        board,
        changed,
        level11Count
    } = applyMove(state.board, direction);
    if (!changed) return; // invalid move

    state.board = board;
    if (level11Count > 0) showMergeBanner();

    const empties = state.board.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);

    if (empties.length > 0) {
        state.mode = 'spawn';
        state.aiResult = null;
        setAIArrow('…', false);
        setAIStatus('في انتظار وضع الوحش…');
        setModeBar('⚡ وضع الإنبات – انقر على أي خلية فارغة لوضع وحش');
        renderBoard();
    } else {
        // لا توجد خلايا فارغة بعد الحركة
        renderBoard();
        if (isGameOver(state.board)) {
            setTimeout(() => alert('⚔ اللوحة مغلقة – لا توجد حركات متبقية! استخدم وضع التعديل.'), 80);
        } else {
            requestSolve();
        }
    }
}

/* ================================================================
   TILE CLICK HANDLER
   ================================================================ */
function handleTileClick(index) {
    if (state.mode === 'spawn') {
        if (state.board[index] !== 0) return; // must click empty tile
        state.spawnTile = index;
        openModal('spawn');
    } else if (state.isEditMode) {
        state.editTile = index;
        openModal('edit');
    }
}

/* ================================================================
   SPAWN / EDIT SELECTION
   ================================================================ */
function confirmSpawn(level) {
    closeModal('spawn');
    if (state.spawnTile < 0) return;
    state.board[state.spawnTile] = level;
    state.spawnTile = -1;
    state.mode = 'idle';
    setModeBar('');
    renderBoard();
    if (isGameOver(state.board)) {
        setTimeout(() => alert('⚔ اللوحة مغلقة – لا توجد حركات! رتّب البلاطات للمتابعة.'), 80);
    } else {
        requestSolve();
    }
}

function cancelSpawn() {
    closeModal('spawn');
    // Stay in spawn mode – player must still place a tile
}

function confirmEdit(level) {
    closeModal('edit');
    if (state.editTile < 0) return;
    if (level === 11) {
        // Placing a level-11 tile triggers immediate ascension (becomes empty)
        showMergeBanner();
        state.board[state.editTile] = 0;
    } else {
        state.board[state.editTile] = level;
    }
    state.editTile = -1;
    renderBoard();
    requestSolve();
}

function cancelEdit() {
    closeModal('edit');
    state.editTile = -1;
}

/* ================================================================
   BOARD MANAGEMENT
   ================================================================ */
function clearBoard() {
    if (!confirm('هل تريد مسح اللوحة والبداية من جديد؟')) return;
    state.board.fill(0);
    state.mode = 'idle';
    state.aiResult = null;
    setModeBar('');
    clearSavedGame();
    renderBoard();
    setAIArrow('?', false);
    setAIStatus('تم مسح اللوحة – جاهز للعبة جديدة');
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
    document.getElementById('btn-edit-mode').classList.toggle('active', state.isEditMode);
    if (state.isEditMode) {
        state.mode = 'idle';
        setModeBar('✎ وضع التعديل – انقر على أي بلاطة لتحديد مستواها');
    } else {
        setModeBar('');
    }
    renderBoard();
}

/* ================================================================
   RENDERING
   ================================================================ */
function renderBoard() {
    const boardEl = document.getElementById('board');
    for (let i = 0; i < 16; i++) {
        const tile = boardEl.children[i];
        const val = state.board[i];
        tile.dataset.level = val;

        // Clear classes
        tile.classList.remove('spawn-target', 'edit-highlight');

        const img = tile.querySelector('.tile-img');
        if (val > 0 && val <= 11) {
            const animal = ANIMALS[val];
            img.src = animal.img;
            img.alt = animal.name;
            img.style.display = '';
            tile.title = animal.name + ' (مستوى ' + val + ')';
            tile.querySelector('.tile-name').textContent = animal.name;
            tile.querySelector('.tile-num').textContent = val;
        } else {
            img.src = '';
            img.alt = '';
            img.style.display = 'none';
            tile.title = '';
            tile.querySelector('.tile-name').textContent = '';
            tile.querySelector('.tile-num').textContent = '';
        }

        // Spawn-mode: highlight empty tiles
        if (state.mode === 'spawn' && val === 0) tile.classList.add('spawn-target');

        // Edit-mode: highlight all tiles
        if (state.isEditMode) tile.classList.add('edit-highlight');
    }

    // Highlight suggested direction button
    highlightSuggestedBtn();

    // Auto-save after every visual update
    saveGameState();
}

function highlightSuggestedBtn() {
    document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('suggested'));
    if (state.aiResult && state.aiResult.direction) {
        const btn = document.querySelector(`.dir-btn[data-dir="${state.aiResult.direction}"]`);
        if (btn) btn.classList.add('suggested');
    }
}

function renderAIPanel(result) {
    const arrows = {
        left: '⬅',
        right: '➡',
        up: '⬆',
        down: '⬇'
    };
    const arrow = result.direction ? arrows[result.direction] : '✕';
    setAIArrow(arrow, !!result.direction);

    const conf = result.confidence || 0;
    const fill = document.getElementById('confidence-fill');
    fill.style.width = conf + '%';
    const pos = conf <= 33 ? '0%' : conf <= 66 ? '50%' : '100%';
    fill.style.backgroundPosition = pos + ' 0';

    document.getElementById('confidence-label').textContent = `Survival: ${conf}٪`;
    setAIStatus(result.direction ?
        `أفضل حركة: ${arrow}  (ثقة ${conf}٪)` :
        'لا توجد حركة صالحة');

    highlightSuggestedBtn();
}

function setAIArrow(text, hasResult) {
    const el = document.getElementById('ai-direction');
    el.textContent = text;
    el.classList.toggle('has-result', hasResult);
}

function setAIStatus(text) {
    document.getElementById('ai-status').textContent = text;
}

function setModeBar(text) {
    document.getElementById('mode-bar').textContent = text;
}

/* ================================================================
   MODALS
   ================================================================ */
function openModal(type) {
    document.getElementById(type === 'spawn' ? 'spawn-overlay' : 'edit-overlay').classList.remove('hidden');
}

function closeModal(type) {
    document.getElementById(type === 'spawn' ? 'spawn-overlay' : 'edit-overlay').classList.add('hidden');
}

function buildPicker(containerId, levels) {
    const el = document.getElementById(containerId);
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
            btn.innerHTML = `<img src="${animal.img}" alt="${animal.name}" class="picker-img"><span class="lbnum">${lv}</span>`;
            btn.style.background = `radial-gradient(circle at 38% 38%, ${lighten(animal.color)}, ${animal.color})`;
            btn.style.boxShadow = `0 0 10px ${animal.color}88`;
            btn.title = animal.name;
        }
        el.appendChild(btn);
    });
}

function lighten(hex) {
    // Simple lighten: blend toward white
    const r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    const mix = (c, t = 220) => Math.round(c + (t - c) * 0.45);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/* ================================================================
   MERGE BANNER
   ================================================================ */
function showMergeBanner() {
    const banner = document.getElementById('merge-banner');
    // Restart animation by briefly hiding
    banner.classList.add('hidden');
    void banner.offsetWidth; // force reflow
    banner.classList.remove('hidden');
    clearTimeout(showMergeBanner._timer);
    showMergeBanner._timer = setTimeout(() => banner.classList.add('hidden'), 1900);
}

/* ================================================================
   KEYBOARD SUPPORT
   ================================================================ */
const KEY_MAP = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    a: 'left',
    d: 'right',
    w: 'up',
    s: 'down',
    A: 'left',
    D: 'right',
    W: 'up',
    S: 'down',
};

/* ================================================================
   BOARD DOM INIT
   ================================================================ */
function initBoardDOM() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    for (let i = 0; i < 16; i++) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.level = '0';
        tile.innerHTML = `<img class="tile-img" src="" alt="" draggable="false" onerror="this.style.display='none'"><span class="tile-name"></span><span class="tile-num"></span>`;
        tile.addEventListener('click', () => handleTileClick(i));
        boardEl.appendChild(tile);
    }
}

/* ================================================================
   INIT
   ================================================================ */
function init() {
    initBoardDOM();

    buildPicker('spawn-picker', [1, 2, 3, 4, 5]);
    buildPicker('edit-picker', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    // Spawn picker buttons
    document.getElementById('spawn-picker').addEventListener('click', e => {
        const btn = e.target.closest('.level-btn');
        if (btn) confirmSpawn(parseInt(btn.dataset.level));
    });

    // Edit picker buttons
    document.getElementById('edit-picker').addEventListener('click', e => {
        const btn = e.target.closest('.level-btn');
        if (btn) confirmEdit(parseInt(btn.dataset.level));
    });

    // Modal cancel buttons
    document.getElementById('spawn-cancel').addEventListener('click', cancelSpawn);
    document.getElementById('edit-cancel').addEventListener('click', cancelEdit);

    // Direction buttons
    document.querySelectorAll('.dir-btn').forEach(btn => {
        btn.addEventListener('click', () => handleMove(btn.dataset.dir));
    });

    // Tool buttons
    document.getElementById('btn-edit-mode').addEventListener('click', toggleEditMode);
    document.getElementById('btn-clear').addEventListener('click', clearBoard);
    document.getElementById('btn-random').addEventListener('click', randomBoard);
    document.getElementById('btn-analyze').addEventListener('click', requestSolve);

    // Keyboard
    document.addEventListener('keydown', e => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
        const dir = KEY_MAP[e.key];
        if (dir) handleMove(dir);
    });

    // Init worker
    initWorker();

    // Restore saved game (or start fresh)
    const hadSave = loadGameState();

    // Initial render
    renderBoard();

    if (!hadSave) {
        setAIStatus('Ready – Press Analyze or Make a Move');
    } else if (state.mode === 'idle') {
        requestSolve(); // auto-analyze restored board
    }
}

/* ================================================================
   GAME STATE PERSISTENCE  (per-user save/restore)
   ================================================================ */

function currentUsername() {
    try {
        const sess = JSON.parse(localStorage.getItem('bm_session') || 'null');
        return (sess && sess.username) ? sess.username : null;
    } catch (_) {
        return null;
    }
}

function saveGameState() {
    const user = currentUsername();
    if (!user) return;
    try {
        localStorage.setItem('bm_save_' + user, JSON.stringify({
            board: state.board.slice(),
            mode: state.mode === 'spawn' ? 'spawn' : 'idle',
            savedAt: Date.now()
        }));
        // Flash "✓ saved" indicator
        const indicator = document.getElementById('session-saved');
        if (indicator) {
            indicator.textContent = '✓ محفوظ';
            clearTimeout(saveGameState._fadeTimer);
            saveGameState._fadeTimer = setTimeout(() => {
                indicator.textContent = '';
            }, 1800);
        }
    } catch (_) {}
}

function loadGameState() {
    const user = currentUsername();
    if (!user) return false;
    try {
        const raw = localStorage.getItem('bm_save_' + user);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        if (!saved || !Array.isArray(saved.board) || saved.board.length !== 16) return false;

        state.board = saved.board.map(v => Number(v) || 0);

        if (saved.mode === 'spawn') {
            state.mode = 'spawn';
            setAIArrow('…', false);
            setAIStatus('في انتظار وضع الوحيوان…');
            setModeBar('⚡   انقر على أي خلية فارغة لوضع حيوان');
        }

        // Show "game restored" notice
        const when = saved.savedAt ?
            new Date(saved.savedAt).toLocaleTimeString() :
            '';
        setAIStatus('تم استعادة اللعبة' + (when ? ' (محفوظة ' + when + ')' : '') + ' – اضغط تحليل');
        return true;
    } catch (_) {
        return false;
    }
}

function clearSavedGame() {
    const user = currentUsername();
    if (user) localStorage.removeItem('bm_save_' + user);
}

/* ================================================================
   SESSION DISPLAY & LOGOUT
   ================================================================ */
function logoutGame() {
    if (confirm('هل تريد العودة إلى شاشة تسجيل الدخول؟\n\nاللوحة محفوظة تلقائياً وستجدها عند عودتك.')) {
        localStorage.removeItem('bm_session');
        window.location.replace('login.html');
    }
}

/* ── حساب الوقت المتبقي ── */
function getRemainingInfo(expiresAt) {
    if (!expiresAt) return null;
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return {
        text: '⛔ انتهت الصلاحية',
        color: '#ef5350',
        expired: true
    };
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    if (days >= 2) return {
        text: '⏳ ' + days + ' أيام',
        color: '#81c784',
        expired: false
    };
    if (days === 1) return {
        text: '⏳ يوم و' + hours + ' ساعة',
        color: '#ffe082',
        expired: false
    };
    if (hours > 0) return {
        text: '⚠ ' + hours + ' ساعة!',
        color: '#ffab40',
        expired: false
    };
    return {
        text: '🔴 ' + mins + ' دقيقة!',
        color: '#ef5350',
        expired: false
    };
}

function updateSessionTime() {
    try {
        const sess = JSON.parse(localStorage.getItem('bm_session') || 'null');
        const users = JSON.parse(localStorage.getItem('bm_users') || '[]');
        if (!sess) return;
        const user = users.find(u => u.username === sess.username);
        if (!user || !user.expiresAt) return;

        const info = getRemainingInfo(user.expiresAt);
        const el = document.getElementById('session-time');
        if (!el || !info) return;

        if (info.expired) {
            // Kick out immediately
            localStorage.removeItem('bm_session');
            alert('انتهت صلاحية حسابك. سيتم تسجيل خروجك.');
            window.location.replace('login.html');
            return;
        }
        el.textContent = info.text;
        el.style.color = info.color;
    } catch (_) {}
}

function initSessionDisplay() {
    try {
        const sess = JSON.parse(localStorage.getItem('bm_session') || 'null');
        if (sess && sess.username) {
            const el = document.getElementById('session-user');
            if (el) el.textContent = '⚔ ' + sess.username;
        }
    } catch (_) {}
    // Show time immediately then refresh every 60 seconds
    updateSessionTime();
    setInterval(updateSessionTime, 60000);
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    initSessionDisplay();
});