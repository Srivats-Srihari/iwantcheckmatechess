import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { 
  parseFen, 
  getLegalMoves, 
  makeMove, 
  moveToSan, 
  getBestMoveMinimax, 
  BoardState, 
  Move, 
  stateToFen, 
  evaluateMaterial 
} from '../../utils/chess';

// Copy logo.jpg to public/logo.jpg on server initialization
try {
  const projectRoot = process.cwd();
  const srcLogo = path.join(projectRoot, 'logo.jpg');
  const destLogo = path.join(projectRoot, 'public', 'logo.jpg');
  if (fs.existsSync(srcLogo)) {
    // Always ensure it is up-to-date in public folder
    fs.copyFileSync(srcLogo, destLogo);
    console.log('[API] Successfully verified/copied logo.jpg to public/logo.jpg');
  }
} catch (logoErr) {
  console.error('[API] Logo copy failed:', logoErr);
}

// Dynamic safe loading of onnxruntime-node for serverless Vercel deployments
let ort: any = null;
try {
  ort = require('onnxruntime-node');
  console.log('[API] Successfully loaded onnxruntime-node for serverless Vercel model inference fallbacks!');
} catch (e) {
  console.warn('[API] onnxruntime-node is not currently loaded/installed in this environment.');
}

// Convert FEN position string to standard 8x8 matrix
function fenToBoard(fenStr: string): string[][] {
  const parts = fenStr.split(' ');
  const placement = parts[0];
  const board: string[][] = [];
  for (const row of placement.split('/')) {
    const boardRow: string[] = [];
    for (const char of row) {
      if (/\d/.test(char)) {
        boardRow.push(...Array(parseInt(char, 10)).fill(''));
      } else {
        boardRow.push(char);
      }
    }
    board.push(boardRow);
  }
  return board;
}

const pieceChannels: Record<string, number> = {
  'P': 0, 'N': 1, 'B': 2, 'R': 3, 'Q': 4, 'K': 5,
  'p': 6, 'n': 7, 'b': 8, 'r': 9, 'q': 10, 'k': 11
};
const pieceIds: Record<string, number> = {
  'P': 1, 'N': 2, 'B': 3, 'R': 4, 'Q': 5, 'K': 6,
  'p': -1, 'n': -2, 'b': -3, 'r': -4, 'q': -5, 'k': -6
};

// Encode chess board matrix into ONNX format input float array
function encodeBoardState(board: string[][], shape: number[]): Float32Array {
  if (shape.length === 4) {
    const [batch, c, h, w] = shape;
    if (c === 12) {
      const data = new Float32Array(12 * 8 * 8);
      for (let r = 0; r < 8; r++) {
        for (let col = 0; col < 8; col++) {
          const pc = board[r][col];
          if (pc in pieceChannels) {
            const channel = pieceChannels[pc];
            data[channel * 64 + r * 8 + col] = 1.0;
          }
        }
      }
      return data;
    } else if (c === 1) {
      const data = new Float32Array(1 * 8 * 8);
      for (let r = 0; r < 8; r++) {
        for (let col = 0; col < 8; col++) {
          const pc = board[r][col];
          if (pc in pieceIds) {
            data[r * 8 + col] = pieceIds[pc];
          }
        }
      }
      return data;
    }
  } else if (shape.length === 2) {
    const [batch, s] = shape;
    if (s === 768) {
      const data = new Float32Array(768);
      for (let r = 0; r < 8; r++) {
        for (let col = 0; col < 8; col++) {
          const pc = board[r][col];
          if (pc in pieceChannels) {
            const idx = pieceChannels[pc] * 64 + r * 8 + col;
            data[idx] = 1.0;
          }
        }
      }
      return data;
    } else if (s === 64) {
      const data = new Float32Array(64);
      for (let r = 0; r < 8; r++) {
        for (let col = 0; col < 8; col++) {
          const pc = board[r][col];
          if (pc in pieceIds) {
            data[r * 8 + col] = pieceIds[pc];
          }
        }
      }
      return data;
    }
  }

  // Flattened 768 fallback (12 channels x 64 squares)
  const data = new Float32Array(768);
  for (let r = 0; r < 8; r++) {
    for (let col = 0; col < 8; col++) {
      const pc = board[r][col];
      if (pc in pieceChannels) {
        const idx = pieceChannels[pc] * 64 + r * 8 + col;
        data[idx] = 1.0;
      }
    }
  }
  return data;
}

