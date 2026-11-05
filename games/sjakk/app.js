/**
 * Sjakk – 2-Player Party Chess for NTNU Games
 * Complete chess engine, Web Audio effects, 1-device pass & play,
 * and real-time party room multiplayer.
 */

(() => {
  "use strict";

  // --- Sound Synthesizer (Web Audio API) ---
  const soundEngine = {
    ctx: null,
    enabled: true,

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    },

    playMove() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
      } catch (_) {}
    },

    playCapture() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(480, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (_) {}
    },

    playCheck() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        [580, 880].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.18, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.07 + 0.14);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.14);
        });
      } catch (_) {}
    },

    playVictory() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.3, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.25);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.25);
        });
      } catch (_) {}
    },
  };

  // --- Initial Chess Setup ---
  // Uppercase = White, Lowercase = Black
  const STARTING_BOARD = [
    ["r", "n", "b", "q", "k", "b", "n", "r"], // rank 8
    ["p", "p", "p", "p", "p", "p", "p", "p"], // rank 7
    [null, null, null, null, null, null, null, null], // rank 6
    [null, null, null, null, null, null, null, null], // rank 5
    [null, null, null, null, null, null, null, null], // rank 4
    [null, null, null, null, null, null, null, null], // rank 3
    ["P", "P", "P", "P", "P", "P", "P", "P"], // rank 2
    ["R", "N", "B", "Q", "K", "B", "N", "R"], // rank 1
  ];

  const PIECE_VALUES = {
    p: 1, P: 1,
    n: 3, N: 3,
    b: 3, B: 3,
    r: 5, R: 5,
    q: 9, Q: 9,
    k: 0, K: 0,
  };

  // --- Engine State ---
  class ChessGame {
    constructor() {
      this.reset();
    }

    reset() {
      this.board = STARTING_BOARD.map((row) => [...row]);
      this.turn = "w"; // 'w' or 'b'
      this.castling = {
        wK: true, // white kingside
        wQ: true, // white queenside
        bK: true, // black kingside
        bQ: true, // black queenside
      };
      this.enPassantTarget = null; // { r, c }
      this.halfmoveClock = 0;
      this.fullmoveNumber = 1;
      this.history = []; // stack of { from, to, piece, captured, flags, castling, enPassantTarget, san }
      this.capturedWhite = []; // black pieces captured by white
      this.capturedBlack = []; // white pieces captured by black
      this.positionHistory = {}; // FEN -> count
      this.recordPosition();
    }

    recordPosition() {
      const fen = this.getBoardFEN();
      this.positionHistory[fen] = (this.positionHistory[fen] || 0) + 1;
    }

    getBoardFEN() {
      let fen = "";
      for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (!p) {
            empty++;
          } else {
            if (empty > 0) {
              fen += empty;
              empty = 0;
            }
            fen += p;
          }
        }
        if (empty > 0) fen += empty;
        if (r < 7) fen += "/";
      }
      fen += ` ${this.turn}`;
      return fen;
    }

    clone() {
      const g = new ChessGame();
      g.board = this.board.map((row) => [...row]);
      g.turn = this.turn;
      g.castling = { ...this.castling };
      g.enPassantTarget = this.enPassantTarget ? { ...this.enPassantTarget } : null;
      g.halfmoveClock = this.halfmoveClock;
      g.fullmoveNumber = this.fullmoveNumber;
      return g;
    }

    isWhite(piece) {
      return piece && piece === piece.toUpperCase();
    }

    isBlack(piece) {
      return piece && piece === piece.toLowerCase();
    }

    getColor(piece) {
      if (!piece) return null;
      return this.isWhite(piece) ? "w" : "b";
    }

    isSquareAttacked(r, c, attackerColor) {
      // Check knights
      const knightOffsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      const targetKnight = attackerColor === "w" ? "N" : "n";
      for (const [dr, dc] of knightOffsets) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          if (this.board[nr][nc] === targetKnight) return true;
        }
      }

      // Check pawns
      const pawnDir = attackerColor === "w" ? 1 : -1; // row offset from attacker's pawn to attacked square
      const targetPawn = attackerColor === "w" ? "P" : "p";
      const pr = r + pawnDir;
      if (pr >= 0 && pr < 8) {
        if (c - 1 >= 0 && this.board[pr][c - 1] === targetPawn) return true;
        if (c + 1 < 8 && this.board[pr][c + 1] === targetPawn) return true;
      }

      // Check king
      const targetKing = attackerColor === "w" ? "K" : "k";
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const kr = r + dr, kc = c + dc;
          if (kr >= 0 && kr < 8 && kc >= 0 && kc < 8) {
            if (this.board[kr][kc] === targetKing) return true;
          }
        }
      }

      // Check orthogonals (Rook, Queen)
      const targetRook = attackerColor === "w" ? "R" : "r";
      const targetQueen = attackerColor === "w" ? "Q" : "q";
      const orthDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of orthDirs) {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const p = this.board[nr][nc];
          if (p) {
            if (p === targetRook || p === targetQueen) return true;
            break;
          }
          nr += dr;
          nc += dc;
        }
      }

      // Check diagonals (Bishop, Queen)
      const targetBishop = attackerColor === "w" ? "B" : "b";
      const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of diagDirs) {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const p = this.board[nr][nc];
          if (p) {
            if (p === targetBishop || p === targetQueen) return true;
            break;
          }
          nr += dr;
          nc += dc;
        }
      }

      return false;
    }

    findKing(color) {
      const target = color === "w" ? "K" : "k";
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (this.board[r][c] === target) return { r, c };
        }
      }
      return null;
    }

    isInCheck(color = this.turn) {
      const kingPos = this.findKing(color);
      if (!kingPos) return false;
      const opponentColor = color === "w" ? "b" : "w";
      return this.isSquareAttacked(kingPos.r, kingPos.c, opponentColor);
    }

    generatePseudoLegalMoves(color = this.turn) {
      const moves = [];
      const isW = color === "w";

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (!p || this.getColor(p) !== color) continue;

          const type = p.toUpperCase();

          // 1. PAWN
          if (type === "P") {
            const dir = isW ? -1 : 1;
            const startRank = isW ? 6 : 1;
            const promoRank = isW ? 0 : 7;

            // 1 step forward
            const r1 = r + dir;
            if (r1 >= 0 && r1 < 8 && !this.board[r1][c]) {
              if (r1 === promoRank) {
                ["Q", "R", "B", "N"].forEach((promo) => {
                  moves.push({ from: { r, c }, to: { r: r1, c }, piece: p, promo });
                });
              } else {
                moves.push({ from: { r, c }, to: { r: r1, c }, piece: p });

                // 2 steps forward from initial rank
                const r2 = r + 2 * dir;
                if (r === startRank && !this.board[r2][c]) {
                  moves.push({ from: { r, c }, to: { r: r2, c }, piece: p, isDoublePawn: true });
                }
              }
            }

            // Diagonal captures
            for (const dc of [-1, 1]) {
              const nc = c + dc;
              if (nc >= 0 && nc < 8 && r1 >= 0 && r1 < 8) {
                const targetPiece = this.board[r1][nc];
                if (targetPiece && this.getColor(targetPiece) !== color) {
                  if (r1 === promoRank) {
                    ["Q", "R", "B", "N"].forEach((promo) => {
                      moves.push({ from: { r, c }, to: { r: r1, c: nc }, piece: p, promo });
                    });
                  } else {
                    moves.push({ from: { r, c }, to: { r: r1, c: nc }, piece: p });
                  }
                } else if (
                  this.enPassantTarget &&
                  this.enPassantTarget.r === r1 &&
                  this.enPassantTarget.c === nc
                ) {
                  moves.push({ from: { r, c }, to: { r: r1, c: nc }, piece: p, isEnPassant: true });
                }
              }
            }
          }

          // 2. KNIGHT
          else if (type === "N") {
            const offsets = [
              [-2, -1], [-2, 1], [-1, -2], [-1, 2],
              [1, -2], [1, 2], [2, -1], [2, 1],
            ];
            for (const [dr, dc] of offsets) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = this.board[nr][nc];
                if (!target || this.getColor(target) !== color) {
                  moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                }
              }
            }
          }

          // 3. BISHOP & QUEEN (Diagonals)
          if (type === "B" || type === "Q") {
            const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
            for (const [dr, dc] of dirs) {
              let nr = r + dr, nc = c + dc;
              while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = this.board[nr][nc];
                if (!target) {
                  moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                } else {
                  if (this.getColor(target) !== color) {
                    moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                  }
                  break;
                }
                nr += dr;
                nc += dc;
              }
            }
          }

          // 4. ROOK & QUEEN (Orthogonals)
          if (type === "R" || type === "Q") {
            const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of dirs) {
              let nr = r + dr, nc = c + dc;
              while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = this.board[nr][nc];
                if (!target) {
                  moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                } else {
                  if (this.getColor(target) !== color) {
                    moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                  }
                  break;
                }
                nr += dr;
                nc += dc;
              }
            }
          }

          // 5. KING
          else if (type === "K") {
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                  const target = this.board[nr][nc];
                  if (!target || this.getColor(target) !== color) {
                    moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                  }
                }
              }
            }

            // Castling
            const oppColor = isW ? "b" : "w";
            if (!this.isInCheck(color)) {
              // Kingside castling
              const canKingside = isW ? this.castling.wK : this.castling.bK;
              const rookSquare = isW ? this.board[7][7] : this.board[0][7];
              const expectedRook = isW ? "R" : "r";
              if (
                canKingside &&
                rookSquare === expectedRook &&
                !this.board[r][5] &&
                !this.board[r][6] &&
                !this.isSquareAttacked(r, 5, oppColor) &&
                !this.isSquareAttacked(r, 6, oppColor)
              ) {
                moves.push({ from: { r, c }, to: { r, c: 6 }, piece: p, isCastling: "K" });
              }

              // Queenside castling
              const canQueenside = isW ? this.castling.wQ : this.castling.bQ;
              const qRookSquare = isW ? this.board[7][0] : this.board[0][0];
              if (
                canQueenside &&
                qRookSquare === expectedRook &&
                !this.board[r][1] &&
                !this.board[r][2] &&
                !this.board[r][3] &&
                !this.isSquareAttacked(r, 3, oppColor) &&
                !this.isSquareAttacked(r, 2, oppColor)
              ) {
                moves.push({ from: { r, c }, to: { r, c: 2 }, piece: p, isCastling: "Q" });
              }
            }
          }
        }
      }

      return moves;
    }

    getLegalMoves(color = this.turn) {
      const pseudo = this.generatePseudoLegalMoves(color);
      return pseudo.filter((m) => {
        const sim = this.clone();
        sim.applyMoveInternal(m);
        return !sim.isInCheck(color);
      });
    }

    applyMoveInternal(move) {
      const { from, to, piece, promo, isEnPassant, isCastling, isDoublePawn } = move;

      // Update castling rights if King moves
      if (piece === "K") {
        this.castling.wK = false;
        this.castling.wQ = false;
      } else if (piece === "k") {
        this.castling.bK = false;
        this.castling.bQ = false;
      }

      // Update castling rights if Rook moves
      if (piece === "R") {
        if (from.r === 7 && from.c === 0) this.castling.wQ = false;
        if (from.r === 7 && from.c === 7) this.castling.wK = false;
      } else if (piece === "r") {
        if (from.r === 0 && from.c === 0) this.castling.bQ = false;
        if (from.r === 0 && from.c === 7) this.castling.bK = false;
      }

      // If a Rook is captured in corner
      if (to.r === 7 && to.c === 0) this.castling.wQ = false;
      if (to.r === 7 && to.c === 7) this.castling.wK = false;
      if (to.r === 0 && to.c === 0) this.castling.bQ = false;
      if (to.r === 0 && to.c === 7) this.castling.bK = false;

      // Move piece
      this.board[from.r][from.c] = null;

      if (isEnPassant) {
        // Remove captured pawn
        const capturedPawnRow = from.r;
        this.board[capturedPawnRow][to.c] = null;
      }

      if (isCastling === "K") {
        // Move rook as well
        this.board[from.r][5] = this.board[from.r][7];
        this.board[from.r][7] = null;
      } else if (isCastling === "Q") {
        this.board[from.r][3] = this.board[from.r][0];
        this.board[from.r][0] = null;
      }

      // Final placed piece (handle promotion)
      let placedPiece = piece;
      if (promo) {
        placedPiece = this.isWhite(piece) ? promo.toUpperCase() : promo.toLowerCase();
      }

      this.board[to.r][to.c] = placedPiece;

      // Update en passant target
      if (isDoublePawn) {
        this.enPassantTarget = { r: (from.r + to.r) / 2, c: from.c };
      } else {
        this.enPassantTarget = null;
      }
    }

    makeMove(move) {
      const from = move.from;
      const to = move.to;
      const piece = this.board[from.r][from.c];
      const captured = this.board[to.r][to.c];

      // Clone state for history undo
      const prevCastling = { ...this.castling };
      const prevEnPassant = this.enPassantTarget ? { ...this.enPassantTarget } : null;

      // Build SAN (Standard Algebraic Notation)
      const san = this.formatSAN(move, piece, captured);

      // Track captured pieces
      if (captured) {
        if (this.isWhite(captured)) {
          this.capturedWhite.push(captured);
        } else {
          this.capturedBlack.push(captured);
        }
      } else if (move.isEnPassant) {
        const epPawn = this.turn === "w" ? "p" : "P";
        if (this.turn === "w") this.capturedBlack.push(epPawn);
        else this.capturedWhite.push(epPawn);
      }

      this.applyMoveInternal(move);

      // Switch turn
      this.turn = this.turn === "w" ? "b" : "w";
      if (this.turn === "w") this.fullmoveNumber++;

      this.history.push({
        from,
        to,
        piece,
        captured,
        promo: move.promo,
        castling: prevCastling,
        enPassantTarget: prevEnPassant,
        san,
      });

      this.recordPosition();
      return san;
    }

    undoMove() {
      if (!this.history.length) return false;
      const last = this.history.pop();

      // Restore board
      this.board[last.from.r][last.from.c] = last.piece;
      this.board[last.to.r][last.to.c] = last.captured;

      if (last.promo) {
        this.board[last.from.r][last.from.c] = this.isWhite(last.piece) ? "P" : "p";
      }

      // Revert castling
      if (last.piece.toUpperCase() === "K" && Math.abs(last.to.c - last.from.c) === 2) {
        if (last.to.c === 6) {
          // Kingside
          this.board[last.from.r][7] = this.board[last.from.r][5];
          this.board[last.from.r][5] = null;
        } else if (last.to.c === 2) {
          // Queenside
          this.board[last.from.r][0] = this.board[last.from.r][3];
          this.board[last.from.r][3] = null;
        }
      }

      // Revert en passant
      if (last.piece.toUpperCase() === "P" && !last.captured && last.from.c !== last.to.c) {
        const pawnRow = last.from.r;
        const capturedPawn = this.turn === "w" ? "P" : "p";
        this.board[pawnRow][last.to.c] = capturedPawn;
      }

      // Pop from captured trays
      if (last.captured) {
        if (this.isWhite(last.captured)) this.capturedWhite.pop();
        else this.capturedBlack.pop();
      }

      this.castling = last.castling;
      this.enPassantTarget = last.enPassantTarget;
      this.turn = this.turn === "w" ? "b" : "w";
      if (this.turn === "b") this.fullmoveNumber--;

      return true;
    }

    formatSAN(move, piece, captured) {
      const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const toSquare = `${files[move.to.c]}${8 - move.to.r}`;

      if (move.isCastling === "K") return "O-O";
      if (move.isCastling === "Q") return "O-O-O";

      const type = piece.toUpperCase();
      let san = "";

      if (type === "P") {
        if (captured || move.isEnPassant) {
          san = `${files[move.from.c]}x${toSquare}`;
        } else {
          san = toSquare;
        }
        if (move.promo) {
          san += `=${move.promo.toUpperCase()}`;
        }
      } else {
        san = `${type}${captured ? "x" : ""}${toSquare}`;
      }

      // Check / Checkmate suffix
      const sim = this.clone();
      sim.applyMoveInternal(move);
      sim.turn = sim.turn === "w" ? "b" : "w";
      if (sim.isInCheck()) {
        const nextLegal = sim.getLegalMoves();
        san += nextLegal.length === 0 ? "#" : "+";
      }

      return san;
    }

    getGameStatus() {
      const legalMoves = this.getLegalMoves();
      const inCheck = this.isInCheck();

      if (legalMoves.length === 0) {
        if (inCheck) {
          const winner = this.turn === "w" ? "Svart" : "Hvit";
          return {
            over: true,
            result: this.turn === "w" ? "0-1" : "1-0",
            title: `Sjakkmatt! ${winner} vinner! 🏆`,
            reason: `${winner} satte motstanderen i sjakkmatt.`,
          };
        } else {
          return {
            over: true,
            result: "1/2-1/2",
            title: "Patt! Remis 🤝",
            reason: "Spilleren i trekket har ingen lovlige trekk og står ikke i sjakk.",
          };
        }
      }

      // Insufficient material check
      if (this.isInsufficientMaterial()) {
        return {
          over: true,
          result: "1/2-1/2",
          title: "Remis (For lite materiell) 🤝",
          reason: "Ingen av spillerne har nok brikker til å sette sjakkmatt.",
        };
      }

      // Threefold repetition
      const fen = this.getBoardFEN();
      if ((this.positionHistory[fen] || 0) >= 3) {
        return {
          over: true,
          result: "1/2-1/2",
          title: "Remis (Trekkgjentakelse) 🤝",
          reason: "Samme stilling har oppstått 3 ganger.",
        };
      }

      return {
        over: false,
        inCheck: inCheck,
      };
    }

    isInsufficientMaterial() {
      const pieces = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (p) pieces.push(p);
        }
      }
      if (pieces.length === 2) return true; // K vs K
      if (pieces.length === 3) {
        // K + B vs K or K + N vs K
        const nonKings = pieces.filter((p) => p.toUpperCase() !== "K");
        if (nonKings.length === 1) {
          const t = nonKings[0].toUpperCase();
          if (t === "B" || t === "N") return true;
        }
      }
      return false;
    }

    getMaterialDifference() {
      let whiteScore = 0;
      let blackScore = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (!p) continue;
          const val = PIECE_VALUES[p] || 0;
          if (this.isWhite(p)) whiteScore += val;
          else blackScore += val;
        }
      }
      return whiteScore - blackScore;
    }

    getPremoveTargets(r, c, color) {
      const p = this.board[r][c];
      if (!p || this.getColor(p) !== color) return [];

      const targets = [];
      const isW = color === "w";
      const type = p.toUpperCase();
      const addTarget = (nr, nc) => {
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !(nr === r && nc === c)) {
          if (!targets.some((t) => t.r === nr && t.c === nc)) {
            targets.push({ r: nr, c: nc });
          }
        }
      };

      if (type === "P") {
        const dir = isW ? -1 : 1;
        const startRank = isW ? 6 : 1;
        addTarget(r + dir, c);
        if (r === startRank) {
          addTarget(r + 2 * dir, c);
        }
        addTarget(r + dir, c - 1);
        addTarget(r + dir, c + 1);
      } else if (type === "N") {
        const offsets = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1],
        ];
        for (const [dr, dc] of offsets) {
          addTarget(r + dr, c + dc);
        }
      } else if (type === "B" || type === "R" || type === "Q") {
        const dirs = [];
        if (type === "B" || type === "Q") {
          dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }
        if (type === "R" || type === "Q") {
          dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        }
        for (const [dr, dc] of dirs) {
          let nr = r + dr;
          let nc = c + dc;
          while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            addTarget(nr, nc);
            nr += dr;
            nc += dc;
          }
        }
      } else if (type === "K") {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            addTarget(r + dr, c + dc);
          }
        }
        const homeRank = isW ? 7 : 0;
        if (r === homeRank && c === 4) {
          if (isW ? this.castling.wK : this.castling.bK) addTarget(homeRank, 6);
          if (isW ? this.castling.wQ : this.castling.bQ) addTarget(homeRank, 2);
        }
      }

      return targets;
    }
  }

  // --- UI Controller & Multiplayer Sync ---
  const state = {
    game: new ChessGame(),
    mode: "local", // 'local' or 'room'
    perspective: "w", // 'w' or 'b'
    selectedSquare: null, // { r, c }
    legalMovesForSelected: [],
    premove: null, // { from: {r, c}, to: {r, c}, promo: 'Q' }
    premoveTargetsForSelected: [], // [{ r, c }]
    lastMove: null, // { from: {r, c}, to: {r, c} }
    autoFlip: false,

    // Timers
    timeControl: 300, // seconds
    whiteTime: 300,
    blackTime: 300,
    timerRunning: false,
    timerInterval: null,

    // Room Multiplayer
    roomCode: null,
    playerId: null,
    playerColor: "w", // 'w', 'b', or 'spectator'
    isHost: false,
    isPartyRoom: false,
    pollTimer: null,
    lastPolledVersion: 0,
    pendingPromotionMove: null,
    gameStatus: "waiting", // 'waiting', 'active', 'finished'
    dismissedGameOver: false,
    customGameOverTitle: null,
    customGameOverReason: null,
    manuallyFlipped: false,
    partyRoomCode: null,
    botDifficulty: "hard",
    botColor: "b",
    userColorChoice: "w",
  };

  // DOM Elements
  const el = {
    viewLobby: document.getElementById("viewLobby"),
    viewGame: document.getElementById("viewGame"),
    btnExitToLobby: document.getElementById("btnExitToLobby"),

    tabLobbyLocal: document.getElementById("tabLobbyLocal"),
    tabLobbyRoom: document.getElementById("tabLobbyRoom"),
    tabLobbyBot: document.getElementById("tabLobbyBot"),
    panelLobbyLocal: document.getElementById("panelLobbyLocal"),
    panelLobbyRoom: document.getElementById("panelLobbyRoom"),
    panelLobbyBot: document.getElementById("panelLobbyBot"),

    btnStartLocalMatch: document.getElementById("btnStartLocalMatch"),
    selectLocalTime: document.getElementById("selectLocalTime"),
    checkLocalAutoFlip: document.getElementById("checkLocalAutoFlip"),

    btnSubmitCreateLobby: document.getElementById("btnSubmitCreateLobby"),
    inputHostNameLobby: document.getElementById("inputHostNameLobby"),
    selectOnlineTime: document.getElementById("selectOnlineTime"),
    btnSubmitJoinLobby: document.getElementById("btnSubmitJoinLobby"),
    inputRoomCodeLobby: document.getElementById("inputRoomCodeLobby"),
    inputJoinNameLobby: document.getElementById("inputJoinNameLobby"),

    btnStartBotMatch: document.getElementById("btnStartBotMatch"),
    controlBotColor: document.getElementById("controlBotColor"),
    controlBotDiff: document.getElementById("controlBotDiff"),
    selectBotTime: document.getElementById("selectBotTime"),

    boardFrame: document.getElementById("boardFrame"),
    chessGrid: document.getElementById("chessGrid"),
    checkBanner: document.getElementById("checkBanner"),
    btnSoundToggle: document.getElementById("btnSoundToggle"),
    soundIcon: document.getElementById("soundIcon"),
    btnFlipBoard: document.getElementById("btnFlipBoard"),
    btnHelp: document.getElementById("btnHelp"),

    tabLocal: document.getElementById("tabLocal"),
    tabRoom: document.getElementById("tabRoom"),
    roomPill: document.getElementById("roomPill"),
    roomPillCode: document.getElementById("roomPillCode"),
    btnCopyRoomLink: document.getElementById("btnCopyRoomLink"),

    topPlayerCard: document.getElementById("topPlayerCard"),
    topAvatar: document.getElementById("topAvatar"),
    topPlayerName: document.getElementById("topPlayerName"),
    topColorDot: document.getElementById("topColorDot"),
    topTurnBadge: document.getElementById("topTurnBadge"),
    topCapturedTray: document.getElementById("topCapturedTray"),
    topMaterialLead: document.getElementById("topMaterialLead"),
    topClock: document.getElementById("topClock"),

    bottomPlayerCard: document.getElementById("bottomPlayerCard"),
    bottomAvatar: document.getElementById("bottomAvatar"),
    bottomPlayerName: document.getElementById("bottomPlayerName"),
    bottomColorDot: document.getElementById("bottomColorDot"),
    bottomTurnBadge: document.getElementById("bottomTurnBadge"),
    bottomCapturedTray: document.getElementById("bottomCapturedTray"),
    bottomMaterialLead: document.getElementById("bottomMaterialLead"),
    bottomClock: document.getElementById("bottomClock"),

    gameStatusText: document.getElementById("gameStatusText"),
    moveHistoryList: document.getElementById("moveHistoryList"),

    btnUndo: document.getElementById("btnUndo"),
    btnDrawOffer: document.getElementById("btnDrawOffer"),
    btnResign: document.getElementById("btnResign"),
    btnNewGame: document.getElementById("btnNewGame"),
    selectTimeControl: document.getElementById("selectTimeControl"),
    checkAutoFlip: document.getElementById("checkAutoFlip"),
    labelAutoFlip: document.getElementById("labelAutoFlip"),

    // Modals
    modalPromotion: document.getElementById("modalPromotion"),
    promotionChoices: document.getElementById("promotionChoices"),
    modalGameOver: document.getElementById("modalGameOver"),
    gameOverTrophy: document.getElementById("gameOverTrophy"),
    gameOverTitle: document.getElementById("gameOverTitle"),
    gameOverReason: document.getElementById("gameOverReason"),
    btnGameOverRematch: document.getElementById("btnGameOverRematch"),
    btnGameOverClose: document.getElementById("btnGameOverClose"),
    btnGameOverLounge: document.getElementById("btnGameOverLounge"),
    btnBack: document.getElementById("btnBack"),

    modalRoomSetup: document.getElementById("modalRoomSetup"),
    btnCloseRoomModal: document.getElementById("btnCloseRoomModal"),
    tabCreateRoom: document.getElementById("tabCreateRoom"),
    tabJoinRoom: document.getElementById("tabJoinRoom"),
    bodyCreateRoom: document.getElementById("bodyCreateRoom"),
    bodyJoinRoom: document.getElementById("bodyJoinRoom"),
    inputHostName: document.getElementById("inputHostName"),
    btnSubmitCreateRoom: document.getElementById("btnSubmitCreateRoom"),
    inputRoomCode: document.getElementById("inputRoomCode"),
    inputJoinName: document.getElementById("inputJoinName"),
    btnSubmitJoinRoom: document.getElementById("btnSubmitJoinRoom"),

    modalHelp: document.getElementById("modalHelp"),
    btnCloseHelpModal: document.getElementById("btnCloseHelpModal"),
  };

  function renderAvatarHtml(avatar) {
    if (avatar === "💀") return `<span class="skull-emoji">💀</span>`;
    if (window.CharacterCreator && typeof window.CharacterCreator.getAvatarImgSrc === "function") {
      const src = window.CharacterCreator.getAvatarImgSrc(avatar);
      return `<img src="${src}" alt="Spillerfigur" class="player-mon-img" />`;
    }
    const monIds = ["charbear", "jormundgandr", "pixiu", "squitonkey", "tanuki", "totter"];
    if (avatar && (monIds.includes(avatar) || avatar.endsWith(".png") || avatar.startsWith("data:"))) {
      const src = (avatar.endsWith(".png") || avatar.startsWith("data:")) ? avatar : `/assets/mons/${avatar}.png`;
      return `<img src="${src}" alt="Monster" class="player-mon-img" />`;
    }
    return avatar || "👤";
  }

  // --- Board Coordinate Conversion ---
  // If perspective is 'w', visual row 0 is rank 8 (matrix r=0), col 0 is file a (matrix c=0).
  // If perspective is 'b', visual row 0 is rank 1 (matrix r=7), col 0 is file h (matrix c=7).
  function toMatrixCoords(vRow, vCol) {
    if (state.perspective === "w") {
      return { r: vRow, c: vCol };
    } else {
      return { r: 7 - vRow, c: 7 - vCol };
    }
  }

  function toVisualCoords(r, c) {
    if (state.perspective === "w") {
      return { vRow: r, vCol: c };
    } else {
      return { vRow: 7 - r, vCol: 7 - c };
    }
  }

  function clearPremove() {
    state.premove = null;
    state.premoveTargetsForSelected = [];
  }

  function formatServerGameOverTitle(data) {
    const reason = (data.resultReason || "").toLowerCase();
    const res = data.result || "";
    const wName = (data.whitePlayer && data.whitePlayer.name) || "Hvit";
    const bName = (data.blackPlayer && data.blackPlayer.name) || "Svart";

    if (reason.includes("tid")) {
      if (res === "1-0") return `Tiden er ute! ${wName} vinner! 🏆`;
      if (res === "0-1") return `Tiden er ute! ${bName} vinner! 🏆`;
      return "Tiden er ute! ⏱️";
    }
    if (reason.includes("sjakkmatt")) {
      if (res === "1-0") return `Sjakkmatt! ${wName} vinner! 🏆`;
      if (res === "0-1") return `Sjakkmatt! ${bName} vinner! 🏆`;
      return "Sjakkmatt! 🏆";
    }
    if (res === "1-0") return `${wName} vinner! 🏆`;
    if (res === "0-1") return `${bName} vinner! 🏆`;
    if (res === "1/2-1/2") return "Remis! 🤝";
    return "Partiet er over!";
  }

  // --- Render Board & Squares ---
  function initBoardDOM() {
    el.chessGrid.innerHTML = "";
    el.chessGrid.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (state.premove || state.selectedSquare) {
        clearPremove();
        state.selectedSquare = null;
        state.legalMovesForSelected = [];
        renderBoard();
      }
    });
    for (let vRow = 0; vRow < 8; vRow++) {
      for (let vCol = 0; vCol < 8; vCol++) {
        const sq = document.createElement("div");
        const isLight = (vRow + vCol) % 2 === 0;
        sq.className = isLight ? "square square-light" : "square square-dark";

        // Rank label (on file 0 / leftmost column)
        if (vCol === 0) {
          const rankLabel = document.createElement("span");
          rankLabel.className = "coord-label coord-rank";
          rankLabel.textContent = state.perspective === "w" ? String(8 - vRow) : String(vRow + 1);
          sq.appendChild(rankLabel);
        }

        // File label (on rank 7 / bottom row)
        if (vRow === 7) {
          const fileLabel = document.createElement("span");
          fileLabel.className = "coord-label coord-file";
          const fileLetter = state.perspective === "w" ? String.fromCharCode(97 + vCol) : String.fromCharCode(104 - vCol);
          fileLabel.textContent = fileLetter;
          sq.appendChild(fileLabel);
        }
        sq.dataset.vrow = String(vRow);
        sq.dataset.vcol = String(vCol);
        sq.addEventListener("click", () => handleSquareClick(vRow, vCol));
        el.chessGrid.appendChild(sq);
      }
    }
  }

  function renderBoard() {
    // Board perspective background
    if (state.perspective === "w") {
      el.boardFrame.classList.remove("black-perspective");
    } else {
      el.boardFrame.classList.add("black-perspective");
    }

    const inCheck = state.game.isInCheck();
    const checkedKing = inCheck ? state.game.findKing(state.game.turn) : null;

    // Check banner
    if (inCheck) {
      el.checkBanner.classList.remove("hidden");
    } else {
      el.checkBanner.classList.add("hidden");
    }

    for (let vRow = 0; vRow < 8; vRow++) {
      for (let vCol = 0; vCol < 8; vCol++) {
        const { r, c } = toMatrixCoords(vRow, vCol);
        const sq = el.chessGrid.children[vRow * 8 + vCol];
        sq.innerHTML = "";
        const isLight = (vRow + vCol) % 2 === 0;
        sq.className = isLight ? "square square-light" : "square square-dark";

        // Rank label (on file 0 / leftmost column)
        if (vCol === 0) {
          const rankLabel = document.createElement("span");
          rankLabel.className = "coord-label coord-rank";
          rankLabel.textContent = state.perspective === "w" ? String(8 - vRow) : String(vRow + 1);
          sq.appendChild(rankLabel);
        }

        // File label (on rank 7 / bottom row)
        if (vRow === 7) {
          const fileLabel = document.createElement("span");
          fileLabel.className = "coord-label coord-file";
          const fileLetter = state.perspective === "w" ? String.fromCharCode(97 + vCol) : String.fromCharCode(104 - vCol);
          fileLabel.textContent = fileLetter;
          sq.appendChild(fileLabel);
        }

        // Last move highlight
        if (
          state.lastMove &&
          ((state.lastMove.from.r === r && state.lastMove.from.c === c) ||
            (state.lastMove.to.r === r && state.lastMove.to.c === c))
        ) {
          sq.classList.add("last-move");
        }

        // Premove highlight
        if (state.premove) {
          if (state.premove.from.r === r && state.premove.from.c === c) {
            sq.classList.add("premove-from");
          }
          if (state.premove.to.r === r && state.premove.to.c === c) {
            sq.classList.add("premove-to");
          }
        }

        // Selected square (lifted piece, no blue square)
        if (state.selectedSquare && state.selectedSquare.r === r && state.selectedSquare.c === c) {
          sq.classList.add("selected");
        }

        // Checked King highlight
        if (checkedKing && checkedKing.r === r && checkedKing.c === c) {
          sq.classList.add("in-check");
        }

        // Piece
        const piece = state.game.board[r][c];
        if (piece) {
          const pieceEl = document.createElement("div");
          pieceEl.className = "chess-piece";
          pieceEl.innerHTML = `
            <div class="piece-shadow piece-${piece}"></div>
            <div class="piece-sprite piece-${piece}"></div>
          `;
          sq.appendChild(pieceEl);
        }

        // Legal move indicator (when it's our turn)
        const legalMove = state.legalMovesForSelected.find((m) => m.to.r === r && m.to.c === c);
        if (legalMove) {
          const isCapture = !!state.game.board[r][c] || legalMove.isEnPassant;
          const indicator = document.createElement("div");
          indicator.className = isCapture ? "capture-ring" : "move-dot";
          sq.appendChild(indicator);
        }

        // Premove target indicator (when selecting a premove during opponent's turn)
        const premoveTarget = state.premoveTargetsForSelected.find((t) => t.r === r && t.c === c);
        if (premoveTarget) {
          const hasPiece = !!state.game.board[r][c];
          const indicator = document.createElement("div");
          indicator.className = hasPiece ? "premove-ring" : "premove-dot";
          sq.appendChild(indicator);
        }
      }
    }

    renderPlayerCards();
    renderMoveHistory();
  }

  function renderPlayerCards() {
    const isWhiteTurn = state.game.turn === "w";
    const whitePlayerIsBottom = state.perspective === "w";

    // Bottom card config
    const bottomColor = whitePlayerIsBottom ? "w" : "b";
    const topColor = whitePlayerIsBottom ? "b" : "w";

    // Turn styling
    const isFinished = state.gameStatus === "finished" || state.game.getGameStatus().over;
    el.bottomPlayerCard.classList.toggle("is-turn", !isFinished && state.game.turn === bottomColor);
    el.topPlayerCard.classList.toggle("is-turn", !isFinished && state.game.turn === topColor);

    el.bottomTurnBadge.classList.toggle("hidden", isFinished || state.game.turn !== bottomColor);
    el.topTurnBadge.classList.toggle("hidden", isFinished || state.game.turn !== topColor);

    el.bottomClock.classList.toggle("active", !isFinished && state.game.turn === bottomColor);
    el.topClock.classList.toggle("active", !isFinished && state.game.turn === topColor);

    // Color dots
    el.bottomColorDot.className = `player-color-indicator ${bottomColor === "w" ? "white" : "black"}`;
    el.topColorDot.className = `player-color-indicator ${topColor === "w" ? "white" : "black"}`;

    // Names in local, bot, vs room mode
    if (state.mode === "bot") {
      const isBottomHuman = bottomColor === state.playerColor;
      el.bottomPlayerName.textContent = isBottomHuman ? "Deg" : (state.botDifficulty === "easy" ? "Bot (Rekrutt)" : "Bot (Mester)");
      el.topPlayerName.textContent = !isBottomHuman ? "Deg" : (state.botDifficulty === "easy" ? "Bot (Rekrutt)" : "Bot (Mester)");
      el.bottomAvatar.innerHTML = renderAvatarHtml(isBottomHuman ? "charbear" : "jormundgandr");
      el.topAvatar.innerHTML = renderAvatarHtml(!isBottomHuman ? "charbear" : "jormundgandr");
    } else if (state.mode === "local") {
      el.bottomPlayerName.textContent = bottomColor === "w" ? "Hvit" : "Svart";
      el.topPlayerName.textContent = topColor === "w" ? "Hvit" : "Svart";
      el.bottomAvatar.innerHTML = renderAvatarHtml(bottomColor === "w" ? "charbear" : "jormundgandr");
      el.topAvatar.innerHTML = renderAvatarHtml(topColor === "w" ? "charbear" : "jormundgandr");
    }

    // Material difference
    const diff = state.game.getMaterialDifference();
    el.bottomMaterialLead.textContent = "";
    el.topMaterialLead.textContent = "";
    if (diff !== 0) {
      if (diff > 0) {
        // White leads
        if (whitePlayerIsBottom) el.bottomMaterialLead.textContent = `+${diff}`;
        else el.topMaterialLead.textContent = `+${diff}`;
      } else {
        // Black leads
        if (whitePlayerIsBottom) el.topMaterialLead.textContent = `+${Math.abs(diff)}`;
        else el.bottomMaterialLead.textContent = `+${Math.abs(diff)}`;
      }
    }

    // Captured pieces trays
    renderCapturedTray(el.bottomCapturedTray, bottomColor === "w" ? state.game.capturedBlack : state.game.capturedWhite);
    renderCapturedTray(el.topCapturedTray, topColor === "w" ? state.game.capturedBlack : state.game.capturedWhite);

    // Clocks
    renderClocks();

    // Status text
    const status = state.game.getGameStatus();
    if (status.over || state.gameStatus === "finished") {
      const reasonStr =
        status.reason ||
        state.customGameOverReason ||
        (el.gameOverReason ? el.gameOverReason.textContent : "") ||
        "Partiet er over.";
      const titleStr =
        status.title ||
        state.customGameOverTitle ||
        (el.gameOverTitle ? el.gameOverTitle.textContent : "") ||
        "Partiet er over";

      if (state.dismissedGameOver) {
        updateStatusTextForDismissed(reasonStr);
      } else {
        el.gameStatusText.textContent = titleStr;
        el.gameStatusText.style.color = "var(--accent-gold)";
      }
    } else if (state.premove) {
      el.gameStatusText.textContent = "Premove klar – venter på motstander…";
      el.gameStatusText.style.color = "var(--accent-orange)";
    } else {
      el.gameStatusText.textContent = isWhiteTurn ? "Hvits trekk" : "Svarts trekk";
      el.gameStatusText.style.color = "var(--accent-blue)";
    }
  }

  function renderCapturedTray(container, pieces) {
    container.innerHTML = "";
    const sorted = [...pieces].sort((a, b) => (PIECE_VALUES[b] || 0) - (PIECE_VALUES[a] || 0));
    sorted.forEach((p) => {
      const span = document.createElement("span");
      span.className = `tray-piece piece-${p}`;
      container.appendChild(span);
    });
  }

  function renderClocks() {
    if (state.timeControl <= 0) {
      el.bottomClock.textContent = "∞";
      el.topClock.textContent = "∞";
      el.bottomClock.classList.remove("low-time");
      el.topClock.classList.remove("low-time");
      return;
    }

    const whiteClockStr = formatTime(state.whiteTime);
    const blackClockStr = formatTime(state.blackTime);

    const whitePlayerIsBottom = state.perspective === "w";
    if (whitePlayerIsBottom) {
      el.bottomClock.textContent = whiteClockStr;
      el.topClock.textContent = blackClockStr;
      el.bottomClock.classList.toggle("low-time", state.whiteTime <= 30);
      el.topClock.classList.toggle("low-time", state.blackTime <= 30);
    } else {
      el.bottomClock.textContent = blackClockStr;
      el.topClock.textContent = whiteClockStr;
      el.bottomClock.classList.toggle("low-time", state.blackTime <= 30);
      el.topClock.classList.toggle("low-time", state.whiteTime <= 30);
    }
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }

  function renderMoveHistory() {
    if (!state.game.history.length) {
      el.moveHistoryList.innerHTML =
        '<span class="move-empty-hint">Trekkene vises her etterhvert som dere spiller...</span>';
      return;
    }

    el.moveHistoryList.innerHTML = "";
    for (let i = 0; i < state.game.history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = state.game.history[i];
      const blackMove = state.game.history[i + 1];

      const block = document.createElement("div");
      block.className = "move-turn-block";
      block.innerHTML = `
        <span class="move-turn-num">${moveNum}.</span>
        <span class="move-san">${whiteMove ? whiteMove.san : ""}</span>
        ${blackMove ? `<span class="move-san">${blackMove.san}</span>` : ""}
      `;
      el.moveHistoryList.appendChild(block);
    }

    // Scroll to end of list
    el.moveHistoryList.scrollLeft = el.moveHistoryList.scrollWidth;
  }

  // --- Interaction & Move Handling ---
  function handleSquareClick(vRow, vCol) {
    if (state.gameStatus === "finished" || state.game.getGameStatus().over) {
      return;
    }

    if (state.mode === "bot" && state.game.turn === state.botColor) {
      return;
    }

    const { r, c } = toMatrixCoords(vRow, vCol);
    const piece = state.game.board[r][c];

    // In room mode, handle premoves when it is not our turn
    if (state.mode === "room") {
      if (state.playerColor !== "w" && state.playerColor !== "b") {
        return; // spectator
      }
      if (state.gameStatus !== "active") {
        return;
      }

      if (state.playerColor !== state.game.turn) {
        // --- PREMOVE SELECTION & SETTING ---
        if (state.selectedSquare) {
          // Clicking the same square deselects
          if (state.selectedSquare.r === r && state.selectedSquare.c === c) {
            state.selectedSquare = null;
            state.premoveTargetsForSelected = [];
            renderBoard();
            return;
          }

          // Check if clicked square is a valid premove target for the selected piece
          const isTarget = state.premoveTargetsForSelected.some((t) => t.r === r && t.c === c);
          if (isTarget) {
            state.premove = {
              from: { ...state.selectedSquare },
              to: { r, c },
              promo: "Q",
            };
            state.selectedSquare = null;
            state.premoveTargetsForSelected = [];
            soundEngine.playMove();
            renderBoard();
            return;
          }
        }

        // Clicking one of our own pieces selects it for premoving
        if (piece && state.game.getColor(piece) === state.playerColor) {
          // If clicking the piece that already had an active premove, cancel the premove
          if (
            state.premove &&
            state.premove.from.r === r &&
            state.premove.from.c === c &&
            !state.selectedSquare
          ) {
            clearPremove();
            renderBoard();
            return;
          }
          clearPremove();
          state.selectedSquare = { r, c };
          state.legalMovesForSelected = [];
          state.premoveTargetsForSelected = state.game.getPremoveTargets(r, c, state.playerColor);
          renderBoard();
        } else {
          // Clicking elsewhere clears any active premove or selection
          clearPremove();
          state.selectedSquare = null;
          state.legalMovesForSelected = [];
          renderBoard();
        }
        return;
      }
    }

    // --- NORMAL TURN MOVE HANDLING ---
    clearPremove();

    // 1. If clicking a legal target square for already selected piece
    if (state.selectedSquare) {
      if (state.selectedSquare.r === r && state.selectedSquare.c === c) {
        state.selectedSquare = null;
        state.legalMovesForSelected = [];
        renderBoard();
        return;
      }

      const legalMove = state.legalMovesForSelected.find((m) => m.to.r === r && m.to.c === c);

      if (legalMove) {
        // Check for pawn promotion
        const movingPiece = state.game.board[state.selectedSquare.r][state.selectedSquare.c];
        const isPawn = movingPiece && movingPiece.toUpperCase() === "P";
        const isEndRank = (state.game.turn === "w" && r === 0) || (state.game.turn === "b" && r === 7);

        if (isPawn && isEndRank) {
          // Open promotion modal
          promptPromotion(legalMove);
          return;
        }

        executeMove(legalMove);
        return;
      }
    }

    // 2. Selecting a piece of the current turn's color
    if (piece && state.game.getColor(piece) === state.game.turn) {
      state.selectedSquare = { r, c };
      const allLegal = state.game.getLegalMoves();
      state.legalMovesForSelected = allLegal.filter((m) => m.from.r === r && m.from.c === c);
      renderBoard();
    } else {
      // Deselect
      state.selectedSquare = null;
      state.legalMovesForSelected = [];
      renderBoard();
    }
  }

  function promptPromotion(move) {
    state.pendingPromotionMove = move;
    el.promotionChoices.innerHTML = "";

    const color = state.game.turn;
    const pieces = ["Q", "R", "B", "N"];

    pieces.forEach((type) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "promo-btn";
      const spriteClass = color === "w" ? `piece-${type}` : `piece-${type.toLowerCase()}`;
      btn.innerHTML = `<div class="promo-piece-inner ${spriteClass}"></div>`;
      btn.addEventListener("click", () => {
        el.modalPromotion.close();
        move.promo = type;
        executeMove(move);
      });
      el.promotionChoices.appendChild(btn);
    });

    if (!el.modalPromotion.open) {
      el.modalPromotion.showModal();
    }
  }

  async function executeMove(move) {
    const isCapture = !!state.game.board[move.to.r][move.to.c] || move.isEnPassant;

    // Apply move in local engine
    const san = state.game.makeMove(move);
    state.lastMove = { from: { ...move.from }, to: { ...move.to } };
    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    clearPremove();

    // Sound FX
    if (isCapture) {
      soundEngine.playCapture();
    } else {
      soundEngine.playMove();
    }

    // Check sound
    if (state.game.isInCheck()) {
      soundEngine.playCheck();
    }

    // Auto-flip board in 1-device pass & play
    if (state.mode === "local" && state.autoFlip) {
      state.perspective = state.game.turn;
    }

    // Check game termination
    const status = state.game.getGameStatus();
    if (status.over) {
      stopTimer();
      soundEngine.playVictory();
      state.gameStatus = "finished";
      state.dismissedGameOver = false;
      state.customGameOverTitle = status.title;
      state.customGameOverReason = status.reason;
      triggerGameOver(status.title, status.reason);
    } else {
      if (state.mode === "local") {
        state.gameStatus = "active";
      }
      startTimer();
    }

    renderBoard();

    // If playing against Bot, trigger bot calculation if it is bot's turn
    if (state.mode === "bot" && !status.over && state.game.turn === state.botColor) {
      setTimeout(playBotTurn, 450);
    }

    // If in multiplayer room mode, sync move to server
    if (state.mode === "room") {
      await syncMoveToServer(move, san, status);
    }
  }

  function updateExitButtonsLabels() {
    if (state.mode === "room") {
      if (el.btnBack) {
        el.btnBack.textContent = state.isPartyRoom ? "‹ Lounge" : "‹ Avslutt rom";
      }
      if (el.btnGameOverLounge) {
        el.btnGameOverLounge.textContent = state.isPartyRoom ? "‹ Tilbake til Lounge" : "‹ Avslutt rom";
      }
    } else {
      if (el.btnBack) {
        el.btnBack.textContent = "‹ NTNU GAMES";
      }
      if (el.btnGameOverLounge) {
        el.btnGameOverLounge.textContent = "‹ Tilbake til menyen";
      }
    }
  }

  function triggerGameOver(title, reason) {
    el.gameOverTitle.textContent = title;
    el.gameOverReason.textContent = reason;
    updateExitButtonsLabels();
    if (!el.modalGameOver.open) {
      el.modalGameOver.showModal();
    }
  }

  // --- Clocks & Timers ---
  function startTimer() {
    if (state.timeControl <= 0) return;
    if (state.timerInterval) clearInterval(state.timerInterval);

    state.timerRunning = true;
    let lastTick = Date.now();

    state.timerInterval = setInterval(() => {
      if (state.gameStatus === "finished") {
        stopTimer();
        return;
      }

      const now = Date.now();
      const delta = (now - lastTick) / 1000;
      lastTick = now;

      if (state.game.turn === "w") {
        state.whiteTime = Math.max(0, state.whiteTime - delta);
        if (state.whiteTime <= 0) {
          handleTimeout("w");
        }
      } else {
        state.blackTime = Math.max(0, state.blackTime - delta);
        if (state.blackTime <= 0) {
          handleTimeout("b");
        }
      }

      renderClocks();
    }, 100);
  }

  function stopTimer() {
    state.timerRunning = false;
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  async function handleTimeout(color) {
    if (state.gameStatus === "finished") return;
    stopTimer();
    state.gameStatus = "finished";
    state.dismissedGameOver = false;
    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    clearPremove();
    if (el.modalPromotion && el.modalPromotion.open) {
      el.modalPromotion.close();
    }
    state.pendingPromotionMove = null;

    const winner = color === "w" ? "Svart" : "Hvit";
    const title = `Tiden er ute! ${winner} vinner! 🏆`;
    const reason = `Tiden er ute! ${winner} vinner på tid.`;
    state.customGameOverTitle = title;
    state.customGameOverReason = reason;

    soundEngine.playVictory();
    renderBoard();
    triggerGameOver(title, reason);

    if (state.mode === "room" && state.roomCode) {
      try {
        await fetch("/api/sjakk/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            action: "timeout",
          }),
        });
      } catch (err) {
        console.warn("Kunne ikke rapportere timeout:", err);
      }
    }
  }

  function resetGame() {
    state.game.reset();
    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    clearPremove();
    state.lastMove = null;
    state.whiteTime = state.timeControl;
    state.blackTime = state.timeControl;
    state.dismissedGameOver = false;
    state.customGameOverTitle = null;
    state.customGameOverReason = null;
    if (state.mode === "local" || state.mode === "bot") {
      state.gameStatus = state.mode === "bot" ? "active" : "waiting";
      if (el.btnDrawOffer) {
        el.btnDrawOffer.disabled = false;
        el.btnDrawOffer.textContent = "Remis";
        el.btnDrawOffer.classList.remove("btn-rematch-pulse");
      }
      if (el.btnResign) el.btnResign.disabled = false;
    }
    stopTimer();

    if (state.mode === "local" && state.autoFlip) {
      state.perspective = "w";
    }

    updateExitButtonsLabels();
    renderBoard();
  }

  // --- Multiplayer Room Mode ---
  async function syncMoveToServer(move, san, status) {
    try {
      const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const fromStr = `${files[move.from.c]}${8 - move.from.r}`;
      const toStr = `${files[move.to.c]}${8 - move.to.r}`;

      const resp = await fetch("/api/sjakk/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          move: {
            from: fromStr,
            to: toStr,
            piece: move.piece,
            san: san,
            promotion: move.promo,
            isPremove: !!move.isPremove,
            gameOver: status.over,
            result: status.result || "*",
            resultReason: status.reason || "",
          },
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        // Server rejected the move (e.g. flag fell on server right before move arrived)
        state.game.undoMove();
        state.lastMove = state.game.history.length
          ? {
              from: { ...state.game.history[state.game.history.length - 1].from },
              to: { ...state.game.history[state.game.history.length - 1].to },
            }
          : null;
        renderBoard();
      }
    } catch (err) {
      console.warn("Nettverksfeil ved sending av trekk:", err);
    }
  }

  function updateStatusTextForDismissed(reason) {
    if (!el.gameStatusText) return;
    el.gameStatusText.innerHTML = `
      <span>${reason}</span>
      <button type="button" class="game-status-reopen-btn" id="btnReopenGameOver">
        🏆 Vis resultat / Omkamp
      </button>
    `;
    const btnReopen = document.getElementById("btnReopenGameOver");
    if (btnReopen) {
      btnReopen.onclick = () => {
        state.dismissedGameOver = false;
        if (!el.modalGameOver.open) {
          el.modalGameOver.showModal();
        }
      };
    }
  }

  function exitStandaloneRoomToLocal() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    stopTimer();
    if (el.modalGameOver && el.modalGameOver.open) {
      el.modalGameOver.close();
    }
    state.roomCode = null;
    state.partyRoomCode = null;
    state.isPartyRoom = false;
    state.mode = "local";
    state.perspective = "w";
    if (el.tabLocal) el.tabLocal.classList.add("active");
    if (el.tabRoom) el.tabRoom.classList.remove("active");
    if (el.roomPill) el.roomPill.classList.add("hidden");
    if (el.btnUndo) el.btnUndo.disabled = false;
    if (el.labelAutoFlip) el.labelAutoFlip.classList.remove("hidden");
    window.history.replaceState({}, document.title, window.location.pathname);
    resetGame();
  }

  async function returnToLounge() {
    // 1. Local mode: go back to main NTNU Games hub
    if (state.mode === "local") {
      stopTimer();
      if (el.modalGameOver && el.modalGameOver.open) {
        el.modalGameOver.close();
      }
      window.location.href = "/";
      return;
    }

    // 2. Room mode
    const code = state.roomCode || state.partyRoomCode;
    const playerId = state.playerId || sessionStorage.getItem("party_player_id") || "";
    const hostToken = sessionStorage.getItem("party_host_token") || "";
    const isGameOver =
      state.gameStatus === "finished" ||
      state.game.getGameStatus().over ||
      (state.timeControl > 0 && (state.whiteTime <= 0 || state.blackTime <= 0));

    if (state.gameStatus === "active" && !isGameOver) {
      const promptMsg = state.isPartyRoom
        ? "Vil du avslutte partiet og gå til Party Lounge?"
        : "Vil du avslutte partiet og forlate rommet?";
      const ok = confirm(promptMsg);
      if (!ok) return;
    }

    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    stopTimer();
    if (el.modalGameOver && el.modalGameOver.open) {
      el.modalGameOver.close();
    }

    if (code && state.isPartyRoom) {
      try {
        await fetch("/api/party/to-lounge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: code,
            playerId: playerId,
            hostToken: hostToken,
          }),
        });
      } catch (err) {
        console.warn("to-lounge fetch failed:", err);
      }

      sessionStorage.setItem("party_room_code", code);
      if (playerId) sessionStorage.setItem("party_player_id", playerId);
      window.location.href = `/party/?code=${encodeURIComponent(code)}&player=${encodeURIComponent(playerId)}`;
      return;
    }

    // Standalone Sjakk room (not launched from Party Lounge)
    if (code) {
      try {
        await fetch("/api/sjakk/exit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: code,
            playerId: playerId,
          }),
        });
      } catch (_) {}
      exitStandaloneRoomToLocal();
      return;
    }

    window.location.href = "/";
  }

  function stopRoomPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function startRoomPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);

    async function poll() {
      if (state.mode !== "room" || !state.roomCode) return;

      try {
        const resp = await fetch(
          `/api/sjakk/state?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId || "")}`
        );
        if (!resp.ok) return;

        const data = await resp.json();
        if (!data.ok) return;

        // Sync whether this room belongs to a Party Lounge
        if (typeof data.isPartyRoom === "boolean") {
          state.isPartyRoom = data.isPartyRoom;
        }
        updateExitButtonsLabels();

        // Sync time control from server
        if (typeof data.timeControl === "number" && state.timeControl !== data.timeControl) {
          state.timeControl = data.timeControl;
          if (el.selectTimeControl) {
            el.selectTimeControl.value = String(data.timeControl);
          }
        }

        // Sync player role and board perspective
        if (data.myRole && (data.myRole === "w" || data.myRole === "b" || data.myRole === "spectator")) {
          state.playerColor = data.myRole;
          if (!state.manuallyFlipped && (data.myRole === "w" || data.myRole === "b")) {
            if (state.perspective !== data.myRole) {
              state.perspective = data.myRole;
              renderBoard();
            }
          }
        }

        // Sync host status
        if (data.whitePlayer && state.playerId) {
          state.isHost = (data.whitePlayer.id === state.playerId);
        }

        // Sync player labels
        if (data.whitePlayer) {
          const isBottom = state.perspective === "w";
          const targetName = isBottom ? el.bottomPlayerName : el.topPlayerName;
          const targetAv = isBottom ? el.bottomAvatar : el.topAvatar;
          if (targetName) targetName.textContent = data.whitePlayer.name;
          if (targetAv) targetAv.innerHTML = renderAvatarHtml(data.whitePlayer.avatar);
        }

        if (data.blackPlayer) {
          const isBottom = state.perspective === "b";
          const targetName = isBottom ? el.bottomPlayerName : el.topPlayerName;
          const targetAv = isBottom ? el.bottomAvatar : el.topAvatar;
          if (targetName) targetName.textContent = data.blackPlayer.name;
          if (targetAv) targetAv.innerHTML = renderAvatarHtml(data.blackPlayer.avatar);
        }

        // Sync times
        state.whiteTime = data.whiteTime;
        state.blackTime = data.blackTime;
        renderClocks();

        // Check if lounge return / exit was triggered
        if (data.returnedToLounge || (data.resultReason && data.resultReason.includes("Party Lounge"))) {
          if (state.pollTimer) {
            clearInterval(state.pollTimer);
            state.pollTimer = null;
          }
          stopTimer();
          if (state.isPartyRoom) {
            const code = state.roomCode || sessionStorage.getItem("party_room_code");
            const pId = state.playerId || sessionStorage.getItem("party_player_id") || "";
            if (code) {
              window.location.href = `/party/?code=${encodeURIComponent(code)}&player=${encodeURIComponent(pId)}`;
              return;
            }
          } else {
            exitStandaloneRoomToLocal();
            return;
          }
        }

        // 1. Detect rematch transition: finished -> active
        if (state.gameStatus === "finished" && data.status === "active") {
          state.gameStatus = "active";
          state.dismissedGameOver = false;
          state.customGameOverTitle = null;
          state.customGameOverReason = null;
          if (el.modalGameOver.open) el.modalGameOver.close();
          el.btnGameOverRematch.disabled = false;
          el.btnGameOverRematch.textContent = "Spill omkamp";
          el.btnGameOverRematch.classList.remove("btn-rematch-pulse");
          el.btnResign.disabled = false;
          el.btnDrawOffer.disabled = false;
          resetGame();
          state.gameStatus = "active";
          if (data.moves && data.moves.length > 0) {
            applyRemoteMoves(data.moves);
          }
          if (state.timeControl > 0) {
            startTimer();
          }
          return;
        }

        // 2. Check initial start: waiting -> active
        if (state.gameStatus === "waiting" && data.status === "active") {
          state.gameStatus = "active";
          el.btnResign.disabled = false;
          el.btnDrawOffer.disabled = false;
          if (data.moves && data.moves.length > 0) {
            applyRemoteMoves(data.moves);
          }
          if (state.timeControl > 0 && !state.timerRunning) {
            startTimer();
          }
        }

        // 3. Apply any new moves from opponent
        if (data.moves.length > state.game.history.length) {
          applyRemoteMoves(data.moves);
        }

        // 4. Handle active state (timers & draw offers)
        if (data.status === "active") {
          if (state.timeControl > 0 && !state.timerRunning) {
            startTimer();
          } else if (state.timeControl <= 0 && state.timerRunning) {
            stopTimer();
          }

          el.btnResign.disabled = false;
          if (data.drawOfferedBy && data.drawOfferedBy !== state.playerColor) {
            el.btnDrawOffer.textContent = "Godta remis 🤝";
            el.btnDrawOffer.classList.add("btn-rematch-pulse");
            el.btnDrawOffer.disabled = false;
          } else if (data.drawOfferedBy === state.playerColor) {
            el.btnDrawOffer.textContent = "Remis tilbudt… ⏳";
            el.btnDrawOffer.classList.remove("btn-rematch-pulse");
            el.btnDrawOffer.disabled = true;
          } else {
            el.btnDrawOffer.textContent = "Tilby remis";
            el.btnDrawOffer.classList.remove("btn-rematch-pulse");
            el.btnDrawOffer.disabled = false;
          }
        }

        // 5. Handle finished state and rematch button states
        if (data.status === "finished") {
          stopTimer();
          clearPremove();
          state.selectedSquare = null;
          state.legalMovesForSelected = [];
          if (el.modalPromotion && el.modalPromotion.open) {
            el.modalPromotion.close();
          }
          el.btnResign.disabled = true;
          el.btnDrawOffer.disabled = true;
          el.btnDrawOffer.classList.remove("btn-rematch-pulse");

          const justFinished = state.gameStatus !== "finished";
          state.gameStatus = "finished";

          const serverTitle = formatServerGameOverTitle(data);
          const serverReason = data.resultReason || "Spillet ble avsluttet.";
          state.customGameOverTitle = serverTitle;
          state.customGameOverReason = serverReason;

          // Sync rematch button text based on server rematchRequestedBy
          if (data.rematchRequestedBy) {
            if (data.rematchRequestedBy !== state.playerColor) {
              el.btnGameOverRematch.textContent = "Godta omkamp! ⚔️";
              el.btnGameOverRematch.classList.add("btn-rematch-pulse");
              el.btnGameOverRematch.disabled = false;
            } else {
              el.btnGameOverRematch.textContent = "Venter på motstander… ⏳";
              el.btnGameOverRematch.classList.remove("btn-rematch-pulse");
              el.btnGameOverRematch.disabled = true;
            }
          } else {
            el.btnGameOverRematch.textContent = "Spill omkamp";
            el.btnGameOverRematch.classList.remove("btn-rematch-pulse");
            el.btnGameOverRematch.disabled = false;
          }

          if (justFinished) {
            state.dismissedGameOver = false;
            soundEngine.playVictory();
            triggerGameOver(serverTitle, serverReason);
          } else if (el.modalGameOver.open) {
            el.gameOverTitle.textContent = serverTitle;
            el.gameOverReason.textContent = serverReason;
            updateExitButtonsLabels();
          } else if (!state.dismissedGameOver) {
            triggerGameOver(serverTitle, serverReason);
          }

          renderBoard();
        }
      } catch (err) {
        console.warn("Polling feil:", err);
      }
    }

    state.pollTimer = setInterval(poll, 400);
    poll();
  }

  function applyRemoteMoves(serverMoves) {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    // Apply any missing moves
    for (let i = state.game.history.length; i < serverMoves.length; i++) {
      const sm = serverMoves[i];
      if (!sm.from || !sm.to) continue;

      const fromC = files.indexOf(sm.from[0]);
      const fromR = 8 - parseInt(sm.from[1], 10);
      const toC = files.indexOf(sm.to[0]);
      const toR = 8 - parseInt(sm.to[1], 10);

      const legal = state.game.getLegalMoves();
      const match = legal.find(
        (m) =>
          m.from.r === fromR &&
          m.from.c === fromC &&
          m.to.r === toR &&
          m.to.c === toC
      );

      if (match) {
        if (sm.promotion) {
          match.promo = sm.promotion;
        }
        const isCapture = !!state.game.board[toR][toC] || match.isEnPassant;
        state.game.makeMove(match);
        state.lastMove = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };

        if (isCapture) soundEngine.playCapture();
        else soundEngine.playMove();

        if (state.game.isInCheck()) soundEngine.playCheck();
      }
    }

    // If it is now our turn and the game is still active, check for queued premove!
    const status = state.game.getGameStatus();
    if (!status.over && state.gameStatus === "active" && state.game.turn === state.playerColor) {
      if (state.premove) {
        const pm = state.premove;
        clearPremove();
        state.selectedSquare = null;
        state.legalMovesForSelected = [];

        const legalMoves = state.game.getLegalMoves();
        const matchedMove = legalMoves.find(
          (m) =>
            m.from.r === pm.from.r &&
            m.from.c === pm.from.c &&
            m.to.r === pm.to.r &&
            m.to.c === pm.to.c &&
            (!m.promo || m.promo === (pm.promo || "Q"))
        );

        if (matchedMove) {
          matchedMove.isPremove = true;
          if (matchedMove.promo) {
            matchedMove.promo = pm.promo || "Q";
          }
          executeMove(matchedMove);
          return;
        }
      } else if (state.selectedSquare) {
        // Player had selected one of their pieces during opponent's turn -> upgrade to legal moves
        const selPiece = state.game.board[state.selectedSquare.r][state.selectedSquare.c];
        if (selPiece && state.game.getColor(selPiece) === state.playerColor) {
          state.premoveTargetsForSelected = [];
          const allLegal = state.game.getLegalMoves();
          state.legalMovesForSelected = allLegal.filter(
            (m) => m.from.r === state.selectedSquare.r && m.from.c === state.selectedSquare.c
          );
        } else {
          state.selectedSquare = null;
          state.premoveTargetsForSelected = [];
          state.legalMovesForSelected = [];
        }
      }
    }

    renderBoard();
  }

  // --- Setup Event Listeners ---
  function initEvents() {
    // Sound Toggle
    if (el.btnSoundToggle) {
      el.btnSoundToggle.addEventListener("click", () => {
        soundEngine.enabled = !soundEngine.enabled;
        if (el.soundIcon) el.soundIcon.textContent = soundEngine.enabled ? "🔊" : "🔇";
      });
    }

    // Flip Board
    if (el.btnFlipBoard) {
      el.btnFlipBoard.addEventListener("click", () => {
        state.manuallyFlipped = true;
        state.perspective = state.perspective === "w" ? "b" : "w";
        renderBoard();
      });
    }

    // Help Modal
    if (el.btnHelp) {
      el.btnHelp.addEventListener("click", () => el.modalHelp && el.modalHelp.showModal());
    }
    if (el.btnCloseHelpModal) {
      el.btnCloseHelpModal.addEventListener("click", () => el.modalHelp && el.modalHelp.close());
    }

    // Local vs Room Tabs (if modal is present)
    if (el.tabLocal) {
      el.tabLocal.addEventListener("click", () => {
        el.tabLocal.classList.add("active");
        if (el.tabRoom) el.tabRoom.classList.remove("active");
        if (el.roomPill) el.roomPill.classList.add("hidden");
        if (el.btnUndo) el.btnUndo.disabled = false;
        if (el.labelAutoFlip) el.labelAutoFlip.classList.remove("hidden");
        state.mode = "local";
        state.isPartyRoom = false;
        state.roomCode = null;
        state.perspective = "w";
        if (state.pollTimer) {
          clearInterval(state.pollTimer);
          state.pollTimer = null;
        }
        resetGame();
      });
    }

    if (el.tabRoom) {
      el.tabRoom.addEventListener("click", () => {
        if (el.modalRoomSetup) el.modalRoomSetup.showModal();
      });
    }

    if (el.btnCloseRoomModal) {
      el.btnCloseRoomModal.addEventListener("click", () => el.modalRoomSetup && el.modalRoomSetup.close());
    }

    if (el.tabCreateRoom) {
      el.tabCreateRoom.addEventListener("click", () => {
        el.tabCreateRoom.classList.add("active");
        if (el.tabJoinRoom) el.tabJoinRoom.classList.remove("active");
        if (el.bodyCreateRoom) el.bodyCreateRoom.classList.remove("hidden");
        if (el.bodyJoinRoom) el.bodyJoinRoom.classList.add("hidden");
      });
    }

    if (el.tabJoinRoom) {
      el.tabJoinRoom.addEventListener("click", () => {
        el.tabJoinRoom.classList.add("active");
        if (el.tabCreateRoom) el.tabCreateRoom.classList.remove("active");
        if (el.bodyJoinRoom) el.bodyJoinRoom.classList.remove("hidden");
        if (el.bodyCreateRoom) el.bodyCreateRoom.classList.add("hidden");
      });
    }

    // Reusable Create Room Function (Used by both Modal and Lobby Screen)
    async function createRoomWithName(hostName, timeSec) {
      const validTime = Number.isNaN(timeSec) || !timeSec ? (state.timeControl || 300) : timeSec;
      if (el.btnSubmitCreateLobby) {
        el.btnSubmitCreateLobby.disabled = true;
        el.btnSubmitCreateLobby.textContent = "Oppretter rom…";
      }
      if (el.btnSubmitCreateRoom) {
        el.btnSubmitCreateRoom.disabled = true;
        el.btnSubmitCreateRoom.textContent = "Oppretter rom…";
      }

      try {
        const resp = await fetch("/api/sjakk/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostName: hostName,
            timeControl: validTime,
          }),
        });

        const data = await resp.json();
        if (data.ok) {
          state.roomCode = data.roomCode;
          state.playerId = data.playerId;
          state.playerColor = "w";
          state.isHost = true;
          state.isPartyRoom = false;
          state.mode = "room";
          state.perspective = "w";
          state.gameStatus = "waiting";

          if (el.tabRoom) el.tabRoom.classList.add("active");
          if (el.tabLocal) el.tabLocal.classList.remove("active");
          if (el.roomPill) el.roomPill.classList.remove("hidden");
          if (el.roomPillCode) el.roomPillCode.textContent = data.roomCode;
          if (el.btnUndo) el.btnUndo.disabled = true;
          if (el.labelAutoFlip) el.labelAutoFlip.classList.add("hidden");

          if (el.modalRoomSetup && el.modalRoomSetup.open) el.modalRoomSetup.close();
          resetGame();
          showView("game");
          startRoomPolling();
        } else {
          alert(data.error || "Kunne ikke opprette rom.");
        }
      } catch (err) {
        alert("Feil ved opprettelse av rom.");
      } finally {
        if (el.btnSubmitCreateLobby) {
          el.btnSubmitCreateLobby.disabled = false;
          el.btnSubmitCreateLobby.textContent = "Opprett sjakkrom";
        }
        if (el.btnSubmitCreateRoom) {
          el.btnSubmitCreateRoom.disabled = false;
          el.btnSubmitCreateRoom.textContent = "Opprett Sjakkrom";
        }
      }
    }

    // Reusable Join Room Function (Used by both Modal and Lobby Screen)
    async function joinRoomWithCode(code, playerName) {
      if (!code) {
        alert("Skriv inn en romkode.");
        return;
      }

      if (el.btnSubmitJoinLobby) {
        el.btnSubmitJoinLobby.disabled = true;
        el.btnSubmitJoinLobby.textContent = "Kobler til…";
      }
      if (el.btnSubmitJoinRoom) {
        el.btnSubmitJoinRoom.disabled = true;
        el.btnSubmitJoinRoom.textContent = "Kobler til…";
      }

      try {
        const resp = await fetch("/api/sjakk/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: code,
            playerName: playerName,
          }),
        });

        const data = await resp.json();
        if (data.ok) {
          state.roomCode = data.roomCode;
          state.playerId = data.playerId;
          state.playerColor = data.playerColor;
          state.isHost = false;
          state.isPartyRoom = false;
          state.mode = "room";
          state.perspective = data.playerColor === "b" ? "b" : "w";
          state.gameStatus = "waiting";

          if (el.tabRoom) el.tabRoom.classList.add("active");
          if (el.tabLocal) el.tabLocal.classList.remove("active");
          if (el.roomPill) el.roomPill.classList.remove("hidden");
          if (el.roomPillCode) el.roomPillCode.textContent = data.roomCode;
          if (el.btnUndo) el.btnUndo.disabled = true;
          if (el.labelAutoFlip) el.labelAutoFlip.classList.add("hidden");

          if (el.modalRoomSetup && el.modalRoomSetup.open) el.modalRoomSetup.close();
          resetGame();
          showView("game");
          startRoomPolling();
        } else {
          alert(data.error || "Fant ikke rommet.");
        }
      } catch (err) {
        alert("Feil ved tilkobling til rom.");
      } finally {
        if (el.btnSubmitJoinLobby) {
          el.btnSubmitJoinLobby.disabled = false;
          el.btnSubmitJoinLobby.textContent = "Koble til parti";
        }
        if (el.btnSubmitJoinRoom) {
          el.btnSubmitJoinRoom.disabled = false;
          el.btnSubmitJoinRoom.textContent = "Bli med i partiet";
        }
      }
    }

    // Submit Create Room from Modal
    if (el.btnSubmitCreateRoom) {
      el.btnSubmitCreateRoom.addEventListener("click", async () => {
        const hostName = (el.inputHostName ? el.inputHostName.value : "").trim() || "Hvit";
        const timeSec = el.selectTimeControl ? parseInt(el.selectTimeControl.value, 10) : 300;
        await createRoomWithName(hostName, timeSec);
      });
    }

    // Submit Join Room from Modal
    if (el.btnSubmitJoinRoom) {
      el.btnSubmitJoinRoom.addEventListener("click", async () => {
        const code = (el.inputRoomCode ? el.inputRoomCode.value : "").trim().toUpperCase();
        const playerName = (el.inputJoinName ? el.inputJoinName.value : "").trim() || "Svart";
        await joinRoomWithCode(code, playerName);
      });
    }

    // Copy Room Link
    if (el.btnCopyRoomLink) {
      el.btnCopyRoomLink.addEventListener("click", async () => {
        const url = `${window.location.origin}/sjakk/?room=${encodeURIComponent(state.roomCode)}`;
        try {
          await navigator.clipboard.writeText(url);
          el.btnCopyRoomLink.textContent = "✓";
          setTimeout(() => {
            if (el.btnCopyRoomLink) el.btnCopyRoomLink.textContent = "Kopier";
          }, 1500);
        } catch (_) {
          prompt("Kopier lenke:", url);
        }
      });
    }

    // Undo Move (Local mode)
    if (el.btnUndo) {
      el.btnUndo.addEventListener("click", () => {
        if (state.mode === "room") return;
        if (state.timeControl > 0 && (state.whiteTime <= 0 || state.blackTime <= 0)) return;
        if (state.game.undoMove()) {
          state.selectedSquare = null;
          state.legalMovesForSelected = [];
          state.gameStatus = state.game.history.length > 0 ? "active" : "waiting";
          state.customGameOverTitle = null;
          state.customGameOverReason = null;
          state.dismissedGameOver = false;
          state.lastMove = state.game.history.length
            ? { ...state.game.history[state.game.history.length - 1] }
            : null;
          if (state.autoFlip) {
            state.perspective = state.game.turn;
          }
          renderBoard();
        }
      });
    }

    // Draw Offer
    if (el.btnDrawOffer) {
      el.btnDrawOffer.addEventListener("click", async () => {
        if (state.gameStatus === "finished") return;
        if (state.mode === "room") {
          await fetch("/api/sjakk/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomCode: state.roomCode,
              playerId: state.playerId,
              action: "draw",
            }),
          });
        } else {
          const agree = confirm("Begge spillere godtar remis (uavgjort)?");
          if (agree) {
            stopTimer();
            state.gameStatus = "finished";
            state.dismissedGameOver = false;
            state.selectedSquare = null;
            state.legalMovesForSelected = [];
            state.customGameOverTitle = "Remis! 🤝";
            state.customGameOverReason = "Spillerne ble enige om remis.";
            soundEngine.playVictory();
            renderBoard();
            triggerGameOver(state.customGameOverTitle, state.customGameOverReason);
          }
        }
      });
    }

    // Resign
    if (el.btnResign) {
      el.btnResign.addEventListener("click", async () => {
        if (state.gameStatus === "finished") return;
        const confirmResign = confirm("Er du sikker på at du vil gi opp partiet?");
        if (!confirmResign) return;

        if (state.mode === "room") {
          await fetch("/api/sjakk/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomCode: state.roomCode,
              playerId: state.playerId,
              action: "resign",
            }),
          });
        } else {
          stopTimer();
          state.gameStatus = "finished";
          state.dismissedGameOver = false;
          state.selectedSquare = null;
          state.legalMovesForSelected = [];
          const resigning = state.game.turn === "w" ? "Hvit" : "Svart";
          const winner = state.game.turn === "w" ? "Svart" : "Hvit";
          state.customGameOverTitle = `${winner} vinner! 🏆`;
          state.customGameOverReason = `${resigning} ga opp partiet.`;
          soundEngine.playVictory();
          renderBoard();
          triggerGameOver(state.customGameOverTitle, state.customGameOverReason);
        }
      });
    }

    // New Game / Rematch
    if (el.btnNewGame) {
      el.btnNewGame.addEventListener("click", async () => {
        if (state.mode === "room") {
          if (state.gameStatus === "finished") {
            if (el.btnGameOverRematch) el.btnGameOverRematch.click();
          } else {
            alert("Du kan ikke starte nytt parti midt i en nettduell uten å gi opp eller tilby remis.");
          }
          return;
        }
        if (confirm("Starte et nytt parti?")) {
          state.dismissedGameOver = false;
          if (el.modalGameOver && el.modalGameOver.open) {
            el.modalGameOver.close();
          }
          resetGame();
        }
      });
    }

    if (el.btnGameOverRematch) {
      el.btnGameOverRematch.addEventListener("click", async () => {
        if (state.mode === "room") {
          el.btnGameOverRematch.disabled = true;
          el.btnGameOverRematch.textContent = "Sender forespørsel… ⏳";
          try {
            const resp = await fetch("/api/sjakk/action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roomCode: state.roomCode,
                playerId: state.playerId,
                action: "rematch",
              }),
            });
            const data = await resp.json();
            if (data.ok) {
              el.btnGameOverRematch.textContent = "Venter på motstander… ⏳";
            } else {
              alert(data.error || "Kunne ikke be om omkamp.");
              el.btnGameOverRematch.disabled = false;
              el.btnGameOverRematch.textContent = "Spill omkamp";
            }
          } catch (err) {
            el.btnGameOverRematch.disabled = false;
            el.btnGameOverRematch.textContent = "Spill omkamp";
          }
        } else {
          state.dismissedGameOver = false;
          if (el.modalGameOver && el.modalGameOver.open) {
            el.modalGameOver.close();
          }
          resetGame();
        }
      });
    }

    if (el.btnGameOverClose) {
      el.btnGameOverClose.addEventListener("click", () => {
        state.dismissedGameOver = true;
        if (el.modalGameOver && el.modalGameOver.open) {
          el.modalGameOver.close();
        }
        const reason =
          state.customGameOverReason ||
          (el.gameOverReason ? el.gameOverReason.textContent : "") ||
          "Partiet er avsluttet.";
        updateStatusTextForDismissed(reason);
      });
    }

    if (el.btnGameOverLounge) {
      el.btnGameOverLounge.addEventListener("click", returnToLounge);
    }
    if (el.btnBack) {
      el.btnBack.addEventListener("click", returnToLounge);
    }

    // Time Control Change
    if (el.selectTimeControl) {
      el.selectTimeControl.addEventListener("change", (e) => {
        if (state.mode === "room") return;
        state.timeControl = parseInt(e.target.value, 10);
        state.whiteTime = state.timeControl;
        state.blackTime = state.timeControl;
        renderClocks();
      });
    }

    // Auto Flip
    if (el.checkAutoFlip) {
      el.checkAutoFlip.addEventListener("change", (e) => {
        state.autoFlip = e.target.checked;
        if (state.autoFlip) {
          state.perspective = state.game.turn;
          renderBoard();
        }
      });
    }

    // Parse URL params for ?room=CODE
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room") || params.get("code");
    const playerParam = params.get("player") || params.get("playerId");

    if (roomParam) {
      const roomUpper = roomParam.toUpperCase();
      if (el.inputRoomCode) el.inputRoomCode.value = roomUpper;
      if (el.inputRoomCodeLobby) el.inputRoomCodeLobby.value = roomUpper;
      if (el.tabLobbyRoom) el.tabLobbyRoom.click();
      if (el.tabRoom) el.tabRoom.click();
      if (playerParam) {
        state.playerId = playerParam;
        state.roomCode = roomUpper;
        state.partyRoomCode = roomUpper;
        state.isPartyRoom = true;
        state.mode = "room";
        sessionStorage.setItem("party_room_code", roomUpper);
        sessionStorage.setItem("party_player_id", playerParam);
        if (el.tabRoom) el.tabRoom.classList.add("active");
        if (el.tabLocal) el.tabLocal.classList.remove("active");
        if (el.roomPill) el.roomPill.classList.remove("hidden");
        if (el.roomPillCode) el.roomPillCode.textContent = state.roomCode;
        if (el.btnUndo) el.btnUndo.disabled = true;
        if (el.labelAutoFlip) el.labelAutoFlip.classList.add("hidden");
        updateExitButtonsLabels();
        if (el.modalRoomSetup && el.modalRoomSetup.open) el.modalRoomSetup.close();
        showView("game");
        startRoomPolling();
      } else {
        showView("lobby");
      }
    } else {
      showView("lobby");
    }
  }

  function showView(viewName) {
    if (!el.viewLobby || !el.viewGame) return;
    if (viewName === "lobby") {
      el.viewLobby.classList.remove("hidden");
      el.viewGame.classList.add("hidden");
      if (el.btnExitToLobby) el.btnExitToLobby.classList.add("hidden");
      stopTimer();
      stopRoomPolling();
    } else if (viewName === "game") {
      el.viewLobby.classList.add("hidden");
      el.viewGame.classList.remove("hidden");
      if (el.btnExitToLobby) el.btnExitToLobby.classList.remove("hidden");
    }
  }

  function playBotTurn() {
    if (state.mode !== "bot" || state.gameStatus === "finished" || state.game.turn !== state.botColor) return;
    const legalMoves = state.game.getLegalMoves();
    if (!legalMoves.length) return;

    let chosenMove = null;
    if (state.botDifficulty === "easy") {
      const captures = legalMoves.filter(
        (m) => !!state.game.board[m.to.r][m.to.c] || m.isEnPassant
      );
      if (captures.length && Math.random() < 0.6) {
        chosenMove = captures[Math.floor(Math.random() * captures.length)];
      } else {
        chosenMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      }
    } else {
      let bestScore = -9999;
      const botColor = state.game.turn;
      const oppColor = botColor === "w" ? "b" : "w";

      for (const move of legalMoves) {
        let score = 0;
        const target = state.game.board[move.to.r][move.to.c];
        if (target) {
          score += (PIECE_VALUES[target.toLowerCase()] || 1) * 10;
        }
        if (move.isEnPassant) score += 10;
        if ((move.to.r === 3 || move.to.r === 4) && (move.to.c === 3 || move.to.c === 4)) {
          score += 3;
        }
        const sim = state.game.clone();
        sim.applyMoveInternal(move);
        if (sim.isInCheck(oppColor)) score += 6;
        if (sim.isSquareAttacked(move.to.r, move.to.c, oppColor)) {
          score -= (PIECE_VALUES[(move.piece || "p").toLowerCase()] || 1) * 7;
        }
        score += Math.random() * 2.5;
        if (score > bestScore) {
          bestScore = score;
          chosenMove = move;
        }
      }
    }

    if (chosenMove) {
      if (
        chosenMove.piece &&
        chosenMove.piece.toUpperCase() === "P" &&
        (chosenMove.to.r === 0 || chosenMove.to.r === 7)
      ) {
        chosenMove.promo = "Q";
      }
      executeMove(chosenMove);
    }
  }

  function initLobbyTabs() {
    const tabs = [
      { btn: el.tabLobbyLocal, panel: el.panelLobbyLocal },
      { btn: el.tabLobbyRoom, panel: el.panelLobbyRoom },
      { btn: el.tabLobbyBot, panel: el.panelLobbyBot },
    ];

    tabs.forEach(({ btn, panel }) => {
      if (!btn || !panel) return;
      btn.addEventListener("click", () => {
        tabs.forEach((t) => {
          if (t.btn) {
            t.btn.classList.remove("active");
            t.btn.setAttribute("aria-selected", "false");
          }
          if (t.panel) t.panel.classList.add("hidden");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        panel.classList.remove("hidden");
      });
    });

    if (el.controlBotColor) {
      el.controlBotColor.querySelectorAll(".seg-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          el.controlBotColor.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.userColorChoice = btn.dataset.color || "w";
        });
      });
    }

    if (el.controlBotDiff) {
      el.controlBotDiff.querySelectorAll(".seg-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          el.controlBotDiff.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.botDifficulty = btn.dataset.diff || "hard";
        });
      });
    }

    if (el.btnStartLocalMatch) {
      el.btnStartLocalMatch.addEventListener("click", () => {
        state.mode = "local";
        state.autoFlip = el.checkLocalAutoFlip ? el.checkLocalAutoFlip.checked : false;
        if (el.checkAutoFlip) el.checkAutoFlip.checked = state.autoFlip;
        const timeVal = parseInt(el.selectLocalTime.value, 10);
        state.timeControl = timeVal;
        state.whiteTime = timeVal;
        state.blackTime = timeVal;
        state.perspective = "w";
        if (el.selectTimeControl) el.selectTimeControl.value = String(timeVal);
        if (el.labelAutoFlip) el.labelAutoFlip.classList.remove("hidden");
        if (el.roomPill) el.roomPill.classList.add("hidden");
        el.btnUndo.disabled = false;
        resetGame();
        showView("game");
      });
    }

    if (window.PartyConnect) {
      window.PartyConnect.init({
        gameId: "sjakk",
        createBtnId: "btnCreatePartyRoom",
        joinBtnId: "btnJoinPartyRoom",
        hostInputId: "inputPartyHostName",
        joinInputId: "inputPartyJoinName",
        codeInputId: "inputPartyRoomCode",
      });
    }

    if (el.btnSubmitCreateLobby) {
      el.btnSubmitCreateLobby.addEventListener("click", async () => {
        const name = (el.inputHostNameLobby ? el.inputHostNameLobby.value : "").trim() || "Hvit";
        const timeVal = parseInt(el.selectOnlineTime ? el.selectOnlineTime.value : "300", 10);
        state.timeControl = timeVal;
        state.whiteTime = timeVal;
        state.blackTime = timeVal;
        await createRoomWithName(name, timeVal);
      });
    }

    if (el.btnSubmitJoinLobby) {
      el.btnSubmitJoinLobby.addEventListener("click", async () => {
        const code = (el.inputRoomCodeLobby ? el.inputRoomCodeLobby.value : "").trim().toUpperCase();
        const name = (el.inputJoinNameLobby ? el.inputJoinNameLobby.value : "").trim() || "Svart";
        await joinRoomWithCode(code, name);
      });
    }

    if (el.btnStartBotMatch) {
      el.btnStartBotMatch.addEventListener("click", () => {
        state.mode = "bot";
        state.autoFlip = false;
        if (el.labelAutoFlip) el.labelAutoFlip.classList.add("hidden");
        if (el.roomPill) el.roomPill.classList.add("hidden");
        el.btnUndo.disabled = false;

        let chosenColor = state.userColorChoice;
        if (chosenColor === "random") {
          chosenColor = Math.random() < 0.5 ? "w" : "b";
        }
        state.playerColor = chosenColor;
        state.botColor = chosenColor === "w" ? "b" : "w";
        state.perspective = chosenColor;

        const timeVal = parseInt(el.selectBotTime ? el.selectBotTime.value : "300", 10);
        state.timeControl = timeVal;
        state.whiteTime = timeVal;
        state.blackTime = timeVal;
        if (el.selectTimeControl) el.selectTimeControl.value = String(timeVal);

        resetGame();
        state.gameStatus = "active";
        showView("game");

        if (state.game.turn !== state.playerColor) {
          setTimeout(playBotTurn, 600);
        }
      });
    }

    if (el.btnExitToLobby) {
      el.btnExitToLobby.addEventListener("click", () => {
        showView("lobby");
      });
    }
  }

  // --- Initial Launch ---
  function init() {
    initBoardDOM();
    initLobbyTabs();
    initEvents();
    renderBoard();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
