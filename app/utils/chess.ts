/**
 * Core Chess Rules Engine and Variant Generator
 * High-fidelity, self-contained chess rules manager for React/Next.js.
 */

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Board = (Piece | null)[][];

export interface CastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface BoardState {
  board: Board;
  activeColor: Color;
  castlingRights: CastlingRights;
  enPassantSquare: string | null; // e.g., "e3"
  halfmoveClock: number;
  fullmoveNumber: number;
}

export interface Move {
  from: string; // e.g., "e2"
  to: string;   // e.g., "e4"
  promotion?: string; // "q" | "r" | "b" | "n"
}

// Coordinate conversions
export function sqToCoords(sq: string): [number, number] {
  const file = sq.charCodeAt(0) - 97; // 'a' -> 0
  const rank = 8 - parseInt(sq[1], 10); // '8' -> 0, '1' -> 7
  return [rank, file];
}

export function coordsToSq(row: number, col: number): string {
  const file = String.fromCharCode(97 + col);
  const rank = (8 - row).toString();
  return `${file}${rank}`;
}

// Convert board state to FEN string
export function stateToFen(state: BoardState): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let emptyCount = 0;
    let rowStr = '';
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        const char = piece.type === 'n' ? 'n' : piece.type;
        rowStr += piece.color === 'w' ? char.toUpperCase() : char.toLowerCase();
      }
    }
    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    rows.push(rowStr);
  }

  const piecePlacement = rows.join('/');
  const activeColor = state.activeColor;
  
  // Castling
  let castling = '';
  if (state.castlingRights.wK) castling += 'K';
  if (state.castlingRights.wQ) castling += 'Q';
  if (state.castlingRights.bK) castling += 'k';
  if (state.castlingRights.bQ) castling += 'q';
  if (castling === '') castling = '-';

  const ep = state.enPassantSquare || '-';
  const halfmove = state.halfmoveClock.toString();
  const fullmove = state.fullmoveNumber.toString();

  return `${piecePlacement} ${activeColor} ${castling} ${ep} ${halfmove} ${fullmove}`;
}

// Parse FEN into board state
export function parseFen(fen: string): BoardState {
  const parts = fen.trim().split(/\s+/);
  const piecePlacement = parts[0];
  const activeColor = (parts[1] || 'w') as Color;
  const castlingStr = parts[2] || '-';
  const enPassantSquare = parts[3] && parts[3] !== '-' ? parts[3] : null;
  const halfmoveClock = parseInt(parts[4] || '0', 10);
  const fullmoveNumber = parseInt(parts[5] || '1', 10);

  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  const rows = piecePlacement.split('/');

  for (let r = 0; r < 8; r++) {
    const rowStr = rows[r];
    let c = 0;
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (/[0-9]/.test(char)) {
        c += parseInt(char, 10);
      } else {
        const color: Color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toLowerCase() as PieceType;
        board[r][c] = { type, color };
        c++;
      }
    }
  }

  const castlingRights: CastlingRights = {
    wK: castlingStr.includes('K'),
    wQ: castlingStr.includes('Q'),
    bK: castlingStr.includes('k'),
    bQ: castlingStr.includes('q'),
  };

  return {
    board,
    activeColor,
    castlingRights,
    enPassantSquare,
    halfmoveClock,
    fullmoveNumber,
  };
}

// Returns true if coordinates are inside the board
function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

