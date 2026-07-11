"use client";

import React, { useState, useEffect, useRef } from 'react';
import PieceSvg from './components/PieceSvg';
import { chessAudio } from './utils/audio';
import { 
  parseFen, 
  stateToFen, 
  getLegalMoves, 
  makeMove, 
  getChallengeStartingFen, 
  getChallengeBeatStartingFen,
  evaluateMaterial, 
  isKingInCheck,
  moveToSan,
  BoardState, 
  Move,
  Color
} from './utils/chess';

// Types for user profiles & storage
interface UserProfile {
  username: string;
  elo: number;
  title: string;
  avatar?: string;
  streak: number;
}

const AVAILABLE_AVATARS = ['👑', '⚡', '🤖', '🦾', '🦉', '👾', '♟️', '🌌', '🦊', '🦁', '🐉', '⚔️', '🔮', '🛡️', '🌟'];

interface ChallengeRecord {
  type: string;
  piece: string;
  count: number;
  completed: boolean;
}

export default function ChessArena() {
  // --- STATE ---
  // Chess Core Game State (Starting FEN is standard)
  const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const [boardState, setBoardState] = useState<BoardState>(parseFen(initialFen));
  const [fenString, setFenString] = useState<string>(initialFen);
  
  // Game Play states
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [moveHistory, setMoveHistory] = useState<{ san: string; from: string; to: string; fenBefore: string; fenAfter: string }[]>([]);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  
  // Customizations
  const [theme, setTheme] = useState<'cyber' | 'purple' | 'classic'>('purple');
  const [pieceStyle, setPieceStyle] = useState<'classic' | 'neon' | 'wood'>('classic');
  const [botColor, setBotColor] = useState<Color>('b'); // bot is black, player is white
  const [timeControl, setTimeControl] = useState<number>(300); // 5 minutes (300s) default

  // New Pre-Game Setup States
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [opponent, setOpponent] = useState<'Iwantcheckmate' | 'Blunderboss' | 'Drawfish'>('Iwantcheckmate');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  
  // Countdown Timers (drift-proof)
  const [clocks, setClocks] = useState<{ w: number; b: number }>({ w: 300000, b: 300000 }); // in ms
  const lastTick = useRef<number>(0);
  const timerInterval = useRef<any>(null);

  // Bot thinking state & difficulty
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);
  const [botDifficulty, setBotDifficulty] = useState<string>('Blitz'); // Blitz, Bullet, Classical, Rapid

  // Evaluation & Analysis
  const [evaluationScore, setEvaluationScore] = useState<string>('0.0');
  const [evalSource, setEvalSource] = useState<'API' | 'Local' | 'Material'>('Material');
  const [showEvalBar, setShowEvalBar] = useState<boolean>(true);

  // Pawn Promotion Overlay Modal
  const [isPromoOpen, setIsPromoOpen] = useState<boolean>(false);
  const [promoPendingMove, setPromoPendingMove] = useState<Move | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'match' | 'challenge' | 'history' | 'profile' | 'manual'>('match');

  // User Profile popup & persisted stats
  const [userProfile, setUserProfile] = useState<UserProfile>({
    username: 'Grandmaster Cyber',
    elo: 1500,
    title: 'GM',
    avatar: '👑',
    streak: 0
  });
  const [showProfileEdit, setShowProfileEdit] = useState<boolean>(false);
  const [profileNameInput, setProfileNameInput] = useState<string>('');
  const [profileTitleInput, setProfileTitleInput] = useState<string>('');
  const [profileEloInput, setProfileEloInput] = useState<number>(1500);
  const [profileAvatarInput, setProfileAvatarInput] = useState<string>('👑');

  // Onboarding Setup states
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingName, setOnboardingName] = useState<string>('Grandmaster Cyber');
  const [onboardingElo, setOnboardingElo] = useState<number>(1500);
  const [onboardingTitle, setOnboardingTitle] = useState<string>('GM');
  const [onboardingAvatar, setOnboardingAvatar] = useState<string>('👑');
  
  // Custom Asymmetric Challenge stats
  const [challengeTarget, setChallengeTarget] = useState<'q' | 'r' | 'b' | 'n' | 'p'>('n');
  const [challengeCount, setChallengeCount] = useState<number>(1);
  const [challengeMode, setChallengeMode] = useState<'challenge_beat' | 'challenge_lose'>('challenge_beat');
  const [isChallengeActive, setIsChallengeActive] = useState<boolean>(false);
  const [isPlacementPhase, setIsPlacementPhase] = useState<boolean>(false);
  const [placedSquares, setPlacedSquares] = useState<string[]>([]);

  // New Game Variants States
  const [gameVariant, setGameVariant] = useState<'normal' | 'challenge_beat' | 'challenge_lose' | 'custom_fen'>('normal');
  const [pastedFen, setPastedFen] = useState<string>('');

  // Review Mode Computed States
  const activeFen = reviewIndex !== null && moveHistory[reviewIndex]
    ? moveHistory[reviewIndex].fenAfter
    : fenString;

  const activeBoardState = reviewIndex !== null && moveHistory[reviewIndex]
    ? parseFen(moveHistory[reviewIndex].fenAfter)
    : boardState;

  // --- INITIALIZATION ---
  useEffect(() => {
    // Load local storage profiles if available
    const cachedProfile = localStorage.getItem('iwantcheckmate_user_profile');
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        setUserProfile(parsed);
        setProfileNameInput(parsed.username);
        setProfileTitleInput(parsed.title);
        setProfileEloInput(parsed.elo ?? 1500);
        setProfileAvatarInput(parsed.avatar ?? '👑');
      } catch (e) {
        console.error('Failed to parse cached profile', e);
        setShowOnboarding(true);
      }
    } else {
      setShowOnboarding(true);
    }

    // Load challenge counts based on initial variant
    const savedBeat = localStorage.getItem('iwantcheckmate_challenge_beat_count');
    const savedLose = localStorage.getItem('iwantcheckmate_challenge_lose_count');
    if (gameVariant === 'challenge_beat') {
      setChallengeCount(savedBeat ? parseInt(savedBeat, 10) : 1);
    } else if (gameVariant === 'challenge_lose') {
      setChallengeCount(savedLose ? parseInt(savedLose, 10) : 1);
    }

    // Trigger lazy compile of bot-move API and run model inspector
    fetch('/api/bot-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', color: 'Black', timeBucket: 'Blitz' })
    }).catch(() => {});
  }, []);

  // Sync challenge count manually adjusted or on game variant change
  useEffect(() => {
    if (gameVariant === 'challenge_beat') {
      const saved = localStorage.getItem('iwantcheckmate_challenge_beat_count');
      setChallengeCount(saved ? parseInt(saved, 10) : 1);
    } else if (gameVariant === 'challenge_lose') {
      const saved = localStorage.getItem('iwantcheckmate_challenge_lose_count');
      setChallengeCount(saved ? parseInt(saved, 10) : 1);
    }
  }, [gameVariant]);

  const handleChallengeCountChange = (val: number) => {
    setChallengeCount(val);
    if (gameVariant === 'challenge_beat') {
      localStorage.setItem('iwantcheckmate_challenge_beat_count', val.toString());
    } else if (gameVariant === 'challenge_lose') {
      localStorage.setItem('iwantcheckmate_challenge_lose_count', val.toString());
    }
  };

  // --- FEN & PGN HELPERS ---
  const isValidFen = (fen: string): boolean => {
    if (!fen) return false;
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4) return false; // 4 to 6 fields are acceptable
    
    // 1. Piece placement
    const rows = parts[0].split('/');
    if (rows.length !== 8) return false;
    
    for (const row of rows) {
      let sum = 0;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (/[1-8]/.test(char)) {
          sum += parseInt(char, 10);
        } else if (/[prnbqkPRNBQK]/.test(char)) {
          sum += 1;
        } else {
          return false; // invalid character
        }
      }
      if (sum !== 8) return false; // row must sum to 8 squares
    }
    
    // 2. Active color
    if (parts[1] !== 'w' && parts[1] !== 'b') return false;
    
    // 3. Castling rights
    if (!/^(?:-|[KkQq]+)$/.test(parts[2])) return false;
    
    // 4. En passant
    if (parts[3] !== '-' && !/^[a-h][36]$/.test(parts[3])) return false;
    
    return true;
  };

  const getDefaultPlacedSquares = (count: number): string[] => {
    const candidates = [
      'd4', 'e4', 'd5', 'e5',
      'c4', 'f4', 'c5', 'f5',
      'b4', 'g4', 'b5', 'g5',
      'a4', 'h4', 'a5', 'h5'
    ];
    return candidates.slice(0, count);
  };

  const generatePgnString = () => {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
    const playerText = userProfile.username || "Player";
    const opponentText = `${opponent} (${opponent === 'Iwantcheckmate' ? botDifficulty : 'Stockfish'})`;
    const whitePlayer = playerColor === 'w' ? playerText : opponentText;
    const blackPlayer = playerColor === 'b' ? playerText : opponentText;
    
    let resultHeader = "*";
    if (isGameOver) {
      if (gameResult?.includes("Draw") || gameResult?.includes("Stalemate")) {
        resultHeader = "1/2-1/2";
      } else if (gameResult?.includes("White wins") || gameResult?.includes("checkmate! White wins") || gameResult?.includes("White wins by Timeout")) {
        resultHeader = "1-0";
      } else if (gameResult?.includes("Black wins") || gameResult?.includes("checkmate! Black wins") || gameResult?.includes("Black wins by Timeout")) {
        resultHeader = "0-1";
      }
    }

    let pgn = `[Event "IWantCheckmate Chess Arena"]\n`;
    pgn += `[Site "iwantcheckmatechess.com"]\n`;
    pgn += `[Date "${date}"]\n`;
    pgn += `[Round "1"]\n`;
    pgn += `[White "${whitePlayer}"]\n`;
    pgn += `[Black "${blackPlayer}"]\n`;
    pgn += `[Result "${resultHeader}"]\n`;
    pgn += `[Variant "${gameVariant === 'normal' ? 'Standard' : gameVariant}"]\n`;
    if (gameVariant !== 'normal') {
      let fenVal = pastedFen;
      if (gameVariant === 'challenge_beat') {
        fenVal = getChallengeBeatStartingFen(challengeTarget, playerColor, placedSquares);
      } else if (gameVariant === 'challenge_lose') {
        fenVal = getChallengeStartingFen('challenge_lose', challengeTarget, challengeCount, playerColor === 'w' ? 'white' : 'black');
      }
      pgn += `[FEN "${fenVal}"]\n`;
    }
    pgn += `\n`;

    let movesStr = "";
    for (let i = 0; i < moveHistory.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = moveHistory[i].san;
      const blackMove = moveHistory[i + 1] ? ` ${moveHistory[i + 1].san}` : "";
      movesStr += `${moveNum}. ${whiteMove}${blackMove} `;
    }
    pgn += movesStr.trim() + ` ${resultHeader}`;

    return pgn;
  };

  const handleCopyPgn = () => {
    const pgn = generatePgnString();
    navigator.clipboard.writeText(pgn);
  };

  const handleDownloadPgn = () => {
    const pgn = generatePgnString();
    const element = document.createElement("a");
    const file = new Blob([pgn], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `iwantcheckmate_${gameVariant}_match.pgn`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // --- PLAY SOUND EFFECTS CHESS_AUDIO FALLBACK OR SYNTHESIS ---
  const triggerAudio = (action: 'move' | 'capture' | 'check' | 'victory' | 'defeat') => {
    if (action === 'move') chessAudio.playMove();
    else if (action === 'capture') chessAudio.playCapture();
    else if (action === 'check') chessAudio.playCheck();
    else if (action === 'victory') chessAudio.playVictory();
    else if (action === 'defeat') chessAudio.playDefeat();
  };

  // --- DRIFT-PROOF TICK TIMERS IMPLEMENTATION ---
  useEffect(() => {
    if (isGameOver || isPlacementPhase || !isGameStarted) {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
      return;
    }

    lastTick.current = Date.now();
    timerInterval.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick.current;
      lastTick.current = now;

      setClocks(prev => {
        const active = boardState.activeColor;
        const nextTime = Math.max(0, prev[active] - delta);

        if (nextTime === 0) {
          // Timeout!
          setIsGameOver(true);
          const winner = active === 'w' ? 'Black' : 'White';
          setGameResult(`${winner} wins by Timeout! ⏱️`);
          
          const isPlayerWinner = (winner === 'White' && playerColor === 'w') || (winner === 'Black' && playerColor === 'b');
          
          if (isPlayerWinner) {
            triggerAudio('victory');
            const newStreak = userProfile.streak + 1;
            const newElo = userProfile.elo + 15;
            const updatedProfile = { ...userProfile, streak: newStreak, elo: newElo };
            setUserProfile(updatedProfile);
            localStorage.setItem('iwantcheckmate_user_profile', JSON.stringify(updatedProfile));
            
            if (isChallengeActive) {
              if (gameVariant === 'challenge_lose' || challengeMode === 'challenge_lose') {
                const nextCount = Math.min(15, challengeCount + 1);
                handleChallengeCountChange(nextCount);
              }
            }
          } else {
            triggerAudio('defeat');
            const updatedProfile = { ...userProfile, streak: 0, elo: Math.max(800, userProfile.elo - 10) };
            setUserProfile(updatedProfile);
            localStorage.setItem('iwantcheckmate_user_profile', JSON.stringify(updatedProfile));
            
            if (isChallengeActive) {
              if (gameVariant === 'challenge_beat' || challengeMode === 'challenge_beat') {
                const nextCount = Math.min(15, challengeCount + 1);
                handleChallengeCountChange(nextCount);
              }
            }
          }
          
          clearInterval(timerInterval.current);
          timerInterval.current = null;
        }

        return {
          ...prev,
          [active]: nextTime
        };
      });
    }, 100);

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [boardState.activeColor, isGameOver]);

  // --- POSITION HYBRID EVALUATION PIPE ---
  useEffect(() => {
    const runEvaluation = async () => {
      // 1. Material score fallback first (instant)
      const mat = evaluateMaterial(activeBoardState.board);
      let roundedMat = mat.toFixed(1);
      if (mat > 0) roundedMat = `+${roundedMat}`;
      setEvaluationScore(roundedMat);
      setEvalSource('Material');

      // 2. Fetch Stockfish Online API via server-side CORS proxy
      try {
        const res = await fetch(`/api/evaluate?fen=${encodeURIComponent(activeFen)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            if (data.mate !== null) {
              setEvaluationScore(`M${data.mate}`);
            } else if (data.evaluation !== undefined) {
              const sfEval = data.evaluation;
              const activeSign = activeBoardState.activeColor === 'w' ? 1 : -1;
              // Stockfish API returns evaluation from the active side perspective
              const relativeScore = sfEval * activeSign;
              let scoreText = relativeScore.toFixed(1);
              if (relativeScore > 0) scoreText = `+${scoreText}`;
              setEvaluationScore(scoreText);
            }
            setEvalSource('API');
            return;
          }
        }
      } catch (err) {
        // Fallback to local evaluation
        console.warn('Online evaluation failed, utilizing local material fallbacks', err);
      }
    };

    if (showEvalBar) {
      runEvaluation();
    }
  }, [activeFen, activeBoardState.activeColor, showEvalBar]);

  // --- BOT INFERENCE PIPELINE TRRIGERS ---
  useEffect(() => {
    // If it's the bot's turn to move and the game is active
    if (isGameStarted && !isGameOver && boardState.activeColor === botColor && !isBotThinking) {
      triggerBotPlay();
    }
  }, [boardState.activeColor, botColor, isGameOver, isGameStarted, isBotThinking]);

  const triggerBotPlay = async () => {
    setIsBotThinking(true);
    
    try {
      const response = await fetch('/api/bot-move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fen: fenString,
          color: botColor === 'w' ? 'White' : 'Black',
          timeBucket: botDifficulty,
          opponent: opponent, // Pass active bot type to the backend
          evalOn: showEvalBar, // Pass active evaluation state to the backend
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.move) {
          const botMove: Move = data.move;
          applyMoveToState(botMove, data.san, data.isCapture, data.isCheck, data.resultFen);
          setLastMove(botMove);
        }
      } else {
        // Fallback to local random or minimax in case of complete API collapse
        console.warn('Bot move server failure, executing emergency backup move');
        const legal = getLegalMoves(boardState);
        if (legal.length > 0) {
          const emergency = legal[Math.floor(Math.random() * legal.length)];
          const san = moveToSan(boardState, emergency);
          const { state: nextState, isCapture, isCheck } = makeMove(boardState, emergency);
          applyMoveToState(emergency, san, isCapture, isCheck, stateToFen(nextState));
          setLastMove(emergency);
        }
      }
    } catch (e) {
      console.error('Error fetching bot move', e);
    } finally {
      setIsBotThinking(false);
    }
  };

  // --- MOVE APPLICATIONS ---
  const applyMoveToState = (
    move: Move, 
    san: string, 
    isCapture: boolean, 
    isCheck: boolean, 
    resultFen: string
  ) => {
    const nextState = parseFen(resultFen);
    setReviewIndex(null); // Exit review mode when a live move occurs
    
    // Add to history
    setMoveHistory(prev => [
      ...prev,
      { san, from: move.from, to: move.to, fenBefore: fenString, fenAfter: resultFen }
    ]);

    setBoardState(nextState);
    setFenString(resultFen);
    setSelectedSquare(null);

    // Play tactile sound synthesize
    if (isCheck) {
      triggerAudio('check');
    } else if (isCapture) {
      triggerAudio('capture');
    } else {
      triggerAudio('move');
    }

    // Check game termination (Checkmate or stalemate)
    const opponentMoves = getLegalMoves(nextState);
    if (opponentMoves.length === 0) {
      setIsGameOver(true);
      if (isKingInCheck(nextState.board, nextState.activeColor)) {
        // Checkmate!
        const winningColor = nextState.activeColor === 'w' ? 'Black' : 'White';
        setGameResult(`Checkmate! ${winningColor} wins! 👑`);
        
        // Handle Streak scaling & persistent state ratings
        if (winningColor === (botColor === 'w' ? 'Black' : 'White')) {
          // Player won
          triggerAudio('victory');
          const newStreak = userProfile.streak + 1;
          const newElo = userProfile.elo + 15;
          const updatedProfile = { ...userProfile, streak: newStreak, elo: newElo };
          setUserProfile(updatedProfile);
          localStorage.setItem('iwantcheckmate_user_profile', JSON.stringify(updatedProfile));
          
          if (isChallengeActive) {
            if (gameVariant === 'challenge_lose' || challengeMode === 'challenge_lose') {
              const nextCount = Math.min(15, challengeCount + 1);
              handleChallengeCountChange(nextCount);
            }
          }
        } else {
          // Bot won (Player lost)
          triggerAudio('defeat');
          const updatedProfile = { ...userProfile, streak: 0, elo: Math.max(800, userProfile.elo - 10) };
          setUserProfile(updatedProfile);
          localStorage.setItem('iwantcheckmate_user_profile', JSON.stringify(updatedProfile));
          
          if (isChallengeActive) {
            if (gameVariant === 'challenge_beat' || challengeMode === 'challenge_beat') {
              const nextCount = Math.min(15, challengeCount + 1);
              handleChallengeCountChange(nextCount);
            }
          }
        }
      } else {
        // Stalemate
        setGameResult("Stalemate! The match is drawn. 🤝");
        triggerAudio('move');
      }
    }
  };

  // --- USER MOUSE CLICKS HANDLER ---
  const handleSquareClick = (square: string) => {
    if (isPlacementPhase) {
      if (placedSquares.includes(square)) {
        setPlacedSquares(prev => prev.filter(s => s !== square));
      } else {
        const rowStr = 8 - parseInt(square[1]);
        const colStr = square.charCodeAt(0) - 97;
        const standardPiece = boardState.board[rowStr][colStr];
        if (!standardPiece && placedSquares.length < challengeCount) {
          setPlacedSquares(prev => [...prev, square]);
        }
      }
      return;
    }

    if (reviewIndex !== null) return; // Prevent clicking squares in Review Mode
    if (isGameOver || isBotThinking || boardState.activeColor === botColor) return;

    const rowStr = 8 - parseInt(square[1]);
    const colStr = square.charCodeAt(0) - 97;
    const clickedPiece = boardState.board[rowStr][colStr];

    // If a piece belongs to the active color is clicked, select it
    if (clickedPiece && clickedPiece.color === boardState.activeColor) {
      setSelectedSquare(square);
      return;
    }

    // If a square is already selected, attempt a move
    if (selectedSquare) {
      const legalMoves = getLegalMoves(boardState);
      const matchingMove = legalMoves.find(
        m => m.from === selectedSquare && m.to === square
      );

      if (matchingMove) {
        // Intercept Pawn promotions
        const [fr, fc] = [8 - parseInt(selectedSquare[1]), selectedSquare.charCodeAt(0) - 97];
        const activePiece = boardState.board[fr][fc];
        const isPawnPromo = activePiece?.type === 'p' && (square[1] === '8' || square[1] === '1');

        if (isPawnPromo) {
          setPromoPendingMove(matchingMove);
          setIsPromoOpen(true);
        } else {
          // Play move
          const san = moveToSan(boardState, matchingMove);
          const { state: nextState, isCapture, isCheck } = makeMove(boardState, matchingMove);
          applyMoveToState(matchingMove, san, isCapture, isCheck, stateToFen(nextState));
          setLastMove(matchingMove);
        }
      } else {
        setSelectedSquare(null);
      }
    }
  };

  // Resolve Pawn Promotions
  const handlePromotionSelect = (promoType: string) => {
    if (!promoPendingMove) return;

    const finalMove = { ...promoPendingMove, promotion: promoType };
    const san = moveToSan(boardState, finalMove);
    const { state: nextState, isCapture, isCheck } = makeMove(boardState, finalMove);
    applyMoveToState(finalMove, san, isCapture, isCheck, stateToFen(nextState));
    setLastMove(finalMove);

    setIsPromoOpen(false);
    setPromoPendingMove(null);
  };

  const getPlacementPhaseFen = (pColor: 'w' | 'b'): string => {
    return pColor === 'w' 
      ? "rnbqkbnr/pppppppp/8/8/8/8/8/4K3 w kq - 0 1" 
      : "4k3/8/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1";
  };

  // Reset / Rematch Game
  const resetGame = (customFen?: string) => {
    let targetFen = customFen;
    let isBeat = false;
    
    if (!targetFen) {
      const activeVariant = (gameVariant === 'challenge_beat' || gameVariant === 'challenge_lose') ? gameVariant : challengeMode;
      if (isChallengeActive && activeVariant === 'challenge_beat') {
        isBeat = true;
        targetFen = getPlacementPhaseFen(playerColor);
      } else if (isChallengeActive && activeVariant === 'challenge_lose') {
        targetFen = getChallengeStartingFen(
          'challenge_lose',
          challengeTarget,
          challengeCount,
          playerColor === 'w' ? 'white' : 'black'
        );
      } else if (gameVariant === 'custom_fen' && pastedFen) {
        targetFen = pastedFen;
      } else {
        targetFen = initialFen;
      }
    } else {
      const activeVariant = (gameVariant === 'challenge_beat' || gameVariant === 'challenge_lose') ? gameVariant : challengeMode;
      if (isChallengeActive && activeVariant === 'challenge_beat') {
        isBeat = true;
        targetFen = getPlacementPhaseFen(playerColor);
      }
    }

    const nextState = parseFen(targetFen);
    
    if (!customFen) {
      // Keep botColor aligned with player color selection
      setBotColor(playerColor === 'w' ? 'b' : 'w');
    }

    setIsPlacementPhase(isBeat);
    if (isBeat) {
      setPlacedSquares(getDefaultPlacedSquares(challengeCount));
    } else {
      setPlacedSquares([]);
    }
    
    setBoardState(nextState);
    setFenString(targetFen);
    setSelectedSquare(null);
    setLastMove(null);
    setMoveHistory([]);
    setIsGameOver(false);
    setGameResult(null);
    setIsBotThinking(false);
    setReviewIndex(null); // Reset review index on rematch
    
    // Set Clocks
    const clockLimit = timeControl * 1000;
    setClocks({ w: clockLimit, b: clockLimit });
  };

  // Start Programmatic Asymmetric Challenge
  const startChallenge = () => {
    setIsChallengeActive(true);
    setGameVariant(challengeMode); // Align gameVariant with active challenge mode
    setPlayerColor('w'); // Reset player color to White for standardized challenge
    setBotColor('b'); // Bot is black
    
    if (challengeMode === 'challenge_beat') {
      setIsPlacementPhase(true);
      setPlacedSquares(getDefaultPlacedSquares(challengeCount));
      resetGame(getPlacementPhaseFen('w'));
    } else {
      setIsPlacementPhase(false);
      setPlacedSquares([]);
      const challengeFen = getChallengeStartingFen(
        challengeMode,
        challengeTarget,
        challengeCount,
        'white'
      );
      resetGame(challengeFen);
    }
    setActiveTab('match');
    setIsGameStarted(true); // Auto launch challenge match in arena
  };

  const endChallengeMode = () => {
    setIsChallengeActive(false);
    setGameVariant('normal'); // Reset gameVariant
    setIsPlacementPhase(false);
    setPlacedSquares([]);
    resetGame(initialFen);
  };

  // Launch Match from setup screen
  const startGame = () => {
    // Determine bot color based on player color choice
    const botCol = playerColor === 'w' ? 'b' : 'w';
    setBotColor(botCol);
    
    // Set Clocks
    const ms = timeControl * 1000;
    setClocks({ w: ms, b: ms });
    
    let targetFen = initialFen;
    let challengeActive = false;
    let isBeat = false;

    if (gameVariant === 'custom_fen') {
      if (isValidFen(pastedFen)) {
        targetFen = pastedFen;
      } else {
        alert("Invalid FEN! Starting standard match instead.");
      }
    } else if (gameVariant === 'challenge_beat') {
      challengeActive = true;
      isBeat = true;
      targetFen = getPlacementPhaseFen(playerColor);
    } else if (gameVariant === 'challenge_lose') {
      challengeActive = true;
      const colorName = playerColor === 'w' ? 'white' : 'black';
      targetFen = getChallengeStartingFen(
        gameVariant,
        challengeTarget,
        challengeCount,
        colorName
      );
    }

    setIsChallengeActive(challengeActive);
    setIsPlacementPhase(isBeat);
    if (isBeat) {
      setPlacedSquares(getDefaultPlacedSquares(challengeCount));
    } else {
      setPlacedSquares([]);
    }
    
    // Reset Board with target FEN
    const nextState = parseFen(targetFen);
    setBoardState(nextState);
    setFenString(targetFen);
    setSelectedSquare(null);
    setLastMove(null);
    setMoveHistory([]);
    setIsGameOver(false);
    setGameResult(null);
    setIsBotThinking(false);
    setReviewIndex(null);
    
    setIsGameStarted(true);
  };

  // Handle Control Slider adjustments
  const handleTimeControlChange = (seconds: number) => {
    setTimeControl(seconds);
    const ms = seconds * 1000;
    setClocks({ w: ms, b: ms });
  };

  const handleOnboardingSubmit = () => {
    const profile: UserProfile = {
      username: onboardingName.trim() || 'Grandmaster Cyber',
      elo: onboardingElo,
      title: onboardingTitle.trim() || 'GM',
      avatar: onboardingAvatar,
      streak: 0
    };
    setUserProfile(profile);
    localStorage.setItem('iwantcheckmate_user_profile', JSON.stringify(profile));
    
    // Sync inputs
    setProfileNameInput(profile.username);
    setProfileTitleInput(profile.title);
    setProfileEloInput(profile.elo);
    setProfileAvatarInput(profile.avatar ?? '👑');

    setShowOnboarding(false);
  };

  // Save Profile Edit
  const saveProfileEdit = () => {
    const updated: UserProfile = {
      ...userProfile,
      username: profileNameInput || userProfile.username,
      title: profileTitleInput || userProfile.title,
      elo: profileEloInput,
      avatar: profileAvatarInput
    };
    setUserProfile(updated);
    localStorage.setItem('iwantcheckmate_user_profile', JSON.stringify(updated));
    setShowProfileEdit(false);
  };

  // --- NATIVE DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, square: string) => {
    if (reviewIndex !== null) return;
    if (isGameOver || isBotThinking || boardState.activeColor === botColor) return;
    
    // Check if the piece belongs to the active player color
    const rowStr = 8 - parseInt(square[1], 10);
    const colStr = square.charCodeAt(0) - 97;
    const clickedPiece = boardState.board[rowStr][colStr];
    
    if (clickedPiece && clickedPiece.color === boardState.activeColor) {
      e.dataTransfer.setData("text/plain", square);
      setSelectedSquare(square); // Highlight legal moves immediately
    } else {
      e.preventDefault();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow drops
  };

  const handleDrop = (e: React.DragEvent, targetSquare: string) => {
    e.preventDefault();
    if (isPlacementPhase) return; // Disallow drop moves during placement phase

    const fromSquare = e.dataTransfer.getData("text/plain");
    if (!fromSquare || fromSquare === targetSquare) return;

    const legalMoves = getLegalMoves(boardState);
    const matchingMove = legalMoves.find(
      m => m.from === fromSquare && m.to === targetSquare
    );

    if (matchingMove) {
      // Intercept Pawn promotions
      const [fr, fc] = [8 - parseInt(fromSquare[1], 10), fromSquare.charCodeAt(0) - 97];
      const activePiece = boardState.board[fr][fc];
      const isPawnPromo = activePiece?.type === 'p' && (targetSquare[1] === '8' || targetSquare[1] === '1');

      if (isPawnPromo) {
        setPromoPendingMove(matchingMove);
        setIsPromoOpen(true);
      } else {
        const san = moveToSan(boardState, matchingMove);
        const { state: nextState, isCapture, isCheck } = makeMove(boardState, matchingMove);
        applyMoveToState(matchingMove, san, isCapture, isCheck, stateToFen(nextState));
        setLastMove(matchingMove);
      }
    }
    setSelectedSquare(null);
  };

  // --- BOARD GENERATION HELPER ---
  const renderBoardGrid = () => {
    const squares = [];
    const legalMoves = reviewIndex !== null ? [] : getLegalMoves(boardState);
    const availableTargets = selectedSquare 
      ? legalMoves.filter(m => m.from === selectedSquare).map(m => m.to)
      : [];

    const isPlayerWhite = playerColor === 'w';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        // Map visual row and column to board indices depending on player POV orientation
        const boardR = isPlayerWhite ? r : 7 - r;
        const boardC = isPlayerWhite ? c : 7 - c;

        const file = String.fromCharCode(97 + boardC);
        const rank = (8 - boardR).toString();
        const sqName = `${file}${rank}`;
        let piece = activeBoardState.board[boardR][boardC];
        if (isPlacementPhase && placedSquares.includes(sqName)) {
          piece = { type: challengeTarget, color: playerColor as any };
        }

        // Theme-specific colors
        let baseColor = '';
        if (theme === 'cyber') {
          baseColor = (r + c) % 2 === 0 ? 'bg-slate-900/60' : 'bg-emerald-950/40';
        } else if (theme === 'purple') {
          baseColor = (r + c) % 2 === 0 ? 'bg-slate-900/60' : 'bg-purple-950/40';
        } else {
          // Wood maple grid colors
          baseColor = (r + c) % 2 === 0 ? 'bg-[#f0d9b5]' : 'bg-[#b58863]';
        }

        const isSelected = selectedSquare === sqName;
        const isTarget = availableTargets.includes(sqName);
        const isOccupiedTarget = isTarget && piece !== null;
        
        // Last move markers
        const isLastMoveSrc = lastMove?.from === sqName;
        const isLastMoveDst = lastMove?.to === sqName;

        squares.push(
          <div
            key={sqName}
            onClick={() => handleSquareClick(sqName)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, sqName)}
            className={`relative flex items-center justify-center aspect-square select-none cursor-pointer border border-white/5 transition-all duration-200 ${baseColor} 
              ${isSelected ? 'ring-2 ring-cyan-400 ring-inset scale-[1.01] shadow-lg shadow-cyan-500/20 z-10' : ''}
              ${isLastMoveSrc || isLastMoveDst ? 'outline-2 outline-orange-500/60 outline-inset' : ''}
            `}
          >
            {/* Soft selected radial glow */}
            {isSelected && (
              <div className="absolute inset-0 bg-cyan-400/10 rounded-full animate-ping pointer-events-none" />
            )}

            {/* Chess Piece Vector representation */}
            {piece && (
              <div 
                draggable={!isPlacementPhase && !isGameOver && boardState.activeColor !== botColor}
                onDragStart={(e) => handleDragStart(e, sqName)}
                className="w-[85%] h-[85%] transition-transform duration-200 hover:scale-[1.08] active:scale-[0.95]"
              >
                <PieceSvg type={piece.type} color={piece.color} style={pieceStyle} />
              </div>
            )}

            {/* Legal move marker dot overlay */}
            {isTarget && !isOccupiedTarget && (
              <div className="absolute w-[24%] h-[24%] rounded-full bg-cyan-400/50 shadow-sm shadow-cyan-400 pointer-events-none" />
            )}

            {/* Occupied Target capturing warning ring */}
            {isOccupiedTarget && (
              <div className="absolute w-[80%] h-[80%] rounded-full border-2 border-red-500/60 animate-pulse pointer-events-none" />
            )}

            {/* Grid coordinate labeling (Standard rank/file markers on borders) */}
            {c === 0 && (
              <span className="absolute top-1 left-1 text-[9px] font-orbitron font-bold opacity-30 select-none">
                {rank}
              </span>
            )}
            {r === 7 && (
              <span className="absolute bottom-1 right-1 text-[9px] font-orbitron font-bold opacity-30 select-none">
                {file}
              </span>
            )}
          </div>
        );
      }
    }
    return squares;
  };

  // Calculate Clocks display (formats ms to minutes:seconds)
  const formatClock = (ms: number) => {
    const totalSecs = Math.ceil(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Convert Evaluation score value into CSS percentage Heights for Bar
  const getEvalBarPercentage = () => {
    if (evaluationScore.startsWith('M')) {
      return evaluationScore.includes('-') ? 0 : 100;
    }
    const score = parseFloat(evaluationScore);
    if (isNaN(score)) return 50;
    // Map score range [-5, +5] to [0, 100]
    const pValue = 50 + score * 10;
    return Math.max(5, Math.min(95, pValue));
  };

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-start text-slate-100 p-3 sm:p-6 select-none font-outfit
      ${theme === 'cyber' ? 'bg-cyber-gradient' : theme === 'purple' ? 'bg-purple-gradient' : 'bg-classic-gradient'}
    `}>
      
      {/* --- TOP HEADER NAVIGATION PANEL --- */}
      <header className="w-full max-w-6xl mb-6 flex flex-col md:flex-row items-center justify-between gap-4 py-3 px-6 glass-panel rounded-2xl border border-white/10 shadow-xl shadow-black/40">
        <div className="flex items-center gap-4">
          <img 
            src="/logo.jpg" 
            alt="IWantCheckmate Logo" 
            className="w-10 h-10 rounded-xl object-cover shadow-lg border border-white/10 animate-fade-in" 
          />
          <div>
            <h1 className="text-xl font-bold tracking-wider font-orbitron bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              IWANTCHECKMATE
            </h1>
            <p className="text-[10px] font-orbitron uppercase tracking-widest text-emerald-400/80">Variant Edition Arena</p>
          </div>
        </div>

        {/* Persistent User Stats */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-[10px] uppercase font-orbitron tracking-wider text-slate-400">Streak Record</span>
            <div className="text-lg font-bold font-orbitron text-emerald-400">{userProfile.streak} Wins</div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-right">
            <span className="text-[10px] uppercase font-orbitron tracking-wider text-slate-400">User Rating</span>
            <div className="text-lg font-bold font-orbitron text-cyan-400">{userProfile.elo} ELO</div>
          </div>
          <button 
            onClick={() => { setShowProfileEdit(true); setProfileNameInput(userProfile.username); }}
            className="p-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/15 transition-all text-sm cursor-pointer"
          >
            👤
          </button>
        </div>
      </header>
      {/* --- GAME GRID MAIN CONTAINER --- */}
      {!isGameStarted ? (
        <main className="w-full max-w-4xl flex flex-col gap-6 items-stretch mb-10 animate-fade-in">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col gap-8">
            <div className="text-center">
              <h2 className="text-3xl font-black font-orbitron tracking-wider text-purple-400 mb-2">PRE-GAME CHESS ARENA SETUP</h2>
              <p className="text-sm text-slate-300 font-outfit max-w-xl mx-auto">
                Configure your combat parameters, select a specialized artificial intelligence opponent, choose your game variant, and launch your match.
              </p>
            </div>

            {/* Side Selection */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs uppercase font-orbitron tracking-widest text-purple-400 font-bold">1. Choose Your Side</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPlayerColor('w')}
                  className={`p-5 rounded-2xl border flex items-center gap-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer
                    ${playerColor === 'w' 
                      ? 'bg-purple-950/30 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/10' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8'}`}
                >
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-3xl text-white">
                    ♔
                  </div>
                  <div>
                    <span className="block text-base font-bold font-orbitron">Play as White</span>
                    <span className="text-xs opacity-70 font-outfit">Moves first. Command the opening tempo.</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerColor('b')}
                  className={`p-5 rounded-2xl border flex items-center gap-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer
                    ${playerColor === 'b' 
                      ? 'bg-purple-950/30 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/10' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8'}`}
                >
                  <div className="w-12 h-12 bg-slate-950/65 rounded-xl flex items-center justify-center text-3xl text-purple-400">
                    ♚
                  </div>
                  <div>
                    <span className="block text-base font-bold font-orbitron">Play as Black</span>
                    <span className="text-xs opacity-70 font-outfit">Moves second. Solid defense & counterplay.</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Opponent Selection */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs uppercase font-orbitron tracking-widest text-purple-400 font-bold">2. Select Your AI Opponent</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setOpponent('Iwantcheckmate')}
                  className={`p-5 rounded-2xl border flex flex-col gap-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer
                    ${opponent === 'Iwantcheckmate' 
                      ? 'bg-purple-950/30 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/10' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8'}`}
                >
                  <span className="text-3xl">🧠</span>
                  <div>
                    <span className="block text-base font-bold font-orbitron">IWantCheckmate</span>
                    <span className="text-[11px] opacity-80 mt-1 block font-outfit">
                      Powered by custom pre-trained neural networks & move databases. Extremely tactical and strong.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOpponent('Blunderboss')}
                  className={`p-5 rounded-2xl border flex flex-col gap-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer
                    ${opponent === 'Blunderboss' 
                      ? 'bg-purple-950/30 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/10' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8'}`}
                >
                  <span className="text-3xl">🤡</span>
                  <div>
                    <span className="block text-base font-bold font-orbitron">Blunderboss</span>
                    <span className="text-[11px] opacity-80 mt-1 block font-outfit">
                      Plays the worst legal move that avoids immediate self-mate. Spot its blunders to secure victory!
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOpponent('Drawfish')}
                  className={`p-5 rounded-2xl border flex flex-col gap-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer
                    ${opponent === 'Drawfish' 
                      ? 'bg-purple-950/30 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/10' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8'}`}
                >
                  <span className="text-3xl">⚖️</span>
                  <div>
                    <span className="block text-base font-bold font-orbitron">Drawfish</span>
                    <span className="text-[11px] opacity-80 mt-1 block font-outfit">
                      Tries to keep evaluation as close to 0.00 as possible. Avoid traps and navigate drawing lines.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Game Variant Selection */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs uppercase font-orbitron tracking-widest text-purple-400 font-bold">3. Choose Game Variant</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setGameVariant('normal')}
                  className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex gap-4
                    ${gameVariant === 'normal' 
                      ? 'bg-purple-950/30 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/10' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8'}`}
                >
                  <span className="text-3xl mt-1">👑</span>
                  <div>
                    <span className="block text-base font-bold font-orbitron">Standard Chess</span>
                    <span className="text-xs opacity-70 font-outfit">Play standard 8x8 game rules with equal starting armies.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGameVariant('challenge_beat')}
                  className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex gap-4
                    ${gameVariant === 'challenge_beat' 
                      ? 'bg-purple-950/30 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/10' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8'}`}
                >
                  <span className="text-3xl mt-1">⚔️</span>
                  <div>
                    <span className="block text-base font-bold font-orbitron">How Many to Beat</span>
                    <span className="text-xs opacity-70 font-outfit">Bot starts with N pieces of selected type. Win to test your skill! Gained count persists on loss.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGameVariant('challenge_lose')}
                  className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex gap-4
                    ${gameVariant === 'challenge_lose' 
                      ? 'bg-purple-950/30 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/10' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8'}`}
                >
                  <span className="text-3xl mt-1">🛡️</span>
                  <div>
                    <span className="block text-base font-bold font-orbitron">How Many to Lose To</span>
                    <span className="text-xs opacity-70 font-outfit">Bot starts with N pieces of selected type. Try to lose! Gained count persists on win.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGameVariant('custom_fen')}
                  className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex gap-4
                    ${gameVariant === 'custom_fen' 
                      ? 'bg-purple-950/30 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/10' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8'}`}
                >
                  <span className="text-3xl mt-1">📋</span>
                  <div>
                    <span className="block text-base font-bold font-orbitron">Custom FEN Paste</span>
                    <span className="text-xs opacity-70 font-outfit">Input a custom FEN notation string to initiate a custom layout.</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Asymmetric Challenge Configuration details */}
            {(gameVariant === 'challenge_beat' || gameVariant === 'challenge_lose') && (
              <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-950/15 flex flex-col gap-4 animate-fade-in">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs uppercase font-orbitron tracking-widest text-purple-400 font-bold">Challenge Configuration</h4>
                  <button
                    type="button"
                    onClick={() => handleChallengeCountChange(1)}
                    className="text-[10px] font-orbitron font-bold text-red-400 hover:text-red-300 uppercase tracking-widest cursor-pointer"
                  >
                    Reset Count to 1 ↩️
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Select Piece */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-400 font-outfit">Select Target Piece Type</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {['q', 'r', 'b', 'n', 'p'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setChallengeTarget(p as any)}
                          className={`py-2 text-xs font-bold rounded-lg border uppercase transition-all cursor-pointer
                            ${challengeTarget === p 
                              ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-bold' 
                              : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quantity Slider */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-xs text-slate-400 font-outfit">
                      <span>Piece Quantity (N)</span>
                      <span className="text-purple-400 font-bold font-orbitron">{challengeCount} pieces</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="1"
                      value={challengeCount}
                      onChange={(e) => handleChallengeCountChange(parseInt(e.target.value, 10))}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-400 mt-2"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Custom FEN paste details */}
            {gameVariant === 'custom_fen' && (
              <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-950/15 flex flex-col gap-3 animate-fade-in">
                <h4 className="text-xs uppercase font-orbitron tracking-widest text-purple-400 font-bold">Paste Custom FEN Position</h4>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={pastedFen}
                    onChange={(e) => setPastedFen(e.target.value)}
                    placeholder="e.g. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                    className="w-full bg-slate-950/80 border border-white/10 text-slate-100 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-purple-400 transition-all placeholder:text-slate-600"
                  />
                  <div className="flex justify-between items-center text-[11px] mt-0.5">
                    {pastedFen.trim() === '' ? (
                      <span className="text-slate-500 font-outfit">Paste any standard FEN string to launch from that exact position.</span>
                    ) : isValidFen(pastedFen) ? (
                      <span className="text-emerald-400 font-bold font-orbitron flex items-center gap-1">
                        ✓ FEN STATE VALID
                      </span>
                    ) : (
                      <span className="text-red-400 font-bold font-orbitron flex items-center gap-1">
                        ✗ INVALID FEN FORMAT
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Time Control */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xs uppercase font-orbitron tracking-widest text-purple-400 font-bold">4. Match Time Control</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: '1 Min (Bullet)', value: 60 },
                  { label: '3 Min (Blitz)', value: 180 },
                  { label: '5 Min (Blitz)', value: 300 },
                  { label: '10 Min (Rapid)', value: 600 },
                  { label: '30 Min (Classic)', value: 1800 },
                ].map(item => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleTimeControlChange(item.value)}
                    className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all cursor-pointer
                      ${timeControl === item.value 
                        ? 'bg-purple-500/20 border-purple-400 text-purple-300' 
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex justify-between text-[11px] uppercase font-orbitron tracking-wider text-slate-400">
                  <span>Custom Time Limit</span>
                  <span className="text-purple-400 font-bold font-orbitron">{Math.floor(timeControl / 60)} Minutes {timeControl % 60 > 0 ? `${timeControl % 60} Seconds` : ''}</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="1800"
                  step="60"
                  value={timeControl}
                  onChange={(e) => handleTimeControlChange(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
              </div>
            </div>

            {/* Aesthetics Theme Customization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="flex flex-col gap-3">
                <h3 className="text-xs uppercase font-orbitron tracking-widest text-purple-400 font-bold">5. Arena Grid Theme</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['cyber', 'purple', 'classic'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`py-2 text-xs capitalize rounded-xl border transition-all cursor-pointer
                        ${theme === t 
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-bold shadow-md shadow-purple-400/5' 
                          : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-xs uppercase font-orbitron tracking-widest text-purple-400 font-bold">6. Piece Rendering Style</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['classic', 'neon', 'wood'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPieceStyle(p)}
                      className={`py-2 text-xs capitalize rounded-xl border transition-all cursor-pointer
                        ${pieceStyle === p 
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-bold shadow-md shadow-purple-400/5' 
                          : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-px bg-white/10 my-1" />

            {/* Launch Action */}
            <div className="flex flex-col items-stretch mt-2">
              <button
                type="button"
                disabled={gameVariant === 'custom_fen' && !isValidFen(pastedFen)}
                onClick={startGame}
                className={`w-full py-4 font-black font-orbitron tracking-widest text-sm rounded-2xl transition-all shadow-xl text-center
                  ${(gameVariant === 'custom_fen' && !isValidFen(pastedFen))
                    ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed opacity-50 shadow-none'
                    : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 hover:scale-[1.01] active:scale-[0.99] text-slate-950 shadow-purple-500/10 cursor-pointer'}`}
              >
                LAUNCH BATTLE ARENA ⚡
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mb-10 animate-fade-in">
          
          {/* LEFT COLUMN: EVALUATION BAR + CHESSBOARD (8 Columns) */}
          <section className="lg:col-span-8 flex flex-col md:flex-row items-stretch gap-4 glass-panel p-4 rounded-3xl border border-white/5 shadow-2xl relative">
            
            {/* Game Over Overlay Modal */}
            {isGameOver && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center z-50 p-6 text-center animate-fade-in">
                <h2 className="text-4xl font-black font-orbitron text-cyan-400 mb-2">MATCH RESOLVED</h2>
                <p className="text-xl font-bold font-outfit mb-6 text-slate-200">{gameResult}</p>
                
                <div className="flex flex-col gap-3">
                  <div className="flex gap-4">
                    <button
                      onClick={() => resetGame()}
                      className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 active:scale-[0.98] text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 font-orbitron tracking-wider cursor-pointer"
                    >
                      REMATCH
                    </button>
                    <button
                      onClick={() => setIsGameStarted(false)}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-bold rounded-xl border border-white/10 font-orbitron tracking-wider cursor-pointer"
                    >
                      NEW MATCH
                    </button>
                  </div>

                  <button
                    onClick={handleDownloadPgn}
                    className="w-full px-6 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 hover:scale-[1.01] active:scale-[0.99] font-bold rounded-xl font-orbitron text-xs tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                  >
                    DOWNLOAD PGN 💾
                  </button>

                  {isChallengeActive && (
                    <button
                      onClick={endChallengeMode}
                      className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-red-400 font-bold rounded-xl border border-red-500/20 font-orbitron tracking-wider cursor-pointer"
                    >
                      END CHALLENGE
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Desktop Real-Time Evaluation Bar */}
            {showEvalBar && (
              <div className={`hidden md:flex ${playerColor === 'w' ? 'md:flex-col-reverse' : 'md:flex-col'} md:w-8 md:h-auto rounded-xl overflow-hidden border border-white/10 relative`}>
                {/* White Winning Score percentage */}
                <div 
                  style={{ height: `${getEvalBarPercentage()}%`, transition: 'height 0.4s ease' }} 
                  className="bg-slate-100 w-full"
                />
                {/* Black Winning Score percentage */}
                <div className="bg-slate-950 w-full flex-1" />
                
                {/* Text score overlay indicator */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="bg-slate-900/90 text-[10px] font-bold font-orbitron px-1.5 py-0.5 rounded border border-white/10 text-cyan-400">
                    {evaluationScore}
                  </span>
                </div>
              </div>
            )}

            {/* Mobile Real-Time Evaluation Bar */}
            {showEvalBar && (
              <div className={`flex ${playerColor === 'w' ? 'flex-row' : 'flex-row-reverse'} w-full h-6 md:hidden rounded-lg overflow-hidden border border-white/10 relative mb-2`}>
                {/* White Winning Score percentage */}
                <div 
                  style={{ width: `${getEvalBarPercentage()}%`, transition: 'width 0.4s ease' }} 
                  className="bg-slate-100 h-full"
                />
                {/* Black Winning Score percentage */}
                <div className="bg-slate-950 h-full flex-1" />
                
                {/* Text score overlay indicator */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="bg-slate-900/90 text-[9px] font-bold font-orbitron px-1.5 py-0.5 rounded border border-white/10 text-cyan-400">
                    Eval: {evaluationScore}
                  </span>
                </div>
              </div>
            )}

            {/* Interactive Core Chessboard Grid */}
            <div className="flex-1 flex flex-col justify-center">
              
              {/* Top Side Bot Badge Timer Header */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isBotThinking ? 'bg-red-500 animate-ping' : 'bg-red-600'}`} />
                  <span className="font-bold font-orbitron text-sm capitalize">
                    {botColor === 'w' ? 'White' : 'Black'} Bot ({opponent === 'Iwantcheckmate' ? botDifficulty : opponent})
                  </span>
                  {isBotThinking && (
                    <span className="text-xs text-red-400 animate-pulse uppercase font-orbitron tracking-widest">(Thinking...)</span>
                  )}
                </div>
                <div className="px-3 py-1 font-orbitron font-bold text-lg bg-slate-950/80 border border-white/10 rounded-lg shadow-inner text-slate-300">
                  {formatClock(clocks[botColor])}
                </div>
              </div>

              {/* Placement Phase Banner Overlay */}
              {isPlacementPhase && (
                <div className="mb-3 px-4 py-3 bg-purple-500/20 border border-purple-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
                  <div className="flex flex-col">
                    <span className="text-purple-400 text-xs font-black font-orbitron animate-pulse">👉 PLACEMENT PHASE ACTIVE</span>
                    <span className="text-xs text-slate-300 font-medium font-outfit mt-0.5">
                      Click empty squares to place or remove your {challengeCount} {challengeTarget.toUpperCase()}(s). Placed: {placedSquares.length}/{challengeCount}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (placedSquares.length === challengeCount) {
                        const finalFen = getChallengeBeatStartingFen(challengeTarget, playerColor, placedSquares);
                        setBoardState(parseFen(finalFen));
                        setFenString(finalFen);
                        setIsPlacementPhase(false);
                      } else {
                        alert(`Please place exactly ${challengeCount} pieces before starting.`);
                      }
                    }}
                    disabled={placedSquares.length !== challengeCount}
                    className={`px-4 py-2 text-xs font-black font-orbitron rounded-lg transition-all cursor-pointer shadow-md
                      ${placedSquares.length === challengeCount 
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-600 hover:scale-105 active:scale-95' 
                        : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'}`}
                  >
                    START BATTLE ⚡
                  </button>
                </div>
              )}

              {/* Review Mode Banner */}
              {reviewIndex !== null && (
                <div className="mb-3 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-xs font-black font-orbitron animate-pulse">● REVIEWING HISTORY</span>
                    <span className="text-xs text-slate-300 font-medium font-outfit">Move {reviewIndex + 1} of {moveHistory.length}</span>
                  </div>
                  <button
                    onClick={() => setReviewIndex(null)}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-[10px] font-black font-orbitron rounded-lg transition-all cursor-pointer"
                  >
                    RESUME LIVE
                  </button>
                </div>
              )}

              {/* The Actual 8x8 Board Container */}
              <div className={`w-full aspect-square grid grid-cols-8 gap-0 rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl shadow-black/50
                ${theme === 'cyber' ? 'animate-cyber-glow' : theme === 'purple' ? 'animate-purple-glow' : ''}
              `}>
                {renderBoardGrid()}

                {/* Pawn Promotion Selection Overlays Modal */}
                {isPromoOpen && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md flex flex-col items-center justify-center z-40 p-4 animate-fade-in">
                    <div className="glass-panel p-6 rounded-2xl border border-white/10 text-center max-w-sm">
                      <h3 className="text-lg font-bold font-orbitron tracking-wider text-cyan-400 mb-4">PAWN PROMOTION</h3>
                      <div className="grid grid-cols-4 gap-4">
                        {['q', 'r', 'b', 'n'].map(p => (
                          <button
                            key={p}
                            onClick={() => handlePromotionSelect(p)}
                            className="p-3 bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400/50 rounded-xl transition-all cursor-pointer aspect-square flex items-center justify-center"
                          >
                            <div className="w-10 h-10">
                              <PieceSvg type={p as any} color={boardState.activeColor} style={pieceStyle} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Side Player Profile Timer Header */}
              <div className="flex justify-between items-center mt-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-xl shadow-md">
                    {userProfile.avatar || '👑'}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-black font-orbitron px-1 py-0.5 rounded border border-cyan-500/30">
                        {userProfile.title}
                      </span>
                      <span className="font-bold font-orbitron text-sm">
                        {userProfile.username} (You)
                      </span>
                      <div className={`w-2 h-2 rounded-full ${boardState.activeColor === (botColor === 'w' ? 'b' : 'w') && !isGameOver ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">ELO: {userProfile.elo}</span>
                  </div>
                </div>
                <div className="px-3 py-1 font-orbitron font-bold text-lg bg-slate-950/80 border border-white/10 rounded-lg shadow-inner text-emerald-400">
                  {formatClock(clocks[botColor === 'w' ? 'b' : 'w'])}
                </div>
              </div>

            </div>
          </section>

          {/* RIGHT COLUMN: CONTROL PANEL & MOVE LOGS (4 Columns) */}
          <section className="lg:col-span-4 flex flex-col gap-6">
            
            {/* TAB SELECTIONS */}
            <div className="grid grid-cols-5 gap-1 p-1 bg-slate-950/80 border border-white/10 rounded-2xl">
              {['match', 'challenge', 'history', 'profile', 'manual'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`py-2 px-1 text-[10px] font-orbitron uppercase tracking-wider font-bold rounded-xl transition-all cursor-pointer
                    ${activeTab === tab 
                      ? (theme === 'cyber' ? 'bg-emerald-500 text-slate-950' : theme === 'purple' ? 'bg-purple-500 text-slate-950' : 'bg-amber-600 text-slate-950')
                      : 'text-slate-400 hover:text-white hover:bg-white/5'}
                  `}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* MATCH PANEL */}
            {activeTab === 'match' && (
              <div className="flex-1 flex flex-col gap-4 glass-panel p-5 rounded-3xl border border-white/5 shadow-2xl">
                <div>
                  <h3 className="text-base font-bold font-orbitron tracking-wider text-cyan-400 mb-1">MATCH CONFIGURATOR</h3>
                  <p className="text-xs text-slate-400 font-outfit">Customize board parameters and AI behavior.</p>
                </div>

                {/* Opponent Selection Indicator */}
                <div className="flex flex-col gap-1.5 bg-slate-950/50 p-3 border border-white/5 rounded-xl">
                  <span className="text-[9px] uppercase font-orbitron tracking-widest text-slate-500">Active Opponent</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold font-orbitron text-cyan-300 capitalize">{opponent}</span>
                    <button 
                      onClick={() => setIsGameStarted(false)}
                      className="text-[10px] font-orbitron font-bold text-cyan-400/80 hover:text-cyan-400 uppercase tracking-wider cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Active Challenge Indicator & Reset */}
                {isChallengeActive && (
                  <div className="flex flex-col gap-1.5 bg-slate-950/50 p-3 border border-white/5 rounded-xl">
                    <span className="text-[9px] uppercase font-orbitron tracking-widest text-slate-500">Active Challenge Count</span>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold font-orbitron text-purple-400 uppercase">{challengeTarget} x {challengeCount}</span>
                      <button 
                        onClick={() => handleChallengeCountChange(1)}
                        className="text-[10px] font-orbitron font-bold text-red-400 hover:text-red-300 uppercase tracking-wider cursor-pointer"
                      >
                        Reset to 1 ↩️
                      </button>
                    </div>
                  </div>
                )}

                {/* Bot Style Select */}
                {opponent === 'Iwantcheckmate' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] uppercase font-orbitron tracking-wider text-slate-400">AI Play Bucket (Difficulty)</label>
                    <div className="grid grid-cols-4 gap-1">
                      {['Bullet', 'Blitz', 'Rapid', 'Classical'].map(b => (
                        <button
                          key={b}
                          onClick={() => setBotDifficulty(b)}
                          className={`py-1.5 px-1 text-xs font-bold rounded-lg border transition-all cursor-pointer
                            ${botDifficulty === b 
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                              : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Time Control Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] uppercase font-orbitron tracking-wider text-slate-400">
                    <span>Match Time Control</span>
                    <span className="text-cyan-400 font-bold">{Math.floor(timeControl / 60)} Min</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="1800"
                    step="60"
                    value={timeControl}
                    onChange={(e) => handleTimeControlChange(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Board Themes Customizations */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-orbitron tracking-wider text-slate-400">Arena Grid Theme</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['cyber', 'purple', 'classic'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`py-1 text-xs capitalize rounded-lg border transition-all cursor-pointer
                          ${theme === t 
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Piece Style Customizations */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-orbitron tracking-wider text-slate-400">Chess Piece Style</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['classic', 'neon', 'wood'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPieceStyle(p)}
                        className={`py-1 text-xs capitalize rounded-lg border transition-all cursor-pointer
                          ${pieceStyle === p 
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Evaluation Bar Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-950/30 border border-white/5 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold font-orbitron text-slate-300">Evaluation Bar</span>
                    <span className="text-[10px] text-slate-500 font-outfit">Toggle live Stockfish analysis</span>
                  </div>
                  <button
                    onClick={() => setShowEvalBar(!showEvalBar)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-black uppercase transition-all cursor-pointer border
                      ${showEvalBar 
                        ? 'bg-purple-500/20 border-purple-400 text-purple-300' 
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                  >
                    {showEvalBar ? 'ACTIVE' : 'MUTED'}
                  </button>
                </div>

                <div className="h-px bg-white/5 my-1" />

                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <button
                    onClick={() => setIsGameStarted(false)}
                    className="col-span-2 py-2.5 px-4 bg-slate-950 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-900 active:scale-95 transition-all rounded-xl font-bold font-orbitron tracking-wider text-[10px] cursor-pointer"
                  >
                    ← LEAVE / SETUP MATCH
                  </button>
                  <button
                    onClick={() => resetGame()}
                    className="py-2.5 px-4 bg-slate-900 border border-white/15 text-slate-300 hover:bg-slate-800 active:scale-95 transition-all rounded-xl font-bold font-orbitron tracking-wider text-[11px] cursor-pointer"
                  >
                    RESET
                  </button>
                  <button
                    onClick={() => {
                      const flip = botColor === 'w' ? 'b' : 'w';
                      setBotColor(flip);
                      resetGame();
                    }}
                    className="py-2.5 px-4 bg-cyan-500 hover:bg-cyan-600 text-slate-950 active:scale-95 transition-all rounded-xl font-bold font-orbitron tracking-wider text-[11px] cursor-pointer"
                  >
                    FLIP COLOR
                  </button>
                </div>
              </div>
            )}

            {/* CHALLENGE PANEL */}
            {activeTab === 'challenge' && (
              <div className="flex-1 flex flex-col gap-4 glass-panel p-5 rounded-3xl border border-white/5 shadow-2xl">
                <div>
                  <h3 className="text-base font-bold font-orbitron tracking-wider text-cyan-400 mb-1">PIECE CHALLENGES</h3>
                  <p className="text-xs text-slate-400 font-outfit">Play programmatic asymmetric endgame challenges.</p>
                </div>

                {/* Challenge Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-orbitron tracking-wider text-slate-400">Objective Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setChallengeMode('challenge_beat')}
                      className={`p-3 rounded-xl border flex flex-col gap-1 text-left transition-all cursor-pointer
                        ${challengeMode === 'challenge_beat' 
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                          : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                      <span className="text-xs font-bold font-orbitron">Beat Army</span>
                      <span className="text-[9px] opacity-75 font-outfit">Defeat N pieces</span>
                    </button>
                    <button
                      onClick={() => setChallengeMode('challenge_lose')}
                      className={`p-3 rounded-xl border flex flex-col gap-1 text-left transition-all cursor-pointer
                        ${challengeMode === 'challenge_lose' 
                          ? 'bg-purple-950/40 border-purple-500 text-purple-300' 
                          : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                      <span className="text-xs font-bold font-orbitron">Lose to Army</span>
                      <span className="text-[9px] opacity-75 font-outfit">Lose to N pieces</span>
                    </button>
                  </div>
                </div>

                {/* Target Piece Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-orbitron tracking-wider text-slate-400">Target Piece Type</label>
                  <div className="grid grid-cols-5 gap-1">
                    {['q', 'r', 'b', 'n', 'p'].map(p => (
                      <button
                        key={p}
                        onClick={() => setChallengeTarget(p as any)}
                        className={`py-2 text-xs font-bold rounded-lg border uppercase transition-all cursor-pointer
                          ${challengeTarget === p 
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Piece Quantity */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] uppercase font-orbitron tracking-wider text-slate-400">
                    <span>Piece Quantity (N)</span>
                    <span className="text-cyan-400 font-bold">{challengeCount} Pieces</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={challengeCount}
                    onChange={(e) => setChallengeCount(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div className="h-px bg-white/5 my-1" />

                <div className="grid grid-cols-2 gap-3 mt-auto">
                  {isChallengeActive && (
                    <button
                      onClick={endChallengeMode}
                      className="py-3 px-4 bg-slate-950 border border-white/10 text-red-400 hover:bg-slate-900 active:scale-95 transition-all rounded-xl font-bold font-orbitron tracking-wider text-xs cursor-pointer"
                    >
                      END MODE
                    </button>
                  )}
                  <button
                    onClick={startChallenge}
                    className={`py-3 px-4 active:scale-95 transition-all rounded-xl font-bold font-orbitron tracking-wider text-xs cursor-pointer
                      ${isChallengeActive ? 'col-span-1 bg-emerald-500 text-slate-950 hover:bg-emerald-600' : 'col-span-2 bg-emerald-500 text-slate-950 hover:bg-emerald-600'}
                    `}
                  >
                    START CHALLENGE
                  </button>
                </div>
              </div>
            )}

            {/* HISTORY LOGS */}
            {activeTab === 'history' && (
              <div className="flex-1 flex flex-col gap-4 glass-panel p-5 rounded-3xl border border-white/5 shadow-2xl min-h-[380px]">
                <div>
                  <h3 className="text-base font-bold font-orbitron tracking-wider text-cyan-400 mb-1">MOVE LOGS</h3>
                  <p className="text-xs text-slate-400 font-outfit">Real-time move history logs.</p>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-950/65 rounded-xl border border-white/5 p-3 flex flex-col gap-1.5">
                  {moveHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                      <span>No moves played yet.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm font-mono text-slate-300">
                      {Array(Math.ceil(moveHistory.length / 2)).fill(null).map((_, idx) => {
                        const whiteIdx = idx * 2;
                        const blackIdx = idx * 2 + 1;
                        return (
                          <React.Fragment key={idx}>
                            <div className="flex gap-2">
                              <span className="text-slate-500 font-orbitron text-[11px] w-6 text-right font-bold">
                                {idx + 1}.
                              </span>
                              <span 
                                className={`font-bold transition-colors cursor-pointer ${reviewIndex === whiteIdx ? 'text-amber-400 font-extrabold' : 'text-white hover:text-cyan-400'}`} 
                                onClick={() => setReviewIndex(whiteIdx)}
                              >
                                {moveHistory[whiteIdx].san}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {moveHistory[blackIdx] && (
                                <span 
                                  className={`transition-colors cursor-pointer ${reviewIndex === blackIdx ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-white'}`} 
                                  onClick={() => setReviewIndex(blackIdx)}
                                >
                                  {moveHistory[blackIdx].san}
                                </span>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* PGN Exports */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <button
                    onClick={handleCopyPgn}
                    className="py-2.5 px-3 bg-slate-950 border border-white/10 hover:text-white hover:bg-slate-900 active:scale-95 transition-all rounded-xl font-bold font-orbitron text-[10px] uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Copy PGN 📋
                  </button>
                  <button
                    onClick={handleDownloadPgn}
                    className="py-2.5 px-3 bg-purple-500/20 border border-purple-400/50 hover:bg-purple-500/30 active:scale-95 transition-all rounded-xl font-bold font-orbitron text-[10px] uppercase tracking-wider text-purple-300 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Download PGN 💾
                  </button>
                </div>
              </div>
            )}

            {/* PROFILE CUSTOMIZER */}
            {activeTab === 'profile' && (
              <div className="flex-1 flex flex-col gap-4 glass-panel p-5 rounded-3xl border border-white/5 shadow-2xl">
                <div>
                  <h3 className="text-base font-bold font-orbitron tracking-wider text-cyan-400 mb-1">USER PROFILE</h3>
                  <p className="text-xs text-slate-400 font-outfit">Track stats and configure profile metadata.</p>
                </div>

                <div className="bg-slate-950/65 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-cyan-500/20 border-2 border-cyan-400/80 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg shadow-cyan-400/10">
                      {userProfile.avatar || '👑'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold font-orbitron text-emerald-400 uppercase tracking-widest bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-900/40">
                          {userProfile.title}
                        </span>
                        <h4 className="text-lg font-bold font-orbitron text-white leading-tight">{userProfile.username}</h4>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-1">ELO Rating: <span className="text-cyan-300 font-bold">{userProfile.elo}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                      <span className="text-[9px] uppercase font-orbitron tracking-wider text-slate-400">Current Streak</span>
                      <div className="text-lg font-bold font-orbitron text-emerald-400">{userProfile.streak} Wins</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                      <span className="text-[9px] uppercase font-orbitron tracking-wider text-slate-400">Global Title</span>
                      <div className="text-lg font-bold font-orbitron text-purple-400">{userProfile.elo >= 1600 ? 'Super GM' : 'National Master'}</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { 
                    setShowProfileEdit(true); 
                    setProfileNameInput(userProfile.username); 
                    setProfileTitleInput(userProfile.title); 
                    setProfileEloInput(userProfile.elo);
                    setProfileAvatarInput(userProfile.avatar ?? '👑');
                  }}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 active:scale-95 transition-all text-slate-950 font-bold rounded-xl font-orbitron tracking-wider text-xs shadow-lg shadow-cyan-500/10 cursor-pointer"
                >
                  EDIT PROFILE METADATA
                </button>
              </div>
            )}

            {/* USER MANUAL & GUIDE */}
            {activeTab === 'manual' && (
              <div className="flex-1 flex flex-col gap-4 glass-panel p-5 rounded-3xl border border-white/5 shadow-2xl max-h-[550px] overflow-y-auto custom-scrollbar">
                <div>
                  <h3 className="text-base font-bold font-orbitron tracking-wider text-purple-400 mb-1">ARENA MANUAL & GUIDE</h3>
                  <p className="text-xs text-slate-400 font-outfit">Detailed instructions and gameplay configurations.</p>
                </div>

                <div className="flex flex-col gap-4 text-xs text-slate-300 font-outfit">
                  {/* Overview */}
                  <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                    <h4 className="font-bold font-orbitron text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>👑</span> Welcome to the Arena
                    </h4>
                    <p className="opacity-90 leading-relaxed">
                      This arena hosts standard and custom chess challenges powered by specialized neural engines, custom evaluation fallback matrices, and precise tactile audio synthesizing.
                    </p>
                  </div>

                  {/* Piece Challenge Formats */}
                  <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                    <h4 className="font-bold font-orbitron text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚔️</span> Special Challenge Formats
                    </h4>
                    <div className="flex flex-col gap-2.5">
                      <div className="border-l-2 border-purple-500/30 pl-3">
                        <span className="block font-bold text-slate-200">How Many to Beat (challenge_beat)</span>
                        <p className="opacity-80 mt-0.5 leading-relaxed">
                          You select a target piece type (Queen, Rook, Bishop, Knight, Pawn) and starting count <span className="text-purple-400 font-mono">N</span>. 
                          You enter a pre-match <span className="text-purple-400 font-bold">Placement Phase</span> where you can drop those <span className="text-purple-400 font-mono">N</span> pieces onto empty squares.
                          Every time you <span className="text-red-400 font-bold">lose</span>, the piece count increments next match to give you more power. Win to complete!
                        </p>
                      </div>
                      <div className="border-l-2 border-purple-500/30 pl-3">
                        <span className="block font-bold text-slate-200">How Many to Lose To (challenge_lose)</span>
                        <p className="opacity-80 mt-0.5 leading-relaxed">
                          The bot starts with an asymmetric army composed only of a King + <span className="text-purple-400 font-mono">N</span> pieces of your chosen type, while you play with a standard setup.
                          Every game you <span className="text-emerald-400 font-bold">win</span>, the bot gets stronger by gaining another piece next round. The goal is to survive as many games as possible!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AI Bot Profiles */}
                  <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                    <h4 className="font-bold font-orbitron text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🤖</span> The AI Bot Competitors
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="font-bold text-cyan-300 font-orbitron block">🧠 IWantCheckmate</span>
                        <p className="opacity-85 mt-1 leading-relaxed">
                          Utilizes local move probability distributions and pre-trained ONNX models. Evaluates with a hybrid pipeline (Online API, Local WASM, and Material backup).
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="font-bold text-amber-500 font-orbitron block">🤡 Blunderboss</span>
                        <p className="opacity-85 mt-1 leading-relaxed">
                          An ironic challenger. It evaluates legal chess positions and plays the worst legal move that avoids immediate self-mate or relative evaluation drops of -10, ensuring high-paced tactical blunder recognition.
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="font-bold text-purple-400 font-orbitron block">⚖️ Drawfish</span>
                        <p className="opacity-85 mt-1 leading-relaxed">
                          Your goal is to win; its goal is to draw. Drawfish selects moves specifically designed to bring the position evaluation as close to <span className="text-purple-300 font-mono font-bold">0.00</span> as possible.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tactile & Clock Systems */}
                  <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                    <h4 className="font-bold font-orbitron text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⏱️</span> Drift-Proof Clock & Synth Audio
                    </h4>
                    <p className="opacity-90 leading-relaxed">
                      Our timers calculate true delta-time elapsed between system frames, bypassing browser thread delay. Soundscapes for moves, checks, and game terminations are synthesized live using the Web Audio API.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </section>
        </main>
      )}

      {/* --- FOOTER SPEC INFO PANEL --- */}
      <footer className="w-full max-w-6xl mt-auto py-4 px-6 text-center text-xs text-slate-500 border-t border-white/5">
        <p className="font-orbitron tracking-widest uppercase text-[10px] text-slate-400">IWantCheckmate Chess Variant Arena © 2026</p>
        <p className="font-outfit text-[11px] mt-1 text-slate-500">Live Hybrid Evaluation pipeline utilizing Online Stockfish 10 & programmatically synthesized Web Audio triggers.</p>
      </footer>

      {/* --- PROFILE EDIT MODAL POPUP --- */}
      {showProfileEdit && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 rounded-3xl border border-white/10 w-full max-w-md flex flex-col gap-4 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold font-orbitron tracking-wider text-cyan-400">EDIT PROFILE METADATA</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left side inputs */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-orbitron tracking-wider text-slate-400">Username</label>
                  <input
                    type="text"
                    maxLength={14}
                    value={profileNameInput}
                    onChange={(e) => setProfileNameInput(e.target.value)}
                    className="bg-slate-950 border border-white/10 text-slate-100 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-cyan-400 font-orbitron"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-orbitron tracking-wider text-slate-400">Title Initials</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={profileTitleInput}
                    onChange={(e) => setProfileTitleInput(e.target.value.toUpperCase())}
                    className="bg-slate-950 border border-white/10 text-slate-100 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-cyan-400 font-orbitron uppercase"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] uppercase font-orbitron tracking-wider text-slate-400">
                    <span>Rating ELO</span>
                    <span className="text-cyan-400 font-bold font-mono">{profileEloInput}</span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="3200"
                    step="50"
                    value={profileEloInput}
                    onChange={(e) => setProfileEloInput(parseInt(e.target.value, 10))}
                    className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 mt-1"
                  />
                </div>
              </div>

              {/* Right side avatar selection */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] uppercase font-orbitron tracking-wider text-slate-400">Select Avatar / DP</span>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-2 rounded-2xl border border-white/5 max-h-[120px] overflow-y-auto custom-scrollbar">
                  {AVAILABLE_AVATARS.map(avatar => (
                    <button
                      key={avatar}
                      onClick={() => setProfileAvatarInput(avatar)}
                      className={`text-lg p-1.5 rounded-xl transition-all aspect-square flex items-center justify-center cursor-pointer
                        ${profileAvatarInput === avatar 
                          ? 'bg-cyan-500/20 border border-cyan-400 scale-105 shadow-md shadow-cyan-500/10' 
                          : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 bg-cyan-500/5 px-2.5 py-1.5 rounded-xl border border-cyan-400/15 mt-1">
                  <span className="text-xl">{profileAvatarInput}</span>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-orbitron uppercase text-cyan-300">Avatar Selection</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => setShowProfileEdit(false)}
                className="py-2.5 px-4 bg-slate-900 border border-white/10 hover:bg-slate-800 active:scale-95 rounded-xl font-bold font-orbitron text-xs text-slate-400 hover:text-white cursor-pointer transition-all text-center"
              >
                CANCEL
              </button>
              <button
                onClick={saveProfileEdit}
                className="py-2.5 px-4 bg-cyan-500 hover:bg-cyan-600 active:scale-95 rounded-xl font-bold font-orbitron text-xs text-slate-950 cursor-pointer transition-all text-center"
              >
                SAVE CHANGES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- INITIAL ONBOARDING MODAL --- */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
          <div className="glass-panel p-8 rounded-3xl border-2 border-cyan-500/20 w-full max-w-lg shadow-2xl shadow-cyan-500/10 animate-fade-in flex flex-col gap-6">
            <div className="text-center">
              <div className="text-4xl mb-2 animate-bounce">⚔️</div>
              <h2 className="text-2xl font-black font-orbitron tracking-wider text-cyan-400">ARENA ONBOARDING</h2>
              <p className="text-xs text-slate-400 mt-1 font-outfit">Initialize your digital identity in the Chess Variant Arena.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Fields */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-orbitron tracking-wider text-slate-400">Username</label>
                  <input
                    type="text"
                    maxLength={14}
                    value={onboardingName}
                    onChange={(e) => setOnboardingName(e.target.value)}
                    className="bg-slate-900 border border-white/10 text-slate-100 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-cyan-400 font-orbitron"
                    placeholder="Enter Username"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-orbitron tracking-wider text-slate-400">Title Initials (e.g. GM, IM)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={onboardingTitle}
                    onChange={(e) => setOnboardingTitle(e.target.value.toUpperCase())}
                    className="bg-slate-900 border border-white/10 text-slate-100 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-cyan-400 font-orbitron uppercase"
                    placeholder="GM"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] uppercase font-orbitron tracking-wider text-slate-400">
                    <span>Starting Rating</span>
                    <span className="text-cyan-400 font-bold font-mono">{onboardingElo} ELO</span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="3200"
                    step="50"
                    value={onboardingElo}
                    onChange={(e) => setOnboardingElo(parseInt(e.target.value, 10))}
                    className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 mt-1"
                  />
                </div>
              </div>

              {/* Right Column: Avatar DP Selection */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-orbitron tracking-wider text-slate-400">Select Avatar / DP</span>
                <div className="grid grid-cols-4 gap-2 bg-slate-900/60 p-2.5 rounded-2xl border border-white/5 max-h-[140px] overflow-y-auto custom-scrollbar">
                  {AVAILABLE_AVATARS.map(avatar => (
                    <button
                      key={avatar}
                      onClick={() => setOnboardingAvatar(avatar)}
                      className={`text-xl p-2 rounded-xl transition-all aspect-square flex items-center justify-center cursor-pointer
                        ${onboardingAvatar === avatar 
                          ? 'bg-cyan-500/20 border border-cyan-400 scale-105 shadow-md shadow-cyan-500/10' 
                          : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex items-center gap-2 bg-cyan-500/5 px-3 py-2 rounded-xl border border-cyan-400/20">
                  <span className="text-2xl">{onboardingAvatar}</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-orbitron uppercase text-cyan-300">Active Avatar</span>
                    <span className="text-[9px] text-slate-400">Will be shown on the board & stats card.</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleOnboardingSubmit}
              className="w-full py-3 bg-gradient-to-r from-cyan-400 to-teal-500 hover:from-cyan-500 hover:to-teal-600 active:scale-[0.98] transition-all text-slate-950 font-black rounded-xl font-orbitron tracking-widest text-xs shadow-lg shadow-cyan-500/15 cursor-pointer mt-2"
            >
              INITIALIZE IDENT CARD 💳
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
