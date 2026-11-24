// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Vollständige deutsche Modulbeschreibungen für alle 43 externen K-Comp V2 Module
export default {
  'bmp280': {
    friendlyName: 'Luftdruck- & Temperatursensor',
    subtitle: 'Temperatur & barometrischer Luftdruck',
    maxReason: 'Verwendet die feste Standard-I²C-Adresse 0x76 am gemeinsamen Bus.',
    studentInfo: {
      whatItDoes: 'Misst Luftdruck (Barometer) und Temperatur. Da der Luftdruck mit der Höhe abnimmt, kann er auch deine Seehöhe bzw. Stockwerke schätzen!',
      howToConnect: 'Verbinde die 4 aktiven Pins (VCC, GND, SCL, SDA) mit einem beliebigen K-Comp I²C-Header (H1, H2 oder H3). Die ausgegrauten Pins CSB und SDO bleiben frei.',
      ideas: ['Klassenraum-Wetterstation', 'Aufzug-Stockwerk- & Höhenmesser', 'Sturm- & Luftdruckabfall-Alarm'],
      tips: ['Standard-I²C-Adresse ist 0x76.', 'Funktioniert mit 3,3V- und 5V-Logik — direkt an H1–H3 anschließbar.', 'Benötigt ca. 140 B RAM.']
    }
  },
  'aht10': {
    friendlyName: 'Feuchte- & Temperatursensor',
    subtitle: 'Temperatur & relative Luftfeuchtigkeit',
    maxReason: 'Feste I²C-Adresse 0x38 — standardmäßig nur einmal pro I²C-Bus.',
    studentInfo: {
      whatItDoes: 'Misst die relative Luftfeuchtigkeit (in %) sowie präzise Raumtemperaturen.',
      howToConnect: 'Verbinde VIN, GND, SCL und SDA mit einem freien I²C-Header (H1–H3) am K-Comp.',
      ideas: ['Smarter Raumklima-Monitor', 'Gewächshaus-Feuchtigkeitsregler', 'Atemfeuchte-Tester'],
      tips: ['Nutzt I²C-Adresse 0x38.', 'Zum Testen sanft anhauchen — die Luftfeuchte steigt sofort stark an!', 'Include: <kcomp_AHT10.h> (großes AHT10).']
    }
  },
  'max30102': {
    friendlyName: 'Puls- & Blutsauerstoffsensor',
    subtitle: 'Optischer Herzfrequenz- & SpO2-Sensor',
    maxReason: 'Feste I²C-Adresse 0x57 (nicht änderbar).',
    studentInfo: {
      whatItDoes: 'Leuchtet mit rotem und infrarotem Licht in die Fingerspitze und misst Puls (BPM) sowie Blutsauerstoffsättigung (SpO2) — wie eine Smartwatch!',
      howToConnect: 'Verbinde VIN, GND, SCL und SDA mit einem K-Comp I²C-Header (H1–H3). INT bleibt unbeschaltet.',
      ideas: ['Fitness-Pulsmesser am OLED', 'Stress- & Reaktions-Pulsspiel', 'Lügendetektor-Demo'],
      tips: ['Finger nur leicht auflegen — starkes Drücken presst Blut weg und verfälscht die Messung.', 'Für stabile BPM-Werte 5–10 Sekunden ruhig halten.', 'Nutzt I²C-Adresse 0x57.']
    }
  },
  'gy302': {
    friendlyName: 'Lichtsensor (Lux)',
    subtitle: 'Umgebungshelligkeit in Lux (BH1750)',
    maxReason: 'Standard-I²C-Adresse 0x23 (ADDR offen lassen).',
    studentInfo: {
      whatItDoes: 'Misst die exakte Helligkeit rund um das Board in Lux — vom dunklen Raum (1 Lux) bis zu hellem Sonnenlicht (50.000+ Lux).',
      howToConnect: 'Verbinde VCC, GND, SCL und SDA mit einem K-Comp I²C-Header (H1–H3). ADDR bleibt unbeschaltet.',
      ideas: ['Automatisches Nachtlicht', 'Automatische Display-Helligkeit', 'Laser-Lichtschranken-Alarm'],
      tips: ['Sehr sparsam im RAM (~65 B).', 'Zum Testen das kleine Sensorfenster mit der Hand abdecken — der Wert fällt sofort.']
    }
  },
  'paj7620u2': {
    friendlyName: 'Gestensensor',
    subtitle: 'Berührungslose 9-Wege-Gestenerkennung',
    maxReason: 'Feste I²C-Adresse 0x73.',
    studentInfo: {
      whatItDoes: 'Erkennt 9 Handgesten in der Luft (hoch, runter, links, rechts, vor, zurück, Uhrzeigersinn, Gegenuhrzeigersinn, Winken) komplett ohne Berührung!',
      howToConnect: 'Verbinde VCC, GND, SCL und SDA mit einem K-Comp I²C-Header (H1–H3). INT bleibt frei.',
      ideas: ['Berührungslose Snake- oder Pong-Steuerung', 'Wisch-Steuerung für Musik / Präsentationen', 'Magisches Wink-Türschloss'],
      tips: ['Optimaler Abstand: 5–15 cm über dem dunklen Sensorfenster.', 'Hand deutlich über den Sensor bewegen — zu schnell oder zu nah wird oft nicht erkannt.']
    }
  },
  'bmi160': {
    friendlyName: 'Bewegungs- & Neigungssensor (IMU)',
    subtitle: '6-Achsen-Gyroskop & Beschleunigungssensor',
    shortWarn: '3V3-Pin zwischen VIN & GND überspringen! 5V unbedingt an VIN.',
    protoNote: 'Steckt direkt im roten Prototyping-Steckfeld für stabile Bewegungsmessung (3V3-Pin auslassen!).',
    maxReason: 'Standard-I²C-Adresse 0x69 (kollidiert mit SPS-30, außer SAO→GND).',
    studentInfo: {
      whatItDoes: 'Misst 3D-Neigung, Beschleunigung (G-Kräfte) und Drehgeschwindigkeit (Gyroskop) — derselbe Sensortyp wie in Smartphones und Gamecontrollern.',
      howToConnect: 'Passt ideal ins rote Prototyping-Steckfeld! Verbinde VIN→5V, GND→GND, SCL→SCL, SDA→SDA an H1–H3. WICHTIG: Den 3V3-Pin direkt neben VIN überspringen!',
      ideas: ['Kipp-gesteuertes Kugellabyrinth am OLED', 'Digitale Wasserwaage', 'Schrittzähler / Schüttel-Würfel'],
      tips: ['Niemals 5V an den 3V3-Pin anschließen — immer VIN verwenden!', 'Bei gleichzeitiger Nutzung mit dem SPS-30 Feinstaubsensor: SAO auf GND legen (Adresse wechselt von 0x69 auf 0x68).']
    }
  },
  'as7343': {
    friendlyName: 'Lichtspektrum-Sensor',
    subtitle: '14-Kanal-Spektralsensor (380–1000 nm)',
    maxReason: 'Feste I²C-Adresse 0x39.',
    studentInfo: {
      whatItDoes: 'Zerlegt Licht in 14 einzelne Farb-Wellenlängen (von Violett über das sichtbare Spektrum bis Nah-Infrarot) — wie ein Mini-Laborspektrometer.',
      howToConnect: 'Verbinde VIN, GND, SCL und SDA mit einem beliebigen K-Comp I²C-Header (H1–H3).',
      ideas: ['Pflanzengesundheits- & Blattanalyse', 'Getränke- oder Süßigkeiten-Farbsortierer', 'LED-Lampen-Spektrumtester'],
      tips: ['Besitzt eine kleine weiße Onboard-LED, die per Code zur gleichmäßigen Ausleuchtung geschaltet werden kann.', 'I²C-Adresse ist 0x39 (Konflikt, falls AHT10 auf 0x39 gebrückt ist).']
    }
  },
  'as7331': {
    friendlyName: 'UV-Lichtsensor',
    subtitle: 'UV-A-, UV-B- & UV-C-Spektralsensor',
    maxReason: 'Standard-I²C-Adresse 0x74.',
    studentInfo: {
      whatItDoes: 'Misst unsichtbares Ultraviolettlicht getrennt in UV-A, UV-B und UV-C — ideal zum Testen von Sonnenlicht und Sonnenbrillen!',
      howToConnect: 'Verbinde VCC, GND, SCL und SDA mit einem K-Comp I²C-Header (H1–H3). REA bleibt frei.',
      ideas: ['Sonnencreme- & Sonnenbrillen-UV-Tester', 'Outdoor-UV-Index-Warner', 'UV-Taschenlampen-Detektor'],
      tips: ['Normale LED-Innenbeleuchtung strahlt kaum UV ab — am sonnigen Fenster oder mit UV-Lampe testen.', 'Niemals in UV-C-Lampen blicken!']
    }
  },
  'sps30': {
    friendlyName: 'Feinstaubsensor (PM)',
    subtitle: 'Laser-Feinstaubsensor (PM1.0 / PM2.5 / PM4 / PM10)',
    shortWarn: 'I²C-Adresse 0x69 (bei Kombination mit BMI160: dort SAO→GND).',
    maxReason: 'Feste I²C-Adresse 0x69 und zieht ca. 60 mA für den internen Laser-Lüfter.',
    studentInfo: {
      whatItDoes: 'Nutzt einen winzigen internen Lüfter und Laserstrahl, um mikroskopische Staubpartikel in der Luft zu zählen (PM1.0, PM2.5, PM4 und PM10).',
      howToConnect: 'Verbinde die 4 aktiven Leitungen (VCC, SDA, SCL, GND) direkt mit einem K-Comp I²C-Header (H1–H3). Den ausgegrauten SEL-Pin frei lassen.',
      ideas: ['Klassenraum-Luftgüte-Ampel', '3D-Drucker- & Lötrauch-Detektor', 'Mobiler Feinstaub-Logger'],
      tips: ['Benötigt 5V-Versorgung für den eingebauten Lüfter.', 'Teilt sich Adresse 0x69 mit dem GY-BMI160 — bei Kombination BMI160 SAO mit GND verbinden.']
    }
  },
  'vl53l1x': {
    friendlyName: 'Laser-Abstandssensor',
    subtitle: 'Time-of-Flight Laser-Distanzmesser (bis 400 cm)',
    maxReason: 'Standard-I²C-Adresse 0x29 (kollidiert mit TCS34725).',
    studentInfo: {
      whatItDoes: 'Misst exakte Entfernungen bis 4 Meter (400 cm), indem die Laufzeit eines unsichtbaren Laserimpulses gemessen wird — viel präziser und schmaler als Ultraschall!',
      howToConnect: 'Verbinde VIN, GND, SDA und SCL mit einem K-Comp I²C-Header (H1–H3). INT und SHUT bleiben unbeschaltet.',
      ideas: ['Laser-Maßband am OLED', 'Personenzähler am Türrahmen', 'Roboter-Hinderniserkennung'],
      tips: ['Eventuelle gelbe Schutzfolie vor dem Testen vorsichtig von der Linse abziehen!', 'Teilt sich Adresse 0x29 mit dem TCS34725 Farbsensor — nicht gleichzeitig verwenden.']
    }
  },
  'ina219': {
    friendlyName: 'Strom- & Spannungssensor',
    subtitle: 'DC-Strom-, Busspannungs- & Leistungssensor',
    maxReason: 'Standard-I²C-Adresse 0x40.',
    studentInfo: {
      whatItDoes: 'Misst Gleichspannung (V), Stromstärke (mA) und Leistung (mW) einer anderen Schaltung, Batterie oder Solarzelle.',
      howToConnect: 'Verbinde VCC, GND, SCL und SDA mit einem I²C-Header (H1–H3). Den zu messenden Verbraucher IN SERIE über die grünen Schraubklemmen VIN+ / VIN− einschleifen.',
      ideas: ['Solarpanel-Leistungsmesser', 'USB- & Akku-Kapazitätstester', 'Motorlast- & Blockierüberwachung'],
      tips: ['Niemals eine Batterie direkt ohne Last an VIN+ und VIN− anschließen (Kurzschluss!).', 'Verträgt bis zu 26 V und 3,2 A an der Schraubklemme.']
    }
  },
  'tcs34725': {
    friendlyName: 'RGB-Farbsensor',
    subtitle: 'RGB- & Helligkeits-Farbsensor',
    maxReason: 'Feste I²C-Adresse 0x29 (nicht änderbar).',
    studentInfo: {
      whatItDoes: 'Erkennt Rot-, Grün-, Blau- und Helligkeitswerte von Objekten direkt vor dem Sensor, sodass dein Programm Farben unterscheiden kann.',
      howToConnect: 'Verbinde VIN, GND, SCL und SDA mit einem K-Comp I²C-Header (H1–H3). LED, INT und 3V3 bleiben frei.',
      ideas: ['M&M- / Smarties-Farbsortierer', 'Farben-Quizspiel', 'Linien- oder Farbzonen-Roboter'],
      tips: ['Objekte für beste Ergebnisse 1–2 cm vor den Sensor halten.', 'Feste Adresse 0x29 — nicht mit dem VL53L1X Lasersensor am selben Bus kombinierbar.']
    }
  },
  'tb6612fng': {
    friendlyName: 'Dual-Motortreiber-Shield',
    subtitle: 'I²C Dual-DC-Motortreiber-Shield',
    shortWarn: '3,3V-Logik + RST→RESET. Externe 6–12V-Batterie an VM. (2. Shield: AD0 brücken → 0x2F)',
    maxReason: 'Unterstützt bis zu 2 Shields (0x30 + 0x2F über AD0-Lötbrücke) für 4WD-Roboter.',
    studentInfo: {
      whatItDoes: 'Steuert sicher Geschwindigkeit und Drehrichtung von 2 DC-Motoren über I²C (bis zu 4 Motoren mit zwei Shields!). Mikrocontroller dürfen Motoren niemals direkt treiben.',
      howToConnect: 'Verbinde 3V3 → K-Comp 3.3V (NICHT 5V!), RST → K-Comp RESET sowie GND/D1(SCL)/D2(SDA) mit einem I²C-Header. Motoren über eine externe 6–12V-Batterie an den VM/GND-Klemmen versorgen.',
      ideas: ['2WD- oder 4WD-Roboterauto', 'Ferngesteuerter Rover', 'Motorisiertes Mini-Förderband'],
      tips: ['KRITISCH: Logik läuft strikt mit 3,3V — niemals 5V an 3V3 anschließen!', 'Immer RST → RESET verbinden und motorUpdate() in loop() aufrufen.', 'Für ein 2. Shield auf der Rückseite AD0 verlöten (Adresse 0x2F).']
    }
  },
  'drv2605l': {
    friendlyName: 'Haptik-Treiber (Vibration)',
    subtitle: 'I²C Haptik-Effekttreiber + ERM-Motor',
    maxReason: 'Feste I²C-Adresse 0x5A.',
    studentInfo: {
      whatItDoes: 'Steuert einen Vibrationsmotor mit 123 eingebauten Smartphone-Haptikeffekten — knackige Klicks, Doppel-Taps, Herzschlag-Impulse und sanfte Rampen!',
      howToConnect: 'Verbinde VIN, GND, SCL und SDA mit einem K-Comp I²C-Header (H1–H3). Die beiden Drähte des Vibrationsmotors kommen an die +/−-Pads des Treibers.',
      ideas: ['Gamecontroller mit Rumble-Feedback', 'Lautloser Vibrations-Timer / Morse-Geber', 'Taktiler Navigator für Barrierefreiheit'],
      tips: ['Nutzt I²C-Adresse 0x5A.', 'Deutlich smarter als ein einfacher Vibrationsmotor, da Effekte automatisch und ohne Code-Blockierung abgespielt werden.']
    }
  },
  'cardkb': {
    friendlyName: 'Mini-QWERTY-Tastatur',
    subtitle: 'M5Stack Mini-I²C-Tastatur',
    maxReason: 'Feste I²C-Adresse 0x5F.',
    studentInfo: {
      whatItDoes: 'Eine daumengroße vollwertige QWERTY-Tastatur, die jeden Tastendruck per I²C an den K-Comp sendet — für Nachrichten, Passwörter oder Befehle direkt am Board!',
      howToConnect: 'Die 4 Grove-Leitungen an einen beliebigen I²C-Header (H1–H3) anschließen: Rot=5V, Schwarz=GND, Gelb=SDA, Weiß=SCL.',
      ideas: ['Mini-Funk-Chat (mit HC-12)', 'Passwort-Tresor oder Quizspiel', 'OLED-Texteditor / Taschenrechner'],
      tips: ['Unterstützt Shift- und Sym/Fn-Tasten für Zahlen und Sonderzeichen.', 'Sehr leichtgewichtig im RAM (~60 B).']
    }
  },
  'pn532': {
    friendlyName: 'NFC / RFID-Kartenleser',
    subtitle: '13,56-MHz RFID- / NFC-Leser & Schreiber',
    shortWarn: 'Modus-DIP am Modul für I²C: SW1=ON, SW2=OFF.',
    maxReason: 'Feste I²C-Adresse 0x24 und ca. 240 B SRAM-Bedarf.',
    studentInfo: {
      whatItDoes: 'Liest und beschreibt kontaktlose NFC-Schlüsselanhänger, Chipkarten und Schülerausweise aus wenigen Zentimetern Abstand — wie kontaktloses Bezahlen!',
      howToConnect: 'Stelle den kleinen Modus-Schalter auf der roten Platine auf I²C (SW1 = ON, SW2 = OFF) und verbinde VCC, GND, SDA und SCL mit einem I²C-Header (H1–H3).',
      ideas: ['Elektronisches Spind- oder Türschloss', 'Anwesenheits-Scanner im Labor', 'NFC-Jukebox oder Spielfiguren-Erkennung'],
      tips: ['90 % aller PN532-Fehler liegen am Modus-Schalter — unbedingt SW1=ON, SW2=OFF prüfen!', 'Benötigt ~240 B RAM; bei knappem Speicher OLED auf Paged-Modus umschalten.']
    }
  },
  'gy-neo6m': {
    friendlyName: 'GPS-Standortempfänger',
    subtitle: 'u-blox 6M NMEA Satelliten-GPS',
    maxReason: 'Nutzt SoftwareSerial (UART) — der ATmega328P kann immer nur einen SoftwareSerial-Port gleichzeitig abhören.',
    studentInfo: {
      whatItDoes: 'Empfängt Signale von GPS-Satelliten, um Breitengrad, Längengrad, Geschwindigkeit und exakte UTC-Uhrzeit weltweit zu berechnen.',
      howToConnect: 'VCC→5V und GND→GND verbinden. Datenleitungen ÜBERKREUZEN: Modul TX → K-Comp RX-Pin und Modul RX → K-Comp TX-Pin (z. B. D6/D7).',
      ideas: ['Fahrrad-Tacho & Streckenmesser', 'Schatzsuche- / Geocaching-Kompass', 'Hochpräzise Satelliten-Digitaluhr'],
      tips: ['Benötigt freie Sicht zum Himmel (oder direkt am Fenster) — der erste Satelliten-Fix kann 1–3 Minuten dauern!', 'TX ↔ RX unbedingt kreuzen.']
    }
  },
  'ch9329': {
    friendlyName: 'USB-Tastatur- & Maus-Adapter',
    subtitle: 'UART-zu-USB Tastatur- & Maus-Emulator',
    maxReason: 'Nutzt SoftwareSerial (UART) und agiert als einzelnes USB-HID-Gerät.',
    studentInfo: {
      whatItDoes: 'Wird an den PC-USB-Port gesteckt und lässt den K-Comp als echte USB-Tastatur oder Maus auftreten — Mauszeiger per Joystick steuern oder Shortcuts auslösen!',
      howToConnect: '5V→5V, GND→GND und Datenpins ÜBERKREUZEN: Modul TX → K-Comp RX, Modul RX → K-Comp TX. USB-Stecker in den PC stecken.',
      ideas: ['Kipp-gesteuerter PC-Gamecontroller (mit GY-BMI160)', 'Eigenes Makro-Keypad für Shortcuts', 'Joystick-Maus für Barrierefreiheit'],
      tips: ['Die gelben Konfigurations-Jumper auf dem Modul NICHT umstecken!', 'Bei Anschluss an D6/D7 müssen DIP-Schalter S1-7 und S1-8 AUS sein.']
    }
  },
  'as608': {
    friendlyName: 'Fingerabdruck-Scanner',
    subtitle: 'Optischer biometrischer Fingerabdruck-Sensor',
    maxReason: 'Nutzt SoftwareSerial (UART — nur ein aktiver Empfänger gleichzeitig).',
    studentInfo: {
      whatItDoes: 'Erfasst und erkennt menschliche Fingerabdrücke über einen grün beleuchteten optischen Sensor und speichert die Vorlagen direkt im eigenen internen Speicher.',
      howToConnect: 'VCC→5V, GND→GND verbinden und TX → K-Comp RX sowie RX → K-Comp TX kreuzen (zwei freie Digital-Pins).',
      ideas: ['Biometrische Schatzkiste oder Spindschloss', 'Geheimer PC-Login-Entsperrer (mit CH9329)', 'Mehrbenutzer-Zutrittsalarm'],
      tips: ['Jumper-Kabel kurz halten — 57600 Baud über SoftwareSerial sind empfindlich gegen Wackelkontakte.', 'Finger zuerst mit dem Enroll-Beispielsketch einlernen.']
    }
  },
  'ld2410c': {
    friendlyName: 'Anwesenheits-Radar',
    subtitle: '24-GHz mmWave Personenerkennung',
    shortWarn: 'Radar-Baudrate für AVR-SoftwareSerial auf ≤19200 reduzieren.',
    maxReason: 'Nutzt SoftwareSerial (UART — ein aktiver SoftwareSerial-Empfänger am ATmega328P).',
    studentInfo: {
      whatItDoes: 'Ein 24-GHz-Millimeterwellen-Radar, das sowohl bewegte als auch völlig ruhig sitzende Personen (sogar Atmung!) bis 5 m erkennt — selbst durch dünnes Plastik oder Holz.',
      howToConnect: 'VCC→5V, GND→GND verbinden und TX → K-Comp RX sowie RX → K-Comp TX kreuzen.',
      ideas: ['Schreibtischlampe, die beim stillen Sitzen an bleibt', 'Raumbelegungs-Zähler', 'Berührungsloses Display-Aufwecken'],
      tips: ['Werkseitige Baudrate ist 256000 — per HLKRadarTool-App auf 9600 oder 19200 senken, damit AVR-SoftwareSerial sauber liest!', 'Keine Metallflächen direkt vor dem Radar-Patch platzieren.']
    }
  },
  'ld2450': {
    friendlyName: 'Mehrpersonen-Bewegungsradar',
    subtitle: '24-GHz Multi-Target XY-Tracking-Radar',
    shortWarn: 'Radar-Baudrate für AVR-SoftwareSerial auf ≤19200 reduzieren.',
    maxReason: 'Nutzt SoftwareSerial (UART — ein aktiver SoftwareSerial-Empfänger am ATmega328P).',
    studentInfo: {
      whatItDoes: 'Verfolgt Live-X/Y-Position und Geschwindigkeit von bis zu 3 bewegten Personen gleichzeitig per 24-GHz-Radar — perfekt für ein Live-Radarbild am OLED!',
      howToConnect: '5V→5V, GND→GND sowie TX → K-Comp RX und RX → K-Comp TX am 4-Pin-Header kreuzen.',
      ideas: ['Live-Sci-Fi-Radarbildschirm am OLED', 'Zonen-Raumalarm', 'Automatischer Servo-Scheinwerfer, der dir folgt'],
      tips: ['Wie beim LD2410C die Baudrate für AVR-SoftwareSerial auf ≤19200 reduzieren.', 'Erkennt bewegte Personen am besten in einem 6-Meter-Kegel.']
    }
  },
  'hc12': {
    friendlyName: 'Langstrecken-Funkmodul',
    subtitle: '433-MHz Langstrecken-UART-Transceiver',
    maxReason: 'Nutzt SoftwareSerial (UART); ein Funkmodul pro K-Comp-Board.',
    studentInfo: {
      whatItDoes: 'Wie ein Walkie-Talkie für Textdaten — ermöglicht zwei K-Comp-Boards drahtlosen Datenaustausch quer durchs Klassenzimmer oder den Schulhof (hunderte Meter)!',
      howToConnect: 'VCC→5V, GND→GND verbinden und TXD → K-Comp RX sowie RXD → K-Comp TX kreuzen. SET für normalen Betrieb frei lassen.',
      ideas: ['Zwei-Board-Funkchat (mit CardKB)', 'Funk-Wetterstation + Innenanzeige', 'Drahtloses Multiplayer-Tic-Tac-Toe'],
      tips: ['Vor dem Senden sicherstellen, dass die Kupfer-Spirale (Antenne) angelötet ist.', 'Wenn mehrere Gruppen im selben Raum testen, per AT-Befehl verschiedene Funkkanäle wählen!']
    }
  },
  'hc05': {
    friendlyName: 'Bluetooth-Modul',
    subtitle: 'Onboard-Slot Bluetooth 2.0 Seriell',
    shortWarn: 'Nutzt Onboard-Funk-Slot (S1-7 & S1-8 EIN → reserviert D6/D7).',
    maxReason: 'Steckt direkt im einzelnen Onboard-Funk-Slot (nicht gleichzeitig mit ESP-8266 möglich).',
    studentInfo: {
      whatItDoes: 'Fügt klassisches Bluetooth (Seriell) hinzu, um Befehle von einer Android-App an den K-Comp zu senden oder Sensordaten ans Smartphone zu streamen.',
      howToConnect: 'Direkt in die beschriftete HC-05-Buchse auf der K-Comp-Platine stecken — keine Jumper-Kabel nötig! DIP-Schalter S1-7 und S1-8 auf EIN stellen.',
      ideas: ['Smartphone-gesteuertes Roboterauto', 'Drahtloses Sensor-Dashboard am Handy', 'Bluetooth-LED- / Summer-Steuerung'],
      tips: ['Nutzt D6 und D7 intern über S1-7 & S1-8.', 'Kann nicht gleichzeitig mit dem ESP-8266 WLAN-Modul eingesteckt werden.', 'Standard-Bluetooth-PIN ist meist 1234 oder 0000.']
    }
  },
  'esp8266': {
    friendlyName: 'WLAN-Modul',
    subtitle: 'Onboard-Slot 2,4-GHz WLAN-Modul',
    shortWarn: 'Nutzt Onboard-Funk-Slot (S1-7 & S1-8 EIN → reserviert D6/D7).',
    maxReason: 'Steckt direkt im einzelnen 2×4 Onboard-Funk-Slot (nicht gleichzeitig mit HC-05).',
    studentInfo: {
      whatItDoes: 'Verbindet deinen K-Comp mit einem 2,4-GHz-WLAN, damit das Board eine kleine Webseite bereitstellen oder Sensordaten ins Netzwerk senden kann!',
      howToConnect: 'Direkt in die 2×4-Buchse ESP8266 auf der K-Comp-Platine stecken (3,3V wird automatisch geregelt). DIP-Schalter S1-7 und S1-8 auf EIN lassen.',
      ideas: ['WLAN-Temperatur-Webseite fürs Labor', 'IoT-Benachrichtigungs-Taster', 'Browser-gesteuerter Servo oder LED'],
      tips: ['Unterstützt nur 2,4-GHz-WLANs (kein 5 GHz).', 'Reserviert D6 & D7 über S1-7 & S1-8; nicht mit HC-05 kombinierbar.']
    }
  },
  'sg90-180': {
    friendlyName: 'Winkel-Servomotor (0–180°)',
    subtitle: 'Positions-Mikroservo (0°–180°)',
    maxReason: 'Bis zu 3 Servos passen gut zu den PWM-Pins und dem 5V-USB-Stromlimit.',
    studentInfo: {
      whatItDoes: 'Ein kleiner Getriebemotor, der seinen Arm exakt auf jeden beliebigen Winkel zwischen 0° und 180° fährt und diese Position aktiv hält.',
      howToConnect: 'Orange → beliebiger PWM-Pin (~D9, ~D3, ~D5, ~D6, ~D10 oder ~D11), Rot → 5V, Braun → GND. Bei Nutzung von ~D9 muss DIP S1-6 (Summer) AUS sein.',
      ideas: ['Roboterarm / Schwenk-Neige-Kopf (2–3 Servos)', 'Automatischer Schranken oder Süßigkeiten-Spender', 'Analoge Zeigeranzeige'],
      tips: ['Bis zu 3 SG90-Servos pro Projekt möglich!', 'Servohorn unter Spannung niemals mit Gewalt von Hand drehen — sonst brechen die Kunststoffzahnräder.']
    }
  },
  'sg90-360': {
    friendlyName: 'Endlos-Servomotor (360°)',
    subtitle: 'Endlos drehender Mikroservo',
    maxReason: 'Bis zu 3 Servos passen gut zu den PWM-Pins und dem 5V-USB-Stromlimit.',
    studentInfo: {
      whatItDoes: 'Sieht aus wie ein normaler SG90, dreht aber endlos wie ein Rad! Statt eines Winkels bestimmst du im Code Geschwindigkeit und Drehrichtung.',
      howToConnect: 'Orange → beliebiger PWM-Pin (~D9, ~D3, ~D5, ~D6, ~D10 oder ~D11), Rot → 5V, Braun → GND.',
      ideas: ['Mini-Seilwinde oder Aufzug', 'Langsamer Drehteller / Präsentationsständer', 'Kompakter 2-Rad-Mini-Rover'],
      tips: ['90 = Stopp, <90 = eine Richtung, >90 = Gegenrichtung.', 'Bis zu 3 Servos in einem Projekt möglich.']
    }
  },
  'hcsr04-sg90': {
    friendlyName: 'Drehbarer Ultraschall-Radar',
    subtitle: 'Schwenkbarer Ultraschall-Abstandsscanner',
    maxReason: 'Belegt 2 Digital-Pins + 1 PWM-Pin für einen einzelnen Radar-Turm.',
    studentInfo: {
      whatItDoes: 'Setzt einen Ultraschall-Abstandssensor auf einen SG90-Servo, sodass er nach links und rechts schwenkt und Hindernisse wie ein Sonar erfasst!',
      howToConnect: 'HC-SR04 VCC/GND + TRIG/ECHO an Digital-Pins anschließen, SG90-Servo an einen PWM-Pin (~D9) + 5V/GND.',
      ideas: ['180°-Sonar-Radar am OLED', 'Autonomer Hindernis-Scanner für Roboter', 'Bewegungswinkel-Tracker'],
      tips: ['Zwischen zwei Messungen ca. 30 ms warten, damit alte Echos abklingen.', 'Onboard-Ultraschall-Slot deaktivieren, falls D10/D11 extern genutzt werden.']
    }
  },
  'vib-motor': {
    friendlyName: 'Vibrationsmotor',
    subtitle: '9000-RPM Münz-Vibrationsmodul (MOSFET)',
    maxReason: 'Bis zu 2 Motoren (z. B. Links/Rechts-Feedback) an PWM-Pins innerhalb sicherer Stromgrenzen.',
    studentInfo: {
      whatItDoes: 'Ein flacher Münz-Vibrationsmotor (wie im Smartphone) mit eingebautem Transistor-Treiber, regelbar von sanftem Brummen bis zu starker Vibration.',
      howToConnect: 'VCC→5V, GND→GND und IN → beliebiger PWM-Pin (~D9, ~D3, ~D5, ~D6, ~D10 oder ~D11).',
      ideas: ['Lautloser tragbarer Timer / Wecker', 'Links/Rechts-Vibrations-Navigator (mit 2 Motoren!)', 'Treffer- / Kollisions-Feedback für Spiele'],
      tips: ['Durch den eingebauten MOSFET-Treiber darf das Modul direkt an einen PWM-Pin (anders als nackte DC-Motoren!).']
    }
  },
  'dc-motor': {
    friendlyName: 'DC-Getriebemotor / Rad',
    subtitle: 'TT 1:48 Getriebemotor (~200 U/min)',
    shortWarn: 'NIEMALS direkt an den K-Comp anschließen! Nur an TB6612FNG A1/A2 oder B1/B2.',
    maxReason: 'Bis zu 4 Motoren (2 pro TB6612FNG-Shield × max. 2 Shields = 4WD-Roboter).',
    studentInfo: {
      whatItDoes: 'Ein klassischer gelber Gleichstrom-Getriebemotor mit hohem Drehmoment für Roboterräder oder Förderbänder.',
      howToConnect: 'NIEMALS direkt an K-Comp-Pins anschließen! Die zwei Motorleitungen AUSSCHLIESSLICH an die Klemmen A1/A2 oder B1/B2 eines TB6612FNG-Motortreiber-Shields anschließen.',
      ideas: ['2WD- oder 4WD-Roboterauto', 'Linienfolger-Rennwagen', 'Motorisiertes Glücksrad'],
      tips: ['Direktanschluss an ATmega328P-Pins zerstört den Mikrocontroller durch hohe Ströme & Spannungsspitzen!', 'Zuerst das TB6612FNG-Motortreiber-Shield hinzufügen.']
    }
  },
  'mq135': {
    friendlyName: 'Luftqualitäts-Gassensor',
    subtitle: 'NH3, NOx, CO2, Benzol & Rauch',
    maxReason: 'Interner Heizer zieht ~150 mA und am K-Comp gibt es nur 2 freigebbare Analog-Pins (A3, A0).',
    studentInfo: {
      whatItDoes: 'Erkennt verbrauchte Luft, CO2-verwandte Gase, Ammoniak, Rauch und Dämpfe über die Widerstandsänderung eines beheizten Sensorgitters.',
      howToConnect: 'VCC→5V, GND→GND und AO (Analog-Ausgang) → A3 (oder A0 bei DIP S1-3 Potentiometer AUS). DO bleibt frei.',
      ideas: ['Klassenraum-Lüftungsampel („Fenster auf!“)', 'Luftgüte-Balkenanzeige am OLED', 'Parfüm- / Deo-Detektor'],
      tips: ['Wird im Betrieb spürbar warm — das ist normal! Der Heizer braucht 1–3 Minuten zum Einpendeln.', 'Include: <kcomp_MQSensors.h>.']
    }
  },
  'mq2': {
    friendlyName: 'Rauch- & Gassensor',
    subtitle: 'LPG, Propan, Methan & Rauch',
    maxReason: 'Interner Heizer zieht ~150 mA und Analog-Eingänge sind begrenzt (A3, A0).',
    studentInfo: {
      whatItDoes: 'Reagiert stark auf Rauch, Brenngase (LPG/Propan) und Methan — ideal für einen Rauchmelder-Prototyp im Labor.',
      howToConnect: 'VCC→5V, GND→GND und AO → A3 (oder A0 bei S1-3 AUS).',
      ideas: ['Küchen-Gasleck-Demoalarm', 'Rauchmelder mit Summer & roter LED', 'Gaskonzentrations-Balken am OLED'],
      tips: ['Nur für Unterrichts-Demos — niemals als echten Sicherheits-Rauchmelder verwenden!', 'Zieht ~150 mA und erwärmt sich im Betrieb.']
    }
  },
  'mq7': {
    friendlyName: 'Kohlenmonoxid-Sensor',
    subtitle: 'CO-Gaskonzentrationssensor',
    maxReason: 'Interner Heizer zieht ~150 mA und Analog-Eingänge sind begrenzt (A3, A0).',
    studentInfo: {
      whatItDoes: 'Misst Kohlenmonoxid-(CO-)Konzentrationen als analoge Spannung, die der K-Comp per analogRead() ausliest.',
      howToConnect: 'VCC→5V, GND→GND und AO → A3 (oder A0 bei S1-3 AUS).',
      ideas: ['Luftgüte-Warndashboard', 'Multi-Sensor-Umweltmonitor', 'Schwellwert-Alarm mit Summer'],
      tips: ['Nur für Bildungszwecke — NICHT für lebensrettende CO-Melder zertifiziert!', 'Interner Heizer erwärmt sich (~150 mA).']
    }
  },
  'mq3': {
    friendlyName: 'Alkoholdampf-Sensor',
    subtitle: 'Ethanol- / Alkoholdampf-Sensor',
    maxReason: 'Interner Heizer zieht ~150 mA und Analog-Eingänge sind begrenzt (A3, A0).',
    studentInfo: {
      whatItDoes: 'Erkennt Ethanol- bzw. Alkoholdämpfe in der Luft — im Labor sicher testbar mit einem Tropfen Handdesinfektionsmittel auf einem Taschentuch daneben!',
      howToConnect: 'VCC→5V, GND→GND und AO → A3 (oder A0 bei S1-3 AUS).',
      ideas: ['Desinfektionsmittel-Dampftester', 'Mini-Alkomat-Demo am OLED', 'Chemielabor-Lüftungswächter'],
      tips: ['Ca. 60 Sekunden Aufwärmzeit für einen stabilen Grundwert einplanen.', 'Niemals flüssiges Desinfektionsmittel direkt auf das heiße Metallgitter tropfen!']
    }
  },
  'soil-moisture': {
    friendlyName: 'Bodenfeuchtesensor',
    subtitle: 'Korrosionsfreie kapazitive Sonde',
    maxReason: 'Am K-Comp gibt es maximal 2 externe Analog-Pins (A3 sowie A0 bei S1-3 AUS).',
    studentInfo: {
      whatItDoes: 'Misst, wie feucht oder trocken Blumenerde ist, ohne zu rosten (arbeitet kapazitiv statt mit offenen Metallkontakten!).',
      howToConnect: 'VCC→5V, GND→GND und AOUT → A3 (oder A0 bei S1-3 AUS).',
      ideas: ['„Gieß mich!“-Pflanzenwächter', 'Zwei-Pflanzen-Feuchtevergleich (bis zu 2 Sonden)', 'Automatische Servo-Bewässerung'],
      tips: ['Platine niemals weiter als bis zur weißen gestrichelten Linie in Wasser/Erde stecken!', 'Kleinere Analogwerte bedeuten FEUCHTERE Erde; höhere Werte bedeuten TROCKENE Erde.']
    }
  },
  'ky039': {
    friendlyName: 'Finger-Pulssensor',
    subtitle: 'IR-Photoplethysmografie Finger-Puls',
    maxReason: 'Optischer Einzelnutzer-Pulssensor + einzelne Bibliotheksinstanz.',
    studentInfo: {
      whatItDoes: 'Nutzt eine Infrarot-LED und einen Fototransistor, um feine Helligkeitsänderungen bei jedem Pulsschlag im Finger zu erfassen.',
      howToConnect: '5V→5V, GND→GND und SIG → A3 (oder A0 bei S1-3 AUS).',
      ideas: ['Live-Pulskurve im Seriellen Plotter', 'Puls-Blinker mit roter LED', 'Atem-Biofeedback-Spiel'],
      tips: ['Hand über den Sensor wölben — helles Deckenlicht erzeugt 50-Hz-Flimmerstörungen!', 'Für exaktere BPM-Werte ist der I²C-Sensor MAX30102 einfacher auszulesen.']
    }
  },
  'ad8232': {
    friendlyName: 'EKG-Herzsignalsensor',
    subtitle: '1-Kanal-Elektrokardiogramm (EKG)',
    shortWarn: 'NUR 3,3V (5V zerstört den Chip)! Laptop beim Tragen der Elektroden im Akkubetrieb nutzen.',
    protoNote: 'Ins rote Prototyping-Steckfeld stecken, damit 3,3V-Verkabelung und Elektrodenbuchse stabil bleiben.',
    maxReason: 'Einzelnes EKG-Frontend mit 1 Analog- + 2 Digital-Pins und strikter 3,3V-Versorgung.',
    studentInfo: {
      whatItDoes: 'Misst die winzigen elektrischen Signale deines Herzens (EKG) über Klebeelektroden — genau wie ein Herzmonitor im Krankenhaus!',
      howToConnect: 'STRENG 3.3V → K-Comp 3.3V (NIEMALS 5V!), GND→GND, OUTPUT→A3 sowie LO+/LO− an zwei Digital-Pins (z. B. D7/D6) zur Elektrodenerkennung.',
      ideas: ['Live-EKG-Kurve im Seriellen Plotter', 'Echtzeit-Herzmonitor am OLED', 'Elektroden-Ablöse-Warnalarm'],
      tips: ['GEFAHR: 5V zerstören den AD8232 sofort — 3,3V doppelt prüfen!', 'SICHERHEIT: Laptop beim Tragen von EKG-Elektroden IMMER vom Netzteil trennen (reiner Akkubetrieb)!']
    }
  },
  'ir-rx': {
    friendlyName: 'Infrarot-Fernbedienungs-Empfänger',
    subtitle: '38-kHz Infrarot-Demodulator (NEC)',
    maxReason: 'Nutzt einen Hardware-Interrupt (D2 oder ~D3) mit einer Hintergrund-ISR.',
    studentInfo: {
      whatItDoes: 'Empfängt unsichtbare 38-kHz-Infrarotimpulse der 21-Tasten-Fernbedienung, damit du den K-Comp quer durch den Raum steuern kannst!',
      howToConnect: 'VCC→5V, GND→GND und OUT zwingend an einen Hardware-Interrupt-Pin: D2 (INT0) oder ~D3 (INT1).',
      ideas: ['Ferngesteuerter Roboter oder Servo', 'Drahtlose Menüsteuerung am OLED', 'Klassen-Quiz-Buzzer per Fernbedienung'],
      tips: ['Muss an D2 oder ~D3 angeschlossen werden — normale Digital-Pins können den schnellen Interrupt nicht auslösen.', 'Benötigt freie Sichtverbindung zur Fernbedienung.']
    }
  },
  'ir-tx': {
    friendlyName: 'Infrarot-Fernbedienungs-Sender',
    subtitle: '38-kHz Infrarot-Sendediode',
    maxReason: 'Nutzt Hardware-Timer2-Trägererzeugung mit einer Sender-Instanz.',
    studentInfo: {
      whatItDoes: 'Sendet unsichtbare 38-kHz-Infrarotsignale — mache deinen K-Comp zur programmierbaren TV-, Beamer- oder Roboter-Fernbedienung!',
      howToConnect: 'VCC→5V, GND→GND und DAT → ein PWM-Pin (~D3 empfohlen).',
      ideas: ['Universal-Beamer-Fernbedienung', 'Infrarot-Lasertag-Sender (mit IR-Empfänger)', 'Geheime IR-Nachrichten zwischen zwei Boards'],
      tips: ['Cooler Trick: Halte deine Smartphone-Kamera beim Senden vor die IR-LED — viele Handykameras machen das unsichtbare violette Leuchten sichtbar!']
    }
  },
  'rf433-tx': {
    friendlyName: '433-MHz-Funksender',
    subtitle: 'FS1000A ASK 433-MHz-Sender',
    shortWarn: '17,3 cm Draht an das ANT-Pad anlöten für Reichweite > 1 m.',
    protoNote: 'Ins rote Prototyping-Steckfeld stecken für sauberen Pin-Zugang und aufrechte Antenne.',
    maxReason: 'RadioHead RH_ASK nutzt Timer1 mit einer Sender-Instanz pro Board.',
    studentInfo: {
      whatItDoes: 'Sendet drahtlose 433-MHz-Funkpakete an einen 433-MHz-Empfänger auf einem zweiten Board — funktioniert auch durch Wände ohne Sichtverbindung!',
      howToConnect: 'VCC→5V, GND→GND und DATA → beliebiger freier Digital-Pin (z. B. D12 oder D8).',
      ideas: ['Drahtlose Türklingel', 'Funk-Außen-Wettersensor', 'Einfache RC-Auto-Fernsteuerung'],
      tips: ['Einen 17,3 cm langen geraden Draht am ANT-Pad anbringen — ohne Antenne liegt die Reichweite unter 1 Meter!', 'Einweg-Funk: zusammen mit einem 433-MHz-Empfänger auf einem zweiten K-Comp verwenden.']
    }
  },
  'rf433-rx': {
    friendlyName: '433-MHz-Funkempfänger',
    subtitle: 'MX-RM-5V ASK 433-MHz-Empfänger',
    shortWarn: '17,3 cm Draht an das ANT-Pad für sauberen Empfang.',
    protoNote: 'Ins rote Prototyping-Steckfeld stecken für sauberen Pin-Zugang und stabile Antenne.',
    maxReason: 'RadioHead RH_ASK nutzt Timer1 mit einer Empfänger-Instanz pro Board.',
    studentInfo: {
      whatItDoes: 'Empfängt 433-MHz-Funkpakete von einem 433-MHz-Funksender auf einem zweiten K-Comp oder einfachen Funk-Handsender.',
      howToConnect: 'VCC→5V, GND→GND und DATA → beliebiger freier Digital-Pin (z. B. D2 oder D8).',
      ideas: ['Funk-Alarmempfänger mit OLED + Summer', 'Ferngesteuerter Garagentor-Servo', 'Innenanzeige für Außensensor'],
      tips: ['17,3 cm geraden Draht als Antenne am ANT-Pad anlöten.', 'Nutzt Timer1 (bei Kombination mit Servos am selben Board auf mögliches Zittern achten).']
    }
  },
  'ds18b20': {
    friendlyName: 'Wasserdichter Temperaturfühler',
    subtitle: 'Wasserdichter 1-Wire-Temperatursensor',
    shortWarn: 'Bereits mit 4,7-kΩ-Pull-up-Widerstand ausgestattet — direkt an 5V, GND & Digital-Pin.',
    maxReason: 'Bis zu 2 Fühler ideal (z. B. Innen- vs. Außentemperatur oder Warm- vs. Kaltwasser).',
    studentInfo: {
      whatItDoes: 'Ein wasserdichter Edelstahl-Temperaturfühler, den du direkt in Wasser, Tee, Schnee oder Erde tauchen kannst (−55 °C bis +125 °C)!',
      howToConnect: 'Dein Labor-Fühler ist bereits fest mit dem 4,7-kΩ-Pull-up-Widerstand ausgestattet — kein zusätzlicher Breadboard-Widerstand nötig! Einfach Rot → 5V, Schwarz → GND und Gelb (DQ) → beliebiger freier Digital-Pin (z. B. D8).',
      ideas: ['Smarter Tee- / Kakao-Temperaturalarm', 'Aquarium-Thermometer mit Warnung', 'Innen-/Außen-Dual-Temperaturlogger'],
      tips: ['Der Pull-up-Widerstand ist bei unseren Labor-Fühlern schon eingebaut!', 'Nur die Metallspitze & das schwarze Kabel eintauchen — Stecker trocken halten.']
    }
  },
  'hx711': {
    friendlyName: 'Digitale Waage / Wägezelle',
    subtitle: '24-Bit Wägezellen-ADC (+ 50-kg-Zellen)',
    protoNote: 'Das rote Prototyping-Steckfeld nutzen, um die 4 Halbbrücken-Wägezellen sauber zur Wheatstone-Brücke zu verbinden.',
    maxReason: 'Nutzt 2 Digital-Pins und eine Kalibrierungs-Instanz in kcomp_HX711.h.',
    studentInfo: {
      whatItDoes: 'Liest winzige Spannungsänderungen von Metall-Wägezellen aus, sodass du deine eigene präzise digitale Küchen- oder Personenwaage bauen kannst!',
      howToConnect: 'VCC→5V, GND→GND, DT (Daten) → D2 und SCK (Takt) → D8 (oder zwei beliebige freie Digital-Pins). Wägezellen an E+/E−/A+/A− anschließen.',
      ideas: ['Digitale Grammwaage am OLED', 'Smarter Trinkflaschen-Füllstandstracker', 'Paket- & Schultaschen-Waage'],
      tips: ['Beim Start immer tareHX711() ohne Gewicht aufrufen, um auf 0 zu setzen.', 'Einmal mit einem bekannten Gewicht kalibrieren (z. B. volle 500-ml-Wasserflasche ≈ 500 g).']
    }
  },
  'tft-gc9a01': {
    friendlyName: 'Rundes Farbdisplay (1.28")',
    subtitle: '240×240 RGB IPS-Display (I²C)',
    shortWarn: 'Über I²C (H1–H3) verbinden. Bei Kombination mit OLED den OLED-Paged-Modus nutzen.',
    maxReason: 'Einzelne I²C-Display-Adresse (0x3D) und ca. 220 B SRAM-Bedarf.',
    studentInfo: {
      whatItDoes: 'Ein gestochen scharfes rundes 240×240 Vollfarb-IPS-Display — ideal für Smartwatch-Zifferblätter, Tachometer, Instrumente und animierte Roboteraugen!',
      howToConnect: 'Die 4 aktiven I²C-Pins (VCC, GND, SCL, SDA) an einen beliebigen K-Comp I²C-Header (H1–H3) anschließen. Die ausgegrauten Pins DC, CS und RST bleiben frei.',
      ideas: ['Smartwatch / analoges Zifferblatt', 'Tachometer oder Neigungsanzeige', 'Animiertes Roboterauge'],
      tips: ['Bei gleichzeitiger Nutzung von Onboard-OLED und rundem TFT: OLED auf Paged-Modus stellen (spart 864 B SRAM).', 'I²C-Adresse ist 0x3D (kollidiert nicht mit dem Onboard-OLED auf 0x3C).']
    }
  }
};