// Generate pseudo-legal moves for a piece at square sq
export function getPseudoLegalMoves(state: BoardState, fromSq: string): Move[] {
  const [r, c] = sqToCoords(fromSq);
  const piece = state.board[r][c];
  if (!piece || piece.color !== state.activeColor) return [];

  const moves: Move[] = [];
  const color = piece.color;
  const oppColor: Color = color === 'w' ? 'b' : 'w';

  switch (piece.type) {
    case 'p': {
      const dir = color === 'w' ? -1 : 1;
      const startRank = color === 'w' ? 6 : 1;
      const promoRank = color === 'w' ? 0 : 7;

      // Single step forward
      const nextR = r + dir;
      if (inBounds(nextR, c) && !state.board[nextR][c]) {
        if (nextR === promoRank) {
          ['q', 'r', 'b', 'n'].forEach(p => moves.push({ from: fromSq, to: coordsToSq(nextR, c), promotion: p }));
        } else {
          moves.push({ from: fromSq, to: coordsToSq(nextR, c) });
        }

        // Double step forward
        const doubleR = r + 2 * dir;
        if (r === startRank && inBounds(doubleR, c) && !state.board[doubleR][c]) {
          moves.push({ from: fromSq, to: coordsToSq(doubleR, c) });
        }
      }

      // Normal captures
      const captureCols = [c - 1, c + 1];
      captureCols.forEach(col => {
        if (inBounds(nextR, col)) {
          const targetPiece = state.board[nextR][col];
          if (targetPiece && targetPiece.color === oppColor) {
            if (nextR === promoRank) {
              ['q', 'r', 'b', 'n'].forEach(p => moves.push({ from: fromSq, to: coordsToSq(nextR, col), promotion: p }));
            } else {
              moves.push({ from: fromSq, to: coordsToSq(nextR, col) });
            }
          }
        }
      });

      // En Passant capture
      if (state.enPassantSquare) {
        const [epR, epC] = sqToCoords(state.enPassantSquare);
        if (nextR === epR && Math.abs(c - epC) === 1) {
          moves.push({ from: fromSq, to: state.enPassantSquare });
        }
      }
      break;
    }

    case 'n': {
      const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      offsets.forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) {
          const target = state.board[nr][nc];
          if (!target || target.color === oppColor) {
            moves.push({ from: fromSq, to: coordsToSq(nr, nc) });
          }
        }
      });
      break;
    }

    case 'b':
    case 'r':
    case 'q': {
      const dirs: [number, number][] = [];
      if (piece.type === 'b' || piece.type === 'q') {
        dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }
      if (piece.type === 'r' || piece.type === 'q') {
        dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }

      dirs.forEach(([dr, dc]) => {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          const target = state.board[nr][nc];
          if (!target) {
            moves.push({ from: fromSq, to: coordsToSq(nr, nc) });
          } else {
            if (target.color === oppColor) {
              moves.push({ from: fromSq, to: coordsToSq(nr, nc) });
            }
            break; // Blocked
          }
          nr += dr;
          nc += dc;
        }
      });
      break;
    }

    case 'k': {
      // 1-step moves
      const dirs = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];
      dirs.forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) {
          const target = state.board[nr][nc];
          if (!target || target.color === oppColor) {
            moves.push({ from: fromSq, to: coordsToSq(nr, nc) });
          }
        }
      });

      // Castling (handled in full getLegalMoves since it needs check verification)
      break;
    }
  }

  return moves;
}

// Find king coordinate for a color
export function findKing(board: Board, color: Color): [number, number] | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        return [r, c];
      }
    }
  }
  return null;
}

