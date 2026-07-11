<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Context: IWantCheckmate Chess Arena (Variant Edition)

This document outlines the user interface (UI) design system, core functional specifications, and data model arrangements for this custom chess variant to guide development.

---

## 1. User Interface (UI) Specifications & Design Aesthetics

The UI is built with a state-of-the-art **Glassmorphic and Cyberpunk-infused Design System** crafted to feel high-tech, alive, and tactile. It uses modern typography and custom styles instead of browser defaults to ensure visual excellence.

### A. The Glassmorphic System
* **Frosted Backgrounds**: Uses semitransparent panels leveraging CSS backdrop-filters (`backdrop-blur-md bg-zinc-950/70` or `bg-slate-900/60`).
* **Thin Glowing Borders**: High-tech thin border lines (`border border-white/10` or `border-[#10b981]/30`) that frame panels.
* **Accent Color Palettes**:
  * *Cyber (Default / Neon)*: Deep emerald-green glows, bright cyan markers, and dark slate backgrounds with high-contrast lime highlights.
  * *Purple (Space / Stellar)*: Royal purple glows, lavender-indigo tones, and stellar radial backdrops.
  * *Classic*: Dark charcoal-gray and warm ivory tones for players seeking a traditional look.

### B. Micro-Animations & Dynamic Hover Effects
* **Tactile Buttons**: Control panels, tabs, and action buttons feature smooth scale-ups (`hover:scale-[1.02] active:scale-[0.98]`) and brightness shifts.
* **Glow Pulses**: The AI bot thinking status and active game indicators utilize infinite keyframe glow pulses (`animate-pulse` and box-shadow glows).
* **Chess Piece Highlighting**:
  * Selected squares receive a soft, custom-colored radial highlight.
  * Legally available moves display a translucent dot overlay or a thin, pulsing ring on occupied target squares.
  * The last played move is highlighted with a distinct, semi-transparent orange border/overlay to maintain clear visibility.

### C. Responsive Layout Grid
* **Desktop View**: Multi-column split grid:
  * *Left Column*: Real-time vertical Evaluation Bar aligned next to the interactive Core Chessboard.
  * *Right Column*: Flexible multi-tab Control Panel containing bot profiles, clocks, match customization sliders, and the live interactive Move History Log.
* **Mobile View**: Responsive stacked layout:
  * The chessboard automatically scales to fit 100% of the mobile viewport width.
  * The Evaluation Bar switches to a slim horizontal strip above/below the board.
  * The Control Panel components collapse into touch-friendly accordion tabs.

### D. Core Board Customizations
* **Board Themes**: Customizable grid colors (e.g., cyber green/dark green, purple/lavender, classic maple/wood grain).
* **Piece Styles (Classic, Neon, Wood)**: Matches separate custom SVG asset systems that render crisp vector graphics at any resolution.
* **Pawn Promotion Overlay**: A modal displaying options for Queen, Rook, Bishop, and Knight with a sleek backdrop blur to focus the player's choice.
* **User Profile Customizer**: A premium modular popup where users can easily set their username, ELO rating, titles, and track progress.

---

## 2. Functional Specifications

This game is a specialized chess variant featuring piece challenge systems, drift-proof timers, and hybrid evaluation fallbacks.

### A. Programmatic Piece Challenge System
Players can play custom piece challenges that programmatically generate asymmetric starting boards:
* **Challenge Presets**:
  1. `challenge_beat` ("How many to beat"): The player tries to defeat a specific number of pieces.
  2. `challenge_lose` ("How many to lose"): The player tries to lose to a specific number of pieces.
* **Programmatic Generator (`getChallengeStartingFen`)**:
  - Dynamically sets up standard pieces on the player's side.
  - Places only a King plus a specified quantity ($N$) of a chosen target piece (Queen, Rook, Bishop, Knight, or Pawn) on the opponent's side.
  - Automatically scales the challenge: winning adds more pieces to the bot's side, while losing resets or scales down the count.

### B. Drift-Proof Countdown Timers
* Standard JS timers (`setInterval`) drift due to browser thread blocking. This variant solves this using a **drift-proof clock**:
  - Measures the exact delta-time elapsed between ticks using `Date.now() - lastTick.current`.
  - Automatically updates clock balances for the active side and implements precise time-out terminations with custom sound notifications.

### C. Live Hybrid Evaluation Pipeline
The game displays continuous positional evaluations by checking three sources in priority order:
1. **Stockfish Online API**: Fetches remote evaluations with depth 10.
2. **Local Stockfish WASM**: If offline or blocked by CORS/network errors, evaluates the position directly inside the user's browser thread.
3. **Material Fallback**: Evaluates and tallies material differences directly from the current board array.

### D. Audio Synthesizer Orchestration
Built-in sound effects are programmatically synthesized or played via `chessAudio` triggers for tactile feedback during:
* Move execution (`playMove`)
* Capturing pieces (`playCapture`)
* Checking the King (`playCheck`)
* Victory / Defeat soundscapes (`playVictory` / `playDefeat`)

### E. Persistent State Storage
Player profile ratings, challenge win-streaks, and piece counts are serialized and preserved in the user's local browser storage (`iwantcheckmate_user_profile`, `iwantcheckmate_challenge_records`) to maintain progress across sessions.

---

## 3. Bot Models & Dataset Specifications (`/bot` Subdirectory)

All neural network models, pre-trained weights, move probability datasets, and mappings are neatly organized in the `bot` subdirectory located in the project's root folder:

### A. Subdirectory Contents:
1. **PyTorch Models (`.pt` files)**: Full model checkpoints containing neural network weights, used for model fine-tuning, python training, or server fallback predictions.
2. **ONNX Models (`.onnx` files)**: Highly optimized web-inference models designed for high-speed client-side execution in the browser via WebAssembly.
3. **JSON and Parquet Datasets**:
   - Outlines **move probability distribution arrays** mapped to specific board states.
   - Houses **1-1 highest move mappings** for instant lookups without invoking live neural engine calls.

### B. Guidance for AI Agents:
When executing backend logic, model predictions, or evaluation scripts, you must navigate to the `/bot` subdirectory and **choose your file format accordingly**:
* Use **ONNX (`.onnx`)** files for web-side browser inference integrations.
* Use **PyTorch (`.pt`)** files for native python scripts or backend neural evaluations.
* Use **JSON/ Parquet** files for making the moves as long as the fen is in the file and if not, use onnx models
* Use **JSON / Parquet** files for tabular data verification, legal move probability evaluations, or fast key-value lookups.
