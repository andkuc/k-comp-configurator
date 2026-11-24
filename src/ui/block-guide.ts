// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Interactive Kurzinfo Popups & Overview Handbook for Program Structure Blocks (13 Techniques + Visual Diagrams)
import { state, $, escapeHtml, isLightTheme } from '../core/state';
import { BLOCK_CATALOG, BLOCK_GROUPS, getBlockDef, addCodeBlock } from '../core/code-blocks';
import { highlightCppCode } from '../core/codegen';
import { t, tBlockGuide } from '../i18n/index';

// Crisp, Inkscape-safe (no SVG filter tags) inline SVG conceptual diagrams per technique, adapted to Dark & White Mode
function buildBlockDiagramSvg(type, accent) {
  const light = isLightTheme();
  const bg = light ? '#f8fafc' : '#0b1120';
  const card = light ? '#ffffff' : '#131d33';
  const card2 = light ? '#f1f5f9' : '#1b2944';
  const border = light ? '#cbd5e1' : '#334155';
  const ink = light ? '#0f172a' : '#f1f5f9';
  const muted = light ? '#475569' : '#94a3b8';
  const hiBg = light ? '#e0f2fe' : '#0c2c4a';
  const okBg = light ? '#dcfce7' : '#064e3b';
  const okInk = light ? '#15803d' : '#6ee7b7';
  const warnBg = light ? '#fef3c7' : '#451a03';
  const warnInk = light ? '#b45309' : '#fde68a';
  const errBg = light ? '#fee2e2' : '#450a0a';
  const errInk = light ? '#b91c1c' : '#fca5a5';
  const acc = light && accent === '#38bdf8' ? '#0284c7' : accent;

  const wrap = (inner) => `
    <svg class="bguide-svg" viewBox="0 0 460 116" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <rect x="0.75" y="0.75" width="458.5" height="114.5" rx="8" fill="${bg}" stroke="${border}" stroke-width="1.2"/>
      ${inner}
    </svg>`;

  const arrow = (x1, y1, x2, y2, col = muted) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2" stroke-linecap="round"/>` +
    `<polygon points="${x2},${y2} ${x2 - 6},${y2 - 3.5} ${x2 - 6},${y2 + 3.5}" fill="${col}"/>`;

  if (type === 'eva') {
    return wrap(`
      <rect x="18" y="24" width="118" height="50" rx="7" fill="${okBg}" stroke="${okInk}" stroke-width="1.5"/>
      <text x="77" y="45" fill="${okInk}" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui,sans-serif">1. INPUT</text>
      <text x="77" y="62" fill="${ink}" font-size="9.5" text-anchor="middle" font-family="Consolas,monospace">readInputs()</text>
      ${arrow(138, 49, 168, 49, acc)}
      <rect x="171" y="24" width="118" height="50" rx="7" fill="${hiBg}" stroke="${acc}" stroke-width="1.6"/>
      <text x="230" y="45" fill="${acc}" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui,sans-serif">2. UPDATE</text>
      <text x="230" y="62" fill="${ink}" font-size="9.5" text-anchor="middle" font-family="Consolas,monospace">updateLogic()</text>
      ${arrow(291, 49, 321, 49, acc)}
      <rect x="324" y="24" width="118" height="50" rx="7" fill="${warnBg}" stroke="${warnInk}" stroke-width="1.5"/>
      <text x="383" y="45" fill="${warnInk}" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui,sans-serif">3. OUTPUT</text>
      <text x="383" y="62" fill="${ink}" font-size="9.5" text-anchor="middle" font-family="Consolas,monospace">renderOutputs()</text>
      <path d="M 383 76 L 383 97 L 77 97 L 77 79" fill="none" stroke="${muted}" stroke-width="1.6" stroke-dasharray="4,3"/>
      <polygon points="77,75 73.5,82 80.5,82" fill="${muted}"/>
      <rect x="192" y="88" width="76" height="16" rx="4" fill="${card}" stroke="${border}"/>
      <text x="230" y="99" fill="${muted}" font-size="9" font-weight="700" text-anchor="middle" font-family="Consolas,monospace">loop() ↺</text>
    `);
  }

  if (type === 'fsm') {
    return wrap(`
      <rect x="20" y="26" width="106" height="46" rx="8" fill="${card}" stroke="${border}" stroke-width="1.6"/>
      <text x="73" y="45" fill="${ink}" font-size="10.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">0: MENU</text>
      <text x="73" y="61" fill="${muted}" font-size="9" text-anchor="middle" font-family="system-ui,sans-serif">Start Screen</text>
      ${arrow(128, 49, 174, 49, acc)}
      <text x="151" y="40" fill="${acc}" font-size="8.5" font-weight="700" text-anchor="middle" font-family="Consolas,monospace">START</text>
      <rect x="177" y="26" width="106" height="46" rx="8" fill="${okBg}" stroke="${okInk}" stroke-width="1.8"/>
      <text x="230" y="45" fill="${okInk}" font-size="10.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">1: PLAYING</text>
      <text x="230" y="61" fill="${ink}" font-size="9" text-anchor="middle" font-family="system-ui,sans-serif">Active Rules</text>
      ${arrow(285, 49, 331, 49, errInk)}
      <text x="308" y="40" fill="${errInk}" font-size="8.5" font-weight="700" text-anchor="middle" font-family="Consolas,monospace">END</text>
      <rect x="334" y="26" width="106" height="46" rx="8" fill="${errBg}" stroke="${errInk}" stroke-width="1.5"/>
      <text x="387" y="45" fill="${errInk}" font-size="10.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">2: GAMEOVER</text>
      <text x="387" y="61" fill="${ink}" font-size="9" text-anchor="middle" font-family="system-ui,sans-serif">Score / Reset</text>
      <path d="M 387 74 L 387 96 L 73 96 L 73 77" fill="none" stroke="${muted}" stroke-width="1.5" stroke-dasharray="4,3"/>
      <polygon points="73,73 69.5,80 76.5,80" fill="${muted}"/>
      <text x="230" y="92" fill="${muted}" font-size="8.8" font-weight="700" text-anchor="middle" font-family="Consolas,monospace">switch (gameState)  •  1 B SRAM</text>
    `);
  }

  if (type === 'toggle') {
    return wrap(`
      <rect x="36" y="30" width="136" height="54" rx="8" fill="${card2}" stroke="${border}" stroke-width="1.5"/>
      <text x="104" y="51" fill="${muted}" font-size="11" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">false</text>
      <text x="104" y="69" fill="${ink}" font-size="9.5" text-anchor="middle" font-family="system-ui,sans-serif">Paused / Standby</text>
      <path d="M 176 44 L 280 44" fill="none" stroke="${okInk}" stroke-width="2"/>
      <polygon points="284,44 277,40.5 277,47.5" fill="${okInk}"/>
      <path d="M 284 70 L 180 70" fill="none" stroke="${muted}" stroke-width="2"/>
      <polygon points="176,70 183,66.5 183,73.5" fill="${muted}"/>
      <rect x="192" y="21" width="76" height="17" rx="4" fill="${card}" stroke="${acc}"/>
      <text x="230" y="33" fill="${acc}" font-size="8.8" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">!isRunning</text>
      <rect x="288" y="30" width="136" height="54" rx="8" fill="${okBg}" stroke="${okInk}" stroke-width="1.8"/>
      <text x="356" y="51" fill="${okInk}" font-size="11" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">true</text>
      <text x="356" y="69" fill="${ink}" font-size="9.5" text-anchor="middle" font-family="system-ui,sans-serif">Active Mode</text>
    `);
  }

  if (type === 'timer') {
    return wrap(`
      <text x="20" y="24" fill="${muted}" font-size="9.5" font-weight="700" font-family="Consolas,monospace">millis() timeline (loop() never stops!)</text>
      <line x1="22" y1="64" x2="432" y2="64" stroke="${border}" stroke-width="3" stroke-linecap="round"/>
      <polygon points="438,64 430,59.5 430,68.5" fill="${muted}"/>
      ${[60, 175, 290, 405].map((x, idx) => `
        <line x1="${x}" y1="42" x2="${x}" y2="74" stroke="${acc}" stroke-width="2"/>
        <circle cx="${x}" cy="64" r="6" fill="${acc}"/>
        <rect x="${x - 24}" y="28" width="48" height="15" rx="4" fill="${warnBg}" stroke="${acc}" stroke-width="1"/>
        <text x="${x}" y="38.5" fill="${warnInk}" font-size="8.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">+${idx * 250}ms</text>
      `).join('')}
      <text x="117" y="92" fill="${okInk}" font-size="9" font-weight="700" text-anchor="middle" font-family="system-ui,sans-serif">Buttons &amp; OLED active</text>
      <text x="232" y="92" fill="${okInk}" font-size="9" font-weight="700" text-anchor="middle" font-family="system-ui,sans-serif">Buttons &amp; OLED active</text>
      <text x="347" y="92" fill="${okInk}" font-size="9" font-weight="700" text-anchor="middle" font-family="system-ui,sans-serif">Zero delay() freeze</text>
    `);
  }

  if (type === 'oneshot') {
    return wrap(`
      <rect x="20" y="34" width="96" height="44" rx="7" fill="${hiBg}" stroke="${acc}" stroke-width="1.5"/>
      <text x="68" y="53" fill="${acc}" font-size="10" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">Start</text>
      <text x="68" y="68" fill="${ink}" font-size="8.5" text-anchor="middle" font-family="Consolas,monospace">active = true</text>
      ${arrow(118, 56, 150, 56, acc)}
      <rect x="154" y="42" width="144" height="28" rx="6" fill="${card2}" stroke="${border}" stroke-width="1.4"/>
      <rect x="156" y="44" width="102" height="24" rx="4" fill="${warnBg}" stroke="${warnInk}" stroke-width="1"/>
      <text x="226" y="60" fill="${ink}" font-size="9.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">2500 ms…</text>
      ${arrow(300, 56, 332, 56, okInk)}
      <rect x="336" y="34" width="104" height="44" rx="7" fill="${okBg}" stroke="${okInk}" stroke-width="1.6"/>
      <text x="388" y="53" fill="${okInk}" font-size="10" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">Run 1×</text>
      <text x="388" y="68" fill="${ink}" font-size="8.5" text-anchor="middle" font-family="Consolas,monospace">active = false</text>
    `);
  }

  if (type === 'debug_tick') {
    return wrap(`
      <rect x="20" y="28" width="118" height="58" rx="7" fill="${card2}" stroke="${border}" stroke-width="1.4"/>
      <text x="79" y="49" fill="${ink}" font-size="10" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">loop()</text>
      <text x="79" y="65" fill="${muted}" font-size="9" text-anchor="middle" font-family="system-ui,sans-serif">~1000× / sec</text>
      <text x="79" y="79" fill="${errInk}" font-size="8.2" text-anchor="middle" font-family="system-ui,sans-serif">too fast to read</text>
      ${arrow(140, 57, 174, 57, acc)}
      <rect x="178" y="34" width="104" height="46" rx="23" fill="${hiBg}" stroke="${acc}" stroke-width="1.6"/>
      <text x="230" y="54" fill="${acc}" font-size="10" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">500 ms</text>
      <text x="230" y="68" fill="${ink}" font-size="8.5" text-anchor="middle" font-family="system-ui,sans-serif">Gate</text>
      ${arrow(284, 57, 318, 57, okInk)}
      <rect x="322" y="28" width="118" height="58" rx="7" fill="${okBg}" stroke="${okInk}" stroke-width="1.5"/>
      <text x="381" y="49" fill="${okInk}" font-size="10" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">Serial Monitor</text>
      <text x="381" y="65" fill="${ink}" font-size="9" text-anchor="middle" font-family="Consolas,monospace">115200 baud</text>
      <text x="381" y="79" fill="${okInk}" font-size="8.2" text-anchor="middle" font-family="system-ui,sans-serif">2 clean lines/sec</text>
    `);
  }

  if (type === 'btn_callbacks') {
    return wrap(`
      <rect x="20" y="30" width="106" height="54" rx="8" fill="${card}" stroke="${okInk}" stroke-width="1.6"/>
      <circle cx="73" cy="49" r="9" fill="${okInk}"/>
      <text x="73" y="74" fill="${ink}" font-size="9.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">START / SEL</text>
      ${arrow(128, 57, 166, 57, okInk)}
      <rect x="170" y="32" width="114" height="50" rx="7" fill="${card2}" stroke="${border}" stroke-width="1.4"/>
      <text x="227" y="53" fill="${ink}" font-size="9.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">poll...()</text>
      <text x="227" y="69" fill="${muted}" font-size="8.5" text-anchor="middle" font-family="system-ui,sans-serif">Debounce &amp; detect</text>
      ${arrow(286, 57, 322, 57, acc)}
      <rect x="326" y="30" width="114" height="54" rx="8" fill="${okBg}" stroke="${okInk}" stroke-width="1.6"/>
      <text x="383" y="52" fill="${okInk}" font-size="9.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">onStartClicked()</text>
      <text x="383" y="69" fill="${ink}" font-size="8.8" text-anchor="middle" font-family="system-ui,sans-serif">Runs 1× per click</text>
    `);
  }

  if (type === 'oled_grid') {
    const gx = 32, gy = 18, cs = 26;
    let cells = '';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = gx + c * cs, y = gy + r * cs;
        const isCur = r === 1 && c === 1;
        cells += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" fill="${isCur ? hiBg : card}" stroke="${isCur ? acc : border}" stroke-width="${isCur ? '2' : '1'}"/>`;
      }
    }
    // X at (0,0), O at (2,1)
    cells += `<line x1="${gx + 6}" y1="${gy + 6}" x2="${gx + 20}" y2="${gy + 20}" stroke="${acc}" stroke-width="2.2"/>`;
    cells += `<line x1="${gx + 20}" y1="${gy + 6}" x2="${gx + 6}" y2="${gy + 20}" stroke="${acc}" stroke-width="2.2"/>`;
    cells += `<circle cx="${gx + cs + 13}" cy="${gy + 2 * cs + 13}" r="7.5" fill="none" stroke="${warnInk}" stroke-width="2.2"/>`;
    cells += `<rect x="${gx + cs + 3}" y="${gy + cs + 3}" width="20" height="20" fill="none" stroke="${acc}" stroke-width="1.6" stroke-dasharray="3,2"/>`;
    return wrap(`
      ${cells}
      ${arrow(124, 57, 160, 57, acc)}
      <rect x="164" y="18" width="274" height="78" rx="8" fill="${card}" stroke="${border}" stroke-width="1.4"/>
      <text x="178" y="39" fill="${acc}" font-size="10" font-weight="800" font-family="Consolas,monospace">getGridCell(row, col)  →  0 | 1 | 2</text>
      <text x="178" y="59" fill="${okInk}" font-size="10" font-weight="800" font-family="Consolas,monospace">setGridCell(row, col, 1)</text>
      <text x="178" y="80" fill="${muted}" font-size="9.2" font-family="system-ui,sans-serif">drawPieces() renders cells • Full &amp; Paged OLED</text>
    `);
  }

  if (type === 'char_parser') {
    return wrap(`
      <rect x="18" y="34" width="106" height="46" rx="7" fill="${card}" stroke="${border}" stroke-width="1.5"/>
      <text x="71" y="54" fill="${ink}" font-size="9.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">HC-12 / Serial</text>
      <text x="71" y="69" fill="${acc}" font-size="9.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">'S'  'X'  '1'</text>
      ${arrow(126, 57, 160, 57, acc)}
      <rect x="164" y="32" width="114" height="50" rx="7" fill="${hiBg}" stroke="${acc}" stroke-width="1.6"/>
      <text x="221" y="53" fill="${acc}" font-size="10" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">switch (cmd)</text>
      <text x="221" y="69" fill="${ink}" font-size="8.5" text-anchor="middle" font-family="system-ui,sans-serif">1 char • 0 B array</text>
      <line x1="280" y1="57" x2="314" y2="30" stroke="${okInk}" stroke-width="1.8"/>
      <line x1="280" y1="57" x2="314" y2="57" stroke="${errInk}" stroke-width="1.8"/>
      <line x1="280" y1="57" x2="314" y2="84" stroke="${warnInk}" stroke-width="1.8"/>
      <rect x="318" y="18" width="122" height="22" rx="5" fill="${okBg}" stroke="${okInk}"/><text x="379" y="32.5" fill="${okInk}" font-size="9" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">case 'S': Start</text>
      <rect x="318" y="46" width="122" height="22" rx="5" fill="${errBg}" stroke="${errInk}"/><text x="379" y="60.5" fill="${errInk}" font-size="9" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">case 'X': Stop</text>
      <rect x="318" y="74" width="122" height="22" rx="5" fill="${warnBg}" stroke="${warnInk}"/><text x="379" y="88.5" fill="${warnInk}" font-size="9" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">case '1': Mode 1</text>
    `);
  }

  if (type === 'joy_4way') {
    return wrap(`
      <circle cx="96" cy="58" r="42" fill="${card}" stroke="${border}" stroke-width="1.5"/>
      <circle cx="96" cy="58" r="15" fill="${hiBg}" stroke="${acc}" stroke-width="1.4" stroke-dasharray="3,2"/>
      <text x="96" y="30" fill="${okInk}" font-size="11" font-weight="800" text-anchor="middle">▲</text>
      <text x="96" y="94" fill="${okInk}" font-size="11" font-weight="800" text-anchor="middle">▼</text>
      <text x="66" y="62" fill="${okInk}" font-size="11" font-weight="800" text-anchor="middle">◀</text>
      <text x="126" y="62" fill="${okInk}" font-size="11" font-weight="800" text-anchor="middle">▶</text>
      <text x="96" y="61" fill="${acc}" font-size="7.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">0</text>
      ${arrow(146, 58, 178, 58, acc)}
      <rect x="182" y="22" width="258" height="72" rx="8" fill="${card}" stroke="${border}" stroke-width="1.4"/>
      <text x="196" y="43" fill="${okInk}" font-size="10" font-weight="800" font-family="Consolas,monospace">Tilt &gt; ±250  →  1 crisp step</text>
      <text x="196" y="63" fill="${ink}" font-size="9.5" font-family="Consolas,monospace">joyNeutral = false  (locks repeat)</text>
      <text x="196" y="82" fill="${muted}" font-size="9" font-family="system-ui,sans-serif">Release to center → unlocks next step</text>
    `);
  }

  if (type === 'ir_switch') {
    return wrap(`
      <rect x="20" y="24" width="90" height="68" rx="8" fill="${card}" stroke="${border}" stroke-width="1.5"/>
      <circle cx="44" cy="42" r="6" fill="${errInk}"/>
      <circle cx="66" cy="42" r="6" fill="${acc}"/>
      <circle cx="88" cy="42" r="6" fill="${okInk}"/>
      <text x="65" y="68" fill="${ink}" font-size="8.8" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">21-Btn IR</text>
      <text x="65" y="82" fill="${muted}" font-size="8" text-anchor="middle" font-family="Consolas,monospace">38 kHz NEC</text>
      ${arrow(114, 58, 152, 58, acc)}
      <rect x="156" y="32" width="124" height="52" rx="7" fill="${hiBg}" stroke="${acc}" stroke-width="1.6"/>
      <text x="218" y="53" fill="${acc}" font-size="9.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">isIRAvailable()</text>
      <text x="218" y="70" fill="${ink}" font-size="8.5" text-anchor="middle" font-family="system-ui,sans-serif">Interrupt D2 / ~D3</text>
      ${arrow(282, 58, 316, 58, okInk)}
      <rect x="320" y="24" width="120" height="68" rx="7" fill="${card}" stroke="${okInk}" stroke-width="1.5"/>
      <text x="380" y="45" fill="${okInk}" font-size="9" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">IR_BTN_POWER</text>
      <text x="380" y="62" fill="${ink}" font-size="9" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">IR_BTN_PLAY</text>
      <text x="380" y="79" fill="${muted}" font-size="8.5" text-anchor="middle" font-family="Consolas,monospace">IR_BTN_VOL_UP</text>
    `);
  }

  if (type === 'motor_seq') {
    return wrap(`
      <rect x="20" y="28" width="108" height="48" rx="7" fill="${hiBg}" stroke="${acc}" stroke-width="1.5"/>
      <text x="74" y="49" fill="${acc}" font-size="10" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">Step 0</text>
      <text x="74" y="65" fill="${ink}" font-size="8.5" text-anchor="middle" font-family="Consolas,monospace">driveForward()</text>
      ${arrow(130, 52, 174, 52, okInk)}
      <rect x="178" y="28" width="108" height="48" rx="7" fill="${okBg}" stroke="${okInk}" stroke-width="1.5"/>
      <text x="232" y="49" fill="${okInk}" font-size="10" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">Step 1</text>
      <text x="232" y="65" fill="${ink}" font-size="8.5" text-anchor="middle" font-family="Consolas,monospace">turnRight()</text>
      ${arrow(288, 52, 332, 52, warnInk)}
      <rect x="336" y="28" width="104" height="48" rx="7" fill="${warnBg}" stroke="${warnInk}" stroke-width="1.5"/>
      <text x="388" y="49" fill="${warnInk}" font-size="10" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">Step 2…</text>
      <text x="388" y="65" fill="${ink}" font-size="8.5" text-anchor="middle" font-family="Consolas,monospace">next move</text>
      <text x="230" y="99" fill="${muted}" font-size="9" font-weight="700" text-anchor="middle" font-family="Consolas,monospace">if (!isMotorBusy())  •  non-blocking via motorUpdate()</text>
    `);
  }

  // hid_guard
  return wrap(`
    <rect x="20" y="30" width="106" height="54" rx="7" fill="${card}" stroke="${border}" stroke-width="1.5"/>
    <text x="73" y="52" fill="${ink}" font-size="9.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">Sensor / Tilt</text>
    <text x="73" y="69" fill="${muted}" font-size="8.5" text-anchor="middle" font-family="Consolas,monospace">dx, dy</text>
    ${arrow(128, 57, 166, 57, muted)}
    <rect x="170" y="24" width="122" height="66" rx="8" fill="${errBg}" stroke="${errInk}" stroke-width="1.8"/>
    <text x="231" y="47" fill="${errInk}" font-size="10" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">hidEnabled?</text>
    <text x="231" y="64" fill="${ink}" font-size="8.5" text-anchor="middle" font-family="system-ui,sans-serif">START = ON / OFF</text>
    <text x="231" y="80" fill="${warnInk}" font-size="8.2" font-weight="700" text-anchor="middle" font-family="system-ui,sans-serif">Safe on USB plug-in</text>
    ${arrow(294, 57, 330, 57, okInk)}
    <rect x="334" y="30" width="106" height="54" rx="7" fill="${okBg}" stroke="${okInk}" stroke-width="1.6"/>
    <text x="387" y="52" fill="${okInk}" font-size="9.5" font-weight="800" text-anchor="middle" font-family="Consolas,monospace">CH9329 HID</text>
    <text x="387" y="69" fill="${ink}" font-size="8.5" text-anchor="middle" font-family="Consolas,monospace">moveMouse()</text>
  `);
}