// Returns true if color is currently in check
export function isKingInCheck(board: Board, color: Color): boolean {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  const [kr, kc] = kingPos;
  const oppColor: Color = color === 'w' ? 'b' : 'w';

  // Check attacks from enemy Knight
  const nOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  for (const [dr, dc] of nOffsets) {
    const r = kr + dr, c = kc + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p && p.type === 'n' && p.color === oppColor) return true;
    }
  }

  // Check sliding attacks (Rook, Bishop, Queen)
  const slidingDirs: { type: PieceType[]; dirs: [number, number][] }[] = [
    { type: ['b', 'q'], dirs: [[-1, -1], [-1, 1], [1, -1], [1, 1]] },
    { type: ['r', 'q'], dirs: [[-1, 0], [1, 0], [0, -1], [0, 1]] }
  ];
  for (const group of slidingDirs) {
    for (const [dr, dc] of group.dirs) {
      let r = kr + dr, c = kc + dc;
      while (inBounds(r, c)) {
        const p = board[r][c];
        if (p) {
          if (p.color === oppColor && group.type.includes(p.type)) return true;
          break; // Blocked by some piece
        }
        r += dr;
        c += dc;
      }
    }
  }

  // Check Pawn attacks
  const pDir = color === 'w' ? -1 : 1;
  const pCols = [kc - 1, kc + 1];
  for (const col of pCols) {
    const r = kr + pDir;
    if (inBounds(r, col)) {
      const p = board[r][col];
      if (p && p.type === 'p' && p.color === oppColor) return true;
    }
  }

  // Check King attacks (mostly to avoid kings touching)
  const kOffsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  for (const [dr, dc] of kOffsets) {
    const r = kr + dr, c = kc + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === oppColor) return true;
    }
  }

  return false;
}

// Generate fully legal moves for the active color
export function getLegalMoves(state: BoardState): Move[] {
  const activeColor = state.activeColor;
  const legalMoves: Move[] = [];

  // Generate all pseudo-legal moves and filter out those that expose the King to check
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (piece && piece.color === activeColor) {
        const fromSq = coordsToSq(r, c);
        const pseudoMoves = getPseudoLegalMoves(state, fromSq);
        
        pseudoMoves.forEach(m => {
          if (isMoveSafe(state, m)) {
            legalMoves.push(m);
          }
        });
      }
    }
  }

  // Add King castling moves if fully legal
  const kr = activeColor === 'w' ? 7 : 0;
  const kSq = activeColor === 'w' ? 'e1' : 'e8';
  const king = state.board[kr][4];

  if (king && king.type === 'k' && king.color === activeColor && !isKingInCheck(state.board, activeColor)) {
    // Kingside
    const hasKingsideRights = activeColor === 'w' ? state.castlingRights.wK : state.castlingRights.bK;
    if (hasKingsideRights) {
      const fSq = activeColor === 'w' ? 'f1' : 'f8';
      const gSq = activeColor === 'w' ? 'g1' : 'g8';
      const fCoords = sqToCoords(fSq);
      const gCoords = sqToCoords(gSq);

      if (!state.board[fCoords[0]][fCoords[1]] && !state.board[gCoords[0]][gCoords[1]]) {
        // Must verify f and g squares are not attacked
        if (isSquareSafe(state.board, fSq, activeColor) && isSquareSafe(state.board, gSq, activeColor)) {
          legalMoves.push({ from: kSq, to: gSq });
        }
      }
    }

    // Queenside
    const hasQueensideRights = activeColor === 'w' ? state.castlingRights.wQ : state.castlingRights.bQ;
    if (hasQueensideRights) {
      const bSq = activeColor === 'w' ? 'b1' : 'b8';
      const cSq = activeColor === 'w' ? 'c1' : 'c8';
      const dSq = activeColor === 'w' ? 'd1' : 'd8';
      const bCoords = sqToCoords(bSq);
      const cCoords = sqToCoords(cSq);
      const dCoords = sqToCoords(dSq);

      if (!state.board[bCoords[0]][bCoords[1]] && !state.board[cCoords[0]][cCoords[1]] && !state.board[dCoords[0]][dCoords[1]]) {
        // Must verify c and d squares are not attacked
        if (isSquareSafe(state.board, cSq, activeColor) && isSquareSafe(state.board, dSq, activeColor)) {
          legalMoves.push({ from: kSq, to: cSq });
        }
      }
    }
  }

  return legalMoves;
}

// Check if square is safe from attack by opponent
function isSquareSafe(board: Board, sq: string, defenderColor: Color): boolean {
  const [tr, tc] = sqToCoords(sq);
  // We can simulate placing a defender piece on target and see if it could be captured, 
  // or use isKingInCheck with a simulated king at that square. Let's do that!
  const tempBoard = board.map(row => [...row]);
  tempBoard[tr][tc] = { type: 'k', color: defenderColor };
  return !isKingInCheck(tempBoard, defenderColor);
}