// Predict move predictions directly in JavaScript using onnxruntime-web / onnxruntime-node
async function predictMoveOnnx(
  fen: string,
  color: string,
  timeBucket: string
): Promise<{ move: string; score: number }[] | null> {
  if (!ort) {
    return null;
  }

  const projectRoot = process.cwd();
  const capColor = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
  const capTimeBucket = timeBucket.charAt(0).toUpperCase() + timeBucket.slice(1).toLowerCase();
  
  const modelDir = path.join(projectRoot, 'bot', 'Models', capColor, capTimeBucket);
  const onnxPath = path.join(modelDir, 'model.onnx');
  const vocabPath = path.join(projectRoot, 'bot', 'Jsons', capColor, capTimeBucket, 'move_vocab.json');

  if (!fs.existsSync(onnxPath) || !fs.existsSync(vocabPath)) {
    return null;
  }

  try {
    // 1. Read and parse vocabulary map
    const vocabContent = fs.readFileSync(vocabPath, 'utf-8');
    const vocab = JSON.parse(vocabContent);
    const indexToMove = vocab.index_to_move;

    // 2. Load the compiled ONNX model session
    const session = await ort.InferenceSession.create(onnxPath);
    const inputName = session.inputNames[0];
    
    // Retrieve expected dimensions from the metadata, fallback to standard [1, 12, 8, 8]
    const inputMeta = session.inputs[0];
    const parsedShape = inputShape.map((dim: any) => typeof dim === 'number' && dim > 0 ? dim : 1);
    

    // 3. Encode chess board state and create input Float32 Tensor
    const board = fenToBoard(fen);
    const encodedData = encodeBoardState(board, parsedShape);
    const inputTensor = new ort.Tensor('float32', encodedData, parsedShape);

    // 4. Execute inference session
    const outputName = session.outputNames[0];
    const outputs = await session.run({ [inputName]: inputTensor });
    const outputTensor = outputs[outputName];
    const logits = outputTensor.data as Float32Array;

    // 5. Build list of candidates from logit distributions
    const predictions: { move: string; score: number }[] = [];
    for (let i = 0; i < logits.length; i++) {
      const idxStr = String(i);
      if (idxStr in indexToMove) {
        predictions.push({
          move: indexToMove[idxStr],
          score: logits[i]
        });
      }
    }

    // Sort logits descending
    predictions.sort((a, b) => b.score - a.score);
    return predictions;
  } catch (err) {
    console.error('[API] Server-side ONNX fallback execution failed:', err);
    return null;
  }
}

// Query the local pure JS/WASM Stockfish engine
function getLocalStockfishMove(fen: string, depth: number = 8): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const stockfish = require('stockfish');
      const engine = stockfish();
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { engine.postMessage('quit'); } catch (e) {}
          resolve(null);
        }
      }, 5000); // 5 second timeout

      engine.onmessage = (line: string) => {
        if (line.startsWith('bestmove')) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            const parts = line.split(/\s+/);
            const bestMove = parts[1]; // e.g. "e2e4"
            try { engine.postMessage('quit'); } catch (e) {}
            resolve(bestMove === '(none)' ? null : bestMove);
          }
        }
      };

      engine.postMessage('uci');
      engine.postMessage('position fen ' + fen);
      engine.postMessage('go depth ' + depth);
    } catch (err) {
      console.error('[Stockfish] Local JS engine failed to run:', err);
      resolve(null);
    }
  });
}

let workingPythonCommand: string | null = null;
let isPythonProbed = false;

