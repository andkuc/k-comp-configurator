// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Udhëzues të shkurtër për të 13 blloqet e strukturës së programit (Shqip)
export default {
  eva: {
    what: 'Ndan ciklin e pafund loop() pastër në tre funksione me emër: readInputs() (Hyrje), updateLogic() (Përpunim) dhe renderOutputs() (Dalje). Në vend të një cikli të madh e të ngatërruar, çdo pjesë e kodit ka vendin e vet.',
    uses: ['Çdo projekt me 2+ sensorë & aktuatorë', 'Lojëra (Hyrje → Rregulla → Vizatim)', 'Projekte të pastra e të lehta për testim'],
    tips: [
      'Ruaj gjithmonë rendin: lexo harduerin → llogarit rregullat → përditëso daljet.',
      'Është vazhdimi direkt në C i posterit EVA dhe blloqeve „My Blocks“ në mBlock 5.'
    ],
    pattern: `void loop() {\n  readInputs();    // 1. Lexo sensorët & butonat\n  updateLogic();   // 2. Rregullat, timer-at & gjendjet\n  renderOutputs(); // 3. OLED, LED, buzzer, servo\n}`
  },
  fsm: {
    what: 'Një State Machine (automat gjendjesh) përdor një variabël të vogël numri (gameState) si ndërrues shinash. Meqë një pajisje nuk mund të jetë njëkohësisht në „Menu“ dhe „Game Over“, switch (gameState) ekzekuton vetëm rregullat e gjendjes aktuale.',
    uses: ['Lojëra (MENU → PLAYING → GAMEOVER)', 'Sisteme alarmi (GATI / ALARM)', 'Robotë & pajisje me disa modalitete'],
    tips: [
      'Përdor gjithmonë uint8_t për gjendjet — zë vetëm 1 bajt nga 2 KB SRAM (gjysma e int).',
      'Ndrysho gjendjen thjesht me gameState = STATE_PLAYING; — mos harro break;!'
    ],
    pattern: `#define STATE_MENU    0\n#define STATE_PLAYING 1\nuint8_t gameState = STATE_MENU;\n\nswitch (gameState) {\n  case STATE_MENU:    /* prit START */ break;\n  case STATE_PLAYING: /* logjika kryesore */ break;\n}`
  },
  toggle: {
    what: '„Mini State Machine“ më e thjeshtë: një flag i vetëm true/false (bool isRunning) që kalon mes aktiv dhe pauzë. Një shtypje butoni e kthen me një rresht: isRunning = !isRunning;.',
    uses: ['Fillo / Pauzë për matje', 'Hesht / Aktivizo zërin', 'Çelës i thjeshtë Aktiv / Pritje'],
    tips: [
      'Operatori ! e kthen automatikisht true ↔ false.',
      'Një bool zë vetëm 1 bajt SRAM dhe lexohet qartë te if (isRunning).'
    ],
    pattern: `bool isRunning = false;\n\n// Ndrysho me klikim butoni:\nisRunning = !isRunning;\n\nif (isRunning) { /* aktiv */ } else { /* pauzë */ }`
  },
  timer: {
    what: 'Ekzekuton një veprim rregullisht çdo X milisekonda me kronometrin e integruar millis() — pa e ndalur kurrë pllakën. Ndryshe nga delay(), butonat, ekrani dhe sensorët mbeten 100% aktivë gjatë pritjes.',
    uses: ['Pulsim LED ndërsa lexohen butonat', 'Lexim sensorësh çdo 250 ms', 'Lëvizje e qetë në lojëra'],
    tips: [
      'Shkruaj gjithmonë (millis() - lastTime >= INTERVAL) me unsigned long — shmang delay() në programe interaktive!',
      'Mund të shtosh deri në 3 timer-a të pavarur (p.sh. sensor i shpejtë + ekran më i qetë).'
    ],
    pattern: `unsigned long lastTickTime = 0;\n\nif (millis() - lastTickTime >= 250) {\n  lastTickTime = millis(); // rifillo kronometrin\n  // Ekzekutohet çdo 250 ms pa ngrirë loop()!\n}`
  },
  oneshot: {
    what: 'Një timer me numërim mbrapsht që ekzekuton një veprim një herë pas një kohe të caktuar dhe pastaj fiket vetë (active = false). Ideale kur diçka duhet të qëndrojë aktive vetëm disa sekonda.',
    uses: ['Ekran fillestar 2.5 s në OLED', 'Blic i shkurtër LED ose kohë alarmi', 'Kthim automatik në pritje'],
    tips: [
      'Për ta rinisur më vonë mjaftojnë dy rreshta: startTime = millis(); dhe active = true;.',
      'Kushton vetëm 5 bajt SRAM (4 B kohë + 1 B bool).'
    ],
    pattern: `if (splashActive && millis() - splashStartTime >= 2500) {\n  splashActive = false;\n  // Ekzekutohet NJË HERË pas 2.5 sekondash\n}`
  },
  debug_tick: {
    what: 'Një kronometër i dedikuar 500 ms vetëm për mesazhet Serial.println(). Meqë loop() rrotullohet mijëra herë në sekondë, printimi i pakontrolluar e bën Serial Monitor-in të palexueshëm dhe ngadalëson pllakën.',
    uses: ['Ndjekje e pastër e vlerave të sensorëve', 'Kontroll i gameState & variablave', 'Gjetje e shpejtë gabimesh në laborator'],
    tips: [
      'Vendos Serial Monitor në 115200 baud (si Serial.begin(115200)).',
      'Kurrë mos përdor delay(500) vetëm për të lexuar daljen Serial!'
    ],
    pattern: `if (millis() - lastDebugTime >= 500) {\n  lastDebugTime = millis();\n  Serial.println(vlera); // 2 rreshta të lexueshëm/s\n}`
  },
  btn_callbacks: {
    what: 'Trajtim i butonave me ngjarje: në vend që të kontrollosh pina dhe zhurmën e kontaktit manualisht, regjistron një funksion (onStartClicked) në setup(). Sa herë klikohet butoni, K-Comp e thërret funksionin automatikisht saktësisht një herë.',
    uses: ['Fillo / Rinis lojëra (START)', 'Konfirmo zgjedhjen (SELECT)', 'Ndryshim i pastër i modaliteteve'],
    tips: [
      'Mbaje gjithmonë pollStartButton(); / pollSelectButton(); në krye të loop() që të mos humbasë asnjë klikim.',
      'Mbaji funksionet callback të shkurtra — ndrysho gjendje ose flag-e.'
    ],
    pattern: `void onStartClicked() { /* 1× për klikim */ }\n\nvoid setup() {\n  initButtonStart();\n  attachButtonStartClick(onStartClicked);\n}\nvoid loop() { pollStartButton(); }`
  },
  oled_grid: {
    what: 'E kthen ekranin 0.96" OLED në një rrjetë të gatshme loje pa llogaritje pikselësh. Ti vetëm vizaton pamjen e qelizës (1, 2, …) te drawPieces() dhe lexon/ndryshon qelizat me getGridCell(r, c) / setGridCell(r, c, val).',
    uses: ['Tic-Tac-Toe (3×3)', 'Katër në Rresht / Memory / Minesweeper', 'Kuti statusi në ekran'],
    tips: [
      'Nuk ka nevojë për indekse array — përdor gjithmonë getGridCell(row, col) dhe setGridCell(row, col, val).',
      'Shiko shiritin 2 KB SRAM: nëse ngushtohet, kaloje OLED në modalitetin Paged.'
    ],
    pattern: `initGrid(3, 3, 20, 20, 34, 2, gameMemory);\nattachGridRender(drawPieces);\n// Lexo & vendos qeliza lehtë:\nif (getGridCell(row, col) == 0) {\n  setGridCell(row, col, 1);\n}`
  },
  char_parser: {
    what: 'Lexon komanda me 1 karakter (si \'S\', \'X\', \'1\') nga Serial, radio HC-12, Bluetooth HC-05 ose CardKB dhe i drejton drejtpërdrejt me switch (cmd) — plotësisht pa array teksti dhe pa String që konsumojnë RAM.',
    uses: ['Lidhje me 2 lojtarë përmes HC-12', 'Telekomandë me Bluetooth nga telefoni', 'Komanda shpejtësie me CardKB'],
    tips: [
      'Karakteret e vetme përdorin 0 bajt bufer RAM dhe nuk priten kurrë në mes.',
      'Përdor thonjëza teke (\'S\') për char — thonjëzat dyshe ("S") janë për tekste!'
    ],
    pattern: `if (hc12.available()) {\n  char cmd = hc12.read();\n  switch (cmd) {\n    case 'S': /* Fillo */ break;\n    case 'X': /* Ndal  */ break;\n  }\n}`
  },
  joy_4way: {
    what: 'Shndërron vlerat analoge të Joystick-ut (-512..+512) në katër drejtime të pastra (Lart, Poshtë, Majtas, Djathtas). Bllokimi joyNeutral garanton që një anim të lëvizë saktësisht 1 hap në ekran.',
    uses: ['Lëvizja e kursorit në OLED Grid', 'Lundrimi në menu vizuale', 'Zgjedhje opsionesh në lojëra'],
    tips: [
      'Animi mbi ±250 kryen 1 hap; kthimi në qendër e çbllokon hapin tjetër.',
      'Kur OLED Grid Engine është aktive, moveCursor() lidhet automatikisht!'
    ],
    pattern: `if (joyNeutral) {\n  if (joyY < -250)      { /* LART   */ joyNeutral = false; }\n  else if (joyY > 250)  { /* POSHTË */ joyNeutral = false; }\n} else if (joyY > -150 && joyY < 150) {\n  joyNeutral = true; // u kthye në qendër\n}`
  },
  ir_switch: {
    what: 'Dëgjon në sfond me interrupt harduerik shtypjet e telekomandës infra të kuqe me 21 butona. Sapo isIRAvailable() bëhet true, switch (getIRCommand()) kalon direkt te makroja e butonit (IR_BTN_POWER, IR_BTN_PLAY, …).',
    uses: ['Robot ose servo me telekomandë', 'Navigim i menusë OLED pa tela', 'Buzzer kuizi në klasë'],
    tips: [
      'Pini i sinjalit të marrësit IR DUHET të lidhet në pin interrupt D2 ose ~D3.',
      'Makrot #define të butonave zënë 0 bajt SRAM.'
    ],
    pattern: `if (isIRAvailable()) {\n  switch (getIRCommand()) {\n    case IR_BTN_POWER: /* Ndez/Fik */ break;\n    case IR_BTN_PLAY:  /* Fillo    */ break;\n  }\n}`
  },
  motor_seq: {
    what: 'Ekzekuton hapat e lëvizjes autonome të robotit njëri pas tjetrit me !isMotorBusy(). Sapo një lëvizje (si driveForward) përfundon në sfond, driveStep kalon te hapi tjetër pa përdorur kurrë delay().',
    uses: ['Lëvizje autonome në katror', 'Manovër për shmangien e pengesave', 'Sekuenca me kohë për shirit transportues'],
    tips: [
      'Mbaje motorUpdate(); në loop() që biblioteka të dijë kur përfundon çdo hap.',
      'Kërkon shield-in TB6612FNG me bateri të jashtme 6–12 V në VM.'
    ],
    pattern: `if (!isMotorBusy()) {\n  switch (driveStep) {\n    case 0: /* driveForward(100, 1000); */ driveStep = 1; break;\n    case 1: /* turnRight(80, 500);     */ driveStep = 0; break;\n  }\n}`
  },
  hid_guard: {
    what: 'Një siguresë e domosdoshme për përshtatësin USB CH9329 (Tastierë/Maus). Komandat e mausit dërgohen vetëm kur hidEnabled është true (ndizet/fiket me butonin START), që pllaka të mos bllokojë kursorin e laptopit pas ngarkimit.',
    uses: ['Maus PC me anim (Laboratori Fillestar)', 'Tastierë makro USB', 'Testim i sigurt i shkurtoreve'],
    tips: [
      'Fillo gjithmonë me bool hidEnabled = false; që kursori të rrijë i qetë pas lidhjes.',
      'Shtyp START një herë për aktivizim dhe prapë për pauzë të menjëhershme.'
    ],
    pattern: `bool hidEnabled = false; // START ndez/fik\n\nif (hidEnabled) {\n  // Zonë e sigurt: moveMouse(dx, dy); / clickMouse();\n}`
  }
};