export function closeBlockInfoModal() {
  state.openBlockInfo = null;
  $('#blockInfoModal')?.classList.add('hidden');
}

export function openBlocksOverview() {
  state.openBlockInfo = '__overview__';
  const modal = $('#blockInfoModal');
  if (!modal) return;

  $('#blockModalIcon').textContent = '📖';
  $('#blockModalTitle').textContent = t('bguide.overviewTitle');
  $('#blockModalSub').textContent = t('bguide.overviewSub');
  $('#blockModalBadges').innerHTML = '';
  $('#btnBlockBackOverview').classList.add('hidden');
  $('#blockNavGroup').classList.add('hidden');
  $('#btnBlockModalAdd').classList.add('hidden');

  const activeBlocks = state.codeBlocks || [];
  const sectionsHtml = BLOCK_GROUPS.map((grp) => {
    const defs = BLOCK_CATALOG.filter((d) => d.group === grp);
    const cardsHtml = defs.map((d) => {
      const cnt = activeBlocks.filter((b) => b.type === d.type).length;
      const ram = d.sram(d.defaultConfig(cnt));
      return `
        <button type="button" class="bguide-ov-card ${cnt ? 'is-active' : ''}" style="--cb-accent:${d.color}" data-bguide-open="${d.type}">
          <div class="bguide-ov-head">
            <span class="bguide-ov-ico">${d.icon}</span>
            <strong class="bguide-ov-name">${escapeHtml(t(`cb.${d.type}.name`))}</strong>
            <span class="badge">${ram > 0 ? `+${ram} B` : '0 B'}</span>
            ${cnt ? `<span class="badge badge-pwm">✓ ${cnt}</span>` : ''}
          </div>
          <p class="bguide-ov-desc">${escapeHtml(t(`cb.${d.type}.desc`))}</p>
        </button>`;
    }).join('');
    return `
      <div class="bguide-ov-section">
        <h3>${escapeHtml(t(`cb.group.${grp}`))}</h3>
        <div class="bguide-ov-grid">${cardsHtml}</div>
      </div>`;
  }).join('');

  $('#blockModalBody').innerHTML = sectionsHtml;
  $('#blockModalBody').querySelectorAll('[data-bguide-open]').forEach((btn) => {
    btn.addEventListener('click', () => openBlockInfo(btn.dataset.bguideOpen));
  });

  modal.classList.remove('hidden');
}

