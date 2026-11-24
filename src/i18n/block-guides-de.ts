// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Kompakte Schüler-Kurzinfos für alle 13 Programmstruktur-Bausteine (Deutsch)
export default {
  eva: {
    what: 'Teilt deine endlose loop()-Schleife sauber in drei eigene Funktionen auf: readInputs() (Eingabe), updateLogic() (Verarbeitung) und renderOutputs() (Ausgabe). Statt einer unübersichtlichen Riesenschleife hat jeder Codeteil seinen festen Platz.',
    uses: ['Jedes Projekt mit 2+ Sensoren & Aktoren', 'Spiele (Eingabe → Regeln → Zeichnen)', 'Übersichtliche, leicht prüfbare Laborprogramme'],
    tips: [
      'Reihenfolge einhalten: zuerst Hardware lesen, dann rechnen/entscheiden, zuletzt ausgeben.',
      'Direkte C-Fortsetzung des EVA-Laborposters und der „Eigenen Blöcke“ aus mBlock 5.'
    ],
    pattern: `void loop() {\n  readInputs();    // 1. Sensoren & Taster lesen\n  updateLogic();   // 2. Regeln, Timer & Zustände\n  renderOutputs(); // 3. OLED, LED, Summer, Servo\n}`
  },
  fsm: {
    what: 'Eine State Machine (Zustandsautomat) nutzt eine kleine Zahlenvariable (gameState) wie eine Weiche. Da ein Programm nicht gleichzeitig im „Menü“ und im „Game Over“ sein kann, führt switch (gameState) immer nur die Regeln des aktuellen Modus aus.',
    uses: ['Spiele (MENU → PLAYING → GAMEOVER)', 'Alarmanlagen (BEREIT / AUSGELÖST)', 'Geräte & Roboter mit mehreren Betriebsarten'],
    tips: [
      'Immer uint8_t für Zustände nehmen — braucht nur 1 Byte der 2 KB SRAM (halb so viel wie int).',
      'Zustandswechsel gelingt mit einer Zeile (gameState = STATE_PLAYING;) — break; nie vergessen!'
    ],
    pattern: `#define STATE_MENU    0\n#define STATE_PLAYING 1\nuint8_t gameState = STATE_MENU;\n\nswitch (gameState) {\n  case STATE_MENU:    /* auf START warten */ break;\n  case STATE_PLAYING: /* Hauptlogik läuft */ break;\n}`
  },
  toggle: {
    what: 'Die einfachste „Mini-State-Machine“: ein einzelner Wahrheitswert (bool isRunning), der zwischen Aktiv und Pause umschaltet. Ein Tastendruck kippt den Zustand mit einer einzigen Zeile: isRunning = !isRunning;.',
    uses: ['Start / Pause bei Messungen', 'Ton Stumm / Aktiv schalten', 'Einfacher Ein- / Standby-Betrieb'],
    tips: [
      'Das Rufzeichen ! dreht true und false automatisch um.',
      'Ein bool belegt nur 1 Byte SRAM und liest sich in if (isRunning) fast wie normaler Text.'
    ],
    pattern: `bool isRunning = false;\n\n// Bei Tastendruck umschalten:\nisRunning = !isRunning;\n\nif (isRunning) { /* aktiv */ } else { /* Pause */ }`
  },
  timer: {
    what: 'Führt eine Aktion alle X Millisekunden mit der eingebauten Stoppuhr millis() aus — ganz ohne das Board anzuhalten. Anders als bei delay() bleiben Taster, Display und Sensoren dazwischen jederzeit reaktionsschnell.',
    uses: ['LED blinken während Taster abgefragt werden', 'Sensoren alle 250 ms messen', 'Flüssige Spiel-Takte & Cooldowns'],
    tips: [
      'Immer (millis() - lastTime >= INTERVAL) mit unsigned long verwenden — kein delay() in interaktiven Programmen!',
      'Du kannst bis zu 3 unabhängige Timer kombinieren (z. B. schneller Sensor-Takt + langsamer Display-Takt).'
    ],
    pattern: `unsigned long lastTickTime = 0;\n\nif (millis() - lastTickTime >= 250) {\n  lastTickTime = millis(); // Stoppuhr neu starten\n  // Läuft alle 250 ms ohne loop() einzufrieren!\n}`
  },
  oneshot: {
    what: 'Ein Ablauf-Timer (Countdown), der eine Aktion nach einer festen Zeit einmalig ausführt und sich dann selbst beendet (active = false). Ideal, wenn etwas nur wenige Sekunden lang angezeigt oder aktiviert bleiben soll.',
    uses: ['2,5-s-Startbildschirm (Splash) am OLED', 'Kurzer LED-Blitz oder Alarm-Nachlauf', 'Automatische Rückkehr in den Standby'],
    tips: [
      'Zum erneuten Starten genügen zwei Zeilen: startTime = millis(); und active = true;.',
      'Kostet nur 5 Bytes SRAM (4 B Zeitstempel + 1 B bool-Flag).'
    ],
    pattern: `if (splashActive && millis() - splashStartTime >= 2500) {\n  splashActive = false;\n  // Läuft EINMALIG nach 2,5 Sekunden\n}`
  },
  debug_tick: {
    what: 'Eine eigene 500-ms-Stoppuhr nur für Serial.println()-Testausgaben. Da loop() tausendmal pro Sekunde durchläuft, würde ungebremstes Drucken den Serial Monitor unlesbar überfluten und das Board ausbremsen.',
    uses: ['Sensorwerte ruhig live beobachten', 'gameState & Variablen prüfen', 'Schnelle Fehlersuche im Labor'],
    tips: [
      'Serial Monitor auf 115200 Baud stellen (passend zu Serial.begin(115200)).',
      'Niemals delay(500) nur zum Lesen der Debug-Ausgabe einbauen!'
    ],
    pattern: `if (millis() - lastDebugTime >= 500) {\n  lastDebugTime = millis();\n  Serial.println(messwert); // 2 lesbare Zeilen/s\n}`
  },
  btn_callbacks: {
    what: 'Ereignisgesteuerte Taster-Abfrage: Statt selbst Pins zu entprellen, meldest du in setup() eine Funktion (onStartClicked) an. Sobald die Taste gedrückt wird, ruft der K-Comp deine Funktion automatisch exakt einmal auf.',
    uses: ['Spiel starten / neu starten (START)', 'Auswahl bestätigen (SELECT)', 'Saubere Modus-Umschaltung'],
    tips: [
      'pollStartButton(); / pollSelectButton(); immer ganz oben in loop() stehen lassen!',
      'Callback-Funktionen kurz halten — am besten nur Zustände oder Flags setzen.'
    ],
    pattern: `void onStartClicked() { /* 1× pro Klick */ }\n\nvoid setup() {\n  initButtonStart();\n  attachButtonStartClick(onStartClicked);\n}\nvoid loop() { pollStartButton(); }`
  },
  oled_grid: {
    what: 'Verwandelt das 0.96"-OLED in ein fertiges Spielfeld- oder Kachel-Raster ohne Pixel-Kopfrechnen. Du zeichnest in drawPieces() nur, wie eine Zelle (1, 2, …) aussieht, und greifst per getGridCell(r, c) / setGridCell(r, c, wert) darauf zu.',
    uses: ['Tic-Tac-Toe (3×3)', 'Vier Gewinnt / Memory / Minesweeper', 'Übersichtliche Status-Kacheln'],
    tips: [
      'Kein eigenes Array-Indizieren nötig — immer getGridCell(row, col) & setGridCell(row, col, val) nutzen.',
      '2-KB-SRAM-Anzeige im Blick behalten: bei wenig Speicher einfach OLED auf „Paged“ stellen.'
    ],
    pattern: `initGrid(3, 3, 20, 20, 34, 2, gameMemory);\nattachGridRender(drawPieces);\n// Zellen einfach lesen & setzen:\nif (getGridCell(row, col) == 0) {\n  setGridCell(row, col, 1);\n}`
  },
  char_parser: {
    what: 'Liest einzelne Befehlszeichen (z. B. \'S\', \'X\', \'1\') von Serial, HC-12 Funk, HC-05 Bluetooth oder CardKB und verteilt sie direkt per switch (cmd) — völlig ohne Text-Arrays und ohne speicherfressende Strings.',
    uses: ['HC-12 Zweispieler-Funkverbindung', 'Bluetooth-Steuerung per Smartphone', 'Tasten-Kommandos mit CardKB'],
    tips: [
      'Einzelne Zeichen brauchen 0 Bytes Puffer-RAM und können nicht abgeschnitten werden.',
      'Für einzelne Zeichen einfache Hochkommas (\'S\') nutzen — doppelte ("S") sind für Texte!'
    ],
    pattern: `if (hc12.available()) {\n  char cmd = hc12.read();\n  switch (cmd) {\n    case 'S': /* Start */ break;\n    case 'X': /* Stopp */ break;\n  }\n}`
  },
  joy_4way: {
    what: 'Wandelt den stufenlosen Analog-Joystick (-512..+512) in vier klare Richtungen (Hoch, Runter, Links, Rechts) um. Die Sperre joyNeutral sorgt dafür, dass ein Antippen genau einen Schritt auslöst, statt über den Bildschirm zu rasen.',
    uses: ['Cursor im OLED Grid steuern', 'Durch Menüs blättern', 'Auswahl in Spielen treffen'],
    tips: [
      'Ausschlag über ±250 löst 1 Schritt aus; Loslassen in die Mitte entsperrt den nächsten Schritt.',
      'Ist die OLED Grid Engine aktiv, wird moveCursor() automatisch eingebaut!'
    ],
    pattern: `if (joyNeutral) {\n  if (joyY < -250)      { /* HOCH   */ joyNeutral = false; }\n  else if (joyY > 250)  { /* RUNTER */ joyNeutral = false; }\n} else if (joyY > -150 && joyY < 150) {\n  joyNeutral = true; // wieder zentriert\n}`
  },
  ir_switch: {
    what: 'Lauscht per Hardware-Interrupt im Hintergrund auf Tastendrücke der 21-Tasten-Infrarot-Fernbedienung. Sobald isIRAvailable() wahr ist, springt switch (getIRCommand()) direkt zum passenden Tasten-Makro (IR_BTN_POWER, IR_BTN_PLAY, …).',
    uses: ['Ferngesteuerter Roboter oder Servo', 'Drahtlose OLED-Menüsteuerung', 'Klassen-Quiz-Buzzer'],
    tips: [
      'Die Datenleitung des IR-Empfängers MUSS an Interrupt-Pin D2 oder ~D3 angeschlossen sein.',
      'Die eingebauten #define-Tastenmakros belegen 0 Bytes SRAM.'
    ],
    pattern: `if (isIRAvailable()) {\n  switch (getIRCommand()) {\n    case IR_BTN_POWER: /* Ein/Aus */ break;\n    case IR_BTN_PLAY:  /* Start   */ break;\n  }\n}`
  },
  motor_seq: {
    what: 'Führt autonome Fahrschritte eines Roboters nacheinander über !isMotorBusy() aus. Sobald eine Bewegung (z. B. driveForward) im Hintergrund abgeschlossen ist, schaltet driveStep zum nächsten Schritt weiter — völlig ohne delay().',
    uses: ['Quadrat oder Achter autonom fahren', 'Hindernis-Ausweichmanöver', 'Zeitgesteuerte Förderband-Abläufe'],
    tips: [
      'motorUpdate(); muss in loop() bleiben, damit die Bibliothek das Schritt-Ende erkennt.',
      'Erfordert TB6612FNG-Shield mit externer 6–12-V-Batterie an VM.'
    ],
    pattern: `if (!isMotorBusy()) {\n  switch (driveStep) {\n    case 0: /* driveForward(100, 1000); */ driveStep = 1; break;\n    case 1: /* turnRight(80, 500);     */ driveStep = 0; break;\n  }\n}`
  },
  hid_guard: {
    what: 'Eine Sicherheitskupplung („Totmannschalter“) für den CH9329 USB-Tastatur-/Maus-Adapter. Maus- und Tastaturbefehle werden nur gesendet, solange hidEnabled aktiv ist (umschaltbar per START-Taste) — so übernimmt das Board nach dem Upload nicht deinen Laptop.',
    uses: ['Neigungs-Maus fürs Starter-Labor', 'Eigenes USB-Makro-Keypad', 'Sicheres Testen von Shortcuts'],
    tips: [
      'Immer mit bool hidEnabled = false; starten, damit der Mauszeiger nach dem Einstecken ruhig bleibt.',
      '1× START drückt scharf, nochmaliges START pausiert sofort.'
    ],
    pattern: `bool hidEnabled = false; // START schaltet ein/aus\n\nif (hidEnabled) {\n  // Sicherer Bereich: moveMouse(dx, dy); / clickMouse();\n}`
  }
};