// Check if a move is safe (does not leave active king in check)
function isMoveSafe(state: BoardState, move: Move): boolean {
  const tempBoard = state.board.map(row => [...row]);
  const [fr, fc] = sqToCoords(move.from);
  const [tr, tc] = sqToCoords(move.to);
  const piece = tempBoard[fr][fc];

  if (!piece) return false;

  // Move piece
  tempBoard[tr][tc] = move.promotion ? { type: move.promotion as PieceType, color: piece.color } : piece;
  tempBoard[fr][fc] = null;

  // Handle en passant capture in safety check
  if (piece.type === 'p' && move.to === state.enPassantSquare) {
    const dir = piece.color === 'w' ? 1 : -1;
    tempBoard[tr + dir][tc] = null;
  }

  return !isKingInCheck(tempBoard, state.activeColor);
}

// Executes a move, returning the new BoardState, if it was a capture, and if check was delivered
export function makeMove(
  state: BoardState,
  move: Move
): { state: BoardState; isCapture: boolean; isCheck: boolean } {
  const nextBoard = state.board.map(row => [...row]);
  const [fr, fc] = sqToCoords(move.from);
  const [tr, tc] = sqToCoords(move.to);
  const piece = nextBoard[fr][fc];

  if (!piece) {
    throw new Error(`Invalid move: no piece at ${move.from}`);
  }

  let isCapture = nextBoard[tr][tc] !== null;
  const oppColor: Color = state.activeColor === 'w' ? 'b' : 'w';

  // Apply basic move
  nextBoard[tr][tc] = move.promotion
    ? { type: move.promotion as PieceType, color: piece.color }
    : piece;
  nextBoard[fr][fc] = null;

  // En Passant capture
  let nextEnPassantSquare: string | null = null;
  if (piece.type === 'p') {
    if (move.to === state.enPassantSquare) {
      const dir = piece.color === 'w' ? 1 : -1;
      nextBoard[tr + dir][tc] = null;
      isCapture = true;
    }
    
    // Double move sets en passant target
    if (Math.abs(fr - tr) === 2) {
      const epR = (fr + tr) / 2;
      nextEnPassantSquare = coordsToSq(epR, fc);
    }
  }

  // Handle Castling Rook movement
  if (piece.type === 'k') {
    if (fc === 4 && tc === 6) {
      // Kingside castle: move rook from h to f
      const rook = nextBoard[fr][7];
      nextBoard[fr][5] = rook;
      nextBoard[fr][7] = null;
    } else if (fc === 4 && tc === 2) {
      // Queenside castle: move rook from a to d
      const rook = nextBoard[fr][0];
      nextBoard[fr][3] = rook;
      nextBoard[fr][0] = null;
    }
  }

  // Update Castling Rights
  const nextCastling = { ...state.castlingRights };
  if (piece.type === 'k') {
    if (piece.color === 'w') {
      nextCastling.wK = false;
      nextCastling.wQ = false;
    } else {
      nextCastling.bK = false;
      nextCastling.bQ = false;
    }
  } else if (piece.type === 'r') {
    if (piece.color === 'w') {
      if (fr === 7 && fc === 7) nextCastling.wK = false;
      if (fr === 7 && fc === 0) nextCastling.wQ = false;
    } else {
      if (fr === 0 && fc === 7) nextCastling.bK = false;
      if (fr === 0 && fc === 0) nextCastling.bQ = false;
    }
  }

  // If a rook is captured, remove castling rights for that rook
  if (isCapture) {
    if (tr === 7 && tc === 7) nextCastling.wK = false;
    if (tr === 7 && tc === 0) nextCastling.wQ = false;
    if (tr === 0 && tc === 7) nextCastling.bK = false;
    if (tr === 0 && tc === 0) nextCastling.bQ = false;
  }

  // Clocks
  const isPawnMove = piece.type === 'p';
  const halfmoveClock = (isPawnMove || isCapture) ? 0 : state.halfmoveClock + 1;
  const fullmoveNumber = state.activeColor === 'b' ? state.fullmoveNumber + 1 : state.fullmoveNumber;

  const nextState: BoardState = {
    board: nextBoard,
    activeColor: oppColor,
    castlingRights: nextCastling,
    enPassantSquare: nextEnPassantSquare,
    halfmoveClock,
    fullmoveNumber,
  };

  const isCheck = isKingInCheck(nextBoard, oppColor);

  return {
    state: nextState,
    isCapture,
    isCheck,
  };
}