export function openBlockInfo(type) {
  const def = getBlockDef(type);
  if (!def) { openBlocksOverview(); return; }

  state.openBlockInfo = type;
  const modal = $('#blockInfoModal');
  if (!modal) return;

  const guide = tBlockGuide(type);
  const activeBlocks = state.codeBlocks || [];
  const cnt = activeBlocks.filter((b) => b.type === type).length;
  const maxed = cnt >= def.max;
  const ram = def.sram(def.defaultConfig(cnt));

  $('#blockModalIcon').textContent = def.icon;
  $('#blockModalTitle').textContent = t(`cb.${type}.name`);
  $('#blockModalSub').textContent = t(`cb.${type}.desc`);

  const badges = [
    `<span class="badge badge-i2c">${escapeHtml(t(`cb.group.${def.group}`))}</span>`,
    `<span class="badge">${ram > 0 ? `~${ram} B SRAM` : '0 B SRAM'}</span>`,
    `<span class="badge badge-pwm">${escapeHtml(t('bguide.badgeFlatC'))}</span>`,
    def.max > 1 ? `<span class="badge">Max ${def.max}×</span>` : ''
  ].filter(Boolean).join('');
  $('#blockModalBadges').innerHTML = badges;

  const usesHtml = (guide.uses && guide.uses.length)
    ? `<div class="info-ideas">${guide.uses.map((u) => `<span class="info-idea-chip">💡 ${escapeHtml(u)}</span>`).join('')}</div>`
    : '';

  const tipsHtml = (guide.tips && guide.tips.length)
    ? `<ul class="info-tip-list">${guide.tips.map((tp) => `<li>${escapeHtml(tp)}</li>`).join('')}</ul>`
    : '';

  const patternHtml = guide.pattern
    ? `<pre class="code-block bguide-code"><code>${highlightCppCode(guide.pattern)}</code></pre>`
    : '';

  $('#blockModalBody').innerHTML = `
    <div class="bguide-diagram-wrap">
      ${buildBlockDiagramSvg(type, def.color)}
    </div>
    <div class="info-section">
      <h3>${escapeHtml(t('bguide.secHow'))}</h3>
      <p>${escapeHtml(guide.what || t(`cb.${type}.desc`))}</p>
    </div>
    ${usesHtml ? `<div class="info-section"><h3>${escapeHtml(t('bguide.secUses'))}</h3>${usesHtml}</div>` : ''}
    ${patternHtml ? `<div class="info-section"><h3>${escapeHtml(t('bguide.secPattern'))}</h3>${patternHtml}</div>` : ''}
    ${tipsHtml ? `<div class="info-section"><h3>${escapeHtml(t('bguide.secTips'))}</h3>${tipsHtml}</div>` : ''}`;

  // Footer controls: Overview button, Prev/Next navigation, and Add-to-Code CTA
  $('#btnBlockBackOverview').classList.remove('hidden');
  $('#blockNavGroup').classList.remove('hidden');

  const idx = BLOCK_CATALOG.findIndex((b) => b.type === type);
  const prevDef = BLOCK_CATALOG[(idx - 1 + BLOCK_CATALOG.length) % BLOCK_CATALOG.length];
  const nextDef = BLOCK_CATALOG[(idx + 1) % BLOCK_CATALOG.length];
  const prevBtn = $('#btnBlockPrev');
  const nextBtn = $('#btnBlockNext');
  if (prevBtn) {
    prevBtn.dataset.target = prevDef.type;
    prevBtn.title = t(`cb.${prevDef.type}.name`);
  }
  if (nextBtn) {
    nextBtn.dataset.target = nextDef.type;
    nextBtn.title = t(`cb.${nextDef.type}.name`);
  }

  const addBtn = $('#btnBlockModalAdd');
  addBtn.classList.remove('hidden');
  addBtn.dataset.blockType = type;
  addBtn.disabled = maxed;
  addBtn.textContent = maxed
    ? t('bguide.btnAdded', { cnt, max: def.max })
    : (cnt ? t('bguide.btnAddAnother', { cnt, max: def.max }) : t('bguide.btnAdd'));

  modal.classList.remove('hidden');
}

