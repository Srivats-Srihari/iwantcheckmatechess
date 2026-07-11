import React from 'react';
import { PieceType, Color } from '../utils/chess';

interface PieceSvgProps {
  type: PieceType;
  color: Color;
  style?: 'classic' | 'neon' | 'wood';
  className?: string;
}

export const PieceSvg: React.FC<PieceSvgProps> = ({ type, color, style = 'classic', className = '' }) => {
  const isWhite = color === 'w';

  // Gradient IDs
  const gradId = `${color}-${type}-${style}`;

  // Styles Definition
  let stroke = '';
  let fill = '';
  let filter = '';

  if (style === 'neon') {
    // Cyberpunk Neon style
    stroke = isWhite ? '#06b6d4' : '#10b981'; // Cyan for White, Emerald Green for Black
    fill = isWhite ? 'rgba(6, 182, 212, 0.15)' : 'rgba(16, 185, 129, 0.1)';
    filter = isWhite ? 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8))' : 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.8))';
  } else if (style === 'wood') {
    // Warm Wood Style
    stroke = isWhite ? '#854d0e' : '#451a03'; // Dark brown for White, charcoal brown for Black
    fill = `url(#grad-${gradId})`;
  } else {
    // Classic style
    stroke = isWhite ? '#1e293b' : '#0f172a'; // Deep slate
    fill = isWhite ? '#f8fafc' : '#334155'; // Clean white vs charcoal slate
  }

  // Common Gradients for Wood & Classic
  const renderGradients = () => {
    if (style === 'wood') {
      return (
        <defs>
          <radialGradient id={`grad-${gradId}`} cx="50%" cy="40%" r="50%">
            {isWhite ? (
              <>
                <stop offset="0%" stopColor="#fef08a" /> {/* Maple / Light Birch */}
                <stop offset="60%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#ca8a04" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#78350f" /> {/* Dark Walnut */}
                <stop offset="70%" stopColor="#451a03" />
                <stop offset="100%" stopColor="#1c1917" />
              </>
            )}
          </radialGradient>
        </defs>
      );
    }
    return null;
  };

  // SVG Paths for iconic, modern chess pieces
  const getPiecePath = () => {
    switch (type) {
      case 'p': // Pawn
        return (
          <g>
            {/* Pedestal */}
            <path d="M 12,42 L 36,42 L 33,38 L 15,38 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Body */}
            <path d="M 17,38 C 17,30 20,28 21,20 C 19,20 18,19 18,18 C 18,17 19,16 21,16 C 22,16 23,17 23,18 C 23,19 22,20 21,20 C 23,28 27,28 27,20 C 25,20 24,19 24,18 C 24,17 25,16 27,16 C 28,16 29,17 29,18 C 29,19 28,20 27,20 C 28,28 31,30 31,38 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Head Sphere */}
            <circle cx="24" cy="12" r="6" stroke={stroke} fill={fill} strokeWidth="2.5" />
          </g>
        );

      case 'r': // Rook
        return (
          <g>
            {/* Base */}
            <path d="M 10,42 L 38,42 L 36,36 L 12,36 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Body */}
            <path d="M 14,36 L 17,18 L 31,18 L 34,36 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Crenellations (Castle Tops) */}
            <path d="M 14,18 L 14,11 L 18,11 L 18,14 L 22,11 L 26,11 L 26,14 L 30,11 L 34,11 L 34,18 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'n': // Knight (Horse)
        return (
          <g>
            {/* Base */}
            <path d="M 10,42 L 38,42 L 36,38 L 12,38 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Horse Head and Mane */}
            <path d="M 12,38 C 12,32 15,26 18,22 C 16,21 13,21 11,23 C 11,20 13,16 17,14 C 17,12 18,8 20,8 C 21,8 21,11 21,11 C 23,9 25,7 28,7 C 32,7 34,9 34,13 C 34,17 31,21 31,23 C 33,24 35,27 35,31 C 35,36 30,38 28,38 C 23,38 18,36 15,38 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Eye */}
            <circle cx="28" cy="13" r="1.5" fill={stroke} />
            {/* Mouth line */}
            <path d="M 13,29 C 15,29 17,31 18,32" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );

      case 'b': // Bishop
        return (
          <g>
            {/* Base */}
            <path d="M 11,42 L 37,42 L 34,38 L 14,38 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Oval Mitre Body */}
            <path d="M 14,38 C 12,32 15,22 24,11 C 33,22 36,32 34,38 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Slit (traditional Bishop cut) */}
            <path d="M 21,18 L 27,24" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
            {/* Top cross / ball */}
            <circle cx="24" cy="9" r="2.5" stroke={stroke} fill={fill} strokeWidth="1.5" />
          </g>
        );

      case 'q': // Queen
        return (
          <g>
            {/* Base */}
            <path d="M 10,42 L 38,42 L 36,38 L 12,38 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Body */}
            <path d="M 13,38 C 13,32 18,24 24,24 C 30,24 35,32 35,38 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Coronet Spikes */}
            <path d="M 12,24 L 14,14 L 19,21 L 24,10 L 29,21 L 34,14 L 36,24 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Jewels on crown spikes */}
            <circle cx="14" cy="12" r="1.5" stroke={stroke} fill={fill} strokeWidth="1.5" />
            <circle cx="24" cy="8" r="1.5" stroke={stroke} fill={fill} strokeWidth="1.5" />
            <circle cx="34" cy="12" r="1.5" stroke={stroke} fill={fill} strokeWidth="1.5" />
          </g>
        );

      case 'k': // King
        return (
          <g>
            {/* Base */}
            <path d="M 10,42 L 38,42 L 36,38 L 12,38 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Crown Base */}
            <path d="M 14,38 C 14,30 18,22 24,22 C 30,22 34,30 34,38 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* King Crown */}
            <path d="M 13,24 C 15,20 18,20 21,24 C 22,21 26,21 27,24 C 30,20 33,20 35,24 L 33,30 L 15,30 Z" stroke={stroke} fill={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Cross on top */}
            <path d="M 24,18 L 24,10" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 21,13 L 27,13" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      style={{
        filter: filter,
        transition: 'filter 0.3s ease',
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    >
      {renderGradients()}
      {getPiecePath()}
    </svg>
  );
};
export default PieceSvg;