function getWorkingPythonCommand(): string | null {
  if (isPythonProbed) return workingPythonCommand;
  
  isPythonProbed = true;
  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, 'bot', 'predict.py');
  
  if (!fs.existsSync(scriptPath)) {
    console.warn(`[API] predict.py script not found at ${scriptPath}`);
    return null;
  }

  const commands = ['py', 'python', 'python3'];
  for (const command of commands) {
    try {
      // 1. Verify numpy imports successfully without triggering GIL or C-extension crashes
      execSync(`${command} -c "import numpy"`, { stdio: 'ignore', timeout: 2000 });

      // 2. Run predict.py on start FEN to verify JSON outputs work
      const testCmd = `${command} "${scriptPath}" "White" "Blitz" "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"`;
      const stdout = execSync(testCmd, { 
        encoding: 'utf-8', 
        timeout: 3000, 
        stdio: ['ignore', 'pipe', 'ignore'] 
      });
      
      if (stdout.trim().startsWith('{')) {
        workingPythonCommand = command;
        console.log(`[API] Python probe succeeded. Using working command: '${command}'`);
        break;
      }
    } catch (e) {
      // Suppressed - fallback or crashed interpreter
    }
  }
  
  if (!workingPythonCommand) {
    console.warn('[API] Python environment is unconfigured or incompatible (e.g. GIL/NumPy mismatch). Live Python models are bypassed, utilizing instant JSON database and local fallbacks.');
  }
  
  return workingPythonCommand;
}

// Auto-run model inspector to dump model structure
try {
  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, 'bot', 'inspect_model.py');
  if (fs.existsSync(scriptPath)) {
    const pythonCmd = getWorkingPythonCommand();
    if (pythonCmd) {
      console.log('[API] Auto-running inspect_model.py...');
      try {
        execSync(`${pythonCmd} "${scriptPath}"`, { stdio: ['ignore', 'pipe', 'ignore'] });
        console.log('[API] inspect_model.py completed.');
      } catch (e) {
        // silently ignore
      }
    }
  }
} catch (err) {
  // Silently ignore
}

// Memory cache for datasets to avoid parsing large JSONs on every single move
const jsonCache: Record<string, Record<string, string>> = {};

function getBotMoveDatabase(color: string, timeBucket: string): Record<string, string> | null {
  const capColor = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase(); // Black or White
  const capTimeBucket = timeBucket.charAt(0).toUpperCase() + timeBucket.slice(1).toLowerCase(); // Blitz, Bullet, Classical, Rapid, Unknown
  const cacheKey = `${capColor}/${capTimeBucket}`;

  if (jsonCache[cacheKey]) {
    return jsonCache[cacheKey];
  }

  const projectRoot = process.cwd();
  const filePath = path.join(projectRoot, 'bot', 'Jsons', capColor, capTimeBucket, 'best_move.json');

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      jsonCache[cacheKey] = parsed;
      return parsed;
    } catch (e) {
      console.error(`Error loading database at ${filePath}:`, e);
    }
  } else {
    console.warn(`Database file not found: ${filePath}`);
  }

  return null;
}