export function refreshOpenBlockInfo() {
  if (!state.openBlockInfo || $('#blockInfoModal')?.classList.contains('hidden')) return;
  if (state.openBlockInfo === '__overview__') openBlocksOverview();
  else openBlockInfo(state.openBlockInfo);
}

export function bindBlockGuideEvents() {
  $('#btnCloseBlockModal')?.addEventListener('click', closeBlockInfoModal);
  $('#blockInfoModal')?.addEventListener('click', (e: any) => {
    if (e.target === $('#blockInfoModal')) closeBlockInfoModal();
  });
  $('#btnBlockBackOverview')?.addEventListener('click', openBlocksOverview);
  $('#btnBlockPrev')?.addEventListener('click', () => {
    const tgt = $('#btnBlockPrev')?.dataset.target;
    if (tgt) openBlockInfo(tgt);
  });
  $('#btnBlockNext')?.addEventListener('click', () => {
    const tgt = $('#btnBlockNext')?.dataset.target;
    if (tgt) openBlockInfo(tgt);
  });
  $('#btnBlockModalAdd')?.addEventListener('click', () => {
    const btype = $('#btnBlockModalAdd')?.dataset.blockType;
    if (!btype) return;
    addCodeBlock(btype);
    closeBlockInfoModal();
  });
}
