// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// K-Comp V2 Library API Reference Data — synced 1:1 with official 2-Page Word Docs (37 .docx files)
// Preserves exact function order and student-facing wording (EN original + DE/SQ translations).
export const LIBRARY_API = {
  "onboard_oled": {
    "header": "kcomp_oled.h",
    "headerPaged": "kcomp_oled_paged.h",
    "verified": true,
    "macros": [
      "OLED_COLOR_WHITE",
      "OLED_COLOR_BLACK",
      "OLED_COLOR_INVERT",
      "OLED_TEXT_NORMAL",
      "OLED_TEXT_LARGE",
      "OLED_TEXT_HUGE",
      "CURRENT_WIDTH",
      "CURRENT_HEIGHT"
    ],
    "functions": [
      {
        "sig": "bool initDisplay()",
        "call": "if (!initDisplay()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Wakes up the screen, configures the charge pump, and clears memory. • Returns: true if successful, false if missing.",
          "de": "Setup: Weckt das Display auf, konfiguriert die Ladungspumpe und löscht den Speicher. • Rückgabe: true bei Erfolg, false falls nicht gefunden.",
          "sq": "Setup: Zgjon ekranin, konfiguron pompën e ngarkesës dhe pastron memorien. • Kthen: true nëse ka sukses, false nëse mungon."
        }
      },
      {
        "sig": "void clearDisplay()",
        "call": "clearDisplay();",
        "phase": "output",
        "desc": {
          "en": "Erase: Wipes the memory buffer clean (sets all pixels to black). Always call this when drawing something new!",
          "de": "Löschen: Leert den Bildpuffer (setzt alle Pixel auf Schwarz). Vor jedem neuen Zeichnen aufrufen!",
          "sq": "Pastro: Pastron buferin e memories (vendos të gjitha pikselat e zeza). Thirre gjithmonë para vizatimit të ri!"
        }
      },
      {
        "sig": "void updateDisplay()",
        "call": "updateDisplay();",
        "phase": "output",
        "desc": {
          "en": "Show: Pushes the drawing from memory to the actual screen. Nothing appears until you call this.",
          "de": "Anzeigen: Überträgt die Zeichnung aus dem Speicher auf das Display. Vor diesem Aufruf bleibt der Schirm leer.",
          "sq": "Shfaq: Dërgon vizatimin nga memoria në ekranin fizik. Asgjë nuk shfaqet derisa ta thërrasësh këtë."
        }
      },
      {
        "sig": "void invertDisplay(bool invert)",
        "call": "invertDisplay(true);",
        "phase": "config",
        "desc": {
          "en": "Silicon Invert: Hardware command to instantly swap Black and White. • invert: true to invert colors, false for normal display.",
          "de": "Hardware-Invertierung: Vertauscht Schwarz und Weiß sofort per Hardware-Befehl. • invert: true für invertiert, false für normal.",
          "sq": "Invertim Harduerik: Ndërron menjëherë të Zezën me të Bardhën. • invert: true për invertim, false për normal."
        }
      },
      {
        "sig": "void dimDisplay(bool dim)",
        "call": "dimDisplay(true);",
        "phase": "config",
        "desc": {
          "en": "Hardware Dimming: Drops physical voltage to dim the screen and save power. • dim: true to dim, false for full brightness.",
          "de": "Hardware-Dimmen: Senkt die Spannung, um das Display abzudunkeln und Strom zu sparen. • dim: true zum Dimmen, false für volle Helligkeit.",
          "sq": "Zbehje Harduerike: Ul tensionin fizik për ta zbehur ekranin dhe kursyer energji. • dim: true për zbehje, false për ndriçim të plotë."
        }
      },
      {
        "sig": "void drawPixel(int16_t x, int16_t y, uint8_t color)",
        "call": "drawPixel(64, 32, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Dot: Turns on a single pixel. • x: Horizontal coordinate (0 to 127). • y: Vertical coordinate (0 to 63). • color: Pixel color state.",
          "de": "Punkt: Setzt ein einzelnes Pixel. • x: Horizontale Koordinate (0 bis 127). • y: Vertikale Koordinate (0 bis 63). • color: Pixelfarbe.",
          "sq": "Pikë: Ndez një piksel të vetëm. • x: Koordinata horizontale (0 deri 127). • y: Koordinata vertikale (0 deri 63). • color: Ngjyra e pikselit."
        }
      },
      {
        "sig": "void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint8_t color)",
        "call": "drawLine(0, 0, 127, 63, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Line: Draws a diagonal line. • x0, y0: Starting coordinates. • x1, y1: Ending coordinates. • color: Pixel color state.",
          "de": "Linie: Zeichnet eine beliebige Linie. • x0, y0: Startkoordinaten. • x1, y1: Endkoordinaten. • color: Linienfarbe.",
          "sq": "Vijë: Vizaton një vijë diagonale. • x0, y0: Koordinatat e fillimit. • x1, y1: Koordinatat e fundit. • color: Ngjyra."
        }
      },
      {
        "sig": "void drawFastVLine(int16_t x, int16_t y, int16_t h, uint8_t color)",
        "call": "drawFastVLine(64, 0, 64, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Vertical Line: High-speed line. • x, y: Starting top coordinate. • h: Total height in pixels. • color: Pixel color state.",
          "de": "Vertikale Linie: Schnelle senkrechte Linie. • x, y: Obere Startkoordinate. • h: Gesamthöhe in Pixeln. • color: Linienfarbe.",
          "sq": "Vijë Vertikale: Vijë e shpejtë vertikale. • x, y: Koordinata lart. • h: Lartësia në piksel. • color: Ngjyra."
        }
      },
      {
        "sig": "void drawFastHLine(int16_t x, int16_t y, int16_t w, uint8_t color)",
        "call": "drawFastHLine(0, 32, 128, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Horizontal Line: High-speed line. • x, y: Starting left coordinate. • w: Total width in pixels. • color: Pixel color state.",
          "de": "Horizontale Linie: Schnelle waagrechte Linie. • x, y: Linke Startkoordinate. • w: Gesamtbreite in Pixeln. • color: Linienfarbe.",
          "sq": "Vijë Horizontale: Vijë e shpejtë horizontale. • x, y: Koordinata majtas. • w: Gjerësia në piksel. • color: Ngjyra."
        }
      },
      {
        "sig": "void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t color)",
        "call": "drawRect(10, 10, 40, 20, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Box (Outline): Draws an empty rectangle. • x, y: Top-left corner coordinate. • w: Width of the rectangle. • h: Height of the rectangle. • color: Line color state.",
          "de": "Rechteck (Rahmen): Zeichnet ein leeres Rechteck. • x, y: Linke obere Ecke. • w: Breite. • h: Höhe. • color: Rahmenfarbe.",
          "sq": "Kuti (Kornizë): Vizaton një drejtkëndësh bosh. • x, y: Këndi lart-majtas. • w: Gjerësia. • h: Lartësia. • color: Ngjyra e vijës."
        }
      },
      {
        "sig": "void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t color)",
        "call": "fillRect(10, 10, 40, 20, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Box (Solid): Draws a filled rectangle. • x, y: Top-left corner coordinate. • w: Width of the rectangle. • h: Height of the rectangle. • color: Fill color state.",
          "de": "Rechteck (Gefüllt): Zeichnet ein ausgefülltes Rechteck. • x, y: Linke obere Ecke. • w: Breite. • h: Höhe. • color: Füllfarbe.",
          "sq": "Kuti (E mbushur): Vizaton një drejtkëndësh të mbushur. • x, y: Këndi lart-majtas. • w: Gjerësia. • h: Lartësia. • color: Ngjyra e mbushjes."
        }
      },
      {
        "sig": "void drawCircle(int16_t x0, int16_t y0, int16_t r, uint8_t color)",
        "call": "drawCircle(64, 32, 12, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Circle (Outline): Draws a hollow circle. • x0, y0: Center coordinate of the circle. • r: Radius in pixels. • color: Line color state.",
          "de": "Kreis (Umriss): Zeichnet einen leeren Kreis. • x0, y0: Kreismittelpunkt. • r: Radius in Pixeln. • color: Linienfarbe.",
          "sq": "Rreth (Kornizë): Vizaton një rreth bosh. • x0, y0: Qendra e rrethit. • r: Rrezja në piksel. • color: Ngjyra e vijës."
        }
      },
      {
        "sig": "void fillCircle(int16_t x0, int16_t y0, int16_t r, uint8_t color)",
        "call": "fillCircle(64, 32, 12, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Circle (Solid): Draws a filled circle. • x0, y0: Center coordinate of the circle. • r: Radius in pixels. • color: Fill color state.",
          "de": "Kreis (Gefüllt): Zeichnet einen ausgefüllten Kreis. • x0, y0: Kreismittelpunkt. • r: Radius in Pixeln. • color: Füllfarbe.",
          "sq": "Rreth (I mbushur): Vizaton një rreth të mbushur. • x0, y0: Qendra e rrethit. • r: Rrezja në piksel. • color: Ngjyra e mbushjes."
        }
      },
      {
        "sig": "void drawTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint8_t color)",
        "call": "drawTriangle(64, 10, 44, 50, 84, 50, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Triangle (Outline): Draws a hollow triangle. • x0, y0: First point. • x1, y1: Second point. • x2, y2: Third point. • color: Line color state.",
          "de": "Dreieck (Umriss): Zeichnet ein leeres Dreieck. • x0, y0 / x1, y1 / x2, y2: Die drei Eckpunkte. • color: Linienfarbe.",
          "sq": "Trekëndësh (Kornizë): Vizaton një trekëndësh bosh. • x0, y0 / x1, y1 / x2, y2: Tre kulmet. • color: Ngjyra e vijës."
        }
      },
      {
        "sig": "void fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint8_t color)",
        "call": "fillTriangle(64, 10, 44, 50, 84, 50, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Triangle (Solid): Draws a filled triangle. • x0, y0: First point. • x1, y1: Second point. • x2, y2: Third point. • color: Fill color state.",
          "de": "Dreieck (Gefüllt): Zeichnet ein ausgefülltes Dreieck. • x0, y0 / x1, y1 / x2, y2: Die drei Eckpunkte. • color: Füllfarbe.",
          "sq": "Trekëndësh (I mbushur): Vizaton një trekëndësh të mbushur. • x0, y0 / x1, y1 / x2, y2: Tre kulmet. • color: Ngjyra e mbushjes."
        }
      },
      {
        "sig": "void setCursor(int16_t x, int16_t y)",
        "call": "setCursor(0, 0);",
        "phase": "output",
        "desc": {
          "en": "Position: Sets the starting coordinate. • x: Horizontal starting point (left edge of text). • y: Vertical starting point (top edge of text).",
          "de": "Position: Setzt die Startkoordinate. • x: Linker Rand des Textes. • y: Oberer Rand des Textes.",
          "sq": "Pozicioni: Vendos koordinatën fillestare. • x: Skaji i majtë i tekstit. • y: Skaji i sipërm i tekstit."
        }
      },
      {
        "sig": "void printChar(char c, uint8_t color, uint8_t size)",
        "call": "printChar('A', OLED_COLOR_WHITE, OLED_TEXT_NORMAL);",
        "phase": "output",
        "desc": {
          "en": "Write Character: Renders a single character. • c: The character to print (e.g., 'A'). • color: Character color state. • size: Text scaling multiplier. (OLED_TEXT_NORMAL, OLED_TEXT_LARGE, OLED_TEXT_HUGE).",
          "de": "Zeichen schreiben: Zeichnet ein einzelnes Zeichen. • c: Zeichen (z. B. 'A'). • color: Zeichenfarbe. • size: Textgröße (OLED_TEXT_NORMAL, OLED_TEXT_LARGE, OLED_TEXT_HUGE).",
          "sq": "Shkruaj Karakter: Vizaton një karakter të vetëm. • c: Karakteri (p.sh. 'A'). • color: Ngjyra. • size: Madhësia (OLED_TEXT_NORMAL, OLED_TEXT_LARGE, OLED_TEXT_HUGE)."
        }
      },
      {
        "sig": "void printText(const char* text, uint8_t color, uint8_t size)",
        "call": "printText(\"HELLO\", OLED_COLOR_WHITE, OLED_TEXT_NORMAL);",
        "phase": "output",
        "desc": {
          "en": "Write String: Renders text. • text: The string to print (e.g., \"HELLO\"). • color: Text color state. • size: Text scaling multiplier (OLED_TEXT_NORMAL, OLED_TEXT_LARGE, OLED_TEXT_HUGE).",
          "de": "Text schreiben: Zeichnet eine Zeichenkette. • text: Text (z. B. \"HELLO\"). • color: Textfarbe. • size: Textgröße (OLED_TEXT_NORMAL, OLED_TEXT_LARGE, OLED_TEXT_HUGE).",
          "sq": "Shkruaj Tekst: Vizaton tekst. • text: Teksti (p.sh. \"HELLO\"). • color: Ngjyra. • size: Madhësia (OLED_TEXT_NORMAL, OLED_TEXT_LARGE, OLED_TEXT_HUGE)."
        }
      },
      {
        "sig": "void printInt(long value, uint8_t color, uint8_t size)",
        "call": "printInt(value, OLED_COLOR_WHITE, OLED_TEXT_NORMAL);",
        "phase": "output",
        "desc": {
          "en": "Write Integer: Renders a whole number. • value: The number to print. • color: Character color state. • size: Text scaling multiplier. (OLED_TEXT_NORMAL, OLED_TEXT_LARGE, OLED_TEXT_HUGE).",
          "de": "Ganzzahl schreiben: Zeichnet eine ganze Zahl. • value: Zahl. • color: Textfarbe. • size: Textgröße (OLED_TEXT_NORMAL, OLED_TEXT_LARGE, OLED_TEXT_HUGE).",
          "sq": "Shkruaj Numër të Plotë: Vizaton një numër të plotë. • value: Numri. • color: Ngjyra. • size: Madhësia (OLED_TEXT_NORMAL, OLED_TEXT_LARGE, OLED_TEXT_HUGE)."
        }
      },
      {
        "sig": "void printFloat(float value, uint8_t decimalPlaces, uint8_t color, uint8_t size)",
        "call": "printFloat(value, 1, OLED_COLOR_WHITE, OLED_TEXT_NORMAL);",
        "phase": "output",
        "desc": {
          "en": "Write Decimal: Renders a floating-point number. • value: The decimal number to print. • decimalPlaces: Number of decimal places. • color: Character color state. • size: Text scaling multiplier. (OLED_TEXT_NORMAL, OLED_TEXT_LARGE, OLED_TEXT_HUGE).",
          "de": "Kommazahl schreiben: Zeichnet eine Fließkommazahl. • value: Kommazahl. • decimalPlaces: Anzahl Nachkommastellen. • color: Textfarbe. • size: Textgröße.",
          "sq": "Shkruaj Numër Dhjetor: Vizaton një numër dhjetor. • value: Numri dhjetor. • decimalPlaces: Shifrat pas presjes. • color: Ngjyra. • size: Madhësia."
        }
      },
      {
        "sig": "void drawBitmap(int16_t x, int16_t y, const uint8_t *bitmap, int16_t w, int16_t h, uint8_t color)",
        "call": "drawBitmap(56, 24, icon, 16, 16, OLED_COLOR_WHITE);",
        "phase": "output",
        "desc": {
          "en": "Image: Renders a 1-bit array stored in PROGMEM. • x, y: Top-left corner coordinate. • bitmap: The name of the byte array. • w: Width of the graphic in pixels. • h: Height of the graphic in pixels. • color: Color to draw the ON pixels.",
          "de": "Bild: Zeichnet ein 1-Bit-Array aus PROGMEM. • x, y: Linke obere Ecke. • bitmap: Name des Byte-Arrays. • w, h: Breite & Höhe in Pixeln. • color: Farbe der aktiven Pixel.",
          "sq": "Imazh: Vizaton një grafik 1-bit nga PROGMEM. • x, y: Këndi lart-majtas. • bitmap: Emri i array-t. • w, h: Gjerësia & lartësia në piksel. • color: Ngjyra."
        }
      },
      {
        "sig": "CURRENT_WIDTH",
        "call": "CURRENT_WIDTH",
        "phase": "config",
        "desc": {
          "en": "128 or 64 depending on the current screen orientation.",
          "de": "128 oder 64 je nach aktueller Display-Ausrichtung.",
          "sq": "128 ose 64 në varësi të orientimit aktual të ekranit."
        }
      },
      {
        "sig": "CURRENT_HEIGHT",
        "call": "CURRENT_HEIGHT",
        "phase": "config",
        "desc": {
          "en": "128 or 64 depending on the current screen orientation.",
          "de": "128 oder 64 je nach aktueller Display-Ausrichtung.",
          "sq": "128 ose 64 në varësi të orientimit aktual të ekranit."
        }
      },
      {
        "sig": "OLED_PCT_X(percent)",
        "call": "OLED_PCT_X(50)",
        "phase": "config",
        "desc": {
          "en": "Calculate: Returns the exact X pixel coordinate at a given percentage of screen width. • percent: Integer from 0 to 100.",
          "de": "Berechnen: Liefert die exakte X-Pixelkoordinate bei einem Prozentwert der Bildschirmbreite. • percent: Ganzzahl von 0 bis 100.",
          "sq": "Llogarit: Kthen koordinatën e saktë X në piksel për një përqindje të gjerësisë së ekranit. • percent: 0 deri 100."
        }
      },
      {
        "sig": "OLED_PCT_Y(percent)",
        "call": "OLED_PCT_Y(50)",
        "phase": "config",
        "desc": {
          "en": "Calculate: Returns the exact Y pixel coordinate at a given percentage of screen height. • percent: Integer from 0 to 100.",
          "de": "Berechnen: Liefert die exakte Y-Pixelkoordinate bei einem Prozentwert der Bildschirmhöhe. • percent: Ganzzahl von 0 bis 100.",
          "sq": "Llogarit: Kthen koordinatën e saktë Y në piksel për një përqindje të lartësisë së ekranit. • percent: 0 deri 100."
        }
      },
      {
        "sig": "OLED_TEXT_WIDTH(charCount, size)",
        "call": "OLED_TEXT_WIDTH(5, OLED_TEXT_NORMAL)",
        "phase": "config",
        "desc": {
          "en": "Calculate: Returns the total horizontal pixel width of a text string based on the 6-pixel character footprint. • charCount: Total number of characters in your string. • size: The text size multiplier used.",
          "de": "Berechnen: Liefert die Gesamtbreite eines Textes in Pixeln (Basis 6 px pro Zeichen). • charCount: Zeichenanzahl. • size: Textgrößen-Faktor.",
          "sq": "Llogarit: Kthen gjerësinë totale në piksel të tekstit (bazuar në 6 piksel për karakter). • charCount: Numri i karaktereve. • size: Madhësia."
        }
      },
      {
        "sig": "OLED_TEXT_HEIGHT(size)",
        "call": "OLED_TEXT_HEIGHT(OLED_TEXT_NORMAL)",
        "phase": "config",
        "desc": {
          "en": "Calculate: Returns the total vertical pixel height of a text string based on the 8-pixel character footprint. • size: The text size multiplier used.",
          "de": "Berechnen: Liefert die Gesamthöhe eines Textes in Pixeln (Basis 8 px). • size: Textgrößen-Faktor.",
          "sq": "Llogarit: Kthen lartësinë totale në piksel të tekstit (bazuar në 8 piksel). • size: Madhësia."
        }
      },
      {
        "sig": "OLED_ALIGN_CENTER_X(charCount, size)",
        "call": "OLED_ALIGN_CENTER_X(5, OLED_TEXT_NORMAL)",
        "phase": "config",
        "desc": {
          "en": "Position: Calculates the X-coordinate to center text horizontally. • charCount: Total number of characters in your string. • size: The text size multiplier used.",
          "de": "Position: Berechnet die X-Koordinate zum horizontalen Zentrieren von Text. • charCount: Zeichenanzahl. • size: Textgrößen-Faktor.",
          "sq": "Pozicioni: Llogarit koordinatën X për qendërzimin horizontal të tekstit. • charCount: Numri i karaktereve. • size: Madhësia."
        }
      },
      {
        "sig": "OLED_ALIGN_RIGHT_X(charCount, size)",
        "call": "OLED_ALIGN_RIGHT_X(5, OLED_TEXT_NORMAL)",
        "phase": "config",
        "desc": {
          "en": "Position: Calculates the X-coordinate needed to flush-right align text against pixel 127. • charCount: Total number of characters in your string. • size: The text size multiplier used.",
          "de": "Position: Berechnet die X-Koordinate für rechtsbündigen Text am rechten Rand (Pixel 127). • charCount: Zeichenanzahl. • size: Textgrößen-Faktor.",
          "sq": "Pozicioni: Llogarit koordinatën X për rreshtim djathtas te pikseli 127. • charCount: Numri i karaktereve. • size: Madhësia."
        }
      },
      {
        "sig": "OLED_ALIGN_CENTER_Y(size)",
        "call": "OLED_ALIGN_CENTER_Y(OLED_TEXT_NORMAL)",
        "phase": "config",
        "desc": {
          "en": "Position: Calculates the exact Y-coordinate to center text vertically on the screen. • size: The text size multiplier used.",
          "de": "Position: Berechnet die exakte Y-Koordinate zum vertikalen Zentrieren von Text. • size: Textgrößen-Faktor.",
          "sq": "Pozicioni: Llogarit koordinatën e saktë Y për qendërzimin vertikal të tekstit. • size: Madhësia."
        }
      },
      {
        "sig": "OLED_ALIGN_BOTTOM_Y(size)",
        "call": "OLED_ALIGN_BOTTOM_Y(OLED_TEXT_NORMAL)",
        "phase": "config",
        "desc": {
          "en": "Position: Calculates the Y-coordinate to flush-bottom align text so the letters rest on the bottom edge (pixel 63). • size: The text size multiplier used.",
          "de": "Position: Berechnet die Y-Koordinate für Text bündig am unteren Rand (Pixel 63). • size: Textgrößen-Faktor.",
          "sq": "Pozicioni: Llogarit koordinatën Y për rreshtim në fund (pikseli 63). • size: Madhësia."
        }
      },
      {
        "sig": "void firstPage()",
        "call": "firstPage();",
        "phase": "output",
        "desc": {
          "en": "Loop Anchor: Resets the internal page pointer to page 0. Always call this right before entering your render block.",
          "de": "Schleifen-Start: Setzt den internen Seitenzeiger auf Seite 0 zurück. Immer direkt vor dem Zeichenblock aufrufen.",
          "sq": "Fillimi i Ciklit: Rivendos treguesin e faqes në 0. Thirre gjithmonë direkt para bllokut të vizatimit."
        }
      },
      {
        "sig": "bool nextPage()",
        "call": "while (nextPage());",
        "phase": "output",
        "desc": {
          "en": "Frame Advance: Pushes the current memory page to the physical screen and moves focus to the next band. • Returns: true if more pages need rendering, false once all 8 pages are drawn.",
          "de": "Nächste Seite: Überträgt die aktuelle Seite ans Display und schaltet weiter. • Rückgabe: true solange noch Seiten fehlen, false nach allen 8 Seiten.",
          "sq": "Faqja Tjetër: Dërgon faqen aktuale në ekran dhe kalon te tjetra. • Kthen: true derisa të vizatohen të 8 faqet."
        }
      }
    ]
  },
  "oled_grid": {
    "header": "kcomp_oled_grid.h",
    "verified": true,
    "macros": [
      "GRID_MEM_SIZE(rows, cols)"
    ],
    "functions": [
      {
        "sig": "void initGrid(uint8_t rows, uint8_t cols, int16_t cellW, int16_t cellH, int16_t offsetX, int16_t offsetY, uint8_t* memoryPointer)",
        "call": "initGrid(3, 3, 20, 20, 34, 2, gameMemory);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Binds your parameters and memory array to the engine. • rows, cols: Grid dimensions. • cellW, cellH: Width and height of a single cell in pixels. • offsetX, offsetY: Starting absolute pixel of the entire grid (Top-Left). • memoryPointer: The name of your GRID_MEM_SIZE array.",
          "de": "Setup: Bindet Parameter und Speicherfeld an die Grid-Engine. • rows, cols: Rastergröße. • cellW, cellH: Breite & Höhe einer Zelle in Pixeln. • offsetX, offsetY: Linke obere Startkoordinate. • memoryPointer: Name des GRID_MEM_SIZE-Speichers.",
          "sq": "Setup: Lidh parametrat dhe memorien me motorin e rrjetës. • rows, cols: Dimensionet. • cellW, cellH: Gjerësia & lartësia e qelizës në piksel. • offsetX, offsetY: Këndi lart-majtas. • memoryPointer: Emri i GRID_MEM_SIZE."
        }
      },
      {
        "sig": "void attachGridRender(GridRenderCallback callback)",
        "call": "attachGridRender(drawPieces);",
        "phase": "setup",
        "desc": {
          "en": "Hook: Connects your custom piece-drawing function to the engine. • callback: The name of your custom function.",
          "de": "Hook: Verbindet deine eigene Figuren-Zeichenfunktion mit der Engine. • callback: Name deiner Zeichenfunktion.",
          "sq": "Lidhje: Lidh funksionin tënd të vizatimit të figurave me motorin. • callback: Emri i funksionit tënd."
        }
      },
      {
        "sig": "void attachCursorRender(GridCursorCallback callback)",
        "call": "attachCursorRender(drawCursor);",
        "phase": "setup",
        "desc": {
          "en": "Hook: Connects your custom UI cursor-drawing function to the engine. • callback: The name of your custom function.",
          "de": "Hook: Verbindet deine eigene Cursor-Zeichenfunktion mit der Engine. • callback: Name deiner Cursor-Funktion.",
          "sq": "Lidhje: Lidh funksionin tënd të vizatimit të kursorit me motorin. • callback: Emri i funksionit të kursorit."
        }
      },
      {
        "sig": "void clearGrid()",
        "call": "clearGrid();",
        "phase": "output",
        "desc": {
          "en": "Erase: Instantly wipes all cells back to state 0.",
          "de": "Leeren: Setzt sofort alle Zellen auf Zustand 0 zurück.",
          "sq": "Pastro: Kthen menjëherë të gjitha qelizat në gjendjen 0."
        }
      },
      {
        "sig": "void setGridCell(uint8_t row, uint8_t col, uint8_t state)",
        "call": "setGridCell(row, col, 1);",
        "phase": "output",
        "desc": {
          "en": "Write: Changes the value of a specific cell. • row, col: Target coordinates. • state: An integer between 0 and 15.",
          "de": "Schreiben: Ändert den Wert einer bestimmten Zelle. • row, col: Zielkoordinaten. • state: Ganzzahl von 0 bis 15.",
          "sq": "Shkruaj: Ndryshon vlerën e një qelize. • row, col: Koordinatat. • state: Numër i plotë nga 0 në 15."
        }
      },
      {
        "sig": "uint8_t getGridCell(uint8_t row, uint8_t col)",
        "call": "uint8_t val = getGridCell(row, col);",
        "phase": "input",
        "desc": {
          "en": "Read: Returns the current state of a cell. • Returns: 0 if empty, or 1 to 15.",
          "de": "Lesen: Liefert den aktuellen Zustand einer Zelle. • Rückgabe: 0 wenn leer, sonst 1 bis 15.",
          "sq": "Lexo: Kthen gjendjen aktuale të qelizës. • Kthen: 0 nëse bosh, ose 1 deri 15."
        }
      },
      {
        "sig": "void enableCursor(bool enable)",
        "call": "enableCursor(true);",
        "phase": "config",
        "desc": {
          "en": "Visibility: Turns the cursor rendering on or off. • enable: true to show, false to hide.",
          "de": "Sichtbarkeit: Schaltet die Cursor-Anzeige ein oder aus. • enable: true zum Anzeigen, false zum Ausblenden.",
          "sq": "Dukshmëria: Ndez ose fik shfaqjen e kursorit. • enable: true për shfaqje, false për fshehje."
        }
      },
      {
        "sig": "void setCursorPos(uint8_t row, uint8_t col)",
        "call": "setCursorPos(0, 0);",
        "phase": "output",
        "desc": {
          "en": "Teleport: Instantly moves the cursor to a specific cell. • row, col: The target coordinates.",
          "de": "Teleport: Springt mit dem Cursor sofort zu einer bestimmten Zelle. • row, col: Zielkoordinaten.",
          "sq": "Teleport: Zhvendos menjëherë kursorin te një qelizë e caktuar. • row, col: Koordinatat e synuara."
        }
      },
      {
        "sig": "void moveCursor(int8_t deltaRow, int8_t deltaCol)",
        "call": "moveCursor(-1, 0);",
        "phase": "input",
        "desc": {
          "en": "Navigate: Moves the cursor relative to its current position (e.g., -1, 0 moves UP). Automatically constrained by grid edges. • deltaRow, deltaCol: The amount to move by.",
          "de": "Navigieren: Bewegt den Cursor relativ zur aktuellen Position (z. B. -1, 0 bewegt nach OBEN), automatisch an den Rändern begrenzt. • deltaRow, deltaCol: Schrittweite.",
          "sq": "Navigo: Lëviz kursorin relativisht nga pozicioni aktual (p.sh. -1, 0 lëviz LART), i kufizuar automatikisht brenda rrjetës."
        }
      },
      {
        "sig": "uint8_t getCursorRow()",
        "call": "uint8_t row = getCursorRow();",
        "phase": "input",
        "desc": {
          "en": "Location: Returns the current row of the cursor.",
          "de": "Position: Liefert die aktuelle Zeile des Cursors.",
          "sq": "Pozicioni: Kthen rreshtin aktual të kursorit."
        }
      },
      {
        "sig": "uint8_t getCursorCol()",
        "call": "uint8_t col = getCursorCol();",
        "phase": "input",
        "desc": {
          "en": "Location: Returns the current column of the cursor.",
          "de": "Position: Liefert die aktuelle Spalte des Cursors.",
          "sq": "Pozicioni: Kthen kolonën aktuale të kursorit."
        }
      },
      {
        "sig": "void drawGridFramework()",
        "call": "drawGridFramework();",
        "phase": "output",
        "desc": {
          "en": "Borders Only: Draws the physical white dividing lines between cells.",
          "de": "Nur Linien: Zeichnet ausschließlich die weißen Trennlinien zwischen den Zellen.",
          "sq": "Vetëm Kornizat: Vizaton vetëm vijat e bardha ndarëse mes qelizave."
        }
      },
      {
        "sig": "void renderGrid()",
        "call": "renderGrid();",
        "phase": "output",
        "desc": {
          "en": "Master Render: Draws the grid, evaluates all cells, calls your custom drawing function for any cell that is >0, and draws the cursor on top.",
          "de": "Master-Render: Zeichnet das Raster, prüft alle Zellen, ruft bei Zellen > 0 deine Zeichenfunktion auf und zeichnet den Cursor darüber.",
          "sq": "Render Kryesor: Vizaton rrjetën, vlerëson qelizat, thërret funksionin tënd për çdo qelizë > 0 dhe vizaton kursorin sipër."
        }
      }
    ]
  },
  "onboard_joystick": {
    "header": "kcomp_joystick.h",
    "verified": true,
    "macros": [
      "JOYSTICK_CENTER",
      "JOYSTICK_UP",
      "JOYSTICK_DOWN",
      "JOYSTICK_LEFT",
      "JOYSTICK_RIGHT",
      "JOYSTICK_UP_LEFT",
      "JOYSTICK_UP_RIGHT",
      "JOYSTICK_DOWN_LEFT",
      "JOYSTICK_DOWN_RIGHT",
      "JOYSTICK_UNDEFINED"
    ],
    "fields": [
      "direction",
      "intensity"
    ],
    "functions": [
      {
        "sig": "void initJoystick()",
        "call": "initJoystick();",
        "phase": "setup",
        "desc": {
          "en": "Description: Initializes the joystick. Sets pins A1 and A2 as inputs. Usage: Must be called once inside setup().",
          "de": "Beschreibung: Initialisiert den Joystick und setzt A1 und A2 als Eingänge. Verwendung: Einmal in setup() aufrufen.",
          "sq": "Përshkrimi: Inicializon Joystick-un (vendos pinat A1 dhe A2 si hyrje). Thirret një herë në setup()."
        }
      },
      {
        "sig": "int getJoystickXValue()",
        "call": "int joyX = getJoystickXValue();",
        "phase": "input",
        "desc": {
          "en": "Description: Gets the position of the X-axis (horizontal). Returns: A value from -512 (left) and +511 (right).",
          "de": "Beschreibung: Liefert die Position der X-Achse (horizontal). Rückgabe: Wert von -512 (links) bis +511 (rechts).",
          "sq": "Përshkrimi: Merr pozicionin e boshtit X (horizontal). Kthen: Vlerë nga -512 (majtas) deri +511 (djathtas)."
        }
      },
      {
        "sig": "int getJoystickYValue()",
        "call": "int joyY = getJoystickYValue();",
        "phase": "input",
        "desc": {
          "en": "Description: Gets the position of the Y-axis (vertical). Returns: A value from -512 (Down) and +511 (Up).",
          "de": "Beschreibung: Liefert die Position der Y-Achse (vertikal). Rückgabe: Wert von -512 (unten) bis +511 (oben).",
          "sq": "Përshkrimi: Merr pozicionin e boshtit Y (vertikal). Kthen: Vlerë nga -512 (poshtë) deri +511 (lart)."
        }
      },
      {
        "sig": "joystickState getJoystickState()",
        "call": "joystickState js = getJoystickState();",
        "phase": "input",
        "desc": {
          "en": "Read Everything: The \"All-in-One\" function. Returns: A joystickState structure containing both .direction and .intensity calculated for you.",
          "de": "Alles lesen: Die „All-in-One“-Funktion. Rückgabe: Eine joystickState-Struktur mit fertig berechneter .direction und .intensity.",
          "sq": "Lexo Gjithçka: Funksioni „All-in-One“. Kthen: Strukturën joystickState me .direction dhe .intensity të llogaritura."
        }
      }
    ]
  },
  "onboard_led": {
    "header": "kcomp_led.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "void initLed()",
        "call": "initLed();",
        "phase": "setup",
        "desc": {
          "en": "Setup: prepares Pin D5 for output. Must be called once inside setup().",
          "de": "Setup: Bereitet Pin D5 als Ausgang vor. Muss einmal in setup() aufgerufen werden.",
          "sq": "Setup: Përgatit pinin D5 si dalje. Duhet thirrur një herë në setup()."
        }
      },
      {
        "sig": "void ledOn(byte intensity)",
        "call": "ledOn(100);",
        "phase": "output",
        "desc": {
          "en": "Turn On: sets the brightness. • intensity is a number from 0 (OFF) to 100 (max brightness). (Note: The library maps this 0-100 input to the technical 0-255 PWM value automatically).",
          "de": "Einschalten: Setzt die Helligkeit. • intensity: Zahl von 0 (AUS) bis 100 (volle Helligkeit); die Bibliothek rechnet 0–100 automatisch auf 0–255 PWM um.",
          "sq": "Ndiz: Vendos ndriçimin. • intensity: Numër nga 0 (FIKUR) deri 100 (maks.); biblioteka e kthen automatikisht në 0–255 PWM."
        }
      },
      {
        "sig": "void ledOff()",
        "call": "ledOff();",
        "phase": "output",
        "desc": {
          "en": "Turn Off: Switches the LED off. It is the same as ledOn(0).",
          "de": "Ausschalten: Schaltet die LED aus (entspricht ledOn(0)).",
          "sq": "Fik: Fik LED-in (njësoj si ledOn(0))."
        }
      },
      {
        "sig": "void ledFadeIn(byte final, int duration)",
        "call": "ledFadeIn(100, 1000);",
        "phase": "output",
        "desc": {
          "en": "Animation: smoothly brightens the LED. • final is the target brightness (0-100) • duration is time in milliseconds (e.g., 1000 = 1s).",
          "de": "Animation: Blendet die LED sanft ein. • final: Zielhelligkeit (0–100). • duration: Zeit in Millisekunden (z. B. 1000 = 1 s).",
          "sq": "Animacion: Ndriçon butësisht LED-in. • final: Ndriçimi i synuar (0–100). • duration: Koha në milisekonda (p.sh. 1000 = 1 s)."
        }
      },
      {
        "sig": "void ledFadeOut(byte start, int duration)",
        "call": "ledFadeOut(100, 1000);",
        "phase": "output",
        "desc": {
          "en": "Animation: Smoothly dims the LED to darkness. • start is the starting brightness (0-100) • duration is time in ms.",
          "de": "Animation: Dimmt die LED sanft bis zur Dunkelheit ab. • start: Starthelligkeit (0–100). • duration: Zeit in ms.",
          "sq": "Animacion: Zbeh butësisht LED-in deri në fikje. • start: Ndriçimi fillestar (0–100). • duration: Koha në ms."
        }
      }
    ]
  },
  "onboard_pot": {
    "header": "kcomp_potentiometer.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "void initPotentiometer()",
        "call": "initPotentiometer();",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the hardware connection on Pin A0. This must be called once inside your setup() function.",
          "de": "Setup: Initialisiert die Hardware-Verbindung an Pin A0. Einmal in setup() aufrufen.",
          "sq": "Setup: Inicializon lidhjen harduerike në pinin A0. Thirret një herë në setup()."
        }
      },
      {
        "sig": "int getPotentiometerRaw()",
        "call": "int raw = getPotentiometerRaw();",
        "phase": "input",
        "desc": {
          "en": "Read Raw Value: Returns the precise position of the knob. Returns: An integer between 0 (Min) and 1023 (Max).",
          "de": "Rohwert lesen: Liefert die exakte Drehregler-Position als Ganzzahl zwischen 0 (Min) und 1023 (Max).",
          "sq": "Lexo Vlerën Bazë: Kthen pozicionin e saktë të rrotulluesit nga 0 (Min) deri 1023 (Maks)."
        }
      },
      {
        "sig": "int getPotentiometerValue()",
        "call": "int pot = getPotentiometerValue();",
        "phase": "input",
        "desc": {
          "en": "Read Percentage: Returns the position as a simple percentage. Returns: An integer between 0 and 100. (Useful for things like screen brightness or volume).",
          "de": "Prozentwert lesen: Liefert die Position als Prozentzahl zwischen 0 und 100 (praktisch für Helligkeit oder Lautstärke).",
          "sq": "Lexo Përqindjen: Kthen pozicionin në përqindje nga 0 deri 100 (i dobishëm për ndriçim ose volum)."
        }
      }
    ]
  },
  "onboard_start": {
    "header": "kcomp_button_start.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "void initButtonStart()",
        "call": "initButtonStart();",
        "phase": "setup",
        "desc": {
          "en": "Setup: Configures Pin D3. Called once in setup().",
          "de": "Setup: Konfiguriert Pin D3. Einmal in setup() aufrufen.",
          "sq": "Setup: Konfiguron pinin D3. Thirret një herë në setup()."
        }
      },
      {
        "sig": "bool isButtonStartPressed()",
        "call": "if (isButtonStartPressed()) { /* held */ }",
        "phase": "input",
        "desc": {
          "en": "Polling Method: Returns true if the button is currently held down, false otherwise.",
          "de": "Polling-Methode: Liefert true, solange der Taster gedrückt gehalten wird, sonst false.",
          "sq": "Metoda Polling: Kthen true nëse butoni mbahet i shtypur, përndryshe false."
        }
      },
      {
        "sig": "void pollStartButton()",
        "call": "pollStartButton();",
        "phase": "service",
        "desc": {
          "en": "The Manager: Checks hardware, filters noise, and triggers events. Must be called continuously in loop() for Method B to work.",
          "de": "Der Manager: Prüft die Hardware, filtert Prellen und löst Events aus. Muss laufend in loop() aufgerufen werden.",
          "sq": "Menaxheri: Kontrollon harduerin, filtron zhurmën dhe aktivizon ngjarjet. Duhet thirrur vazhdimisht në loop()."
        }
      },
      {
        "sig": "void attachButtonStartClick(func)",
        "call": "attachButtonStartClick(onStartClicked);",
        "phase": "setup",
        "desc": {
          "en": "Event Setup: Registers func to run on a Single Click.",
          "de": "Event-Setup: Registriert func für einen Einzelklick.",
          "sq": "Setup Ngjarjeje: Regjistron func për një klikim të vetëm."
        }
      },
      {
        "sig": "void attachButtonStartDoubleClick(func)",
        "call": "attachButtonStartDoubleClick(onStartDoubleClicked);",
        "phase": "setup",
        "desc": {
          "en": "Event Setup: Registers func to run on a Double Click.",
          "de": "Event-Setup: Registriert func für einen Doppelklick.",
          "sq": "Setup Ngjarjeje: Regjistron func për një klikim të dyfishtë."
        }
      },
      {
        "sig": "void attachButtonStartLongPressed(func)",
        "call": "attachButtonStartLongPressed(onStartLongPressed);",
        "phase": "setup",
        "desc": {
          "en": "Event Setup: Registers func to run when the button is long-pressed.",
          "de": "Event-Setup: Registriert func für langes Gedrückthalten des Tasters.",
          "sq": "Setup Ngjarjeje: Regjistron func për mbajtje të gjatë të butonit."
        }
      }
    ]
  },
  "onboard_select": {
    "header": "kcomp_button_select.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "void initButtonSelect()",
        "call": "initButtonSelect();",
        "phase": "setup",
        "desc": {
          "en": "Setup: Configures Pin D4. Called once in setup().",
          "de": "Setup: Konfiguriert Pin D4. Einmal in setup() aufrufen.",
          "sq": "Setup: Konfiguron pinin D4. Thirret një herë në setup()."
        }
      },
      {
        "sig": "bool isButtonSelectPressed()",
        "call": "if (isButtonSelectPressed()) { /* held */ }",
        "phase": "input",
        "desc": {
          "en": "Polling Method: Returns true if the button is currently held down, false otherwise.",
          "de": "Polling-Methode: Liefert true, solange der Taster gedrückt gehalten wird, sonst false.",
          "sq": "Metoda Polling: Kthen true nëse butoni mbahet i shtypur, përndryshe false."
        }
      },
      {
        "sig": "void pollSelectButton()",
        "call": "pollSelectButton();",
        "phase": "service",
        "desc": {
          "en": "The Manager: Checks hardware, filters noise, and triggers events. Must be called continuously in loop() for Method B to work.",
          "de": "Der Manager: Prüft die Hardware, filtert Prellen und löst Events aus. Muss laufend in loop() aufgerufen werden.",
          "sq": "Menaxheri: Kontrollon harduerin, filtron zhurmën dhe aktivizon ngjarjet. Duhet thirrur vazhdimisht në loop()."
        }
      },
      {
        "sig": "void attachButtonSelectClick(func)",
        "call": "attachButtonSelectClick(onSelectClicked);",
        "phase": "setup",
        "desc": {
          "en": "Event Setup: Registers func to run on a Single Click.",
          "de": "Event-Setup: Registriert func für einen Einzelklick.",
          "sq": "Setup Ngjarjeje: Regjistron func për një klikim të vetëm."
        }
      },
      {
        "sig": "void attachButtonSelectDoubleClick(func)",
        "call": "attachButtonSelectDoubleClick(onSelectDoubleClicked);",
        "phase": "setup",
        "desc": {
          "en": "Event Setup: Registers func to run on a Double Click.",
          "de": "Event-Setup: Registriert func für einen Doppelklick.",
          "sq": "Setup Ngjarjeje: Regjistron func për një klikim të dyfishtë."
        }
      },
      {
        "sig": "void attachButtonSelectLongPressed(func)",
        "call": "attachButtonSelectLongPressed(onSelectLongPressed);",
        "phase": "setup",
        "desc": {
          "en": "Event Setup: Registers func to run when the button is long-pressed.",
          "de": "Event-Setup: Registriert func für langes Gedrückthalten des Tasters.",
          "sq": "Setup Ngjarjeje: Regjistron func për mbajtje të gjatë të butonit."
        }
      }
    ]
  },
  "onboard_buzzer": {
    "header": "kcomp_buzzer.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "void initBuzzer()",
        "call": "initBuzzer();",
        "phase": "setup",
        "desc": {
          "en": "Setup: Configures Pin D9. Must be called in setup().",
          "de": "Setup: Konfiguriert Pin D9. Muss in setup() aufgerufen werden.",
          "sq": "Setup: Konfiguron pinin D9. Duhet thirrur në setup()."
        }
      },
      {
        "sig": "void buzzerBeepBlocking(uint freq)",
        "call": "buzzerBeepBlocking(440);",
        "phase": "output",
        "desc": {
          "en": "Manual Tone: Starts playing a tone at a frequency (Hz) and keeps playing it forever until you turn it off. • freq: Frequency in Hertz (e.g., 440).",
          "de": "Dauerton: Spielt einen Ton mit der angegebenen Frequenz (Hz), bis er ausgeschaltet wird. • freq: Frequenz in Hertz (z. B. 440).",
          "sq": "Ton i Vazhdueshëm: Luan një ton në frekuencën (Hz) derisa ta fikësh. • freq: Frekuenca në Hertz (p.sh. 440)."
        }
      },
      {
        "sig": "void buzzerOff()",
        "call": "buzzerOff();",
        "phase": "output",
        "desc": {
          "en": "Silence: Stops any currently playing tone immediately.",
          "de": "Stille: Stoppt jeden aktuell spielenden Ton sofort.",
          "sq": "Heshtje: Ndalon menjëherë çdo ton që po luhet."
        }
      },
      {
        "sig": "void buzzerBeepNonBlocking(uint freq, ulong duration)",
        "call": "buzzerBeepNonBlocking(1000, 120);",
        "phase": "output",
        "desc": {
          "en": "Timed Beep: Plays a tone for a set time, then stops. • freq: Frequency in Hz. • duration: Time in milliseconds.",
          "de": "Zeitgesteuerter Piepton: Spielt einen Ton für eine feste Zeit und stoppt danach. • freq: Frequenz in Hz. • duration: Dauer in Millisekunden.",
          "sq": "Ton me Kohë: Luan një ton për kohën e caktuar, pastaj ndalet. • freq: Frekuenca në Hz. • duration: Koha në milisekonda."
        }
      },
      {
        "sig": "void buzzerMelodyBlocking(uint notes[], uint durations[], byte length)",
        "call": "buzzerMelodyBlocking(notes, durations, len);",
        "phase": "output",
        "desc": {
          "en": "Play Song (Wait): Plays a full melody. The processor freezes until the song is done. • notes: Array of note frequencies. • durations: Array of note lengths (4=quarter, etc.).",
          "de": "Melodie (blockierend): Spielt eine ganze Melodie ab; der Prozessor wartet bis zum Ende. • notes: Notenfrequenzen. • durations: Notenlängen (4 = Viertelnote).",
          "sq": "Luaj Melodi (Bllokuese): Luan një melodi të plotë; procesori pret derisa të mbarojë. • notes: Frekuencat. • durations: Gjatësitë (4 = e katërta)."
        }
      },
      {
        "sig": "void buzzerMelodyNonBlocking(uint notes[], uint durations[], byte length)",
        "call": "buzzerMelodyNonBlocking(notes, durations, len);",
        "phase": "output",
        "desc": {
          "en": "Play Song (Background): Plays a melody. The processor continues running your other code. (Requires updateMelody() in loop).",
          "de": "Melodie (Hintergrund): Spielt eine Melodie ab, während der übrige Code weiterläuft (benötigt updateMelody() in loop()).",
          "sq": "Luaj Melodi (Në Sfond): Luan melodinë ndërsa kodi tjetër vazhdon (kërkon updateMelody() në loop())."
        }
      },
      {
        "sig": "void updateMelody()",
        "call": "updateMelody();",
        "phase": "service",
        "desc": {
          "en": "Checks if it's time to play the next note. Must be called in loop() if using non-blocking melodies.",
          "de": "Prüft, ob die nächste Note fällig ist. Muss in loop() aufgerufen werden, wenn nicht-blockierende Melodien laufen.",
          "sq": "Kontrollon nëse është koha për notën tjetër. Duhet thirrur në loop() për melodi jo-bllokuese."
        }
      }
    ]
  },
  "onboard_distance": {
    "header": "kcomp_distance.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "void initDistanceSensor()",
        "call": "initDistanceSensor();",
        "phase": "setup",
        "desc": {
          "en": "Setup: Configures the Trigger pin as Output and Echo pin as Input. This must be called once inside setup().",
          "de": "Setup: Konfiguriert den Trigger-Pin als Ausgang und den Echo-Pin als Eingang. Einmal in setup() aufrufen.",
          "sq": "Setup: Konfiguron pinin Trigger si dalje dhe Echo si hyrje. Duhet thirrur një herë në setup()."
        }
      },
      {
        "sig": "int getDistanceMM()",
        "call": "int distMM = getDistanceMM();",
        "phase": "input",
        "desc": {
          "en": "Measure: Triggers a pulse, waits for the echo, and calculates the distance. Returns: The distance to the object in millimeters (mm) as an integer.",
          "de": "Messen: Löst einen Impuls aus, wartet auf das Echo und berechnet den Abstand. Rückgabe: Entfernung zum Objekt in Millimetern (mm) als Ganzzahl.",
          "sq": "Mat: Lëshon një puls, pret jehonën dhe llogarit distancën. Kthen: Distancën deri te objekti në milimetra (mm) si numër i plotë."
        }
      }
    ]
  },
  "bmp280": {
    "header": "kcomp_BMP280.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "bool initBMP280()",
        "call": "if (!initBMP280()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts I²C and reads calibration data. • Returns true if sensor is connected, false if missing.",
          "de": "Setup: Startet I²C und liest die Kalibrierungsdaten. • Rückgabe: true wenn verbunden, false falls nicht gefunden.",
          "sq": "Setup: Nis I²C dhe lexon të dhënat e kalibrimit. • Kthen true nëse sensori është i lidhur, false nëse mungon."
        }
      },
      {
        "sig": "float getBMP280Temperature()",
        "call": "float tempC = getBMP280Temperature();",
        "phase": "input",
        "desc": {
          "en": "Read Temp: Returns temperature in °C.",
          "de": "Temperatur lesen: Liefert die Temperatur in °C.",
          "sq": "Lexo Temperaturën: Kthen temperaturën në °C."
        }
      },
      {
        "sig": "float getBMP280Pressure()",
        "call": "float pressurePa = getBMP280Pressure();",
        "phase": "input",
        "desc": {
          "en": "Read Pressure: Returns absolute pressure in Pa. Divide by 100 to get hPa (hectopascals).",
          "de": "Luftdruck lesen: Liefert den absoluten Druck in Pa. Durch 100 teilen für hPa (Hektopascal).",
          "sq": "Lexo Shtypjen: Kthen shtypjen absolute në Pa. Pjesëto me 100 për hPa (hektopaskal)."
        }
      },
      {
        "sig": "float getBMP280Altitude(float seaLevel)",
        "call": "float altM = getBMP280Altitude(1013.25f);",
        "phase": "input",
        "desc": {
          "en": "Read Altitude: Calculates height in m. • seaLevel: Pressure at sea level (usually ~1013.25 hPa).",
          "de": "Höhe berechnen: Berechnet die Höhe in m. • seaLevel: Luftdruck auf Meereshöhe (üblicherweise ~1013,25 hPa).",
          "sq": "Lexo Lartësinë: Llogarit lartësinë në m. • seaLevel: Shtypja në nivelin e detit (zakonisht ~1013.25 hPa)."
        }
      }
    ]
  },
  "aht10": {
    "header": "kcomp_AHT10.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "void initAHT10()",
        "call": "initAHT10();",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the I2C bus and sends a Calibration Command. Must be called once in setup().",
          "de": "Setup: Startet den I²C-Bus und sendet den Kalibrierungsbefehl. Einmal in setup() aufrufen.",
          "sq": "Setup: Nis busin I²C dhe dërgon komandën e kalibrimit. Duhet thirrur një herë në setup()."
        }
      },
      {
        "sig": "float getAHT10Temperature()",
        "call": "float tempC = getAHT10Temperature();",
        "phase": "input",
        "desc": {
          "en": "Read Temp: Returns the current temperature in °C as a decimal number.",
          "de": "Temperatur lesen: Liefert die aktuelle Temperatur in °C als Kommazahl.",
          "sq": "Lexo Temperaturën: Kthen temperaturën aktuale në °C si numër dhjetor."
        }
      },
      {
        "sig": "float getAHT10Humidity()",
        "call": "float hum = getAHT10Humidity();",
        "phase": "input",
        "desc": {
          "en": "Read Humidity: Returns the current relative humidity in %.",
          "de": "Luftfeuchte lesen: Liefert die aktuelle relative Luftfeuchtigkeit in %.",
          "sq": "Lexo Lagështinë: Kthen lagështinë relative aktuale në %."
        }
      },
      {
        "sig": "void resetAHT10()",
        "call": "resetAHT10();",
        "phase": "config",
        "desc": {
          "en": "Reset: Performs a \"Soft Reset\" to reboot the sensor.",
          "de": "Reset: Führt einen „Soft Reset“ zum Neustart des Sensors durch.",
          "sq": "Reset: Kryen një „Soft Reset“ për të rinisur sensorin."
        }
      }
    ]
  },
  "max30102": {
    "header": "kcomp_MAX30102.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "bool initMAX30102()",
        "call": "if (!initMAX30102()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the sensor and LEDs. Must be called in setup().",
          "de": "Setup: Initialisiert den Sensor und die LEDs. Muss in setup() aufgerufen werden.",
          "sq": "Setup: Inicializon sensorin dhe LED-at. Duhet thirrur në setup()."
        }
      },
      {
        "sig": "void updateVitalSigns()",
        "call": "updateVitalSigns();",
        "phase": "service",
        "desc": {
          "en": "The Worker: CRITICAL! Call this in your loop() as often as possible. If you don't call this, the math stops working.",
          "de": "Der Worker: WICHTIG! So oft wie möglich in loop() aufrufen, sonst bleibt die Berechnung stehen.",
          "sq": "Punëtori: KRITIKE! Thirre në loop() sa më shpesh të jetë e mundur, përndryshe llogaritja ndalet."
        }
      },
      {
        "sig": "int getHeartRate()",
        "call": "int bpm = getHeartRate();",
        "phase": "input",
        "desc": {
          "en": "Read BPM: Returns your heart rate. Returns 0 if no finger is detected.",
          "de": "Puls lesen: Liefert die Herzfrequenz (BPM), oder 0 wenn kein Finger erkannt wird.",
          "sq": "Lexo BPM: Kthen rrahjet e zemrës. Kthen 0 nëse nuk zbulohet asnjë gisht."
        }
      },
      {
        "sig": "int getSPO2()",
        "call": "int spo2 = getSPO2();",
        "phase": "input",
        "desc": {
          "en": "Read Oxygen: Returns the percentage of oxygen in your blood.",
          "de": "Sauerstoff lesen: Liefert die Blutsauerstoffsättigung (SpO2) in Prozent.",
          "sq": "Lexo Oksigjenin: Kthen përqindjen e oksigjenit në gjak (SpO2)."
        }
      }
    ]
  },
  "gy302": {
    "header": "kcomp_GY302.h",
    "verified": true,
    "macros": [
      "GY302_MODE_NORMAL",
      "GY302_MODE_HIGH",
      "GY302_MODE_FAST"
    ],
    "functions": [
      {
        "sig": "bool initGY302()",
        "call": "if (!initGY302()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the sensor, sends a reset command, and sets the default mode to Normal. Returns true if the sensor responded correctly.",
          "de": "Setup: Startet den Sensor, sendet einen Reset-Befehl und aktiviert den Normal-Modus. Rückgabe: true bei gültiger Antwort.",
          "sq": "Setup: Nis sensorin, dërgon reset dhe vendos modalitetin Normal. Kthen true nëse sensori përgjigjet saktë."
        }
      },
      {
        "sig": "float getGY302Lux()",
        "call": "float lux = getGY302Lux();",
        "phase": "input",
        "desc": {
          "en": "Read Lux: Returns the current light level in Lux as a decimal. Returns -1.0 if the reading failed.",
          "de": "Lux lesen: Liefert die aktuelle Helligkeit in Lux als Kommazahl (oder -1.0 bei Lesefehler).",
          "sq": "Lexo Lux: Kthen nivelin aktual të dritës në Lux si numër dhjetor (ose -1.0 nëse leximi dështon)."
        }
      },
      {
        "sig": "void setGY302Mode(GY302Mode mode)",
        "call": "setGY302Mode(GY302_MODE_NORMAL);",
        "phase": "config",
        "desc": {
          "en": "Change Resolution/Speed: Changes the active measurement mode of the sensor. Accepts: • GY302_MODE_NORMAL: 1 Lux precision, ~120ms measurement time. • GY302_MODE_HIGH: 0.5 Lux precision for dark environments, ~120ms measurement time. • GY302_MODE_FAST: 4 Lux precision, ~16ms measurement time for quick updates.",
          "de": "Auflösung/Tempo ändern: Ändert den Messmodus: • GY302_MODE_NORMAL (1 Lux, ~120 ms) • GY302_MODE_HIGH (0,5 Lux für dunkle Räume, ~120 ms) • GY302_MODE_FAST (4 Lux, ~16 ms für schnelle Updates).",
          "sq": "Ndrysho Rezolucionin/Shpejtësinë: Pranon: • GY302_MODE_NORMAL (1 Lux, ~120ms) • GY302_MODE_HIGH (0.5 Lux, ~120ms) • GY302_MODE_FAST (4 Lux, ~16ms)."
        }
      }
    ]
  },
  "paj7620u2": {
    "header": "kcomp_PAJ7620U2.h",
    "verified": true,
    "macros": [
      "GESTURE_NONE",
      "GESTURE_UP",
      "GESTURE_DOWN",
      "GESTURE_LEFT",
      "GESTURE_RIGHT",
      "GESTURE_FORWARD",
      "GESTURE_BACKWARD",
      "GESTURE_CLOCKWISE",
      "GESTURE_COUNTER_CLOCKWISE",
      "GESTURE_WAVE"
    ],
    "functions": [
      {
        "sig": "bool initPAJ7620()",
        "call": "if (!initPAJ7620()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the sensor. Returns true if successful, false if not found.",
          "de": "Setup: Initialisiert den Sensor. Rückgabe: true bei Erfolg, false falls nicht gefunden.",
          "sq": "Setup: Inicializon sensorin. Kthen true nëse ka sukses, false nëse nuk gjendet."
        }
      },
      {
        "sig": "uint8_t getPAJ7620Gesture()",
        "call": "uint8_t gesture = getPAJ7620Gesture();",
        "phase": "input",
        "desc": {
          "en": "Read: Returns the recognized gesture (e.g., GESTURE_LEFT).",
          "de": "Lesen: Liefert die erkannte Geste (z. B. GESTURE_LEFT).",
          "sq": "Lexo: Kthen gjestin e njohur (p.sh. GESTURE_LEFT)."
        }
      },
      {
        "sig": "void setPAJ7620FastMode(bool enable)",
        "call": "setPAJ7620FastMode(true);",
        "phase": "config",
        "desc": {
          "en": "Config: Pass true for 240fps rapid swipe detection, or false for standard 120fps tracking.",
          "de": "Konfiguration: true für schnelle 240-fps-Erkennung, false für Standard-120-fps-Tracking.",
          "sq": "Konfig: Kalo true për zbulim të shpejtë 240fps, ose false për gjurmim standard 120fps."
        }
      },
      {
        "sig": "void setPAJ7620WaveTime(uint16_t cooldown_ms)",
        "call": "setPAJ7620WaveTime(250);",
        "phase": "config",
        "desc": {
          "en": "Config: Ignores new triggers for cooldown_ms milliseconds after a valid read to prevent rebound false positives. 250ms by default.",
          "de": "Konfiguration: Ignoriert neue Auslöser für cooldown_ms ms nach einer Geste gegen Fehlauslösungen (Standard: 250 ms).",
          "sq": "Konfig: Injoron aktivizime të reja për cooldown_ms ms pas një leximi të vlefshëm kundër gabimeve (parazgjedhje 250ms)."
        }
      }
    ]
  },
  "bmi160": {
    "header": "kcomp_GYBMI160.h",
    "verified": true,
    "macros": [],
    "fields": [
      "accelX",
      "accelY",
      "accelZ",
      "gyroX",
      "gyroY",
      "gyroZ",
      "angleX",
      "angleY",
      "angleZ"
    ],
    "functions": [
      {
        "sig": "bool initBMI160()",
        "call": "if (!initBMI160()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the sensor. Must be called in setup(). Returns true if the sensor was initialized successfully.",
          "de": "Setup: Initialisiert den Sensor. Muss in setup() aufgerufen werden. Rückgabe: true bei Erfolg.",
          "sq": "Setup: Inicializon sensorin. Duhet thirrur në setup(). Kthen true nëse inicializohet me sukses."
        }
      },
      {
        "sig": "BMI160Data readBMI160()",
        "call": "BMI160Data data = readBMI160();",
        "phase": "input",
        "desc": {
          "en": "Read: Returns the latest motion and angle data.",
          "de": "Lesen: Liefert die aktuellen Bewegungs- und Winkeldaten (accelX/Y/Z, gyroX/Y/Z, angleX/Y/Z).",
          "sq": "Lexo: Kthen të dhënat më të fundit të lëvizjes dhe këndeve (accelX/Y/Z, gyroX/Y/Z, angleX/Y/Z)."
        }
      },
      {
        "sig": "void resetGyroZ()",
        "call": "resetGyroZ();",
        "phase": "config",
        "desc": {
          "en": "Reset: Sets the Z-angle (Yaw) back to zero.",
          "de": "Reset: Setzt den Z-Winkel (Gieren / Yaw) wieder auf 0 zurück.",
          "sq": "Reset: Kthen këndin Z (Yaw) prapë në zero."
        }
      }
    ]
  },
  "as7343": {
    "header": "kcomp_AS7343.h",
    "verified": true,
    "macros": [],
    "fields": [
      "valid",
      "clear",
      "f1_405nm",
      "f2_425nm",
      "fz_450nm",
      "f3_475nm",
      "f4_515nm",
      "f5_550nm",
      "fy_555nm",
      "fxl_600nm",
      "f6_640nm",
      "f7_690nm",
      "f8_745nm",
      "nir"
    ],
    "functions": [
      {
        "sig": "bool initAS7343()",
        "call": "if (!initAS7343()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Wakes up the sensor and configures it. Returns: true if successful.",
          "de": "Setup: Weckt den Sensor auf und konfiguriert ihn. Rückgabe: true bei Erfolg.",
          "sq": "Setup: Zgjon sensorin dhe e konfiguron. Kthen: true nëse ka sukses."
        }
      },
      {
        "sig": "bool updateAS7343()",
        "call": "if (updateAS7343()) { /* ready */ }",
        "phase": "service",
        "desc": {
          "en": "The Worker: Tells the sensor to scan the light. Takes about ~150ms. Returns true when data is ready.",
          "de": "Der Worker: Löst den Licht-Scan aus (~150 ms) und liefert true, sobald neue Daten bereitliegen.",
          "sq": "Punëtori: Udhëzon sensorin të skanojë dritën (~150ms). Kthen true kur të dhënat janë gati."
        }
      },
      {
        "sig": "AS7343Data getAS7343Data()",
        "call": "AS7343Data spec = getAS7343Data();",
        "phase": "input",
        "desc": {
          "en": "Returns the package of spectral data described above.",
          "de": "Liefert das komplette Spektraldaten-Paket (valid, clear, f1_405nm .. f8_745nm, nir).",
          "sq": "Kthen paketën e plotë të të dhënave spektrale (valid, clear, f1_405nm .. f8_745nm, nir)."
        }
      },
      {
        "sig": "void setAS7343LED(bool enable, uint8_t mA)",
        "call": "setAS7343LED(true, 4);",
        "phase": "config",
        "desc": {
          "en": "Config: Turns the onboard white LED on or off. • enable: true or false. • mA: Brightness from 4 to 10 (e.g., 4 is a safe default).",
          "de": "Konfiguration: Schaltet die weiße Onboard-LED ein/aus. • enable: true/false. • mA: Helligkeit 4 bis 10 (Standard: 4).",
          "sq": "Konfig: Ndez/fik LED-in e bardhë në modul. • enable: true/false. • mA: Ndriçimi 4 deri 10 (parazgjedhje e sigurt: 4)."
        }
      },
      {
        "sig": "void setAS7343Gain(uint8_t gain_level)",
        "call": "setAS7343Gain(6);",
        "phase": "config",
        "desc": {
          "en": "Config: Changes how sensitive the sensor is to light. • gain_level: 0 to 12. (e.g., 6 is a suitable default).",
          "de": "Konfiguration: Stellt die Lichtempfindlichkeit ein. • gain_level: 0 bis 12 (guter Standardwert: 6).",
          "sq": "Konfig: Ndryshon ndjeshmërinë ndaj dritës. • gain_level: 0 deri 12 (parazgjedhje e mirë: 6)."
        }
      }
    ]
  },
  "as7331": {
    "header": "kcomp_AS7331.h",
    "verified": true,
    "macros": [
      "AS7331_GAIN_2048X",
      "AS7331_GAIN_256X",
      "AS7331_GAIN_64X",
      "AS7331_GAIN_16X",
      "AS7331_GAIN_1X"
    ],
    "functions": [
      {
        "sig": "bool initAS7331()",
        "call": "if (!initAS7331()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts I²C and sets up a default continuous measurement loop. • Returns true if sensor is connected, false if missing.",
          "de": "Setup: Startet I²C und aktiviert die kontinuierliche Standard-Messung. • Rückgabe: true wenn verbunden, false falls nicht gefunden.",
          "sq": "Setup: Nis I²C dhe aktivizon matjen e vazhdueshme. • Kthen true nëse sensori është i lidhur, false nëse mungon."
        }
      },
      {
        "sig": "void setAS7331Gain(uint8_t gainReg)",
        "call": "setAS7331Gain(AS7331_GAIN_64X);",
        "phase": "config",
        "desc": {
          "en": "Set Sensitivity: Changes the sensor's hardware amplification. • gainReg: Use one of the built-in macros: AS7331_GAIN_2048X (Highest - Dark room), AS7331_GAIN_256X (High - Indoor), AS7331_GAIN_64X (Default - Mixed), AS7331_GAIN_16X (Low - Direct sunlight), AS7331_GAIN_1X (Lowest).",
          "de": "Empfindlichkeit einstellen: Ändert die Hardware-Verstärkung (AS7331_GAIN_2048X dunkelster Raum bis AS7331_GAIN_1X extrem hell; Standard: AS7331_GAIN_64X).",
          "sq": "Vendos Ndjeshmërinë: Ndryshon amplifikimin harduerik (AS7331_GAIN_2048X deri AS7331_GAIN_1X; parazgjedhje: AS7331_GAIN_64X)."
        }
      },
      {
        "sig": "float getAS7331_UVA()",
        "call": "float uva = getAS7331_UVA();",
        "phase": "input",
        "desc": {
          "en": "Read UV-A: UV-A intensity in µW/cm². (Passes through glass).",
          "de": "UV-A lesen: UV-A-Intensität in µW/cm² (dringt durch Glas).",
          "sq": "Lexo UV-A: Intensiteti UV-A në µW/cm² (kalon përmes qelqit)."
        }
      },
      {
        "sig": "float getAS7331_UVB()",
        "call": "float uvb = getAS7331_UVB();",
        "phase": "input",
        "desc": {
          "en": "Read UV-B: UV-B intensity in µW/cm². (Mostly blocked by glass).",
          "de": "UV-B lesen: UV-B-Intensität in µW/cm² (wird großteils von Glas blockiert).",
          "sq": "Lexo UV-B: Intensiteti UV-B në µW/cm² (bllokohet kryesisht nga qelqi)."
        }
      },
      {
        "sig": "float getAS7331_UVC()",
        "call": "float uvc = getAS7331_UVC();",
        "phase": "input",
        "desc": {
          "en": "Read UV-C: UV-C intensity in µW/cm². (Blocked by the ozone layer).",
          "de": "UV-C lesen: UV-C-Intensität in µW/cm² (wird von der Ozonschicht blockiert).",
          "sq": "Lexo UV-C: Intensiteti UV-C në µW/cm² (bllokohet nga shtresa e ozonit)."
        }
      }
    ]
  },
  "sps30": {
    "header": "kcomp_SPS30.h",
    "verified": true,
    "macros": [
      "SPS30_AQI_GOOD",
      "SPS30_SOURCE_COMBUSTION"
    ],
    "fields": [
      "is_valid",
      "pm1_0",
      "pm2_5",
      "pm4_0",
      "pm10_0",
      "nc0_5",
      "nc1_0",
      "nc2_5",
      "nc4_0",
      "nc10_0",
      "typical_particle_size"
    ],
    "functions": [
      {
        "sig": "bool initSPS30()",
        "call": "if (!initSPS30()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts I²C and spins up the sensor's internal fan. • Returns true if connected, false if missing.",
          "de": "Setup: Startet I²C und dreht den internen Lüfter hoch. • Rückgabe: true wenn verbunden, false falls nicht gefunden.",
          "sq": "Setup: Nis I²C dhe ndez ventilatorin e brendshëm. • Kthen true nëse lidhet, false nëse mungon."
        }
      },
      {
        "sig": "sps30_data_t readSPS30()",
        "call": "sps30_data_t pm = readSPS30();",
        "phase": "input",
        "desc": {
          "en": "Read Data: Asks the sensor for new data and returns the sps30_data_t struct described above.",
          "de": "Daten lesen: Fragt neue Messwerte ab und liefert die sps30_data_t-Struktur (pm1_0..pm10_0, nc0_5..nc10_0).",
          "sq": "Lexo Të Dhënat: Kërkon matje të reja dhe kthen strukturën sps30_data_t (pm1_0..pm10_0, nc0_5..nc10_0)."
        }
      },
      {
        "sig": "SPS30_AQI_t getSPS30_AirQualityLevel()",
        "call": "SPS30_AQI_t aqi = getSPS30_AirQualityLevel();",
        "phase": "input",
        "desc": {
          "en": "Smart AQI: Returns an enum representing the official US EPA air quality index (e.g., SPS30_AQI_GOOD).",
          "de": "Smart AQI: Liefert die Luftqualitätsstufe nach offiziellem EPA-Index (z. B. SPS30_AQI_GOOD).",
          "sq": "Smart AQI: Kthen nivelin e cilësisë së ajrit sipas indeksit zyrtar EPA (p.sh. SPS30_AQI_GOOD)."
        }
      },
      {
        "sig": "SPS30_Source_t getSPS30_PollutionSource()",
        "call": "SPS30_Source_t src = getSPS30_PollutionSource();",
        "phase": "input",
        "desc": {
          "en": "Smart Detective: Returns an enum guessing the pollution source (e.g., SPS30_SOURCE_COMBUSTION).",
          "de": "Quellen-Erkennung: Schätzt die wahrscheinliche Feinstaubquelle (z. B. SPS30_SOURCE_COMBUSTION).",
          "sq": "Detektivi i Burimit: Vlerëson burimin e ndotjes (p.sh. SPS30_SOURCE_COMBUSTION)."
        }
      },
      {
        "sig": "uint8_t getSPS30_AirQualityScore()",
        "call": "uint8_t score = getSPS30_AirQualityScore();",
        "phase": "input",
        "desc": {
          "en": "Clean Score: Returns a simple 0 (heavily polluted) to 100 (perfectly clean) integer score.",
          "de": "Luftgüte-Score: Liefert einen einfachen Wert von 0 (stark belastet) bis 100 (sehr sauber).",
          "sq": "Pikët e Ajrit: Kthen një vlerë të thjeshtë nga 0 (shumë i ndotur) deri 100 (krejt i pastër)."
        }
      }
    ]
  },
  "vl53l1x": {
    "header": "kcomp_TOF400C.h",
    "verified": true,
    "macros": [
      "TOF400C_MODE_SHORT",
      "TOF400C_MODE_MEDIUM",
      "TOF400C_MODE_LONG"
    ],
    "fields": [
      "is_valid",
      "distance_mm"
    ],
    "functions": [
      {
        "sig": "bool initTOF400C()",
        "call": "if (!initTOF400C()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts I²C, checks the device ID, boots the firmware, and applies the tuning parameters. • Returns true if connected, false if missing.",
          "de": "Setup: Startet I²C, prüft die Geräte-ID, bootet die Firmware und lädt die Parameter. • Rückgabe: true wenn verbunden.",
          "sq": "Setup: Nis I²C, verifikon ID-në, ngarkon firmware-in dhe parametrat. • Kthen true nëse lidhet."
        }
      },
      {
        "sig": "void setTOF400CMode(TOF400C_Mode_t mode)",
        "call": "setTOF400CMode(TOF400C_MODE_LONG);",
        "phase": "config",
        "desc": {
          "en": "Configure: Changes the maximum range of the laser. • mode: Use TOF400C_MODE_SHORT, TOF400C_MODE_MEDIUM, or TOF400C_MODE_LONG.",
          "de": "Konfigurieren: Ändert die maximale Laser-Reichweite (TOF400C_MODE_SHORT, TOF400C_MODE_MEDIUM oder TOF400C_MODE_LONG).",
          "sq": "Konfiguro: Ndryshon rrezen maksimale të lazerit (TOF400C_MODE_SHORT, TOF400C_MODE_MEDIUM ose TOF400C_MODE_LONG)."
        }
      },
      {
        "sig": "tof400c_data_t readTOF400C()",
        "call": "tof400c_data_t tof = readTOF400C();",
        "phase": "input",
        "desc": {
          "en": "Read Data: Checks if a pulse has returned and provides the tof400c_data_t struct.",
          "de": "Daten lesen: Prüft den Laserimpuls und liefert die tof400c_data_t-Struktur (is_valid, distance_mm).",
          "sq": "Lexo Të Dhënat: Kontrollon kthimin e pulsit dhe jep strukturën tof400c_data_t (is_valid, distance_mm)."
        }
      }
    ]
  },
  "ina219": {
    "header": "kcomp_INA219.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "bool initINA219(uint8_t address)",
        "call": "if (!initINA219()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the INA219 in Standard Mode. Returns true if connected.",
          "de": "Setup: Initialisiert den INA219 im Standard-Modus. Rückgabe: true wenn verbunden.",
          "sq": "Setup: Inicializon INA219 në modalitetin Standard. Kthen true nëse është i lidhur."
        }
      },
      {
        "sig": "float getINA219BusVoltage_V()",
        "call": "float volts = getINA219BusVoltage_V();",
        "phase": "input",
        "desc": {
          "en": "Measure Supply Voltage: Reads the voltage between VIN- and GND. Returns the voltage in Volts (V).",
          "de": "Versorgungsspannung messen: Liest die Spannung zwischen VIN− und GND in Volt (V).",
          "sq": "Mat Tensionin: Lexon tensionin mes VIN− dhe GND në Volt (V)."
        }
      },
      {
        "sig": "float getINA219ShuntVoltage_mV()",
        "call": "float shuntMv = getINA219ShuntVoltage_mV();",
        "phase": "input",
        "desc": {
          "en": "Measure Shunt Drop: Reads the voltage drop across the 0.1 Ω resistor. Returns the drop in Millivolts (mV).",
          "de": "Shunt-Spannung messen: Liest den Spannungsabfall am 0,1-Ω-Widerstand in Millivolt (mV).",
          "sq": "Mat Rënien në Shunt: Lexon rënien e tensionit mbi rezistencën 0.1 Ω në milivolt (mV)."
        }
      },
      {
        "sig": "float getINA219Current_mA()",
        "call": "float currentMa = getINA219Current_mA();",
        "phase": "input",
        "desc": {
          "en": "Measure Current: Calculates the current flowing from VIN+ to VIN-. Returns the current in Milliamps (mA).",
          "de": "Strom messen: Berechnet den Strom von VIN+ nach VIN− in Milliampere (mA).",
          "sq": "Mat Rrymën: Llogarit rrymën nga VIN+ te VIN− në miliamper (mA)."
        }
      },
      {
        "sig": "float getINA219Power_mW()",
        "call": "float powerMw = getINA219Power_mW();",
        "phase": "input",
        "desc": {
          "en": "Measure Power: Returns the consumed power in milliwatts (mW).",
          "de": "Leistung messen: Liefert die verbrauchte Leistung in Milliwatt (mW).",
          "sq": "Mat Fuqinë: Kthen fuqinë e konsumuar në milivat (mW)."
        }
      },
      {
        "sig": "void setINA219HighPrecision(bool enable)",
        "call": "setINA219HighPrecision(true);",
        "phase": "config",
        "desc": {
          "en": "Change Sensitivity: Pass true for High-Precision Mode (400 mA) or false for Standard Mode (3200 mA).",
          "de": "Empfindlichkeit umschalten: true für Präzisionsmodus (400 mA), false für Standardmodus (3200 mA).",
          "sq": "Ndrysho Ndjeshmërinë: true për modalitetin e lartë (400 mA) ose false për Standard (3200 mA)."
        }
      },
      {
        "sig": "bool isINA219Overflow()",
        "call": "if (isINA219Overflow()) { /* out of range */ }",
        "phase": "input",
        "desc": {
          "en": "Check Range Limit: Returns true if the measured current or power exceeds the active measurement range.",
          "de": "Messbereich prüfen: Liefert true, wenn Strom oder Leistung den aktiven Messbereich überschreiten.",
          "sq": "Kontrollo Kufirin: Kthen true nëse rryma ose fuqia tejkalon diapazonin aktiv."
        }
      }
    ]
  },
  "tcs34725": {
    "header": "kcomp_TCS34725.h",
    "verified": true,
    "macros": [
      "COLOR_TIME_2_4MS",
      "COLOR_TIME_24MS",
      "COLOR_TIME_50MS",
      "COLOR_TIME_101MS",
      "COLOR_TIME_154MS",
      "COLOR_TIME_700MS",
      "COLOR_BLACK",
      "COLOR_WHITE",
      "COLOR_RED",
      "COLOR_GREEN",
      "COLOR_BLUE",
      "COLOR_YELLOW"
    ],
    "functions": [
      {
        "sig": "bool initColorSensor()",
        "call": "if (!initColorSensor()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the sensor. Returns true if successful, false if not found.",
          "de": "Setup: Initialisiert den Farbsensor. Rückgabe: true bei Erfolg, false falls nicht gefunden.",
          "sq": "Setup: Inicializon sensorin e ngjyrave. Kthen true nëse ka sukses, false nëse mungon."
        }
      },
      {
        "sig": "void setColorIntegrationTime(uint8_t timeSetting)",
        "call": "setColorIntegrationTime(COLOR_TIME_101MS);",
        "phase": "config",
        "desc": {
          "en": "Setup: Changes shutter speed. Expects a COLOR_TIME_... macro: COLOR_TIME_2_4MS, COLOR_TIME_24MS, COLOR_TIME_50MS, COLOR_TIME_101MS (best for general scanning), COLOR_TIME_154MS, COLOR_TIME_700MS.",
          "de": "Setup: Ändert die Belichtungszeit per COLOR_TIME_…-Makro (COLOR_TIME_101MS ideal für allgemeines Scannen).",
          "sq": "Setup: Ndryshon kohën e ekspozimit me makro COLOR_TIME_… (COLOR_TIME_101MS më e mira për skanim të përgjithshëm)."
        }
      },
      {
        "sig": "void calibrateColorEngine(uint16_t blackThreshold, uint16_t whiteThreshold)",
        "call": "calibrateColorEngine(250, 10000);",
        "phase": "config",
        "desc": {
          "en": "Setup: Sets the raw channel limits to catch noise and glare. 250 and 10000 might do.",
          "de": "Setup: Setzt die Rohwert-Grenzen gegen Rauschen und Überstrahlung (z. B. 250 und 10000).",
          "sq": "Setup: Vendos kufijtë bazë për zhurmën dhe shkëlqimin (p.sh. 250 dhe 10000)."
        }
      },
      {
        "sig": "void pollColorSensor()",
        "call": "pollColorSensor();",
        "phase": "service",
        "desc": {
          "en": "The Worker: Must be called in loop(). Checks hardware and updates memory.",
          "de": "Der Worker: Muss in loop() aufgerufen werden. Prüft den Sensor und aktualisiert die Messwerte.",
          "sq": "Punëtori: Duhet thirrur në loop(). Kontrollon harduerin dhe përditëson vlerat."
        }
      },
      {
        "sig": "uint16_t getRed()",
        "call": "uint16_t r = getRed();",
        "phase": "input",
        "desc": {
          "en": "Returns the raw red count.",
          "de": "Liefert den Rohwert des Rot-Kanals.",
          "sq": "Kthen vlerën bazë të kanalit të kuq."
        }
      },
      {
        "sig": "uint16_t getGreen()",
        "call": "uint16_t g = getGreen();",
        "phase": "input",
        "desc": {
          "en": "Returns the raw green count.",
          "de": "Liefert den Rohwert des Grün-Kanals.",
          "sq": "Kthen vlerën bazë të kanalit të gjelbër."
        }
      },
      {
        "sig": "uint16_t getBlue()",
        "call": "uint16_t b = getBlue();",
        "phase": "input",
        "desc": {
          "en": "Returns the raw blue count.",
          "de": "Liefert den Rohwert des Blau-Kanals.",
          "sq": "Kthen vlerën bazë të kanalit blu."
        }
      },
      {
        "sig": "uint16_t getClear()",
        "call": "uint16_t c = getClear();",
        "phase": "input",
        "desc": {
          "en": "Returns total unfiltered brightness. Used for calibration.",
          "de": "Liefert die ungefilterte Gesamthelligkeit (für Kalibrierung).",
          "sq": "Kthen ndriçimin total të pafiltruar (për kalibrim)."
        }
      },
      {
        "sig": "uint16_t getLux()",
        "call": "uint16_t lux = getLux();",
        "phase": "input",
        "desc": {
          "en": "Calculates human-perceived Illuminance (Lux).",
          "de": "Berechnet die wahrgenommene Beleuchtungsstärke in Lux.",
          "sq": "Llogarit ndriçimin e perceptuar në Lux."
        }
      },
      {
        "sig": "uint16_t getColorTemperature()",
        "call": "uint16_t kelvin = getColorTemperature();",
        "phase": "input",
        "desc": {
          "en": "Calculates light temperature in Kelvin (K).",
          "de": "Berechnet die Farbtemperatur des Lichts in Kelvin (K).",
          "sq": "Llogarit temperaturën e ngjyrës së dritës në Kelvin (K)."
        }
      },
      {
        "sig": "uint8_t estimateColor()",
        "call": "uint8_t col = estimateColor();",
        "phase": "input",
        "desc": {
          "en": "Runs the estimation algorithm. Returns a macro (e.g., COLOR_RED = 4).",
          "de": "Führt die Farberkennung aus und liefert ein Makro (z. B. COLOR_RED = 4).",
          "sq": "Ekzekuton algoritmin e vlerësimit dhe kthen një makro (p.sh. COLOR_RED = 4)."
        }
      },
      {
        "sig": "const char* getColorName(uint8_t colorCode)",
        "call": "const char* name = getColorName(col);",
        "phase": "input",
        "desc": {
          "en": "Translates the macro into an English string.",
          "de": "Übersetzt das Farb-Makro in den englischen Farbnamen als Text.",
          "sq": "Përkthen makron e ngjyrës në emrin e ngjyrës në anglisht."
        }
      }
    ]
  },
  "tb6612fng": {
    "header": "kcomp_motor_i2c.h",
    "verified": true,
    "macros": [
      "MOTOR_ADDR_0x30",
      "MOTOR_ADDR_0x2F",
      "MOTOR_ADDR_0x2E",
      "MOTOR_ADDR_0x2D",
      "MOTOR_A",
      "MOTOR_B",
      "MOTOR_C",
      "MOTOR_D"
    ],
    "functions": [
      {
        "sig": "bool initMotorI2C(uint8_t addr1, uint8_t addr2)",
        "call": "if (!initMotorI2C(0x30)) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes up to two motor modules (addr1 defaults to 0x30 for Motors A & B; addr2 defaults to 0x00 for 2-motor mode, or e.g. 0x2D for Motors C & D). Returns true if successful.",
          "de": "Setup: Initialisiert bis zu zwei Motormodule (addr1 Standard 0x30 für A & B; addr2 0x00 für 2-Motor-Modus oder z. B. 0x2D für C & D). Rückgabe: true bei Erfolg.",
          "sq": "Setup: Inicializon deri në dy module motorësh (addr1 0x30 për A & B; addr2 0x00 për 2 motorë ose p.sh. 0x2D për C & D). Kthen true nëse ka sukses."
        }
      },
      {
        "sig": "void motorUpdate()",
        "call": "motorUpdate();",
        "phase": "service",
        "desc": {
          "en": "Heartbeat: Must be called continuously inside loop(). Monitors non-blocking timers.",
          "de": "Herzschlag: Muss laufend in loop() aufgerufen werden. Überwacht alle nicht-blockierenden Timer.",
          "sq": "Ritmi: Duhet thirrur vazhdimisht në loop(). Monitoron timer-at jo-bllokues."
        }
      },
      {
        "sig": "void setMotorA(int16_t speed)",
        "call": "setMotorA(80);",
        "phase": "output",
        "desc": {
          "en": "Motor A (Endless): Sets Motor A speed from -100 to +100; 0 applies Short Brake.",
          "de": "Motor A (Endlos): Setzt die Geschwindigkeit von Motor A (-100 bis +100; 0 = Kurzschlussbremse).",
          "sq": "Motori A (Pa kufi): Vendos shpejtësinë e Motorit A nga -100 në +100; 0 aplikon frenimin."
        }
      },
      {
        "sig": "void setMotorA(int16_t speed, uint16_t time_ms)",
        "call": "setMotorA(80, 1000);",
        "phase": "output",
        "desc": {
          "en": "Motor A (Timed): Runs Motor A at speed (-100 to +100) for time_ms milliseconds without blocking.",
          "de": "Motor A (Zeitgesteuert): Steuert Motor A (-100 bis +100) für time_ms ms ohne Blockieren.",
          "sq": "Motori A (Me kohë): Drejton Motorin A (-100 deri +100) për time_ms ms pa bllokim."
        }
      },
      {
        "sig": "void driveForward(int16_t speed)",
        "call": "driveForward(80);",
        "phase": "output",
        "desc": {
          "en": "Drive Forward (Endless): Drives all initialized wheels forward at speed (0 to 100).",
          "de": "Vorwärts fahren (Endlos): Fährt alle initialisierten Räder mit speed (0 bis 100) vorwärts.",
          "sq": "Ec para (Pa kufi): Lëviz të gjitha rrotat përpara me shpejtësi (0 deri 100)."
        }
      },
      {
        "sig": "void driveForward(int16_t speed, uint16_t time_ms)",
        "call": "driveForward(80, 1000);",
        "phase": "output",
        "desc": {
          "en": "Drive Forward (Timed): Drives forward at speed for time_ms milliseconds without blocking.",
          "de": "Vorwärts fahren (Zeitgesteuert): Fährt für time_ms ms vorwärts ohne zu blockieren.",
          "sq": "Ec para (Me kohë): Ecën përpara për time_ms ms pa bllokim."
        }
      },
      {
        "sig": "void driveBackward(int16_t speed)",
        "call": "driveBackward(80);",
        "phase": "output",
        "desc": {
          "en": "Drive Backward (Endless): Drives all initialized wheels in reverse at speed (0 to 100).",
          "de": "Rückwärts fahren (Endlos): Fährt alle initialisierten Räder mit speed (0 bis 100) rückwärts.",
          "sq": "Ec prapa (Pa kufi): Lëviz të gjitha rrotat mbrapa me shpejtësi (0 deri 100)."
        }
      },
      {
        "sig": "void driveBackward(int16_t speed, uint16_t time_ms)",
        "call": "driveBackward(80, 1000);",
        "phase": "output",
        "desc": {
          "en": "Drive Backward (Timed): Drives backward at speed for time_ms milliseconds without blocking.",
          "de": "Rückwärts fahren (Zeitgesteuert): Fährt für time_ms ms rückwärts ohne zu blockieren.",
          "sq": "Ec prapa (Me kohë): Ecën mbrapa për time_ms ms pa bllokim."
        }
      },
      {
        "sig": "void turnLeft(int16_t speed)",
        "call": "turnLeft(70);",
        "phase": "output",
        "desc": {
          "en": "Arc Turn Left (Endless): Stops the left side (A/C) and drives the right side (B/D) forward at speed.",
          "de": "Linkskurve (Endlos): Stoppt die linke Seite (A/C) und treibt die rechte Seite (B/D) vorwärts an.",
          "sq": "Kthesë Majtas (Pa kufi): Ndal anën e majtë (A/C) dhe lëviz anën e djathtë (B/D) përpara."
        }
      },
      {
        "sig": "void turnLeft(int16_t speed, uint16_t time_ms)",
        "call": "turnLeft(70, 500);",
        "phase": "output",
        "desc": {
          "en": "Arc Turn Left (Timed): Performs an arc turn left at speed for time_ms milliseconds without blocking.",
          "de": "Linkskurve (Zeitgesteuert): Fährt für time_ms ms eine Linkskurve ohne Blockieren.",
          "sq": "Kthesë Majtas (Me kohë): Bën kthesë majtas për time_ms ms pa bllokim."
        }
      },
      {
        "sig": "void turnRight(int16_t speed)",
        "call": "turnRight(70);",
        "phase": "output",
        "desc": {
          "en": "Arc Turn Right (Endless): Drives the left side (A/C) forward at speed and stops the right side (B/D).",
          "de": "Rechtskurve (Endlos): Treibt die linke Seite (A/C) vorwärts an und stoppt die rechte Seite (B/D).",
          "sq": "Kthesë Djathtas (Pa kufi): Lëviz anën e majtë (A/C) përpara dhe ndal anën e djathtë (B/D)."
        }
      },
      {
        "sig": "void turnRight(int16_t speed, uint16_t time_ms)",
        "call": "turnRight(70, 500);",
        "phase": "output",
        "desc": {
          "en": "Arc Turn Right (Timed): Performs an arc turn right at speed for time_ms milliseconds without blocking.",
          "de": "Rechtskurve (Zeitgesteuert): Fährt für time_ms ms eine Rechtskurve ohne Blockieren.",
          "sq": "Kthesë Djathtas (Me kohë): Bën kthesë djathtas për time_ms ms pa bllokim."
        }
      },
      {
        "sig": "void pivotLeft(int16_t speed)",
        "call": "pivotLeft(60);",
        "phase": "output",
        "desc": {
          "en": "Pivot Left (Endless): Spins the chassis counter-clockwise in place.",
          "de": "Auf der Stelle links drehen (Endlos): Dreht das Fahrzeug gegen den Uhrzeigersinn auf der Stelle.",
          "sq": "Rrotullo Majtas në vend (Pa kufi): Rrotullon robotin kundërorar në vend."
        }
      },
      {
        "sig": "void pivotLeft(int16_t speed, uint16_t time_ms)",
        "call": "pivotLeft(60, 450);",
        "phase": "output",
        "desc": {
          "en": "Pivot Left (Timed): Spins counter-clockwise in place at speed for time_ms milliseconds without blocking.",
          "de": "Auf der Stelle links drehen (Zeitgesteuert): Dreht für time_ms ms links auf der Stelle ohne Blockieren.",
          "sq": "Rrotullo Majtas në vend (Me kohë): Rrotullon kundërorar për time_ms ms pa bllokim."
        }
      },
      {
        "sig": "void pivotRight(int16_t speed)",
        "call": "pivotRight(60);",
        "phase": "output",
        "desc": {
          "en": "Pivot Right (Endless): Spins the chassis clockwise in place.",
          "de": "Auf der Stelle rechts drehen (Endlos): Dreht das Fahrzeug im Uhrzeigersinn auf der Stelle.",
          "sq": "Rrotullo Djathtas në vend (Pa kufi): Rrotullon robotin orar në vend."
        }
      },
      {
        "sig": "void pivotRight(int16_t speed, uint16_t time_ms)",
        "call": "pivotRight(60, 450);",
        "phase": "output",
        "desc": {
          "en": "Pivot Right (Timed): Spins clockwise in place at speed for time_ms milliseconds without blocking.",
          "de": "Auf der Stelle rechts drehen (Zeitgesteuert): Dreht für time_ms ms rechts auf der Stelle ohne Blockieren.",
          "sq": "Rrotullo Djathtas në vend (Me kohë): Rrotullon orar për time_ms ms pa bllokim."
        }
      },
      {
        "sig": "void setTurnCalibration(uint16_t ms_for_90_deg, int16_t ref_speed)",
        "call": "setTurnCalibration(450, 60);",
        "phase": "config",
        "desc": {
          "en": "Calibrate Chassis Turns: Sets how many milliseconds the robot needs for a 90° pivot at ref_speed (defaults: 450 ms at speed 60).",
          "de": "Dreh-Kalibrierung: Legt fest, wie viele ms der Roboter für eine 90°-Drehung bei ref_speed braucht (Standard: 450 ms bei 60).",
          "sq": "Kalibrimi i Kthesës: Cakton sa milisekonda duhen për rrotullim 90° me ref_speed (parazgjedhje: 450 ms te 60)."
        }
      },
      {
        "sig": "void setMotorInvert(bool invA, bool invB, bool invC, bool invD)",
        "call": "setMotorInvert(false, true, false, false);",
        "phase": "config",
        "desc": {
          "en": "Software Polarity Flip: Inverts the logical direction of individual motors in code (invC and invD default to false) to compensate for mirrored chassis mounting without rewiring.",
          "de": "Software-Richtungsumkehr: Kehrt einzelne Motorrichtungen im Code um (für gespiegelte Montage ohne Umverkabeln).",
          "sq": "Kthim Drejtimi në Kod: Kthen drejtimin logjik të motorëve individualë pa ndryshuar telat."
        }
      },
      {
        "sig": "void setMotorTrim(int8_t trim)",
        "call": "setMotorTrim(0);",
        "phase": "config",
        "desc": {
          "en": "Drift Compensation: Trims the left side (A/C) against the right side (B/D) from -100 to +100; negative values throttle left motors and positive values throttle right motors.",
          "de": "Geradeauslauf-Trimmung: Gleicht linke (A/C) gegen rechte Seite (B/D) von -100 bis +100 ab (negativ bremst links, positiv rechts).",
          "sq": "Kompensim Devijimi: Balancon anën e majtë (A/C) me të djathtën (B/D) nga -100 në +100."
        }
      },
      {
        "sig": "void stopMotors()",
        "call": "stopMotors();",
        "phase": "output",
        "desc": {
          "en": "Stop All: Stops all initialized motors (A to D) immediately using Short Brake.",
          "de": "Alle stoppen: Stoppt alle initialisierten Motoren (A bis D) sofort mit Kurzschlussbremse.",
          "sq": "Ndal Të Gjithë: Ndalon menjëherë të gjithë motorët (A deri D) me frenim."
        }
      },
      {
        "sig": "void brakeMotors()",
        "call": "brakeMotors();",
        "phase": "output",
        "desc": {
          "en": "Electronic Brake: Applies a short-circuit brake to all motors for an abrupt halt.",
          "de": "Elektronische Bremse: Aktiviert die Kurzschlussbremse für einen sofortigen Halt.",
          "sq": "Frenë Elektronike: Aplikon frenim të shkurtër për ndalim të menjëhershëm."
        }
      },
      {
        "sig": "void coastMotors()",
        "call": "coastMotors();",
        "phase": "output",
        "desc": {
          "en": "Free-Spin Stop: Disconnects power from all motors for smooth coasting.",
          "de": "Ausrollen: Trennt die Motoren von der Versorgung für sanftes Ausrollen.",
          "sq": "Ndalim i Lirë: Shkëput rrymën nga motorët për ndalim të butë."
        }
      },
      {
        "sig": "bool isMotorBusy()",
        "call": "if (!isMotorBusy()) { /* next step */ }",
        "phase": "input",
        "desc": {
          "en": "Status Check: Returns true while any timed or angle-based command is still running; useful for state machines.",
          "de": "Statusprüfung: Liefert true, solange ein zeit- oder winkelgesteuerter Befehl läuft (ideal für State Machines).",
          "sq": "Kontroll Statusi: Kthen true sa kohë një komandë me kohë ose kënd është duke u ekzekutuar."
        }
      },
      {
        "sig": "int16_t getMotorASpeed()",
        "call": "int16_t spd = getMotorASpeed();",
        "phase": "input",
        "desc": {
          "en": "Speed Getter (A): Returns the current target speed of Motor A (-100 to +100).",
          "de": "Geschwindigkeit lesen (A): Liefert die aktuelle Zielgeschwindigkeit von Motor A (-100 bis +100).",
          "sq": "Lexo Shpejtësinë (A): Kthen shpejtësinë aktuale të synuar të Motorit A (-100 deri +100)."
        }
      }
    ]
  },
  "drv2605l": {
    "header": "kcomp_DRV2605L.h",
    "verified": true,
    "macros": [
      "VIBE_HEARTBEAT",
      "VIBE_STOP"
    ],
    "functions": [
      {
        "sig": "bool initDRV2605L()",
        "call": "if (!initDRV2605L()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the module. Returns: true if the hardware is found, false if not.",
          "de": "Setup: Startet das Modul. Rückgabe: true wenn gefunden, false sonst.",
          "sq": "Setup: Nis modulin. Kthen: true nëse hardueri gjendet, false nëse jo."
        }
      },
      {
        "sig": "void enableInternalROMMode()",
        "call": "enableInternalROMMode();",
        "phase": "config",
        "desc": {
          "en": "Config: Enables ROM mode for using haptic effects.",
          "de": "Konfiguration: Aktiviert den internen ROM-Modus für vorgefertigte Haptik-Effekte.",
          "sq": "Konfig: Aktivizon modalitetin ROM për efektet haptike të integruara."
        }
      },
      {
        "sig": "void playHapticEffect(uint8_t effectID)",
        "call": "playHapticEffect(VIBE_HEARTBEAT);",
        "phase": "output",
        "desc": {
          "en": "Action: Plays a single effect from the haptic effects list. • effectID: The predefined macro representing the physical effect (e.g., VIBE_HEARTBEAT).",
          "de": "Aktion: Spielt einen einzelnen Haptik-Effekt ab. • effectID: Vordefiniertes Makro (z. B. VIBE_HEARTBEAT).",
          "sq": "Veprim: Luan një efekt të vetëm haptik. • effectID: Makro e paracaktuar (p.sh. VIBE_HEARTBEAT)."
        }
      },
      {
        "sig": "void setHapticSequenceSlot(uint8_t slotNumber, uint8_t effectID)",
        "call": "setHapticSequenceSlot(0, VIBE_HEARTBEAT);",
        "phase": "config",
        "desc": {
          "en": "Config: Places a specific effect into an internal memory slot. • slotNumber: The specific memory slot to overwrite. Must be between 0 and 7. • effectID: The predefined macro to load.",
          "de": "Konfiguration: Legt einen Effekt in einen internen Sequenz-Slot (0 bis 7). • effectID: Gewünschtes Effekt-Makro.",
          "sq": "Konfig: Vendos një efekt në një slot memorie (0 deri 7). • effectID: Makroja e efektit."
        }
      },
      {
        "sig": "void playHapticSequence()",
        "call": "playHapticSequence();",
        "phase": "output",
        "desc": {
          "en": "Action: Plays the chained sequence starting from slot 0. Rule: Ensure the slot after your last effect is set to VIBE_STOP (0)!",
          "de": "Aktion: Spielt die Effekt-Sequenz ab Slot 0 ab. Regel: Den Slot nach dem letzten Effekt auf VIBE_STOP (0) setzen!",
          "sq": "Veprim: Luan sekuencën duke filluar nga sloti 0. Rregull: Vendos VIBE_STOP (0) pas efektit të fundit!"
        }
      },
      {
        "sig": "void stopHaptic()",
        "call": "stopHaptic();",
        "phase": "output",
        "desc": {
          "en": "Action: Cuts power to the motor and stops any effect.",
          "de": "Aktion: Trennt den Motor und stoppt jeden laufenden Effekt.",
          "sq": "Veprim: Ndërpret rrymën te motori dhe ndal çdo efekt."
        }
      },
      {
        "sig": "void enableAudioMode()",
        "call": "enableAudioMode();",
        "phase": "config",
        "desc": {
          "en": "Config: Hands control over to the physical IN pin. Wire an audio source here, and the motor will pulse to the beat.",
          "de": "Konfiguration: Übergibt die Steuerung an den physischen IN-Pin — eine Audioquelle lässt den Motor im Takt pulsieren.",
          "sq": "Konfig: I kalon kontrollin pinit fizik IN — një burim audio bën motorin të pulsojë me ritmin."
        }
      },
      {
        "sig": "void enableRealTimeMode()",
        "call": "enableRealTimeMode();",
        "phase": "config",
        "desc": {
          "en": "Config: Bypasses the ROM. The chip will hold whatever intensity you send it until you change it.",
          "de": "Konfiguration: Umgeht das ROM — der Chip hält exakt die gesendete Intensität bis zur nächsten Änderung.",
          "sq": "Konfig: Anashkalon ROM-in — çipi mban intensitetin që dërgon derisa ta ndryshosh."
        }
      },
      {
        "sig": "void setRealTimeIntensity(uint8_t intensity)",
        "call": "setRealTimeIntensity(128);",
        "phase": "output",
        "desc": {
          "en": "Description: Sets the raw motor power. • intensity: From 0 (off) to 255 (maximum power).",
          "de": "Beschreibung: Setzt die rohe Motorleistung. • intensity: Von 0 (aus) bis 255 (maximale Leistung).",
          "sq": "Përshkrimi: Vendos fuqinë bazë të motorit. • intensity: Nga 0 (fikur) deri 255 (maksimum)."
        }
      }
    ]
  },
  "pn532": {
    "header": "kcomp_PN532.h",
    "verified": true,
    "macros": [
      "PN532_OK",
      "PN532_NO_CARD",
      "CARD_MIFARE_CLASSIC",
      "CARD_NTAG",
      "CARD_UNKNOWN"
    ],
    "functions": [
      {
        "sig": "bool initPN532()",
        "call": "if (!initPN532()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the controller. • Returns: true if successful.",
          "de": "Setup: Initialisiert den NFC-Controller. • Rückgabe: true bei Erfolg.",
          "sq": "Setup: Inicializon kontrolluesin NFC. • Kthen: true nëse ka sukses."
        }
      },
      {
        "sig": "int8_t scanForTag()",
        "call": "if (scanForTag() == PN532_OK) { /* tag found */ }",
        "phase": "input",
        "desc": {
          "en": "The Worker: Polls the physical environment for a tag. • Returns: PN532_OK if found, PN532_NO_CARD if empty.",
          "de": "Der Worker: Sucht nach einem NFC-Tag. • Rückgabe: PN532_OK wenn gefunden, PN532_NO_CARD wenn leer.",
          "sq": "Punëtori: Kërkon për një etiketë NFC. • Kthen: PN532_OK nëse gjendet, PN532_NO_CARD nëse bosh."
        }
      },
      {
        "sig": "uint8_t getTagType()",
        "call": "uint8_t type = getTagType();",
        "phase": "input",
        "desc": {
          "en": "Read: Returns the architecture (CARD_MIFARE_CLASSIC, CARD_NTAG, or CARD_UNKNOWN).",
          "de": "Lesen: Liefert den Kartentyp (CARD_MIFARE_CLASSIC, CARD_NTAG oder CARD_UNKNOWN).",
          "sq": "Lexo: Kthen arkitekturën e kartës (CARD_MIFARE_CLASSIC, CARD_NTAG ose CARD_UNKNOWN)."
        }
      },
      {
        "sig": "void getUid(uint8_t array[])",
        "call": "getUid(uid);",
        "phase": "input",
        "desc": {
          "en": "Read: Copies the tag's Serial Number into your array. • array: Array UID gets stored in. Must be at least 7 bytes long.",
          "de": "Lesen: Kopiert die Seriennummer (UID) des Tags in ein Array (mindestens 7 Bytes groß).",
          "sq": "Lexo: Kopjon numrin serial (UID) të etiketës në array (duhet të jetë të paktën 7 bajt)."
        }
      },
      {
        "sig": "int8_t readTagMemory(uint8_t slot, uint8_t buffer[])",
        "call": "readTagMemory(4, buffer);",
        "phase": "input",
        "desc": {
          "en": "Action: Reads exactly 16 bytes from the slot into your buffer array. • slot: Memory slot which is read. • buffer: Buffer the memory slot is read in. Must be at least 16 bytes long.",
          "de": "Aktion: Liest exakt 16 Bytes aus einem Speicher-Slot in buffer (mindestens 16 Bytes groß).",
          "sq": "Veprim: Lexon saktësisht 16 bajt nga sloti në buffer (të paktën 16 bajt)."
        }
      },
      {
        "sig": "int8_t writeTagMemory(uint8_t slot, uint8_t data[])",
        "call": "writeTagMemory(4, data);",
        "phase": "output",
        "desc": {
          "en": "Action: Burns exactly 16 bytes from your data array permanently into the slot. • slot: Memory slot which is written. • data: The memory slot is filled with data. Must be at least 16 bytes long.",
          "de": "Aktion: Schreibt exakt 16 Bytes dauerhaft aus data in den gewählten Speicher-Slot (mind. 16 Bytes).",
          "sq": "Veprim: Shkruan përgjithmonë saktësisht 16 bajt nga data në slotin e zgjedhur (të paktën 16 bajt)."
        }
      }
    ]
  },
  "gy-neo6m": {
    "header": "kcomp_NEO6MGPS.h",
    "verified": true,
    "macros": [
      "CARDINAL_N",
      "CARDINAL_NE",
      "CARDINAL_E",
      "CARDINAL_SE",
      "CARDINAL_S",
      "CARDINAL_SW",
      "CARDINAL_W",
      "CARDINAL_NW"
    ],
    "fields": [
      "valid",
      "latitude",
      "longitude",
      "speed",
      "altitude",
      "year",
      "month",
      "day",
      "hour",
      "minute"
    ],
    "functions": [
      {
        "sig": "bool initNEO6MGPS(rx, tx, baud)",
        "call": "if (!initNEO6MGPS(GPS_RX_PIN, GPS_TX_PIN, 9600)) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the module. • rx/tx: Pins (usually 6 and 7). • baud: Speed (usually 9600). Returns: true if successful.",
          "de": "Setup: Startet das GPS-Modul. • rx/tx: Pins (meist 6 und 7). • baud: Geschwindigkeit (meist 9600). Rückgabe: true bei Erfolg.",
          "sq": "Setup: Nis modulin GPS. • rx/tx: Pinat (zakonisht 6 dhe 7). • baud: Shpejtësia (zakonisht 9600). Kthen: true nëse ka sukses."
        }
      },
      {
        "sig": "bool updateGPS()",
        "call": "updateGPS();",
        "phase": "service",
        "desc": {
          "en": "The Worker: Reads incoming data from the serial port. Important: Must be called constantly in loop() to keep the data fresh.",
          "de": "Der Worker: Liest eingehende GPS-Daten vom seriellen Port. Wichtig: Muss ständig in loop() aufgerufen werden.",
          "sq": "Punëtori: Lexon të dhënat që vijnë nga porta seriale. E rëndësishme: Duhet thirrur vazhdimisht në loop()."
        }
      },
      {
        "sig": "GPSData getGPSData()",
        "call": "GPSData gps = getGPSData();",
        "phase": "input",
        "desc": {
          "en": "Read: Returns the GPSData struct described above.",
          "de": "Lesen: Liefert die GPSData-Struktur (valid, latitude, longitude, speed, altitude, Datum & Uhrzeit).",
          "sq": "Lexo: Kthen strukturën GPSData (valid, latitude, longitude, speed, altitude, data & ora)."
        }
      },
      {
        "sig": "void setGPSOffset(int hours)",
        "call": "setGPSOffset(1);",
        "phase": "config",
        "desc": {
          "en": "Config: Sets your time zone offset (e.g., 1 for Central Europe).",
          "de": "Konfiguration: Setzt die Zeitzonen-Verschiebung in Stunden (z. B. 1 für Mitteleuropa).",
          "sq": "Konfig: Vendos diferencën e zonës kohore në orë (p.sh. 1 për Evropën Qendrore)."
        }
      },
      {
        "sig": "void setGPSDST(bool enabled)",
        "call": "setGPSDST(false);",
        "phase": "config",
        "desc": {
          "en": "Config: Set to true if summer time is active.",
          "de": "Konfiguration: Auf true setzen, wenn Sommerzeit aktiv ist.",
          "sq": "Konfig: Vendos true nëse ora verore është aktive."
        }
      },
      {
        "sig": "double gps_distanceBetween(lat1, lon1, lat2, lon2)",
        "call": "double distM = gps_distanceBetween(lat1, lon1, lat2, lon2);",
        "phase": "input",
        "desc": {
          "en": "Math: Calculates distance in meters between two coordinates (lat1/lon1 and lat2/lon2).",
          "de": "Mathe: Berechnet die Entfernung in Metern zwischen zwei Koordinaten (lat1/lon1 und lat2/lon2).",
          "sq": "Matematikë: Llogarit distancën në metra mes dy koordinatave (lat1/lon1 dhe lat2/lon2)."
        }
      },
      {
        "sig": "GPSCardinal gps_cardinal(deg)",
        "call": "GPSCardinal dir = gps_cardinal(deg);",
        "phase": "input",
        "desc": {
          "en": "Math: Converts a heading (0-360) into a direction (e.g., CARDINAL_N, CARDINAL_SW).",
          "de": "Mathe: Wandelt einen Kurs (0–360°) in eine Himmelsrichtung um (z. B. CARDINAL_N, CARDINAL_SW).",
          "sq": "Matematikë: Kthen këndin (0–360°) në drejtim busulle (p.sh. CARDINAL_N, CARDINAL_SW)."
        }
      }
    ]
  },
  "ch9329": {
    "header": "kcomp_ch9329_hid.h",
    "verified": true,
    "macros": [
      "KEY_RETURN",
      "KEY_ESC",
      "KEY_TAB"
    ],
    "functions": [
      {
        "sig": "void beginCH9329(int rxPin, int txPin)",
        "call": "beginCH9329(HID_RX_PIN, HID_TX_PIN);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the module. • rxPin / txPin: The pins connected to the module.",
          "de": "Setup: Startet das Modul. • rxPin / txPin: Die mit dem Modul verbundenen Pins.",
          "sq": "Setup: Nis modulin. • rxPin / txPin: Pinat e lidhur me modulin."
        }
      },
      {
        "sig": "void configureMode0()",
        "call": "configureMode0();",
        "phase": "config",
        "desc": {
          "en": "Repair: Forces the chip into the correct operating mode (Mode 0). Only use this if the computer stops recognizing the chip as a keyboard. Wait 3 seconds after calling this for the chip to reboot.",
          "de": "Reparatur: Zwingt den Chip in den Betriebsmodus 0 (nur falls der PC ihn nicht mehr erkennt; danach 3 s warten).",
          "sq": "Riparim: Detyron çipin në modalitetin 0 (përdore vetëm nëse PC nuk e njeh më; prit 3 sekonda pas thirrjes)."
        }
      },
      {
        "sig": "void typeText(const char* text)",
        "call": "typeText(\"Hello!\");",
        "phase": "output",
        "desc": {
          "en": "Action: Automatically types out a full string. • Example: typeText(\"Hello!\");",
          "de": "Aktion: Tippt automatisch eine ganze Zeichenkette. • Beispiel: typeText(\"Hello!\");",
          "sq": "Veprim: Shkruan automatikisht një tekst të plotë. • Shembull: typeText(\"Hello!\");"
        }
      },
      {
        "sig": "size_t writeKey(uint8_t k)",
        "call": "writeKey('a');",
        "phase": "output",
        "desc": {
          "en": "Action: Presses and releases a single key. • Example: writeKey('a');",
          "de": "Aktion: Drückt eine einzelne Taste und lässt sie wieder los. • Beispiel: writeKey('a');",
          "sq": "Veprim: Shtyp dhe lëshon një tast të vetëm. • Shembull: writeKey('a');"
        }
      },
      {
        "sig": "size_t pressKey(uint8_t k)",
        "call": "pressKey(KEY_LEFT_CTRL);",
        "phase": "output",
        "desc": {
          "en": "Action: Presses and holds a key down. Useful for modifiers (Shift, Ctrl, Alt, Win/GUI).",
          "de": "Aktion: Hält eine Taste gedrückt — ideal für Zusatztasten (Shift, Strg, Alt, Win/GUI).",
          "sq": "Veprim: Mban një tast të shtypur — i dobishëm për Shift, Ctrl, Alt, Win/GUI."
        }
      },
      {
        "sig": "size_t releaseKey(uint8_t k)",
        "call": "releaseKey(KEY_LEFT_CTRL);",
        "phase": "output",
        "desc": {
          "en": "Action: Releases a key that was held down.",
          "de": "Aktion: Lässt eine zuvor gehaltene Taste wieder los.",
          "sq": "Veprim: Lëshon një tast që mbahej i shtypur."
        }
      },
      {
        "sig": "void releaseAll()",
        "call": "releaseAll();",
        "phase": "output",
        "desc": {
          "en": "Action: Lifts all fingers off the fake keyboard. Always call this after using pressKey().",
          "de": "Aktion: Lässt alle Tasten gleichzeitig los. Nach pressKey() immer aufrufen!",
          "sq": "Veprim: Lëshon të gjitha tastet. Thirre gjithmonë pasi përdor pressKey()."
        }
      },
      {
        "sig": "void moveMouse(int8_t x, int8_t y)",
        "call": "moveMouse(dx, dy);",
        "phase": "output",
        "desc": {
          "en": "Action: Moves the mouse relative to its position. • x, y: Values from -128 to +127. Negative values = Left/Up. Positive = Right/Down.",
          "de": "Aktion: Bewegt die Maus relativ um x, y (-128 bis +127; negativ = links/oben, positiv = rechts/unten).",
          "sq": "Veprim: Lëviz mausin relativisht me x, y (-128 deri +127; negativ = majtas/lart, pozitiv = djathtas/poshtë)."
        }
      },
      {
        "sig": "void moveMouseAbsolute(uint16_t x, uint16_t y)",
        "call": "moveMouseAbsolute(2048, 2048);",
        "phase": "output",
        "desc": {
          "en": "Action: Moves the mouse to a specific coordinate. • x, y: Values usually range from 0 to 4095.",
          "de": "Aktion: Bewegt die Maus zu einer absoluten Koordinate (x, y meist von 0 bis 4095).",
          "sq": "Veprim: Lëviz mausin në një koordinatë absolute (x, y zakonisht 0 deri 4095)."
        }
      },
      {
        "sig": "void clickMouse(uint8_t buttons)",
        "call": "clickMouse(1);\ndelay(20);\nclickMouse(0);",
        "phase": "output",
        "desc": {
          "en": "Action: Presses mouse buttons. • 1 = Left, 2 = Right, 4 = Middle, 0 = Release.",
          "de": "Aktion: Drückt Maustasten. • 1 = Links, 2 = Rechts, 4 = Mitte, 0 = Loslassen.",
          "sq": "Veprim: Shtyp butonat e mausit. • 1 = Majtas, 2 = Djathtas, 4 = Mes, 0 = Lësho."
        }
      },
      {
        "sig": "void scrollMouse(int8_t wheel)",
        "call": "scrollMouse(1);",
        "phase": "output",
        "desc": {
          "en": "Action: Scrolls the mouse wheel. • 1 = Up, -1 = Down.",
          "de": "Aktion: Dreht das Mausrad. • 1 = Hoch, -1 = Runter.",
          "sq": "Veprim: Rrotullon rrotën e mausit. • 1 = Lart, -1 = Poshtë."
        }
      }
    ]
  },
  "as608": {
    "header": "kcomp_AS608.h",
    "verified": true,
    "macros": [
      "LED_BREATHING",
      "LED_FLASHING",
      "LED_ALWAYS_ON",
      "LED_RED",
      "LED_BLUE",
      "LED_PURPLE"
    ],
    "functions": [
      {
        "sig": "bool initAS608(rxPin, txPin, baud)",
        "call": "if (!initAS608(FP_RX_PIN, FP_TX_PIN, 57600)) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the Fingerprint Reader. • rx/tx: Pin 6 and Pin 7. • baud: Speed (usually 57600). Returns: true if successful.",
          "de": "Setup: Initialisiert den Fingerabdruck-Scanner. • rx/tx: z. B. Pin 6 & 7. • baud: meist 57600. Rückgabe: true bei Erfolg.",
          "sq": "Setup: Inicializon skanerin e gjurmëve. • rx/tx: p.sh. Pin 6 & 7. • baud: zakonisht 57600. Kthen: true nëse ka sukses."
        }
      },
      {
        "sig": "int16_t scanFingerprint()",
        "call": "int16_t id = scanFingerprint();",
        "phase": "input",
        "desc": {
          "en": "Scan: Triggers the reader. Returns the matched User ID (0-127). Returns negative error codes if no match is found.",
          "de": "Scannen: Startet den Scan und liefert die erkannte User-ID (0–127) oder einen negativen Fehlercode.",
          "sq": "Skano: Nis leximin dhe kthen ID-në e gjetur (0–127) ose kod gabimi negativ nëse nuk përputhet."
        }
      },
      {
        "sig": "int8_t enrollFingerprint(uint16_t id)",
        "call": "enrollFingerprint(1);",
        "phase": "config",
        "desc": {
          "en": "Enroll: Blocking function. Prompts the user to place their finger twice to create a robust mathematical model, saving it to the specified id slot.",
          "de": "Einlernen: Blockierende Funktion; fordert zweimaliges Auflegen des Fingers an und speichert das Muster unter id.",
          "sq": "Regjistro: Funksion bllokues; kërkon vendosjen e gishtit dy herë dhe e ruan te sloti id."
        }
      },
      {
        "sig": "int16_t getFingerprintCount()",
        "call": "int16_t count = getFingerprintCount();",
        "phase": "input",
        "desc": {
          "en": "Queries the sensor to see exactly how many fingerprints are currently stored in memory.",
          "de": "Fragt ab, wie viele Fingerabdrücke aktuell im Sensor gespeichert sind.",
          "sq": "Pyet sensorin sa gjurmë gishtash janë të ruajtura aktualisht në memorie."
        }
      },
      {
        "sig": "bool isSlotOccupied(uint16_t id)",
        "call": "if (isSlotOccupied(1)) { /* taken */ }",
        "phase": "input",
        "desc": {
          "en": "Checks if a specific ID slot is already taken before you accidentally overwrite it.",
          "de": "Prüft vor dem Überschreiben, ob ein bestimmter ID-Slot bereits belegt ist.",
          "sq": "Kontrollon nëse një slot ID është tashmë i zënë para se ta mbishkruash."
        }
      },
      {
        "sig": "int8_t deleteFingerprint(uint16_t id)",
        "call": "deleteFingerprint(1);",
        "phase": "config",
        "desc": {
          "en": "Deletes a single fingerprint ID from the memory.",
          "de": "Löscht eine einzelne Fingerabdruck-ID aus dem Speicher.",
          "sq": "Fshin një ID të vetme gjurme nga memoria."
        }
      },
      {
        "sig": "bool clearAllFingerprints()",
        "call": "clearAllFingerprints();",
        "phase": "config",
        "desc": {
          "en": "Performs a factory reset, instantly wiping all stored fingerprints.",
          "de": "Setzt den Speicher zurück und löscht sofort alle gespeicherten Fingerabdrücke.",
          "sq": "Kryen rivendosje fabrike, duke fshirë menjëherë të gjitha gjurmët e ruajtura."
        }
      },
      {
        "sig": "void controlLED(uint8_t mode, uint16_t color, uint16_t speed, uint16_t cycles)",
        "call": "controlLED(LED_BREATHING, LED_BLUE, 100, 0);",
        "phase": "output",
        "desc": {
          "en": "Hardware: Controls the LED ring (on R503 variants). Modes include LED_BREATHING, LED_FLASHING, LED_ALWAYS_ON. Colors include LED_RED, LED_BLUE, LED_PURPLE.",
          "de": "Hardware: Steuert den LED-Ring (R503-Varianten) mit Modus (LED_BREATHING/FLASHING/ALWAYS_ON) und Farbe (LED_RED/BLUE/PURPLE).",
          "sq": "Harduer: Kontrollon unazën LED (variantet R503) me modalitete (LED_BREATHING/FLASHING/ALWAYS_ON) dhe ngjyra (LED_RED/BLUE/PURPLE)."
        }
      }
    ]
  },
  "ld2410c": {
    "header": "kcomp_LD2410.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "bool initLD2410(uint8_t rx, uint8_t tx, long baud)",
        "call": "if (!initLD2410(LD2410_RX_PIN, LD2410_TX_PIN, 9600)) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the radar connection. • rx / tx: K-Comp pins (e.g., 6 and 7). • baud: Speed (Use 9600 for SoftwareSerial). • Returns: true if sensor is online.",
          "de": "Setup: Startet das Radar. • rx / tx: K-Comp-Pins (z. B. 6 & 7). • baud: 9600 für SoftwareSerial. • Rückgabe: true wenn online.",
          "sq": "Setup: Nis lidhjen me radarin. • rx / tx: Pinat K-Comp (p.sh. 6 & 7). • baud: 9600 për SoftwareSerial. • Kthen: true nëse online."
        }
      },
      {
        "sig": "bool updateLD2410()",
        "call": "updateLD2410();",
        "phase": "service",
        "desc": {
          "en": "Process: MUST be called in loop(). Reads incoming data. • Returns: true if new data arrived.",
          "de": "Verarbeitung: MUSS in loop() aufgerufen werden. Liest eingehende Radardaten. • Rückgabe: true bei neuen Daten.",
          "sq": "Procesi: DUHET thirrur në loop(). Lexon të dhënat hyrëse. • Kthen: true nëse kanë mbërritur të dhëna të reja."
        }
      },
      {
        "sig": "bool isPresenceDetected()",
        "call": "if (isPresenceDetected()) { /* someone here */ }",
        "phase": "input",
        "desc": {
          "en": "Check: Returns true if anyone is there (Moving OR Sitting).",
          "de": "Prüfen: Liefert true, wenn eine Person erkannt wird (bewegt ODER ruhig sitzend).",
          "sq": "Kontroll: Kthen true nëse gjendet dikush (në lëvizje OSE ulur)."
        }
      },
      {
        "sig": "bool isMoving()",
        "call": "if (isMoving()) { /* motion */ }",
        "phase": "input",
        "desc": {
          "en": "Check: Returns true if walking/running is detected.",
          "de": "Prüfen: Liefert true, wenn Gehen/Bewegung erkannt wird.",
          "sq": "Kontroll: Kthen true nëse zbulohet ecje/lëvizje."
        }
      },
      {
        "sig": "bool isStationary()",
        "call": "if (isStationary()) { /* still */ }",
        "phase": "input",
        "desc": {
          "en": "Check: Returns true if sitting/breathing is detected.",
          "de": "Prüfen: Liefert true, wenn ruhiges Sitzen/Atmen erkannt wird.",
          "sq": "Kontroll: Kthen true nëse zbulohet prani pa lëvizje/frymëmarrje."
        }
      },
      {
        "sig": "int getDetectionDistance()",
        "call": "int distCm = getDetectionDistance();",
        "phase": "input",
        "desc": {
          "en": "Data: Returns distance to the target in cm.",
          "de": "Daten: Liefert die Entfernung zum Ziel in cm.",
          "sq": "Të dhëna: Kthen distancën deri te objektivi në cm."
        }
      }
    ]
  },
  "hc12": {
    "header": "SoftwareSerial.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "SoftwareSerial(uint8_t receivePin, uint8_t transmitPin)",
        "call": "SoftwareSerial hc12(HC12_RX_PIN, HC12_TX_PIN);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Constructor to create a virtual serial port object. • receivePin: The digital pin receiving data (RX). • transmitPin: The digital pin sending data (TX).",
          "de": "Setup: Erzeugt einen virtuellen seriellen Port. • receivePin: Empfangspin (RX). • transmitPin: Sendepin (TX).",
          "sq": "Setup: Krijon portën virtuale seriale. • receivePin: Pini marrës (RX). • transmitPin: Pini dërgues (TX)."
        }
      },
      {
        "sig": "void begin(long speed)",
        "call": "hc12.begin(9600);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the serial connection. • speed: The baud rate (must be 9600 for HC-12).",
          "de": "Setup: Startet die serielle Funkverbindung. • speed: Baudrate (muss 9600 für HC-12 sein).",
          "sq": "Setup: Nis lidhjen seriale. • speed: Shpejtësia baud (duhet 9600 për HC-12)."
        }
      },
      {
        "sig": "int available()",
        "call": "if (hc12.available()) { /* data ready */ }",
        "phase": "input",
        "desc": {
          "en": "Check: Returns the number of bytes (characters) currently waiting in the receive buffer.",
          "de": "Prüfen: Liefert die Anzahl der Bytes (Zeichen), die im Empfangspuffer warten.",
          "sq": "Kontroll: Kthen numrin e bajtëve (karaktereve) që presin në buferin marrës."
        }
      },
      {
        "sig": "int read()",
        "call": "char c = hc12.read();",
        "phase": "input",
        "desc": {
          "en": "Action: Plucks exactly one character out of the incoming data stream. Returns -1 if no data is available.",
          "de": "Aktion: Liest exakt ein Zeichen aus dem Empfangsstrom (oder -1 wenn nichts vorliegt).",
          "sq": "Veprim: Merr saktësisht një karakter nga rrjedha hyrëse (ose -1 nëse nuk ka të dhëna)."
        }
      },
      {
        "sig": "size_t print(const char* text)",
        "call": "hc12.print(\"S\");",
        "phase": "output",
        "desc": {
          "en": "Action: Sends text wirelessly via 433 MHz radio. Returns the number of bytes written.",
          "de": "Aktion: Sendet Text drahtlos über 433-MHz-Funk. Liefert die Anzahl gesendeter Bytes.",
          "sq": "Veprim: Dërgon tekst pa tela përmes radios 433 MHz. Kthen numrin e bajtëve të dërguar."
        }
      },
      {
        "sig": "int strcmp(const char* str1, const char* str2)",
        "call": "if (strcmp(buf, \"ON\") == 0) { /* match */ }",
        "phase": "input",
        "desc": {
          "en": "Math: Compares two C-strings. Returns 0 if they match.",
          "de": "Vergleich: Vergleicht zwei C-Strings. Liefert 0 bei exakter Übereinstimmung.",
          "sq": "Krahasim: Krahason dy C-stringje. Kthen 0 nëse përputhen."
        }
      }
    ]
  },
  "hc05": {
    "header": "SoftwareSerial.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "SoftwareSerial(uint8_t receivePin, uint8_t transmitPin)",
        "call": "SoftwareSerial btSerial(BT_RX_PIN, BT_TX_PIN);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Constructor to create a virtual serial port object. • receivePin: The digital pin receiving data (RX). • transmitPin: The digital pin sending data (TX).",
          "de": "Setup: Erzeugt einen virtuellen seriellen Port. • receivePin: Empfangspin (RX). • transmitPin: Sendepin (TX).",
          "sq": "Setup: Krijon portën virtuale seriale. • receivePin: Pini marrës (RX). • transmitPin: Pini dërgues (TX)."
        }
      },
      {
        "sig": "void begin(long speed)",
        "call": "btSerial.begin(9600);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the serial connection. • speed: The baud rate (must be 9600 for HC-05).",
          "de": "Setup: Startet die Bluetooth-Verbindung. • speed: Baudrate (muss 9600 für HC-05 sein).",
          "sq": "Setup: Nis lidhjen Bluetooth. • speed: Shpejtësia baud (duhet 9600 për HC-05)."
        }
      },
      {
        "sig": "int available()",
        "call": "if (btSerial.available()) { /* data ready */ }",
        "phase": "input",
        "desc": {
          "en": "Check: Returns the number of bytes (characters) currently waiting in the receive buffer.",
          "de": "Prüfen: Liefert die Anzahl der Bytes (Zeichen), die im Empfangspuffer warten.",
          "sq": "Kontroll: Kthen numrin e bajtëve (karaktereve) që presin në buferin marrës."
        }
      },
      {
        "sig": "int read()",
        "call": "char c = btSerial.read();",
        "phase": "input",
        "desc": {
          "en": "Action: Plucks exactly one character out of the incoming data stream. Returns -1 if no data is available.",
          "de": "Aktion: Liest exakt ein Zeichen aus dem Empfangsstrom (oder -1 wenn nichts vorliegt).",
          "sq": "Veprim: Merr saktësisht një karakter nga rrjedha hyrëse (ose -1 nëse nuk ka të dhëna)."
        }
      },
      {
        "sig": "size_t print(const char* text)",
        "call": "btSerial.print(\"Hello\");",
        "phase": "output",
        "desc": {
          "en": "Action: Sends text wirelessly to the smartphone screen. Returns the number of bytes written.",
          "de": "Aktion: Sendet Text drahtlos an das Smartphone-Terminal. Liefert die Anzahl gesendeter Bytes.",
          "sq": "Veprim: Dërgon tekst pa tela në ekranin e smartfonit. Kthen numrin e bajtëve të shkruar."
        }
      },
      {
        "sig": "int strcmp(const char* str1, const char* str2)",
        "call": "if (strcmp(buf, \"ON\") == 0) { /* match */ }",
        "phase": "input",
        "desc": {
          "en": "Math: Compares two C-strings. Returns 0 if they match.",
          "de": "Vergleich: Vergleicht zwei C-Strings. Liefert 0 bei exakter Übereinstimmung.",
          "sq": "Krahasim: Krahason dy C-stringje. Kthen 0 nëse përputhen."
        }
      }
    ]
  },
  "sg90-180": {
    "header": "kcomp_servosg90.h",
    "verified": true,
    "macros": [
      "SERVO_TYPE_180",
      "SERVO_TYPE_360"
    ],
    "functions": [
      {
        "sig": "bool initServo(uint8_t id, int pin, uint8_t type)",
        "call": "initServo(0, SERVO180_PIN, SERVO_TYPE_180);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Attaches a servo to a specific pin. • id: The unique ID (0-3). • pin: Digital PWM pin number (e.g., 6). • type: Use SERVO_TYPE_180 or SERVO_TYPE_360.",
          "de": "Setup: Bindet einen Servo an einen Pin. • id: Eindeutige ID (0–3). • pin: PWM-Pin (z. B. 9). • type: SERVO_TYPE_180 oder SERVO_TYPE_360.",
          "sq": "Setup: Lidh një servo me një pin. • id: ID unike (0–3). • pin: Pini PWM (p.sh. 9). • type: SERVO_TYPE_180 ose SERVO_TYPE_360."
        }
      },
      {
        "sig": "void setServoAngle(uint8_t id, int angle)",
        "call": "setServoAngle(0, 90);",
        "phase": "output",
        "desc": {
          "en": "Control (180° Only): Sets the target position. • angle: Target in degrees (0 to 180).",
          "de": "Steuerung (nur 180°): Setzt die Zielposition. • angle: Zielwinkel in Grad (0 bis 180).",
          "sq": "Kontroll (Vetëm 180°): Vendos pozicionin e synuar. • angle: Këndi në gradë (0 deri 180)."
        }
      },
      {
        "sig": "void setServoSpeed(uint8_t id, int speed)",
        "call": "setServoSpeed(0, 50);",
        "phase": "output",
        "desc": {
          "en": "Control (360° Only): Sets direction and speed. • speed: Percentage from -100 (backward) to 100 (forward). • 0 = Stop.",
          "de": "Steuerung (nur 360°): Setzt Richtung und Geschwindigkeit. • speed: -100 (rückwärts) bis +100 (vorwärts), 0 = Stopp.",
          "sq": "Kontroll (Vetëm 360°): Vendos drejtimin dhe shpejtësinë. • speed: -100 (prapa) deri +100 (para), 0 = Ndal."
        }
      },
      {
        "sig": "void stopServo(uint8_t id)",
        "call": "stopServo(0);",
        "phase": "output",
        "desc": {
          "en": "Stop: Halts the motor immediately. • For 360°: Sets speed to 0. • For 180°: No effect (motor holds current angle).",
          "de": "Stopp: Hält den Motor sofort an. • Bei 360°: Geschwindigkeit auf 0. • Bei 180°: Hält aktuellen Winkel.",
          "sq": "Ndal: Ndalon motorin menjëherë. • Për 360°: Shpejtësia 0. • Për 180°: Mban këndin aktual."
        }
      }
    ]
  },
  "sg90-360": {
    "header": "kcomp_servosg90.h",
    "verified": true,
    "macros": [
      "SERVO_TYPE_180",
      "SERVO_TYPE_360"
    ],
    "functions": [
      {
        "sig": "bool initServo(uint8_t id, int pin, uint8_t type)",
        "call": "initServo(0, SERVO360_PIN, SERVO_TYPE_360);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Attaches a servo to a specific pin. • id: The unique ID (0-3). • pin: Digital PWM pin number (e.g., 6). • type: Use SERVO_TYPE_180 or SERVO_TYPE_360.",
          "de": "Setup: Bindet einen Servo an einen Pin. • id: Eindeutige ID (0–3). • pin: PWM-Pin (z. B. 9). • type: SERVO_TYPE_180 oder SERVO_TYPE_360.",
          "sq": "Setup: Lidh një servo me një pin. • id: ID unike (0–3). • pin: Pini PWM (p.sh. 9). • type: SERVO_TYPE_180 ose SERVO_TYPE_360."
        }
      },
      {
        "sig": "void setServoAngle(uint8_t id, int angle)",
        "call": "setServoAngle(0, 90);",
        "phase": "output",
        "desc": {
          "en": "Control (180° Only): Sets the target position. • angle: Target in degrees (0 to 180).",
          "de": "Steuerung (nur 180°): Setzt die Zielposition. • angle: Zielwinkel in Grad (0 bis 180).",
          "sq": "Kontroll (Vetëm 180°): Vendos pozicionin e synuar. • angle: Këndi në gradë (0 deri 180)."
        }
      },
      {
        "sig": "void setServoSpeed(uint8_t id, int speed)",
        "call": "setServoSpeed(0, 50);",
        "phase": "output",
        "desc": {
          "en": "Control (360° Only): Sets direction and speed. • speed: Percentage from -100 (backward) to 100 (forward). • 0 = Stop.",
          "de": "Steuerung (nur 360°): Setzt Richtung und Geschwindigkeit. • speed: -100 (rückwärts) bis +100 (vorwärts), 0 = Stopp.",
          "sq": "Kontroll (Vetëm 360°): Vendos drejtimin dhe shpejtësinë. • speed: -100 (prapa) deri +100 (para), 0 = Ndal."
        }
      },
      {
        "sig": "void stopServo(uint8_t id)",
        "call": "stopServo(0);",
        "phase": "output",
        "desc": {
          "en": "Stop: Halts the motor immediately. • For 360°: Sets speed to 0. • For 180°: No effect (motor holds current angle).",
          "de": "Stopp: Hält den Motor sofort an. • Bei 360°: Geschwindigkeit auf 0. • Bei 180°: Hält aktuellen Winkel.",
          "sq": "Ndal: Ndalon motorin menjëherë. • Për 360°: Shpejtësia 0. • Për 180°: Mban këndin aktual."
        }
      }
    ]
  },
  "vib-motor": {
    "header": "kcomp_VibrationMotor.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "void initVibration(uint8_t pin)",
        "call": "initVibration(VIB_MOTOR_PIN);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the motor on the PWM pin specified.",
          "de": "Setup: Initialisiert den Vibrationsmotor am angegebenen PWM-Pin.",
          "sq": "Setup: Inicializon motorin e dridhjes në pinin PWM të specifikuar."
        }
      },
      {
        "sig": "void setVibration(uint8_t intensity)",
        "call": "setVibration(200);",
        "phase": "output",
        "desc": {
          "en": "Action: Turns the motor on at a specific speed. • intensity: 0 to 255.",
          "de": "Aktion: Schaltet den Motor mit einer festen Stärke ein. • intensity: 0 bis 255.",
          "sq": "Veprim: Ndez motorin me shpejtësi të caktuar. • intensity: 0 deri 255."
        }
      },
      {
        "sig": "void stopVibration()",
        "call": "stopVibration();",
        "phase": "output",
        "desc": {
          "en": "Action: Instantly cuts power to the motor.",
          "de": "Aktion: Schaltet den Vibrationsmotor sofort aus.",
          "sq": "Veprim: Ndërpret menjëherë rrymën e motorit."
        }
      },
      {
        "sig": "void vibratePulseNonBlocking(uint8_t intensity, uint16_t durationMs)",
        "call": "vibratePulseNonBlocking(200, 200);",
        "phase": "output",
        "desc": {
          "en": "Action: Starts a temporary haptic pulse. • intensity: 0 to 255. • durationMs: Time in ms (e.g., 200 for a short click).",
          "de": "Aktion: Startet einen zeitgesteuerten Haptik-Impuls. • intensity: 0 bis 255. • durationMs: Dauer in ms (z. B. 200).",
          "sq": "Veprim: Nis një puls të përkohshëm haptik. • intensity: 0 deri 255. • durationMs: Koha në ms (p.sh. 200)."
        }
      },
      {
        "sig": "void pollVibration()",
        "call": "pollVibration();",
        "phase": "service",
        "desc": {
          "en": "The Worker: If you use the pulse function, you MUST call this constantly inside loop(). It checks the clock and turns the motor off when the time is up.",
          "de": "Der Worker: Bei Nutzung von vibratePulseNonBlocking() MUSS dies ständig in loop() laufen, damit der Motor rechtzeitig abschaltet.",
          "sq": "Punëtori: Nëse përdor pulsin, DUHET ta thërrasësh vazhdimisht në loop() që motori të fiket në kohë."
        }
      }
    ]
  },
  "mq135": {
    "header": "kcomp_MQSensors.h",
    "verified": true,
    "macros": [
      "SENSOR_MQ2",
      "SENSOR_MQ3",
      "SENSOR_MQ135",
      "STATUS_CLEAN",
      "STATUS_MODERATE",
      "STATUS_HIGH"
    ],
    "functions": [
      {
        "sig": "void initMQ(uint8_t pin, uint8_t sensor_type)",
        "call": "initMQ(MQ135_PIN, SENSOR_MQ135);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Prepares the pin and loads the math for the sensor. • pin: Analog pin the sensor is connected to (e.g. A3). • sensor_type: Use SENSOR_MQ2, SENSOR_MQ3, or SENSOR_MQ135.",
          "de": "Setup: Bereitet den Analog-Pin vor und lädt die Sensorkennlinie. • pin: z. B. A3. • sensor_type: SENSOR_MQ2, SENSOR_MQ3 oder SENSOR_MQ135.",
          "sq": "Setup: Përgatit pinin analog dhe ngarkon matematikën e sensorit. • pin: p.sh. A3. • sensor_type: SENSOR_MQ2, SENSOR_MQ3 ose SENSOR_MQ135."
        }
      },
      {
        "sig": "void tuneSensitivity(uint8_t pin, float ratio)",
        "call": "tuneSensitivity(MQ135_PIN, 5.0f);",
        "phase": "config",
        "desc": {
          "en": "Optional Tuning: Changes how easily the sensor triggers. • pin: Analog pin (e.g., A3). • ratio: A low number (e.g., 2.0) means high sensitivity; a high number (e.g., 10.0) means low sensitivity.",
          "de": "Feinabstimmung (optional): Ändert die Empfindlichkeit. • ratio: kleiner Wert (z. B. 2.0) = sehr empfindlich; hoher Wert (z. B. 10.0) = unempfindlicher.",
          "sq": "Rregullim Opsional: Ndryshon ndjeshmërinë. • ratio: numër i ulët (p.sh. 2.0) = ndjeshmëri e lartë; numër i lartë (10.0) = e ulët."
        }
      },
      {
        "sig": "void calibrateMQ(uint8_t pin)",
        "call": "calibrateMQ(MQ135_PIN);",
        "phase": "config",
        "desc": {
          "en": "Calibration: Measures the air to define the 0% baseline. ⚠ Must be run in clean, fresh air! • pin: Analog pin (e.g. A3).",
          "de": "Kalibrierung: Misst frische Luft als 0-%-Basislinie. ⚠ Unbedingt an sauberer Frischluft ausführen!",
          "sq": "Kalibrimi: Mat ajrin për të caktuar bazën 0%. ⚠ Duhet kryer në ajër të pastër!"
        }
      },
      {
        "sig": "uint8_t readSensorScore(uint8_t pin)",
        "call": "uint8_t score = readSensorScore(MQ135_PIN);",
        "phase": "input",
        "desc": {
          "en": "Read Data: Returns a percentage from 0% (perfectly clean) to 100% (heavily saturated).",
          "de": "Daten lesen: Liefert einen Prozentwert von 0 % (völlig sauber) bis 100 % (stark belastet).",
          "sq": "Lexo Të Dhënat: Kthen përqindjen nga 0% (krejt i pastër) deri 100% (shumë i ngopur)."
        }
      },
      {
        "sig": "uint8_t readSensorStatus(uint8_t pin)",
        "call": "uint8_t status = readSensorStatus(MQ135_PIN);",
        "phase": "input",
        "desc": {
          "en": "Status: Returns a simple category perfect for warning LEDs: • STATUS_CLEAN (0-33%) • STATUS_MODERATE (34-66%) • STATUS_HIGH (67-100%).",
          "de": "Status: Liefert eine einfache Warnstufe für LEDs: • STATUS_CLEAN (0–33 %) • STATUS_MODERATE (34–66 %) • STATUS_HIGH (67–100 %).",
          "sq": "Statusi: Kthen një kategori të thjeshtë për LED: • STATUS_CLEAN (0–33%) • STATUS_MODERATE (34–66%) • STATUS_HIGH (67–100%)."
        }
      }
    ]
  },
  "mq2": {
    "header": "kcomp_MQSensors.h",
    "verified": true,
    "macros": [
      "SENSOR_MQ2",
      "SENSOR_MQ3",
      "SENSOR_MQ135",
      "STATUS_CLEAN",
      "STATUS_MODERATE",
      "STATUS_HIGH"
    ],
    "functions": [
      {
        "sig": "void initMQ(uint8_t pin, uint8_t sensor_type)",
        "call": "initMQ(MQ2_PIN, SENSOR_MQ2);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Prepares the pin and loads the math for the sensor. • pin: Analog pin the sensor is connected to (e.g. A3). • sensor_type: Use SENSOR_MQ2, SENSOR_MQ3, or SENSOR_MQ135.",
          "de": "Setup: Bereitet den Analog-Pin vor und lädt die Sensorkennlinie. • pin: z. B. A3. • sensor_type: SENSOR_MQ2, SENSOR_MQ3 oder SENSOR_MQ135.",
          "sq": "Setup: Përgatit pinin analog dhe ngarkon matematikën e sensorit. • pin: p.sh. A3. • sensor_type: SENSOR_MQ2, SENSOR_MQ3 ose SENSOR_MQ135."
        }
      },
      {
        "sig": "void tuneSensitivity(uint8_t pin, float ratio)",
        "call": "tuneSensitivity(MQ2_PIN, 5.0f);",
        "phase": "config",
        "desc": {
          "en": "Optional Tuning: Changes how easily the sensor triggers. • pin: Analog pin (e.g., A3). • ratio: A low number (e.g., 2.0) means high sensitivity; a high number (e.g., 10.0) means low sensitivity.",
          "de": "Feinabstimmung (optional): Ändert die Empfindlichkeit. • ratio: kleiner Wert (z. B. 2.0) = sehr empfindlich; hoher Wert (z. B. 10.0) = unempfindlicher.",
          "sq": "Rregullim Opsional: Ndryshon ndjeshmërinë. • ratio: numër i ulët (p.sh. 2.0) = ndjeshmëri e lartë; numër i lartë (10.0) = e ulët."
        }
      },
      {
        "sig": "void calibrateMQ(uint8_t pin)",
        "call": "calibrateMQ(MQ2_PIN);",
        "phase": "config",
        "desc": {
          "en": "Calibration: Measures the air to define the 0% baseline. ⚠ Must be run in clean, fresh air! • pin: Analog pin (e.g. A3).",
          "de": "Kalibrierung: Misst frische Luft als 0-%-Basislinie. ⚠ Unbedingt an sauberer Frischluft ausführen!",
          "sq": "Kalibrimi: Mat ajrin për të caktuar bazën 0%. ⚠ Duhet kryer në ajër të pastër!"
        }
      },
      {
        "sig": "uint8_t readSensorScore(uint8_t pin)",
        "call": "uint8_t score = readSensorScore(MQ2_PIN);",
        "phase": "input",
        "desc": {
          "en": "Read Data: Returns a percentage from 0% (perfectly clean) to 100% (heavily saturated).",
          "de": "Daten lesen: Liefert einen Prozentwert von 0 % (völlig sauber) bis 100 % (stark belastet).",
          "sq": "Lexo Të Dhënat: Kthen përqindjen nga 0% (krejt i pastër) deri 100% (shumë i ngopur)."
        }
      },
      {
        "sig": "uint8_t readSensorStatus(uint8_t pin)",
        "call": "uint8_t status = readSensorStatus(MQ2_PIN);",
        "phase": "input",
        "desc": {
          "en": "Status: Returns a simple category perfect for warning LEDs: • STATUS_CLEAN (0-33%) • STATUS_MODERATE (34-66%) • STATUS_HIGH (67-100%).",
          "de": "Status: Liefert eine einfache Warnstufe für LEDs: • STATUS_CLEAN (0–33 %) • STATUS_MODERATE (34–66 %) • STATUS_HIGH (67–100 %).",
          "sq": "Statusi: Kthen një kategori të thjeshtë për LED: • STATUS_CLEAN (0–33%) • STATUS_MODERATE (34–66%) • STATUS_HIGH (67–100%)."
        }
      }
    ]
  },
  "mq3": {
    "header": "kcomp_MQSensors.h",
    "verified": true,
    "macros": [
      "SENSOR_MQ2",
      "SENSOR_MQ3",
      "SENSOR_MQ135",
      "STATUS_CLEAN",
      "STATUS_MODERATE",
      "STATUS_HIGH"
    ],
    "functions": [
      {
        "sig": "void initMQ(uint8_t pin, uint8_t sensor_type)",
        "call": "initMQ(MQ3_PIN, SENSOR_MQ3);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Prepares the pin and loads the math for the sensor. • pin: Analog pin the sensor is connected to (e.g. A3). • sensor_type: Use SENSOR_MQ2, SENSOR_MQ3, or SENSOR_MQ135.",
          "de": "Setup: Bereitet den Analog-Pin vor und lädt die Sensorkennlinie. • pin: z. B. A3. • sensor_type: SENSOR_MQ2, SENSOR_MQ3 oder SENSOR_MQ135.",
          "sq": "Setup: Përgatit pinin analog dhe ngarkon matematikën e sensorit. • pin: p.sh. A3. • sensor_type: SENSOR_MQ2, SENSOR_MQ3 ose SENSOR_MQ135."
        }
      },
      {
        "sig": "void tuneSensitivity(uint8_t pin, float ratio)",
        "call": "tuneSensitivity(MQ3_PIN, 5.0f);",
        "phase": "config",
        "desc": {
          "en": "Optional Tuning: Changes how easily the sensor triggers. • pin: Analog pin (e.g., A3). • ratio: A low number (e.g., 2.0) means high sensitivity; a high number (e.g., 10.0) means low sensitivity.",
          "de": "Feinabstimmung (optional): Ändert die Empfindlichkeit. • ratio: kleiner Wert (z. B. 2.0) = sehr empfindlich; hoher Wert (z. B. 10.0) = unempfindlicher.",
          "sq": "Rregullim Opsional: Ndryshon ndjeshmërinë. • ratio: numër i ulët (p.sh. 2.0) = ndjeshmëri e lartë; numër i lartë (10.0) = e ulët."
        }
      },
      {
        "sig": "void calibrateMQ(uint8_t pin)",
        "call": "calibrateMQ(MQ3_PIN);",
        "phase": "config",
        "desc": {
          "en": "Calibration: Measures the air to define the 0% baseline. ⚠ Must be run in clean, fresh air! • pin: Analog pin (e.g. A3).",
          "de": "Kalibrierung: Misst frische Luft als 0-%-Basislinie. ⚠ Unbedingt an sauberer Frischluft ausführen!",
          "sq": "Kalibrimi: Mat ajrin për të caktuar bazën 0%. ⚠ Duhet kryer në ajër të pastër!"
        }
      },
      {
        "sig": "uint8_t readSensorScore(uint8_t pin)",
        "call": "uint8_t score = readSensorScore(MQ3_PIN);",
        "phase": "input",
        "desc": {
          "en": "Read Data: Returns a percentage from 0% (perfectly clean) to 100% (heavily saturated).",
          "de": "Daten lesen: Liefert einen Prozentwert von 0 % (völlig sauber) bis 100 % (stark belastet).",
          "sq": "Lexo Të Dhënat: Kthen përqindjen nga 0% (krejt i pastër) deri 100% (shumë i ngopur)."
        }
      },
      {
        "sig": "uint8_t readSensorStatus(uint8_t pin)",
        "call": "uint8_t status = readSensorStatus(MQ3_PIN);",
        "phase": "input",
        "desc": {
          "en": "Status: Returns a simple category perfect for warning LEDs: • STATUS_CLEAN (0-33%) • STATUS_MODERATE (34-66%) • STATUS_HIGH (67-100%).",
          "de": "Status: Liefert eine einfache Warnstufe für LEDs: • STATUS_CLEAN (0–33 %) • STATUS_MODERATE (34–66 %) • STATUS_HIGH (67–100 %).",
          "sq": "Statusi: Kthen një kategori të thjeshtë për LED: • STATUS_CLEAN (0–33%) • STATUS_MODERATE (34–66%) • STATUS_HIGH (67–100%)."
        }
      }
    ]
  },
  "mq7": {
    "header": "kcomp_MQSensors.h",
    "verified": false,
    "macros": [
      "SENSOR_MQ2",
      "SENSOR_MQ3",
      "SENSOR_MQ135",
      "STATUS_CLEAN",
      "STATUS_MODERATE",
      "STATUS_HIGH"
    ],
    "functions": [
      {
        "sig": "void initMQ(uint8_t pin, uint8_t sensor_type)",
        "call": "initMQ(MQ7_PIN, SENSOR_MQ7);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Prepares the pin and loads the math for the sensor. • pin: Analog pin the sensor is connected to (e.g. A3). • sensor_type: Use SENSOR_MQ2, SENSOR_MQ3, or SENSOR_MQ135.",
          "de": "Setup: Bereitet den Analog-Pin vor und lädt die Sensorkennlinie. • pin: z. B. A3. • sensor_type: SENSOR_MQ2, SENSOR_MQ3 oder SENSOR_MQ135.",
          "sq": "Setup: Përgatit pinin analog dhe ngarkon matematikën e sensorit. • pin: p.sh. A3. • sensor_type: SENSOR_MQ2, SENSOR_MQ3 ose SENSOR_MQ135."
        }
      },
      {
        "sig": "void tuneSensitivity(uint8_t pin, float ratio)",
        "call": "tuneSensitivity(MQ7_PIN, 5.0f);",
        "phase": "config",
        "desc": {
          "en": "Optional Tuning: Changes how easily the sensor triggers. • pin: Analog pin (e.g., A3). • ratio: A low number (e.g., 2.0) means high sensitivity; a high number (e.g., 10.0) means low sensitivity.",
          "de": "Feinabstimmung (optional): Ändert die Empfindlichkeit. • ratio: kleiner Wert (z. B. 2.0) = sehr empfindlich; hoher Wert (z. B. 10.0) = unempfindlicher.",
          "sq": "Rregullim Opsional: Ndryshon ndjeshmërinë. • ratio: numër i ulët (p.sh. 2.0) = ndjeshmëri e lartë; numër i lartë (10.0) = e ulët."
        }
      },
      {
        "sig": "void calibrateMQ(uint8_t pin)",
        "call": "calibrateMQ(MQ7_PIN);",
        "phase": "config",
        "desc": {
          "en": "Calibration: Measures the air to define the 0% baseline. ⚠ Must be run in clean, fresh air! • pin: Analog pin (e.g. A3).",
          "de": "Kalibrierung: Misst frische Luft als 0-%-Basislinie. ⚠ Unbedingt an sauberer Frischluft ausführen!",
          "sq": "Kalibrimi: Mat ajrin për të caktuar bazën 0%. ⚠ Duhet kryer në ajër të pastër!"
        }
      },
      {
        "sig": "uint8_t readSensorScore(uint8_t pin)",
        "call": "uint8_t score = readSensorScore(MQ7_PIN);",
        "phase": "input",
        "desc": {
          "en": "Read Data: Returns a percentage from 0% (perfectly clean) to 100% (heavily saturated).",
          "de": "Daten lesen: Liefert einen Prozentwert von 0 % (völlig sauber) bis 100 % (stark belastet).",
          "sq": "Lexo Të Dhënat: Kthen përqindjen nga 0% (krejt i pastër) deri 100% (shumë i ngopur)."
        }
      },
      {
        "sig": "uint8_t readSensorStatus(uint8_t pin)",
        "call": "uint8_t status = readSensorStatus(MQ7_PIN);",
        "phase": "input",
        "desc": {
          "en": "Status: Returns a simple category perfect for warning LEDs: • STATUS_CLEAN (0-33%) • STATUS_MODERATE (34-66%) • STATUS_HIGH (67-100%).",
          "de": "Status: Liefert eine einfache Warnstufe für LEDs: • STATUS_CLEAN (0–33 %) • STATUS_MODERATE (34–66 %) • STATUS_HIGH (67–100 %).",
          "sq": "Statusi: Kthen një kategori të thjeshtë për LED: • STATUS_CLEAN (0–33%) • STATUS_MODERATE (34–66%) • STATUS_HIGH (67–100%)."
        }
      }
    ]
  },
  "soil-moisture": {
    "header": "kcomp_SoilSensor.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "void initSoilSensor(uint8_t pin)",
        "call": "initSoilSensor(SOIL_PIN);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the specified analog pin (e.g., A3) as an input. Must be called once in setup().",
          "de": "Setup: Initialisiert den angegebenen Analog-Pin (z. B. A3) als Eingang. Einmal in setup() aufrufen.",
          "sq": "Setup: Inicializon pinin analog të specifikuar (p.sh. A3) si hyrje. Thirret një herë në setup()."
        }
      },
      {
        "sig": "void setSoilCalibration(uint16_t dry_value, uint16_t wet_value)",
        "call": "setSoilCalibration(560, 220);",
        "phase": "config",
        "desc": {
          "en": "Calibrate: Maps the sensor's unique raw voltages to 0% and 100%. Pass in the raw number when dry, and the raw number when submerged. Calling setSoilCalibration(560, 220); should give acceptable results.",
          "de": "Kalibrieren: Ordnet den Trocken- und Nass-Rohwert 0 % bzw. 100 % zu. setSoilCalibration(560, 220); liefert gute Startwerte.",
          "sq": "Kalibro: Lidh vlerat bazë të thatë dhe të lagësht me 0% dhe 100%. setSoilCalibration(560, 220); jep rezultate të mira."
        }
      },
      {
        "sig": "uint16_t readSoilRaw()",
        "call": "uint16_t raw = readSoilRaw();",
        "phase": "input",
        "desc": {
          "en": "Read Raw: Returns the raw 10-bit analog voltage reading (0-1023) directly from the ATmega328P Analog Digital Converter (ADC).",
          "de": "Rohwert lesen: Liefert den 10-Bit-Rohwert (0–1023) direkt vom ATmega328P Analog-Digital-Wandler (ADC).",
          "sq": "Lexo Vlerën Bazë: Kthen vlerën 10-bit (0–1023) direkt nga konvertuesi analog-dixhital (ADC) i ATmega328P."
        }
      },
      {
        "sig": "uint8_t readSoilMoisture()",
        "call": "uint8_t moisture = readSoilMoisture();",
        "phase": "input",
        "desc": {
          "en": "Read Moisture: Calculates and returns the calibrated moisture level as a percentage (0% to 100%).",
          "de": "Bodenfeuchte lesen: Berechnet und liefert die kalibrierte Feuchtigkeit in Prozent (0 % bis 100 %).",
          "sq": "Lexo Lagështinë: Llogarit dhe kthen lagështinë e kalibruar në përqindje (0% deri 100%)."
        }
      }
    ]
  },
  "ky039": {
    "header": "kcomp_KY039.h",
    "verified": true,
    "macros": [],
    "fields": [
      "beat_detected",
      "bpm",
      "hrv_ms",
      "signal"
    ],
    "functions": [
      {
        "sig": "void initHeartbeat(uint8_t pin)",
        "call": "initHeartbeat(KY039_PIN);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the sensor. Must be called in setup(). • pin: Analog Pin (e.g. A3).",
          "de": "Setup: Initialisiert den Pulssensor. Muss in setup() aufgerufen werden. • pin: Analog-Pin (z. B. A3).",
          "sq": "Setup: Inicializon sensorin e pulsit. Duhet thirrur në setup(). • pin: Pin Analog (p.sh. A3)."
        }
      },
      {
        "sig": "heartbeat_data_t updateHeartbeat()",
        "call": "heartbeat_data_t hb = updateHeartbeat();",
        "phase": "service",
        "desc": {
          "en": "The Worker: CRITICAL! Call this in your loop() as often as possible. If you don't call this, the math stops working.",
          "de": "Der Worker: WICHTIG! So oft wie möglich in loop() aufrufen, sonst bleibt die Pulsberechnung stehen.",
          "sq": "Punëtori: KRITIKE! Thirre në loop() sa më shpesh të jetë e mundur, përndryshe llogaritja ndalet."
        }
      }
    ]
  },
  "ir-rx": {
    "header": "kcomp_ir_receiver_21_button.h",
    "verified": true,
    "macros": [
      "IR_BTN_POWER",
      "IR_BTN_MODE",
      "IR_BTN_MUTE",
      "IR_BTN_PLAY",
      "IR_BTN_PREV",
      "IR_BTN_NEXT",
      "IR_BTN_EQ",
      "IR_BTN_VOL_DOWN",
      "IR_BTN_VOL_UP",
      "IR_BTN_0",
      "IR_BTN_1",
      "IR_BTN_2",
      "IR_BTN_3"
    ],
    "functions": [
      {
        "sig": "void initIRReceiver(uint8_t interrupt_pin)",
        "call": "initIRReceiver(IR_RX_PIN);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the background listening engine. MUST be attached to Pin 2 or 3. Call once in setup().",
          "de": "Setup: Startet den Hintergrund-Empfänger. MUSS an Pin D2 oder ~D3 angeschlossen sein. Einmal in setup() aufrufen.",
          "sq": "Setup: Nis marrësin në sfond. DUHET të lidhet në pinin D2 ose ~D3. Thirret një herë në setup()."
        }
      },
      {
        "sig": "bool isIRAvailable()",
        "call": "if (isIRAvailable()) {\n  uint32_t cmd = getIRCommand();\n}",
        "phase": "input",
        "desc": {
          "en": "Check: Returns true only if a brand new, complete 32-bit button command has been successfully captured.",
          "de": "Prüfen: Liefert nur dann true, wenn ein neuer, vollständiger 32-Bit-Tastenbefehl empfangen wurde.",
          "sq": "Kontroll: Kthen true vetëm kur është kapur një komandë e re e plotë 32-bit."
        }
      },
      {
        "sig": "uint32_t getIRCommand()",
        "call": "uint32_t cmd = getIRCommand();",
        "phase": "input",
        "desc": {
          "en": "Read: Retrieves the raw hex code of the last pressed button.",
          "de": "Lesen: Liefert den Hex-Code der zuletzt gedrückten Fernbedienungstaste.",
          "sq": "Lexo: Merr kodin hex të butonit të fundit të shtypur."
        }
      }
    ]
  },
  "ds18b20": {
    "header": "kcomp_DS18B20.h",
    "verified": true,
    "macros": [],
    "fields": [
      "is_valid",
      "temperature_c"
    ],
    "functions": [
      {
        "sig": "bool initDS18B20(uint8_t pin)",
        "call": "if (!initDS18B20(DS18B20_PIN)) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the 1-Wire bus on a specific digital pin. • Returns true if connected, false if missing.",
          "de": "Setup: Startet den 1-Wire-Bus am angegebenen Digital-Pin. • Rückgabe: true wenn verbunden, false falls nicht gefunden.",
          "sq": "Setup: Nis busin 1-Wire në pinin dixhital të specifikuar. • Kthen true nëse lidhet, false nëse mungon."
        }
      },
      {
        "sig": "void requestDS18B20()",
        "call": "requestDS18B20();",
        "phase": "output",
        "desc": {
          "en": "Trigger: Wakes the sensor up and asks for the temperature.",
          "de": "Auslösen: Weckt den Sensor auf und startet eine neue Temperaturmessung.",
          "sq": "Nisje: Zgjon sensorin dhe kërkon një matje të re temperature."
        }
      },
      {
        "sig": "ds18b20_data_t readDS18B20()",
        "call": "ds18b20_data_t tData = readDS18B20();",
        "phase": "input",
        "desc": {
          "en": "Read Data: Retrieves the data after a 750ms delay. If is_valid is false, it is still calculating.",
          "de": "Daten lesen: Holt den Messwert nach 750 ms ab. Solange is_valid false ist, misst der Sensor noch.",
          "sq": "Lexo Të Dhënat: Merr të dhënat pas 750ms. Nëse is_valid është false, sensori po llogarit ende."
        }
      }
    ]
  },
  "hx711": {
    "header": "kcomp_HX711.h",
    "verified": true,
    "macros": [
      "HX711_SCALE_1KG",
      "HX711_SCALE_5KG",
      "HX711_SCALE_10KG",
      "HX711_SCALE_20KG"
    ],
    "functions": [
      {
        "sig": "bool initHX711(uint8_t dout_pin, uint8_t sck_pin)",
        "call": "if (!initHX711(HX711_DT_PIN, HX711_SCK_PIN)) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Configures the DT and SCK pins, resets the chip, and returns true if the sensor responds.",
          "de": "Setup: Konfiguriert DT- und SCK-Pin, setzt den Chip zurück und liefert true, wenn der Sensor antwortet.",
          "sq": "Setup: Konfiguron pinat DT dhe SCK, rivendos çipin dhe kthen true nëse sensori përgjigjet."
        }
      },
      {
        "sig": "bool isHX711Ready()",
        "call": "if (isHX711Ready()) {\n  float weight_g = getHX711Weight_g(5);\n}",
        "phase": "input",
        "desc": {
          "en": "Check Ready: Returns true when the HX711 has finished a new measurement (DT pin is LOW).",
          "de": "Bereitschaft prüfen: Liefert true, sobald der HX711 eine neue Messung fertig hat (DT-Pin ist LOW).",
          "sq": "Kontrollo Gatishmërinë: Kthen true kur HX711 ka përfunduar një matje të re (pini DT është LOW)."
        }
      },
      {
        "sig": "int32_t getHX711Raw(uint8_t samples)",
        "call": "int32_t raw = getHX711Raw(1);",
        "phase": "input",
        "desc": {
          "en": "Read Raw ADC: Reads and averages samples (default 1) before tare or scale math.",
          "de": "Rohwert lesen: Liest und mittelt samples Rohwerte (Standard: 1) vor Tara- und Skalierungsrechnung.",
          "sq": "Lexo Vlerën Bazë: Lexon dhe mesataron samples vlera (parazgjedhje 1) para tarës dhe shkallëzimit."
        }
      },
      {
        "sig": "void tareHX711(uint8_t samples)",
        "call": "tareHX711();",
        "phase": "config",
        "desc": {
          "en": "Zero the Scale: Measures the empty platform over samples readings (default 10) and saves the zero offset.",
          "de": "Waage nullen (Tara): Misst die leere Waage über samples Messungen (Standard: 10) und speichert den Nullpunkt.",
          "sq": "Zero Peshoren (Tara): Mat platformën bosh mbi samples lexime (parazgjedhje 10) dhe ruan zeron."
        }
      },
      {
        "sig": "void setHX711Scale(float scale_factor)",
        "call": "setHX711Scale(HX711_SCALE_5KG);",
        "phase": "config",
        "desc": {
          "en": "Set Calibration: Sets the division factor that converts raw sensor steps into grams: HX711_SCALE_1KG, HX711_SCALE_5KG, HX711_SCALE_10KG, HX711_SCALE_20KG.",
          "de": "Kalibrierung setzen: Setzt den Umrechnungsfaktor in Gramm (HX711_SCALE_1KG / 5KG / 10KG / 20KG).",
          "sq": "Vendos Kalibrimin: Cakton faktorin e kthimit në gram (HX711_SCALE_1KG / 5KG / 10KG / 20KG)."
        }
      },
      {
        "sig": "void calibrateHX711(float known_weight_g, uint8_t samples)",
        "call": "calibrateHX711(500.0f, 10);",
        "phase": "config",
        "desc": {
          "en": "Auto-Calibrate: Calculates the scale factor automatically using a known weight in grams on a tared scale.",
          "de": "Auto-Kalibrierung: Berechnet den Kalibrierungsfaktor automatisch anhand eines bekannten Gewichts in Gramm.",
          "sq": "Auto-Kalibrim: Llogarit faktorin automatikisht duke përdorur një peshë të njohur në gram."
        }
      },
      {
        "sig": "float getHX711Weight_g(uint8_t samples)",
        "call": "float weight_g = getHX711Weight_g(5);",
        "phase": "input",
        "desc": {
          "en": "Measure Weight: Averages samples readings (default 1) and returns the net weight in grams.",
          "de": "Gewicht messen: Mittelt samples Messungen (Standard: 1) und liefert das Nettogewicht in Gramm.",
          "sq": "Mat Peshën: Mesataron samples lexime (parazgjedhje 1) dhe kthen peshën neto në gram."
        }
      }
    ]
  },
  "ir-tx": {
    "header": "kcomp_ir_transmitter.h",
    "verified": true,
    "macros": [
      "IR_BTN_POWER",
      "SONY_BTN_POWER",
      "SONY_BTN_VOL_UP",
      "SAMSUNG_BTN_POWER",
      "ACER_BTN_POWER",
      "ACER_BTN_SOURCE"
    ],
    "functions": [
      {
        "sig": "void initIRTransmitter(uint8_t pin)",
        "call": "initIRTransmitter(IR_TX_PIN);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the digital pin connected to the IR LED. Must be called once in setup().",
          "de": "Setup: Initialisiert den Digital-Pin der IR-Sendediode. Einmal in setup() aufrufen.",
          "sq": "Setup: Inicializon pinin dixhital të diodës IR. Thirret një herë në setup()."
        }
      },
      {
        "sig": "void send21Button(uint32_t hexCode)",
        "call": "send21Button(IR_BTN_POWER);",
        "phase": "output",
        "desc": {
          "en": "Transmit: Sends a 32-bit NEC command, emulating the standard K-Comp 21-Button remote.",
          "de": "Senden: Sendet einen 32-Bit-NEC-Befehl der 21-Tasten-Fernbedienung.",
          "sq": "Transmeto: Dërgon një komandë 32-bit NEC të telekomandës me 21 butona."
        }
      },
      {
        "sig": "void sendSonyTV(uint32_t hexCode)",
        "call": "sendSonyTV(SONY_BTN_POWER);",
        "phase": "output",
        "desc": {
          "en": "Transmit: Sends a 12-bit SIRC command three times in a row, emulating standard Sony TVs.",
          "de": "Senden: Sendet einen 12-Bit-SIRC-Befehl dreimal hintereinander für Sony-TVs.",
          "sq": "Transmeto: Dërgon një komandë 12-bit SIRC tre herë radhazi për TV Sony."
        }
      },
      {
        "sig": "void sendSamsungTV(uint32_t hexCode)",
        "call": "sendSamsungTV(SAMSUNG_BTN_POWER);",
        "phase": "output",
        "desc": {
          "en": "Transmit: Sends a 32-bit command tailored for Samsung displays.",
          "de": "Senden: Sendet einen 32-Bit-Befehl für Samsung-Fernseher.",
          "sq": "Transmeto: Dërgon një komandë 32-bit për ekranet Samsung."
        }
      },
      {
        "sig": "void sendAcerBeamer(uint32_t hexCode)",
        "call": "sendAcerBeamer(ACER_BTN_POWER);",
        "phase": "output",
        "desc": {
          "en": "Transmit: Sends an NEC-formatted command specifically timed for Acer projectors.",
          "de": "Senden: Sendet einen NEC-Befehl passend für Acer-Beamer.",
          "sq": "Transmeto: Dërgon një komandë NEC të kalibruar për projektorët Acer."
        }
      }
    ]
  },
  "cardkb": {
    "header": "Wire.h",
    "verified": true,
    "macros": [
      "CARDKB_ADDR"
    ],
    "functions": [
      {
        "sig": "Wire.requestFrom(CARDKB_ADDR, 1)",
        "call": "Wire.requestFrom(CARDKB_ADDR, 1);\nif (Wire.available()) {\n  char key = Wire.read();\n}",
        "phase": "input",
        "desc": {
          "en": "Read Key: Requests 1 ASCII byte from CardKB at 0x5F (returns 0 if no key was pressed).",
          "de": "Taste lesen: Fragt 1 ASCII-Zeichen vom CardKB (0x5F) ab (liefert 0, wenn keine Taste gedrückt).",
          "sq": "Lexo Tastin: Kërkon 1 bajt ASCII nga CardKB në 0x5F (kthen 0 nëse asnjë tast nuk është shtypur)."
        }
      }
    ]
  },
  "hcsr04-sg90": {
    "header": "kcomp_servosg90.h",
    "verified": true,
    "macros": [
      "SERVO_TYPE_180"
    ],
    "functions": [
      {
        "sig": "bool initServo(uint8_t id, int pin, uint8_t type)",
        "call": "initServo(0, RADAR_SERVO_PIN, SERVO_TYPE_180);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Attaches the panning 180° radar servo to slot 0.",
          "de": "Setup: Bindet den schwenkbaren 180°-Radar-Servo an Slot 0.",
          "sq": "Setup: Lidh servon 180° të radarit në slotin 0."
        }
      },
      {
        "sig": "void setServoAngle(uint8_t id, int angle)",
        "call": "setServoAngle(0, 90);",
        "phase": "output",
        "desc": {
          "en": "Control (180°): Aims the ultrasonic turret to target angle (0 to 180°).",
          "de": "Steuerung (180°): Dreht den Ultraschall-Turm auf den Zielwinkel (0 bis 180°).",
          "sq": "Kontroll (180°): Drejton kullën e ultrazërit në këndin e synuar (0 deri 180°)."
        }
      },
      {
        "sig": "unsigned long pulseIn(RADAR_ECHO_PIN, HIGH, 25000)",
        "call": "digitalWrite(RADAR_TRIG_PIN, HIGH);\ndelayMicroseconds(10);\ndigitalWrite(RADAR_TRIG_PIN, LOW);\nfloat cm = pulseIn(RADAR_ECHO_PIN, HIGH, 25000) * 0.01715f;",
        "phase": "input",
        "desc": {
          "en": "Measure: Triggers HC-SR04 ping and calculates distance in cm.",
          "de": "Messen: Löst HC-SR04-Messung aus und berechnet die Entfernung in cm.",
          "sq": "Mat: Nis pulsin HC-SR04 dhe llogarit distancën në cm."
        }
      }
    ]
  },
  "rf433-tx": {
    "header": "RH_ASK.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "bool rfTx.init()",
        "call": "if (!rfTx.init()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the 433 MHz ASK transmitter driver.",
          "de": "Setup: Initialisiert den 433-MHz-ASK-Funksender.",
          "sq": "Setup: Inicializon dhënësin radio 433 MHz ASK."
        }
      },
      {
        "sig": "bool rfTx.send(uint8_t* data, uint8_t len)",
        "call": "uint8_t code = 'A';\nrfTx.send(&code, 1);\nrfTx.waitPacketSent();",
        "phase": "output",
        "desc": {
          "en": "Transmit: Sends 1 byte (or packet) over 433 MHz and waits until transmission completes.",
          "de": "Senden: Überträgt 1 Byte (oder Paket) per 433-MHz-Funk und wartet auf Abschluss.",
          "sq": "Transmeto: Dërgon 1 bajt (ose paketë) përmes 433 MHz dhe pret përfundimin."
        }
      }
    ]
  },
  "rf433-rx": {
    "header": "RH_ASK.h",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "bool rfRx.init()",
        "call": "if (!rfRx.init()) { while (1); }",
        "phase": "setup",
        "desc": {
          "en": "Setup: Initializes the 433 MHz ASK receiver driver.",
          "de": "Setup: Initialisiert den 433-MHz-ASK-Funkempfänger.",
          "sq": "Setup: Inicializon marrësin radio 433 MHz ASK."
        }
      },
      {
        "sig": "bool rfRx.recv(uint8_t* buf, uint8_t* len)",
        "call": "uint8_t code = 0;\nuint8_t len = 1;\nif (rfRx.recv(&code, &len)) {\n  // handle code\n}",
        "phase": "input",
        "desc": {
          "en": "Receive: Non-blocking check for incoming 433 MHz packets.",
          "de": "Empfangen: Prüft nicht-blockierend auf eingehende 433-MHz-Pakete.",
          "sq": "Merr: Kontroll jo-bllokues për paketa hyrëse 433 MHz."
        }
      }
    ]
  },
  "ad8232": {
    "header": "Direct GPIO / ADC",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "int analogRead(ECG_OUT_PIN)",
        "call": "if (digitalRead(ECG_LO_PLUS) || digitalRead(ECG_LO_MINUS)) {\n  // leads off\n} else {\n  int ecg = analogRead(ECG_OUT_PIN);\n}",
        "phase": "input",
        "desc": {
          "en": "Read ECG: Checks lead-off pins LO+/LO- and reads the 10-bit ECG signal (0..1023).",
          "de": "EKG lesen: Prüft Elektrodenkontakt (LO+/LO−) und liest das 10-Bit-EKG-Signal (0–1023).",
          "sq": "Lexo EKG: Kontrollon elektrodat (LO+/LO−) dhe lexon sinjalin 10-bit EKG (0–1023)."
        }
      }
    ]
  },
  "dc-motor": {
    "header": "kcomp_motor_i2c.h (via TB6612FNG)",
    "verified": true,
    "macros": [],
    "functions": [
      {
        "sig": "void driveForward(int16_t speed, uint16_t time_ms)",
        "call": "driveForward(80, 1000);",
        "phase": "output",
        "desc": {
          "en": "Motor Shield Required: Always drive DC motors through the TB6612FNG shield — never directly on K-Comp pins!",
          "de": "Motortreiber nötig: DC-Motoren immer über das TB6612FNG-Shield ansteuern — niemals direkt an K-Comp-Pins!",
          "sq": "Kërkohet Shield: Drejto motorët DC gjithmonë përmes TB6612FNG — kurrë direkt në pinat e K-Comp!"
        }
      }
    ]
  },
  "tft-gc9a01": {
    "header": "Wire.h",
    "verified": true,
    "macros": [
      "TFT_I2C_ADDR"
    ],
    "functions": [
      {
        "sig": "Wire.beginTransmission(TFT_I2C_ADDR)",
        "call": "Wire.beginTransmission(TFT_I2C_ADDR);\n// Send I2C display commands\nWire.endTransmission();",
        "phase": "output",
        "desc": {
          "en": "I²C Display: Starts a Wire transaction to the 1.28\" Round TFT at address 0x3D.",
          "de": "I²C-Display: Startet eine I²C-Übertragung zum runden 1.28\"-TFT (Adresse 0x3D).",
          "sq": "Ekran I²C: Nis komunikimin I²C me ekranin e rrumbullakët 1.28\" TFT (adresa 0x3D)."
        }
      }
    ]
  },
  "ld2450": {
    "header": "kcomp_LD2450.h",
    "verified": false,
    "macros": [],
    "functions": [
      {
        "sig": "void initLD2450(uint8_t rx, uint8_t tx)",
        "call": "initLD2450(LD2450_RX_PIN, LD2450_TX_PIN);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the 24 GHz multi-target tracking radar UART link (beta header).",
          "de": "Setup: Startet das 24-GHz-Mehrpersonen-Radar (Beta-Header).",
          "sq": "Setup: Nis radarin 24 GHz me gjurmim shumë-objektivash (header beta)."
        }
      }
    ]
  },
  "esp8266": {
    "header": "kcomp_esp8266.h",
    "verified": false,
    "macros": [],
    "functions": [
      {
        "sig": "void initESP8266(uint8_t rx, uint8_t tx)",
        "call": "initESP8266(WIFI_RX_PIN, WIFI_TX_PIN);",
        "phase": "setup",
        "desc": {
          "en": "Setup: Starts the ESP-01 2.4 GHz Wi-Fi module on Wireless Slot S1-7/8 (beta header).",
          "de": "Setup: Startet das ESP-01 WLAN-Modul im Funk-Slot S1-7/8 (Beta-Header).",
          "sq": "Setup: Nis modulin Wi-Fi ESP-01 në folenë Wireless S1-7/8 (header beta)."
        }
      }
    ]
  }
};