// Find a legal move that matches a SAN string or UCI string
function findMoveBySanOrUci(state: BoardState, input: string): Move | null {
  const legalMoves = getLegalMoves(state);
  const cleanInput = input.replace(/[+#x=QRBNqrbn]/g, '').toLowerCase();

  // 1. Try exact SAN match (e.g. "Nxd4+", "O-O")
  for (const move of legalMoves) {
    const moveSan = moveToSan(state, move);
    if (moveSan === input) return move;
  }

  // 2. Try case-insensitive and stripped match (e.g. "nxd4" -> "d4")
  for (const move of legalMoves) {
    const moveSan = moveToSan(state, move);
    const cleanSan = moveSan.replace(/[+#x=QRBNqrbn]/g, '').toLowerCase();
    if (cleanSan === cleanInput) return move;

    // 3. Try UCI coordinate match (e.g. "e2e4")
    const uci = move.from + move.to;
    if (uci === input.toLowerCase() || (move.from + move.to + (move.promotion || '')) === input.toLowerCase()) {
      return move;
    }
  }

  // 4. Special castling matchers
  if (input === 'O-O' || input === 'o-o') {
    const kSq = state.activeColor === 'w' ? 'e1' : 'e8';
    const targetSq = state.activeColor === 'w' ? 'g1' : 'g8';
    const m = legalMoves.find(mv => mv.from === kSq && mv.to === targetSq);
    if (m) return m;
  }
  if (input === 'O-O-O' || input === 'o-o-o') {
    const kSq = state.activeColor === 'w' ? 'e1' : 'e8';
    const targetSq = state.activeColor === 'w' ? 'c1' : 'c8';
    const m = legalMoves.find(mv => mv.from === kSq && mv.to === targetSq);
    if (m) return m;
  }

  return null;
}

// Normalize FEN to first 4 fields (ignores move clocks for broader matching)
function normalizeFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  return parts.slice(0, 4).join(' ');
}

// Stockfish-powered candidate move evaluator for Drawfish and Blunderboss
async function getStockfishPoweredBotMove(
  state: BoardState,
  botType: 'Drawfish' | 'Blunderboss',
  color: string
): Promise<{ move: Move; source: string; sfFailed: boolean }> {
  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0) {
    throw new Error('No legal moves available');
  }
  if (legalMoves.length === 1) {
    return { move: legalMoves[0], source: `${botType.toLowerCase()}_only_legal`, sfFailed: false };
  }

  const botSign = color.toLowerCase() === 'white' || color.toLowerCase() === 'w' ? 1 : -1;

  // 1. Calculate local material score for all candidate moves to prune candidates
  const scoredMoves = legalMoves.map(move => {
    const { state: nextState } = makeMove(state, move);
    const matScore = evaluateMaterial(nextState.board);
    const botMaterialScore = matScore * botSign;
    return {
      move,
      botMaterialScore,
      matScore
    };
  });

  // 2. Select top 8 candidates for Stockfish analysis
  let candidates = [...scoredMoves];
  if (botType === 'Drawfish') {
    // Closest material score to 0.00
    candidates.sort((a, b) => Math.abs(a.matScore) - Math.abs(b.matScore));
  } else {
    // Blunderboss: wants material score from its own perspective to be as close to -10.0 as possible
    candidates.sort((a, b) => Math.abs(a.botMaterialScore - (-10.0)) - Math.abs(b.botMaterialScore - (-10.0)));
  }
  candidates = candidates.slice(0, 8);

  let sfFailed = false;

  // 3. Query Stockfish Online API for candidates in parallel
  const evalPromises = candidates.map(async (cand) => {
    const { state: nextState } = makeMove(state, cand.move);
    const nextFen = stateToFen(nextState);
    const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(nextFen)}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout per candidate
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          let score = 0;
          let isMate = false;
          let mateIn = 0;

          if (data.mate !== null) {
            isMate = true;
            mateIn = data.mate; // positive is activeColor (opponent) checkmates bot
            score = mateIn > 0 ? -10000 + mateIn : 10000 + mateIn;
          } else if (data.evaluation !== undefined) {
            // data.evaluation is from the opponent's perspective.
            // Bot's perspective score is -data.evaluation
            score = -data.evaluation;
          }

          return {
            move: cand.move,
            score,
            isMate,
            mateIn,
            success: true
          };
        } else {
          if (res.status === 429) sfFailed = true;
        }
      } else {
        if (res.status === 429) sfFailed = true;
      }
    } catch (err) {
      // Fetch failed or aborted
    }

    // Fallback to local material score from bot perspective if API fails
    return {
      move: cand.move,
      score: cand.botMaterialScore,
      isMate: false,
      mateIn: 0,
      success: false
    };
  });

  const evaluated = await Promise.all(evalPromises);

  // If all API requests failed, fall back to our local JS/WASM Stockfish engine to query the best move
  if (evaluated.every(e => !e.success)) {
    sfFailed = true;
    console.log(`[Bot] Stockfish Online API failed. Querying local JS/WASM Stockfish engine directly...`);
    try {
      const activeFen = stateToFen(state);
      const bestLocalMoveStr = await getLocalStockfishMove(activeFen, 8);
      if (bestLocalMoveStr) {
        const localMove = findMoveBySanOrUci(state, bestLocalMoveStr);
        if (localMove) {
          console.log(`[Bot] Successfully retrieved best move from local Stockfish engine: ${bestLocalMoveStr}`);
          return {
            move: localMove,
            source: `${botType.toLowerCase()}_local_stockfish`,
            sfFailed: false
          };
        }
      }
    } catch (localSfErr) {
      console.error('[Bot] Local Stockfish fallback execution failed:', localSfErr);
    }
  }

  // 4. Select the best move according to the bot's strategy
  let selectedMove: Move | null = null;
  let source = `${botType.toLowerCase()}_stockfish`;

  if (botType === 'Drawfish') {
    // Tries bringing eval closest to 0.00
    // score is from bot's perspective, so Math.abs(score) is distance to 0.00
    evaluated.sort((a, b) => Math.abs(a.score) - Math.abs(b.score));
    selectedMove = evaluated[0].move;
    if (!evaluated[0].success) {
      source = 'drawfish_material_fallback';
    }
  } else {
    // Blunderboss: close to relative -10 without ever blundering checkmate
    // Filter out moves where the opponent can force checkmate (mateIn > 0)
    let safeMoves = evaluated.filter(e => !(e.isMate && e.mateIn > 0));
    if (safeMoves.length === 0) {
      safeMoves = evaluated; // if no safe moves, play anything
    }

    // Sort by distance to -10.0 from bot's perspective
    safeMoves.sort((a, b) => Math.abs(a.score - (-10.0)) - Math.abs(b.score - (-10.0)));
    selectedMove = safeMoves[0].move;
    if (!safeMoves[0].success) {
      source = 'blunderboss_material_fallback';
    }
  }

  return {
    move: selectedMove || legalMoves[0],
    source,
    sfFailed
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fen, color, timeBucket, opponent, evalOn } = body;

    if (!fen || !color || !timeBucket) {
      return NextResponse.json({ error: 'Missing fen, color, or timeBucket' }, { status: 400 });
    }

    const state = parseFen(fen);
    const legalMoves = getLegalMoves(state);

    if (legalMoves.length === 0) {
      return NextResponse.json({ message: 'No legal moves available (Checkmate or Stalemate)' });
    }

    let selectedMove: Move | null = null;
    let source = 'database';
    let sfFailed = false;

    const activeOpponent = opponent || 'Iwantcheckmate';
    const isEvalOn = !!evalOn;

    // 1. If bot is set to Blunderboss or Drawfish, use their custom Stockfish-based strategies
    if (activeOpponent === 'Blunderboss' || activeOpponent === 'Drawfish') {
      const result = await getStockfishPoweredBotMove(state, activeOpponent, color);
      selectedMove = result.move;
      source = result.source;
      sfFailed = result.sfFailed;
    }

    // 2. If eval is ON, try Stockfish Online API first, falling back to local Stockfish
    if (!selectedMove && isEvalOn) {
      source = 'stockfish_api';
      try {
        console.log(`[Bot] Eval is ON: calling Stockfish Online API for move...`);
        const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.bestmove) {
            const parts = data.bestmove.split(/\s+/);
            const bestMoveStr = parts[1];
            if (bestMoveStr) {
              selectedMove = findMoveBySanOrUci(state, bestMoveStr);
              if (selectedMove) {
                console.log(`[Bot] Stockfish Online API move (Eval ON): ${bestMoveStr}`);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Bot] Stockfish Online API failed when eval was ON, falling back:', err);
      }

      // Local Stockfish fallback if API query failed
      if (!selectedMove) {
        try {
          console.log(`[Bot] Eval is ON: calling local JS/WASM Stockfish engine...`);
          const bestLocalMoveStr = await getLocalStockfishMove(fen, 8);
          if (bestLocalMoveStr) {
            selectedMove = findMoveBySanOrUci(state, bestLocalMoveStr);
            if (selectedMove) {
              source = 'local_stockfish';
              console.log(`[Bot] Local Stockfish engine move (Eval ON): ${bestLocalMoveStr}`);
            }
          }
        } catch (localSfErr) {
          console.error('[Bot] Local Stockfish query failed when eval was ON:', localSfErr);
        }
      }
    }

    // 3. Step 1: Database Lookup
    if (!selectedMove) {
      const db = getBotMoveDatabase(color, timeBucket);

      if (db) {
        // Direct lookup with full FEN
        let moveStr = db[fen];
        
        // Fuzzy lookup with normalized FEN
        if (!moveStr) {
          const normFen = normalizeFen(fen);
          for (const [dbFen, dbMove] of Object.entries(db)) {
            if (normalizeFen(dbFen) === normFen) {
              moveStr = dbMove;
              break;
            }
          }
        }

        if (moveStr) {
          selectedMove = findMoveBySanOrUci(state, moveStr);
          if (selectedMove) {
            source = 'database';
            console.log(`[Bot] Found move in DB for ${color}/${timeBucket}: ${moveStr} -> ${selectedMove.from}${selectedMove.to}`);
          }
        }
      }
    }

    // 4. Step 2: ML Model (.onnx or .pt) fallback
    if (!selectedMove) {
      // Try JS-native ONNX execution first (extremely fast and Vercel Serverless compatible)
      if (ort) {
        try {
          console.log(`[Bot] FEN not in DB, running JS-native ONNX engine fallback...`);
          const predictions = await predictMoveOnnx(fen, color, timeBucket);
          if (predictions && predictions.length > 0) {
            for (const pred of predictions) {
              const move = findMoveBySanOrUci(state, pred.move);
              if (move) {
                selectedMove = move;
                source = 'neural_onnx_js';
                console.log(`[Bot] JS-native ONNX model move: ${pred.move} (Score: ${pred.score})`);
                break;
              }
            }
          }
        } catch (onnxErr) {
          console.warn('[Bot] JS-native ONNX inference failed, falling back:', onnxErr);
        }
      }

      // If JS ONNX was skipped or failed, fall back to Python predict.py (local environment)
      if (!selectedMove) {
        try {
          const pythonCmd = getWorkingPythonCommand();
          if (pythonCmd) {
            console.log(`[Bot] Running python predict.py ML model fallback...`);
            const projectRoot = process.cwd();
            const scriptPath = path.join(projectRoot, 'bot', 'predict.py');
            const capColor = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
            const capTimeBucket = timeBucket.charAt(0).toUpperCase() + timeBucket.slice(1).toLowerCase();
            
            try {
              const cmd = `${pythonCmd} "${scriptPath}" "${capColor}" "${capTimeBucket}" "${fen}"`;
              const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 6000, stdio: ['ignore', 'pipe', 'ignore'] });
              const parsed = JSON.parse(stdout);
              if (parsed.success && parsed.predictions && parsed.predictions.length > 0) {
                for (const pred of parsed.predictions) {
                  const move = findMoveBySanOrUci(state, pred.move);
                  if (move) {
                    selectedMove = move;
                    source = `neural_${parsed.backend || 'model'}`;
                    console.log(`[Bot] Python Neural model move: ${pred.move} (Score: ${pred.score}) using backend ${parsed.backend}`);
                    break;
                  }
                }
              } else {
                console.warn('[Bot] predict.py returned unsuccessful results:', parsed.reason || 'unknown');
              }
            } catch (err) {
              console.warn('[Bot] predict.py execution failed:', err instanceof Error ? err.message : err);
            }
          }
        } catch (err) {
          console.warn('[Bot] Python model fallback execution failed:', err);
        }
      }
    }

    // (Stockfish fallback layer has been removed for standard iwantcheckmate bot)

    // 6. Step 4: Local Minimax Search Fallback
    if (!selectedMove) {
      source = 'local_minimax';
      console.log(`[Bot] Falling back to local Minimax search...`);
      selectedMove = getBestMoveMinimax(state, 3); // Depth 3
    }

    if (!selectedMove) {
      // Emergency random move
      source = 'emergency_random';
      selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }

    // Prepare response data
    const san = moveToSan(state, selectedMove);
    const { state: nextState, isCapture, isCheck } = makeMove(state, selectedMove);
    const resultFen = stateToFen(nextState);

    return NextResponse.json({
      move: selectedMove,
      san,
      source,
      resultFen,
      isCapture,
      isCheck,
      sfFailed
    });
  } catch (e: any) {
    console.error('Error handling bot move:', e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