// Generate starting FEN for asymmetric programmatic piece challenges (specifically for challenge_lose)
export function getChallengeStartingFen(
  challengeType: 'challenge_beat' | 'challenge_lose',
  targetPiece: 'q' | 'r' | 'b' | 'n' | 'p',
  count: number,
  playerColor: 'white' | 'black'
): string {
  const grid: string[][] = Array(8).fill(null).map(() => Array(8).fill(''));

  // In challenge_lose, player always starts standard, bot is always asymmetric (King + N target pieces)
   const playerSetup: 'standard' | 'asymmetric' = 'standard';
   const botSetup: 'standard' | 'asymmetric' = 'asymmetric';

  // Player's setup (White if playerColor is white, Black if black)
  if (playerColor === 'white') {
    // Player is White (UPPERCASE)
    if (playerSetup === 'standard') {
      grid[7] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
      grid[6] = Array(8).fill('P');
    } else {
      grid[7][4] = 'K';
      let piecesPlaced = 0;
      const pieceChar = targetPiece.toUpperCase();
      for (let r = 7; r >= 5 && piecesPlaced < count; r--) {
        for (let c = 0; c < 8 && piecesPlaced < count; c++) {
          if (r === 7 && c === 4) continue;
          grid[r][c] = pieceChar;
          piecesPlaced++;
        }
      }
    }
  } else {
    // Player is Black (lowercase)
    if (playerSetup === 'standard') {
      grid[0] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
      grid[1] = Array(8).fill('p');
    } else {
      grid[0][4] = 'k';
      let piecesPlaced = 0;
      const pieceChar = targetPiece.toLowerCase();
      for (let r = 0; r < 3 && piecesPlaced < count; r++) {
        for (let c = 0; c < 8 && piecesPlaced < count; c++) {
          if (r === 0 && c === 4) continue;
          grid[r][c] = pieceChar;
          piecesPlaced++;
        }
      }
    }
  }

  // Bot's setup (Black if playerColor is white, White if black)
  if (playerColor === 'white') {
    // Bot is Black (lowercase)
    if (botSetup === 'standard') {
      grid[0] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
      grid[1] = Array(8).fill('p');
    } else {
      grid[0][4] = 'k';
      let piecesPlaced = 0;
      const pieceChar = targetPiece.toLowerCase();
      for (let r = 0; r < 3 && piecesPlaced < count; r++) {
        for (let c = 0; c < 8 && piecesPlaced < count; c++) {
          if (r === 0 && c === 4) continue;
          grid[r][c] = pieceChar;
          piecesPlaced++;
        }
      }
    }
  } else {
    // Bot is White (UPPERCASE)
    if (botSetup === 'standard') {
      grid[7] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
      grid[6] = Array(8).fill('P');
    } else {
      grid[7][4] = 'K';
      let piecesPlaced = 0;
      const pieceChar = targetPiece.toUpperCase();
      for (let r = 7; r >= 5 && piecesPlaced < count; r--) {
        for (let c = 0; c < 8 && piecesPlaced < count; c++) {
          if (r === 7 && c === 4) continue;
          grid[r][c] = pieceChar;
          piecesPlaced++;
        }
      }
    }
  }

  // Convert grid to FEN string
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let emptyCount = 0;
    let rowStr = '';
    for (let c = 0; c < 8; c++) {
      if (grid[r][c] === '') {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        rowStr += grid[r][c];
      }
    }
    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    rows.push(rowStr);
  }

  const piecePlacement = rows.join('/');
  // White always moves first
  const activeColor = 'w';
  
  // Castling rights are only for whoever got standard setup
  let castling = '';
  const whiteIsStandard = playerColor === 'white' ? (playerSetup === 'standard') : (botSetup === 'standard');
  const blackIsStandard = playerColor === 'black' ? (playerSetup === 'standard') : (botSetup === 'standard');
  if (whiteIsStandard) castling += 'KQ';
  if (blackIsStandard) castling += 'kq';
  if (castling === '') castling = '-';

  const enPassant = '-';
  const halfmove = '0';
  const fullmove = '1';

  return `${piecePlacement} ${activeColor} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
}

// Generate starting FEN for challenge_beat: Player gets an empty board with only their King + N extra pieces on user selected squares. Bot gets standard setup.
export function getChallengeBeatStartingFen(
  targetPiece: 'q' | 'r' | 'b' | 'n' | 'p',
  playerColor: 'w' | 'b',
  placedSquares: string[]
): string {
  const grid: string[][] = Array(8).fill(null).map(() => Array(8).fill(''));

  if (playerColor === 'w') {
    // Player is White (empty except for King and placed pieces)
    grid[7][4] = 'K';

    // Bot is Black (standard black setup)
    grid[0] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    grid[1] = Array(8).fill('p');
  } else {
    // Player is Black (empty except for King and placed pieces)
    grid[0][4] = 'k';

    // Bot is White (standard white setup)
    grid[7] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    grid[6] = Array(8).fill('P');
  }

  // Place player's custom extra pieces
  for (const sq of placedSquares) {
    const col = sq.charCodeAt(0) - 97;
    const row = 8 - parseInt(sq[1], 10);
    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
      grid[row][col] = playerColor === 'w' ? targetPiece.toUpperCase() : targetPiece.toLowerCase();
    }
  }

  // Convert grid to FEN string
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let emptyCount = 0;
    let rowStr = '';
    for (let c = 0; c < 8; c++) {
      if (grid[r][c] === '') {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        rowStr += grid[r][c];
      }
    }
    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    rows.push(rowStr);
  }

  const piecePlacement = rows.join('/');
  const activeColor = 'w'; // White moves first
  const castling = playerColor === 'w' ? 'kq' : 'KQ'; // Only bot side gets castling rights
  const enPassant = '-';
  const halfmove = '0';
  const fullmove = '1';

  return `${piecePlacement} ${activeColor} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
}

