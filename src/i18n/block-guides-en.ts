// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Concise Student Guides for all 13 Program Structure Blocks (English)
export default {
  eva: {
    what: 'Splits your endless loop() cleanly into three named functions: readInputs() (Input), updateLogic() (Processing), and renderOutputs() (Output). Instead of one giant messy loop, every piece of code has one clear home.',
    uses: ['Any project with 2+ sensors & outputs', 'Games (Input → Physics → Draw)', 'Clean, easy-to-debug lab projects'],
    tips: [
      'Always read hardware first, calculate rules second, and draw/actuate last.',
      'This is the exact C continuation of the EVA lab poster and mBlock "My Blocks".'
    ],
    pattern: `void loop() {\n  readInputs();    // 1. Read sensors & buttons\n  updateLogic();   // 2. Rules, timers & states\n  renderOutputs(); // 3. OLED, LED, buzzer, servo\n}`
  },
  fsm: {
    what: 'A Finite State Machine (FSM) uses one small number variable (gameState) like a railway switch. Because a device cannot be in "Menu" and "Game Over" at the same time, switch (gameState) runs only the rules for the current mode.',
    uses: ['Games (MENU → PLAYING → GAMEOVER)', 'Alarm systems (ARMED / TRIGGERED)', 'Multi-mode tools & robots'],
    tips: [
      'Always use uint8_t for states — it uses only 1 byte of your 2 KB SRAM (half of an int).',
      'Change modes simply by assigning gameState = STATE_PLAYING; — never forget break;!'
    ],
    pattern: `#define STATE_MENU    0\n#define STATE_PLAYING 1\nuint8_t gameState = STATE_MENU;\n\nswitch (gameState) {\n  case STATE_MENU:    /* wait for START */ break;\n  case STATE_PLAYING: /* run main logic */ break;\n}`
  },
  toggle: {
    what: 'The simplest "mini state machine": a single true/false flag (bool isRunning) that flips between active and paused. Pressing a button inverts it with one line: isRunning = !isRunning;.',
    uses: ['Start / Pause for measurements', 'Mute / Unmute audio alerts', 'Simple On / Standby switch'],
    tips: [
      'The ! operator flips true ↔ false automatically.',
      'A bool takes only 1 byte of SRAM and makes if (isRunning) read like plain English.'
    ],
    pattern: `bool isRunning = false;\n\n// Flip on button click:\nisRunning = !isRunning;\n\nif (isRunning) { /* active */ } else { /* paused */ }`
  },
  timer: {
    what: 'Runs an action repeatedly every X milliseconds using the built-in stopwatch millis() — without ever pausing the board. Unlike delay(), your buttons, display, and sensors stay 100% responsive in between.',
    uses: ['Blink LEDs while reading buttons', 'Read sensors every 250 ms', 'Smooth game movement & cooldowns'],
    tips: [
      'Always write (millis() - lastTime >= INTERVAL) using unsigned long — never use delay() in interactive programs!',
      'You can add up to 3 independent timers (e.g. fast sensor check + slower display refresh).'
    ],
    pattern: `unsigned long lastTickTime = 0;\n\nif (millis() - lastTickTime >= 250) {\n  lastTickTime = millis(); // reset stopwatch\n  // Runs every 250 ms without freezing loop()!\n}`
  },
  oneshot: {
    what: 'A countdown timer that runs an action once after a fixed duration and then turns itself off automatically (active = false). Ideal whenever something should stay visible or active for a few seconds.',
    uses: ['2.5 s startup splash screen on OLED', 'LED flash or alarm timeout', 'Auto-return to standby after inactivity'],
    tips: [
      'To restart the timer later, simply set startTime = millis(); and active = true;.',
      'Costs only 5 bytes of SRAM (4 B timestamp + 1 B bool flag).'
    ],
    pattern: `if (splashActive && millis() - splashStartTime >= 2500) {\n  splashActive = false;\n  // Runs ONCE after 2.5 seconds\n}`
  },
  debug_tick: {
    what: 'A dedicated 500 ms stopwatch purely for Serial.println() debug output. Because loop() runs thousands of times per second, printing on every cycle makes the Serial Monitor unreadable and slows down your board.',
    uses: ['Watching live sensor values cleanly', 'Checking gameState & variables', 'Fast lab troubleshooting'],
    tips: [
      'Keep Serial Monitor set to 115200 baud (matches Serial.begin(115200)).',
      'Never slow down your whole program with delay(500) just to read Serial output!'
    ],
    pattern: `if (millis() - lastDebugTime >= 500) {\n  lastDebugTime = millis();\n  Serial.println(myValue); // 2 readable lines/sec\n}`
  },
  btn_callbacks: {
    what: 'Event-driven button handling: instead of manually checking pins and fighting contact bounce, you register a function (onStartClicked) in setup(). Whenever the user clicks the button, the K-Comp calls your function automatically once.',
    uses: ['Start / Restart games', 'Confirm menu selection (SELECT)', 'Switch modes cleanly'],
    tips: [
      'Always keep pollStartButton(); / pollSelectButton(); at the top of loop() so clicks are never missed.',
      'Keep callback functions short — set flags or change states instead of long loops.'
    ],
    pattern: `void onStartClicked() { /* runs once per click */ }\n\nvoid setup() {\n  initButtonStart();\n  attachButtonStartClick(onStartClicked);\n}\nvoid loop() { pollStartButton(); }`
  },
  oled_grid: {
    what: 'Turns your 0.96" OLED into a complete game or dashboard grid without doing pixel math. You only write how cell values (1, 2, …) look in drawPieces(), and then read/write cells with simple getGridCell(r, c) / setGridCell(r, c, val) calls.',
    uses: ['Tic-Tac-Toe (3×3)', 'Connect Four / Memory / Minesweeper', 'Interactive icon or status tiles'],
    tips: [
      'No manual array indexing needed — always use getGridCell(row, col) and setGridCell(row, col, val).',
      'Watch the 2 KB SRAM bar! If RAM gets tight, switch OLED to Paged mode (automatically handled).'
    ],
    pattern: `initGrid(3, 3, 20, 20, 34, 2, gameMemory);\nattachGridRender(drawPieces);\n// Read / write cells easily:\nif (getGridCell(row, col) == 0) {\n  setGridCell(row, col, 1);\n}`
  },
  char_parser: {
    what: 'Receives single-character commands (like \'S\', \'X\', \'1\') from Serial, HC-12 radio, HC-05 Bluetooth, or CardKB and routes them straight through a switch (cmd) — completely without text arrays or memory-hungry Strings.',
    uses: ['Two-board HC-12 multiplayer link', 'Smartphone Bluetooth remote control', 'CardKB keyboard shortcuts'],
    tips: [
      'Single characters use 0 bytes of buffer RAM and never suffer from packet framing errors.',
      'Use single quotes (\'S\') for char values — double quotes ("S") are for text strings!'
    ],
    pattern: `if (hc12.available()) {\n  char cmd = hc12.read();\n  switch (cmd) {\n    case 'S': /* Start */ break;\n    case 'X': /* Stop  */ break;\n  }\n}`
  },
  joy_4way: {
    what: 'Converts the continuous analog joystick values (-512..+512) into four crisp digital directions (Up, Down, Left, Right). A joyNeutral lock ensures one tilt moves exactly one step instead of flying across the screen.',
    uses: ['Moving the OLED Grid cursor', 'Scrolling visual menus', 'Stepping through game choices'],
    tips: [
      'Tilt past ±250 triggers one move; returning near center unlocks the next move.',
      'When combined with OLED Grid Engine, moveCursor() is wired in automatically!'
    ],
    pattern: `if (joyNeutral) {\n  if (joyY < -250)      { /* UP   */ joyNeutral = false; }\n  else if (joyY > 250)  { /* DOWN */ joyNeutral = false; }\n} else if (joyY > -150 && joyY < 150) {\n  joyNeutral = true; // centered again\n}`
  },
  ir_switch: {
    what: 'Listens in the background via hardware interrupt for button presses on the 21-button infrared remote. As soon as isIRAvailable() is true, switch (getIRCommand()) jumps straight to the matching button macro (IR_BTN_POWER, IR_BTN_PLAY, …).',
    uses: ['Remote-controlled robot or servo', 'Wireless OLED menu navigation', 'Classroom quiz buzzer'],
    tips: [
      'The IR receiver signal pin MUST be connected to interrupt pin D2 or ~D3.',
      'Built-in #define button macros take 0 bytes of SRAM.'
    ],
    pattern: `if (isIRAvailable()) {\n  switch (getIRCommand()) {\n    case IR_BTN_POWER: /* toggle */ break;\n    case IR_BTN_PLAY:  /* start  */ break;\n  }\n}`
  },
  motor_seq: {
    what: 'Executes autonomous robot driving steps one after another using !isMotorBusy(). As soon as one move (like driveForward) finishes in the background, driveStep advances to the next maneuver without ever calling delay().',
    uses: ['Autonomous square / figure-8 drive', 'Obstacle avoidance maneuver', 'Timed conveyor sequences'],
    tips: [
      'Keep motorUpdate(); in loop() so the background motor timer knows when each step ends.',
      'Requires the TB6612FNG shield powered by an external 6–12 V battery on VM.'
    ],
    pattern: `if (!isMotorBusy()) {\n  switch (driveStep) {\n    case 0: /* driveForward(100, 1000); */ driveStep = 1; break;\n    case 1: /* turnRight(80, 500);     */ driveStep = 0; break;\n  }\n}`
  },
  hid_guard: {
    what: 'A mandatory safety clutch ("deadman switch") for the CH9329 USB Keyboard/Mouse adapter. Output commands only run while hidEnabled is true (toggled via the START button), so your board never hijacks your laptop cursor right after upload.',
    uses: ['Tilt-controlled PC mouse (Starter Lab)', 'Custom USB macro keypad', 'Safe testing of keyboard shortcuts'],
    tips: [
      'Always start with bool hidEnabled = false; so the mouse stays calm right after plugging in.',
      'Press START once to activate USB HID, and press START again anytime to pause immediately.'
    ],
    pattern: `bool hidEnabled = false; // START toggles on/off\n\nif (hidEnabled) {\n  // Safe zone: moveMouse(dx, dy); / clickMouse();\n}`
  }
};