// Convert UCI coordinate move to algebraic notation or SAN (for nice logs)
export function moveToSan(state: BoardState, move: Move): string {
  const [fr, fc] = sqToCoords(move.from);
  const [tr, tc] = sqToCoords(move.to);
  const piece = state.board[fr][fc];
  if (!piece) return move.from + move.to;

  if (piece.type === 'k' && Math.abs(fc - tc) === 2) {
    return tc === 6 ? 'O-O' : 'O-O-O';
  }

  let san = '';
  if (piece.type !== 'p') {
    san += piece.type.toUpperCase();
    
    // Add disambiguation (for now just check if target square was captured)
    // Simplify SAN: PieceName + Target square
  } else if (state.board[tr][tc] !== null || move.to === state.enPassantSquare) {
    san += move.from[0] + 'x';
  }

  if (state.board[tr][tc] !== null && piece.type !== 'p') {
    san += 'x';
  }

  san += move.to;
  if (move.promotion) {
    san += '=' + move.promotion.toUpperCase();
  }

  // Check if checkmate or check
  const temp = makeMove(state, move);
  if (temp.isCheck) {
    const oppMoves = getLegalMoves(temp.state);
    san += oppMoves.length === 0 ? '#' : '+';
  }

  return san;
}

// Material value evaluation fallback
export function evaluateMaterial(board: Board): number {
  const values: Record<PieceType, number> = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000
  };

  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const val = values[piece.type];
        score += piece.color === 'w' ? val : -val;
      }
    }
  }
  return score / 100; // Return in pawns unit
}

// Quick Local Minimax AI Engine Fallback (extremely useful for offline/fallback moves)
export function getBestMoveMinimax(state: BoardState, depth: number = 2): Move | null {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;

  let bestMove: Move = moves[0];
  const isWhite = state.activeColor === 'w';
  let bestScore = isWhite ? -Infinity : Infinity;

  // Simple shuffle to add variability
  const shuffledMoves = [...moves].sort(() => Math.random() - 0.5);

  for (const move of shuffledMoves) {
    const { state: nextState } = makeMove(state, move);
    const score = minimax(nextState, depth - 1, -Infinity, Infinity, !isWhite);
    
    if (isWhite) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }

  return bestMove;
}

function minimax(state: BoardState, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
  const moves = getLegalMoves(state);
  if (depth === 0 || moves.length === 0) {
    if (moves.length === 0) {
      if (isKingInCheck(state.board, state.activeColor)) {
        return isMaximizing ? -50000 - depth : 50000 + depth; // Checkmate
      }
      return 0; // Stalemate
    }
    return evaluateMaterial(state.board);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      const { state: nextState } = makeMove(state, m);
      const score = minimax(nextState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      const { state: nextState } = makeMove(state, m);
      const score = minimax(nextState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// Blunderboss AI Engine: Plays the worst legal move that does not lead to getting mated on the next turn
export function getBlunderbossMove(state: BoardState, depth: number = 2): Move | null {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;

  const isWhite = state.activeColor === 'w';
  const scoredMoves: { move: Move; score: number }[] = [];

  for (const move of moves) {
    const { state: nextState } = makeMove(state, move);
    // Evaluate the position after this move
    const score = minimax(nextState, depth, -Infinity, Infinity, !isWhite);
    scoredMoves.push({ move, score });
  }

  // Filter out moves that lead to getting mated.
  // In minimax, checkmate for White is around -50000, and checkmate for Black is around 50000.
  // If we are White, we filter out scores <= -40000.
  // If we are Black, we filter out scores >= 40000.
  let safeMoves = scoredMoves.filter(sm => {
    if (isWhite) {
      return sm.score > -40000;
    } else {
      return sm.score < 40000;
    }
  });

  // If all moves lead to mate, we have to play whatever is legal
  if (safeMoves.length === 0) {
    safeMoves = scoredMoves;
  }

  // Sort moves so the WORST move for the active player is first.
  // For White, worst move has the lowest score (ascending).
  // For Black, worst move has the highest score (descending).
  safeMoves.sort((a, b) => {
    if (isWhite) {
      return a.score - b.score;
    } else {
      return b.score - a.score;
    }
  });

  // Pick the absolute worst move that is safe
  return safeMoves[0]?.move || null;
}

// Drawfish AI Engine: Plays the move that brings the board evaluation closest to 0.00 cp
export function getDrawfishMove(state: BoardState, depth: number = 2): Move | null {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;

  const isWhite = state.activeColor === 'w';
  const scoredMoves: { move: Move; score: number }[] = [];

  for (const move of moves) {
    const { state: nextState } = makeMove(state, move);
    const score = minimax(nextState, depth, -Infinity, Infinity, !isWhite);
    scoredMoves.push({ move, score });
  }

  // Sort by absolute score ascending, so the one closest to 0 (drawish) is first.
  scoredMoves.sort((a, b) => Math.abs(a.score) - Math.abs(b.score));

  return scoredMoves[0]?.move || null;
}

