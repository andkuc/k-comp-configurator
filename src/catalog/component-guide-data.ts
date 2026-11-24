// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Compact Educational Component Guides (Electrical Principle, Visual Signal Flow & Classroom Pitfalls)
// Synchronized with K-Comp V2 2-page module documentation — EN / DE / SQ, zero dependencies
import type { ComponentGuideEntry } from '../types';

export const COMPONENT_GUIDES: Record<string, ComponentGuideEntry> = {
  "bmp280": {
    "dir": "in",
    "electrical": {
      "en": "Inside the tiny metal cap sits a microscopic piezoresistive silicon diaphragm sealed over a vacuum reference chamber. When surrounding air pressure changes, the diaphragm flexes slightly, altering the electrical resistance of embedded strain elements. An internal temperature sensor compensates for air-density shifts, and a built-in 20-bit analog-to-digital converter turns both measurements into noise-immune digital numbers sent over the two-wire I²C bus.",
      "de": "Unter der winzigen Metallkappe sitzt eine mikroskopische piezoresistive Silizium-Membran über einer Vakuum-Referenzkammer. Ändert sich der umgebende Luftdruck, biegt sich diese Membran minimal durch und verändert den elektrischen Widerstand feiner Messbrücken. Ein interner Temperatursensor kompensiert temperaturbedingte Abweichungen, und ein eingebauter 20-Bit-A/D-Wandler überträgt beide Messwerte störungsfrei als digitale Zahlen über den Zweidraht-I²C-Bus.",
      "sq": "Nën kapakun e vogël metalik ndodhet një membranë mikroskopike piezorezistive silici mbi një dhomë referuese me vakum. Kur ndryshon presioni i ajrit, membrana përkulet lehtë dhe ndryshon rezistencën elektrike të elementeve matëse. Një sensor i brendshëm temperature kompenson ndryshimet e dendësisë, ndërsa konvertuesi 20-bit ADC i dërgon të dhënat dixhitale pa zhurmë përmes busit I²C."
    },
    "flow": {
      "en": [
        "Air Pressure",
        "Silicon Diaphragm",
        "20-bit ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "Luftdruck",
        "Silizium-Membran",
        "20-Bit-ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "Presioni i ajrit",
        "Membrana e silicit",
        "ADC 20-bit",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: shares SDA/SCL with other modules via its unique address (0x76).",
      "de": "I²C-Bus: teilt sich SDA/SCL mit anderen Modulen über die eindeutige Adresse (0x76).",
      "sq": "Busi I²C: ndan SDA/SCL me module të tjera përmes adresës unike (0x76)."
    },
    "extraTips": {
      "en": [
        "Altitude drifts with weather fronts because high/low pressure shifts air pressure — calibrate sea-level pressure for accurate elevation."
      ],
      "de": [
        "Die berechnete Höhe schwankt mit dem Wetter, da Hoch- und Tiefdruckgebiete den Luftdruck verändern — für genaue Höhenmessung den lokalen Luftdruck auf Meereshöhe kalibrieren."
      ],
      "sq": [
        "Lartësia e llogaritur ndryshon me motin sepse frontet e presionit të lartë/ulët ndryshojnë presionin e ajrit — kalibroni presionin e nivelit të detit për saktësi."
      ]
    }
  },
  "aht10": {
    "dir": "in",
    "electrical": {
      "en": "The AHT10 combines a polymer capacitive humidity element with a semiconductor bandgap temperature sensor on a single chip. Water vapor absorbed into the microscopic polymer layer changes its electrical capacitance proportionally to relative humidity. An on-chip processor converts both tiny analog signals with a 24-bit analog-to-digital converter and applies factory calibration curves before sending clean digital values over I²C.",
      "de": "Der AHT10 vereint ein kapazitives Polymer-Feuchteelement und einen Halbleiter-Temperatursensor auf einem einzigen Chip. Wasserdampf lagert sich in der hauchdünnen Polymerschicht ein und verändert deren elektrische Kapazität proportional zur relativen Luftfeuchtigkeit (0–100 %). Ein interner Prozessor digitalisiert beide Signale mit 24-Bit-Auflösung, verrechnet die Werkskalibrierung und sendet fertige Digitalwerte über den I²C-Bus.",
      "sq": "AHT10 kombinon një element kapacitiv polimerik për lagështinë me një sensor gjysmëpërçues temperature brenda një çipi të vetëm. Avulli i ujit nga ajri depërton në shtresën e hollë polimerike dhe ndryshon kapacitetin elektrik proporcionalisht me lagështinë relative (0–100%). Një procesor i brendshëm i digjitalizon të dyja sinjalet me rezolucion 24-bit, aplikon kalibrimin e fabrikës dhe dërgon të dhëna të pastra përmes busit I²C."
    },
    "flow": {
      "en": [
        "Air & Humidity",
        "Polymer Capacitor",
        "24-bit ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "Luft & Feuchte",
        "Polymer-Kondensator",
        "24-Bit-ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "Ajri & Lagështia",
        "Kondensator polimer",
        "ADC 24-bit",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: calibrated 24-bit digital packets stay immune to cable noise (address 0x38).",
      "de": "I²C-Bus: kalibrierte 24-Bit-Digitalpakete bleiben auch bei längeren Kabeln störungsfrei (Adresse 0x38).",
      "sq": "Busi I²C: paketat dixhitale 24-bit të kalibruara mbeten të mbrojtura nga zhurma e kabllove (adresa 0x38)."
    },
    "extraTips": {
      "en": [
        "Each measurement takes ~75–100 ms internally; avoid polling continuously in tight loops to prevent sensor self-heating."
      ],
      "de": [
        "Jede Messung benötigt intern ~75–100 ms; nicht zu schnell hintereinander abfragen, um Eigenerwärmung des Sensors zu vermeiden."
      ],
      "sq": [
        "Çdo matje kërkon ~75–100 ms brenda sensorit; shmangni leximet shumë të shpeshta për të parandaluar vetë-ngrohjen e tij."
      ]
    }
  },
  "max30102": {
    "dir": "in",
    "electrical": {
      "en": "The MAX30102 uses photoplethysmography (PPG) with two precision LEDs — red (660 nm) and infrared (880 nm) — paired with a low-noise photodiode. Every heartbeat pushes a wave of blood into your fingertip, momentarily absorbing more infrared light and causing a rhythmic dip in reflected light. Because oxygen-rich and oxygen-poor hemoglobin absorb red and infrared light differently, comparing both waveforms yields both heart rate (BPM) and SpO₂.",
      "de": "Der MAX30102 nutzt Photoplethysmografie (PPG) mit zwei präzisen LEDs — Rot (660 nm) und Infrarot (880 nm) — sowie einer empfindlichen Fotodiode. Jeder Herzschlag pumpt eine Blutwelle in die Fingerkuppe, die kurzzeitig mehr Infrarotlicht absorbiert und das reflektierte Signal rhythmisch abschwächt. Da sauerstoffreiches und -armes Hämoglobin rotes und infrarotes Licht unterschiedlich stark schlucken, lassen sich daraus Puls (BPM) und SpO₂ berechnen.",
      "sq": "MAX30102 përdor fotopletizmografinë (PPG) me dy LED të sakta — të kuqe (660 nm) dhe infra të kuqe (880 nm) — së bashku me një fotodiodë të ndjeshme. Çdo rrahje zemre shtyn një valë gjaku në majë të gishtit duke thithur më shumë dritë infra të kuqe. Krahasimi i thithjes së dritës së kuqe dhe infra të kuqe jep pulsin (BPM) dhe oksigjenin (SpO₂)."
    },
    "flow": {
      "en": [
        "Red + IR LEDs",
        "Finger Blood Pulse",
        "Photodiode + ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "Rot- & IR-LED",
        "Blutwelle im Finger",
        "Fotodiode + ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "LED e kuqe + IR",
        "Pulsi i gjakut",
        "Fotodiodë + ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: streams high-speed optical samples; call updateVitalSigns() continuously without delay().",
      "de": "I²C-Bus: liefert schnelle optische Messwerte; updateVitalSigns() ohne blockierendes delay() in loop() aufrufen.",
      "sq": "Busi I²C: dërgon mostra të shpejta optike; thërrisni updateVitalSigns() vazhdimisht pa delay()."
    },
    "extraTips": {
      "en": [
        "Never use long delay() calls in loop() — pausing the processor breaks pulse-wave tracking."
      ],
      "de": [
        "Keine langen delay()-Aufrufe in loop() verwenden — sonst verpasst die Bibliothek die einzelnen Pulswellen."
      ],
      "sq": [
        "Mos përdorni delay() të gjata në loop() — ndalimi i procesorit prish gjurmimin e valës së pulsit."
      ]
    }
  },
  "gy302": {
    "dir": "in",
    "electrical": {
      "en": "Inside the BH1750 chip sits a silicon photodiode whose spectral response closely matches the human eye. When photons strike the semiconductor junction, they release a tiny electric current proportional to ambient brightness. An integrated 16-bit analog-to-digital converter integrates this current over a fixed exposure window (16 ms in fast mode or 120 ms in high-resolution mode) and sends the calibrated Lux value directly over I²C.",
      "de": "Im BH1750-Chip sitzt eine Silizium-Fotodiode, deren Empfindlichkeit dem menschlichen Auge nachempfunden ist. Auftreffende Lichtteilchen (Photonen) erzeugen einen winzigen elektrischen Strom proportional zur Helligkeit. Ein eingebauter 16-Bit-A/D-Wandler sammelt diesen Strom über ein festes Zeitfenster (16 ms im Schnellmodus, 120 ms im Präzisionsmodus) und überträgt den fertigen Lux-Wert direkt über den I²C-Bus.",
      "sq": "Brenda çipit BH1750 ndodhet një fotodiodë silici, ndjeshmëria spektrale e së cilës imiton syrin e njeriut. Kur fotonet e dritës godasin gjysmëpërçuesin, ato çlirojnë një rrymë të vogël elektrike proporcionalisht me ndriçimin e dhomës. Një konvertues i brendshëm 16-bit ADC e mbledh këtë rrymë gjatë një dritareje kohore (16 ms ose 120 ms) dhe dërgon direkt vlerën e kalibruar në Lux përmes busit I²C."
    },
    "flow": {
      "en": [
        "Ambient Light",
        "Photodiode",
        "16-bit ADC (Lux)",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "Umgebungslicht",
        "Fotodiode",
        "16-Bit-ADC (Lux)",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "Drita e ambientit",
        "Fotodioda",
        "ADC 16-bit (Lux)",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: direct digital Lux readout without analog calibration or voltage dividers (address 0x23).",
      "de": "I²C-Bus: direkte digitale Lux-Ausgabe ohne Analog-Kalibrierung oder Spannungsteiler (Adresse 0x23).",
      "sq": "Busi I²C: lexim dixhital direkt në Lux pa kalibrim analog ose ndarës tensioni (adresa 0x23)."
    },
    "extraTips": {
      "en": [
        "After changing resolution mode via setGY302Mode(), the sensor needs 16–120 ms to complete its first fresh integration cycle."
      ],
      "de": [
        "Nach dem Umschalten des Auflösungsmodus per setGY302Mode() benötigt der Sensor 16–120 ms für die erste gültige Messung."
      ],
      "sq": [
        "Pas ndryshimit të rezolucionit me setGY302Mode(), sensorit i duhen 16–120 ms për ciklin e parë të saktë të matjes."
      ]
    }
  },
  "paj7620u2": {
    "dir": "in",
    "electrical": {
      "en": "The PAJ7620U2 pairs a built-in 940 nm infrared LED with a miniature CMOS optical sensor array behind a dark IR-pass filter. The LED illuminates your hand in invisible infrared light, while an onboard digital signal processor (DSP) tracks the reflected bright spot at up to 240 frames per second. Instead of streaming raw camera pixels, the chip classifies nine 3D hand motions internally and reports a single gesture code over I²C.",
      "de": "Der PAJ7620U2 kombiniert eine eingebaute 940-nm-Infrarot-LED mit einer winzigen CMOS-Kameramatrix hinter einem dunklen IR-Filter. Die LED beleuchtet deine Hand mit unsichtbarem Infrarotlicht, während ein interner Signalprozessor (DSP) den reflektierten Lichtfleck mit bis zu 240 Bildern pro Sekunde verfolgt. Statt Rohbilder zu übertragen, erkennt der Chip neun 3D-Gesten selbstständig und sendet nur den fertigen Gesten-Code über I²C.",
      "sq": "PAJ7620U2 kombinon një LED të integruar infra të kuqe 940 nm me një matricë optike miniaturë CMOS pas një filtri të errët IR. LED-i ndriçon dorën me dritë të padukshme, ndërsa një procesor i brendshëm DSP gjurmon pikën e reflektuar deri në 240 kuadro në sekondë. Në vend që të transmetojë imazhe të rënda, çipi klasifikon vetë nëntë gjeste 3D dhe dërgon vetëm kodin e gjestit përmes I²C."
    },
    "flow": {
      "en": [
        "Hand Motion",
        "IR LED + CMOS Array",
        "On-Chip DSP",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "Handbewegung",
        "IR-LED + CMOS-Sensor",
        "Interner DSP",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "Lëvizja e dorës",
        "IR LED + Sensor CMOS",
        "DSP i brendshëm",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: gesture classification runs inside the sensor chip — poll getPAJ7620Gesture() rapidly without delay().",
      "de": "I²C-Bus: Gestenerkennung läuft direkt im Sensor-Chip — getPAJ7620Gesture() regelmäßig ohne delay() abfragen.",
      "sq": "Busi I²C: njohja e gjesteve kryhet brenda çipit — thërrisni getPAJ7620Gesture() rregullisht pa delay()."
    },
    "extraTips": {
      "en": [
        "Avoid blocking delay() calls in loop(); use millis() timers so quick swipes and waves are never missed."
      ],
      "de": [
        "Blockierende delay()-Aufrufe in loop() vermeiden; besser millis()-Timer nutzen, damit schnelle Wischgesten nicht verpasst werden."
      ],
      "sq": [
        "Shmangni delay() bllokuese në loop(); përdorni kohëmatës millis() që gjestet e shpejta të mos humbasin."
      ]
    }
  },
  "bmi160": {
    "dir": "in",
    "electrical": {
      "en": "The BMI160 is a microscopic MEMS (Micro-Electro-Mechanical System) combining two sensors in one silicon die. Its 3-axis accelerometer suspends tiny proof masses on silicon springs whose capacitance shifts under gravity and linear acceleration, giving stable Pitch and Roll angles. Its 3-axis gyroscope measures Coriolis forces on vibrating microstructures to sense rotation speed (°/s). All six 16-bit channels are digitized internally and read over I²C.",
      "de": "Der BMI160 ist ein mikroskopisches MEMS-Bauteil, das zwei Sensoren auf einem Silizium-Chip vereint. Der 3-Achsen-Beschleunigungssensor misst über winzige federnd gelagerte Siliziummassen die Schwerkraft und Neigung (stabiler Pitch- und Roll-Winkel). Das 3-Achsen-Gyroskop erfasst über die Corioliskraft an schwingenden Mikrostrukturen die Drehgeschwindigkeit (°/s). Alle sechs 16-Bit-Kanäle werden intern digitalisiert und über I²C ausgelesen.",
      "sq": "BMI160 është një sensor mikroskopik MEMS që bashkon dy sensorë në një çip silici. Akselerometri 3-aksial mat gravitetin dhe pjerrësinë (Pitch/Roll) përmes masave të varura në susta silici, ndërsa xhiroskopi 3-aksial mat shpejtësinë e rrotullimit (°/s) përmes forcës së Koriolisit. Të gjashtë kanalet 16-bit digjitalizohen brenda dhe lexohen përmes I²C."
    },
    "flow": {
      "en": [
        "Tilt & Rotation",
        "MEMS Accel + Gyro",
        "16-bit ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "Neigung & Drehung",
        "MEMS Accel + Gyro",
        "16-Bit-ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "Pjerrësi & Rrotullim",
        "MEMS Accel + Gyro",
        "ADC 16-bit",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: seats on the red Prototyping Area for rigid alignment; VIN = 5V, skip the 3V3 pin.",
      "de": "I²C-Bus: sitzt stabil im roten Steckfeld; 5V ausschließlich an VIN anschließen, 3V3-Pin überspringen.",
      "sq": "Busi I²C: vendoset në zonën e kuqe prototip; lidhni 5V vetëm te VIN dhe anashkaloni pinin 3V3."
    },
    "extraTips": {
      "en": [
        "Pitch and Roll stay drift-free using gravity, whereas Yaw (Z-axis) integrates gyro speed over time and slowly drifts — call resetYaw() when needed."
      ],
      "de": [
        "Pitch und Roll bleiben dank Schwerkraft dauerhaft stabil; der Z-Winkel (Yaw) wird aus dem Gyroskop aufsummiert und driftet langsam — bei Bedarf resetYaw() nutzen."
      ],
      "sq": [
        "Pitch dhe Roll mbeten të qëndrueshëm falë gravitetit, ndërsa Yaw (boshti Z) integrohet nga xhiroskopi dhe devijon ngadalë — përdorni resetYaw() kur duhet."
      ]
    }
  },
  "as7343": {
    "dir": "in",
    "electrical": {
      "en": "Unlike a standard 3-channel RGB sensor, the AS7343 contains a matrix of silicon photodiodes topped with precision optical interference filters. Each microscopic filter passes only a narrow band of light, spanning 14 spectral channels from violet (405 nm) across visible colors into near-infrared (855 nm). Because only six ADCs run at once, the chip automatically multiplexes its internal wiring across channels and delivers the full light spectrum over I²C.",
      "de": "Anders als ein einfacher RGB-Sensor besitzt der AS7343 eine Matrix aus Fotodioden mit präzisen optischen Interferenzfiltern. Jeder winzige Filter lässt nur ein enges Wellenlängenband durch — insgesamt 14 Spektralkanäle von Violett (405 nm) über das sichtbare Licht bis ins Nah-Infrarot (855 nm). Da sechs A/D-Wandler parallel arbeiten, schaltet der Chip seine Kanäle intern blitzschnell um (Multiplexing) und liefert das komplette Spektrum per I²C.",
      "sq": "Ndryshe nga një sensor standard me 3 kanale RGB, AS7343 përmban një matricë fotodiodash silici të mbuluara me filtra optikë precizë që lejojnë vetëm breza shumë të ngushtë drite — 14 kanale spektrale nga vjollca (405 nm) deri në infra të kuqe të afërt (855 nm). Çipi përdor multipleksim automatik të brendshëm për të lexuar të gjitha kanalet me radhë dhe dërgon spektrin e plotë përmes I²C."
    },
    "flow": {
      "en": [
        "Object Light",
        "14 Optical Filters",
        "Multiplexed ADCs",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "Objektlicht",
        "14 Spektralfilter",
        "Multiplex-ADCs",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "Drita e objektit",
        "14 Filtra optikë",
        "ADC multipleks",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: includes an onboard white LED controllable in code to illuminate surfaces evenly (address 0x39).",
      "de": "I²C-Bus: integrierte weiße LED per Code schaltbar für gleichmäßige Objektbeleuchtung (Adresse 0x39).",
      "sq": "Busi I²C: përfshin LED të bardhë të kontrollueshëm në kod për ndriçim të njëtrajtshëm (adresa 0x39)."
    },
    "extraTips": {
      "en": [
        "Avoid glare on glossy plastic: hold objects 2–3 cm above the sensor at a slight angle so the white LED does not blind the lens."
      ],
      "de": [
        "Glanzeffekte vermeiden: glänzende Objekte ca. 2–3 cm entfernt und leicht angewinkelt halten, damit die weiße LED den Sensor nicht blendet."
      ],
      "sq": [
        "Shmangni shkëlqimin: mbani objektet me shkëlqim 2–3 cm larg dhe lehtësisht pjerrtas që LED-i i bardhë të mos verbojë lenten."
      ]
    }
  },
  "as7331": {
    "dir": "in",
    "electrical": {
      "en": "The AS7331 contains three dedicated photodiodes behind specialized optical bandpass glass filters that block visible room light and isolate ultraviolet radiation into UV-A (315–400 nm), UV-B (280–315 nm), and UV-C (200–280 nm). Incoming UV photons generate tiny photo-currents proportional to irradiance (µW/cm²). High-resolution internal ADCs integrate these charges over programmable exposure times and transmit digital irradiance values over I²C.",
      "de": "Im AS7331 sitzen drei getrennte Fotodioden hinter speziellen optischen Bandpassfiltern, die sichtbares Raumlicht blockieren und Ultraviolettstrahlung exakt in UV-A (315–400 nm), UV-B (280–315 nm) und UV-C (200–280 nm) trennen. Auftreffende UV-Photonen erzeugen winzige Fotoströme proportional zur Bestrahlungsstärke (µW/cm²). Interne A/D-Wandler integrieren diese Ladungen und liefern fertige Digitalwerte über den I²C-Bus.",
      "sq": "AS7331 përmban tre fotodioda të dedikuara pas filtrave optikë të veçantë prej qelqi që bllokojnë dritën e dukshme dhe ndajnë rrezatimin ultravjollcë në tre breza: UV-A (315–400 nm), UV-B (280–315 nm) dhe UV-C (200–280 nm). Fotonet UV krijojnë rryma elektrike shumë të vogla proporcionalisht me intensitetin (µW/cm²), të cilat konvertuesit e brendshëm ADC i shndërrojnë në vlera të qëndrueshme dixhitale përmes busit I²C."
    },
    "flow": {
      "en": [
        "UV-A/B/C Light",
        "UV Glass Filters",
        "3× Photodiode + ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "UV-A/B/C-Licht",
        "UV-Bandpassfilter",
        "3× Fotodiode + ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "Drita UV-A/B/C",
        "Filtra UV",
        "3× Fotodiodë + ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: strictly 3.3V logic/power on K-Comp! Never wire 5V to VCC (address 0x74).",
      "de": "I²C-Bus: benötigt streng 3.3V Versorgung! Niemals 5V an VCC anschließen (Adresse 0x74).",
      "sq": "Busi I²C: funksionon rreptësisht në 3.3V! Mos lidhni kurrë 5V te VCC (adresa 0x74)."
    },
    "extraTips": {
      "en": [
        "Window glass blocks nearly 100% of UV-B and UV-C — test outdoors in open sunlight or with a safe UV-A flashlight."
      ],
      "de": [
        "Fensterglas blockiert fast 100 % der UV-B- und UV-C-Strahlung — für realistische Werte im Freien oder mit einer UV-A-Taschenlampe testen."
      ],
      "sq": [
        "Xhami i dritares bllokon pothuajse 100% të UV-B dhe UV-C — testojeni jashtë në diell ose me elektrik UV-A."
      ]
    }
  },
  "sps30": {
    "dir": "in",
    "electrical": {
      "en": "The SPS-30 is a miniature laser particle counter. A tiny internal fan continuously pulls ambient air through a dark optical chamber crossed by a focused laser beam. Whenever microscopic dust, smoke, or pollen crosses the laser, it scatters flashes of light onto a sensitive photodiode. From the intensity and duration of each flash, an onboard processor classifies particle sizes (PM1.0, PM2.5, PM4.0, PM10) in µg/m³ and transmits them over I²C.",
      "de": "Der SPS-30 ist ein optischer Laser-Partikelzähler. Ein kleiner interner Lüfter saugt kontinuierlich Raumluft durch eine dunkle Messkammer, die von einem Laserstrahl durchquert wird. Fliegt ein Staub-, Rauch- oder Pollenpartikel durch den Strahl, streut es einen winzigen Lichtblitz auf eine Fotodiode. Aus Blitzstärke und -dauer berechnet ein interner Prozessor die Feinstaubklassen (PM1.0, PM2.5, PM4.0, PM10) in µg/m³ und sendet sie per I²C.",
      "sq": "SPS-30 është një numërues optik grimcash me lazer. Një ventilator i vogël i brendshëm thith vazhdimisht ajrin e ambientit përmes një dhome të errët të përshkuar nga një rreze lazeri. Kur pluhuri mikroskopik, tymi ose poleni kalojnë rrezen, ato shpërndajnë blice drite mbi një fotodiodë të ndjeshme. Procesori i brendshëm analizon intensitetin e tyre për të klasifikuar grimcat PM1.0, PM2.5, PM4.0 dhe PM10 në µg/m³ përmes I²C."
    },
    "flow": {
      "en": [
        "Air & Dust",
        "Internal Fan",
        "Laser Scattering",
        "Photodiode + DSP",
        "I²C → K-Comp V2"
      ],
      "de": [
        "Luft & Staub",
        "Interner Lüfter",
        "Laser-Streuung",
        "Fotodiode + DSP",
        "I²C → K-Comp V2"
      ],
      "sq": [
        "Ajri & Pluhuri",
        "Ventilatori",
        "Shpërndarja lazer",
        "Fotodiodë + DSP",
        "I²C → K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: powered by 5V for the fan motor; uses 16-bit integer mode to save K-Comp SRAM (address 0x69).",
      "de": "I²C-Bus: benötigt 5V für den Lüfter; nutzt 16-Bit-Ganzzahlmodus, um K-Comp-SRAM zu sparen (Adresse 0x69).",
      "sq": "Busi I²C: ushqehet me 5V për ventilatorin; përdor modalitetin 16-bit për të kursyer SRAM (adresa 0x69)."
    },
    "extraTips": {
      "en": [
        "In heavy smoke (like a blown-out candle), readings saturate at 65535 because the library uses memory-saving 16-bit integers — the sensor is not broken."
      ],
      "de": [
        "Bei starkem Rauch (z. B. ausgeblasene Kerze) stoppt der Wert bei 65535 — kein Defekt, sondern das Maximum des speichersparenden 16-Bit-Integer-Modus."
      ],
      "sq": [
        "Në tym të dendur vlerat ndalen te 65535 — ky nuk është defekt, por kufiri i numrave 16-bit që kursejnë memorie."
      ]
    }
  },
  "vl53l1x": {
    "dir": "in",
    "electrical": {
      "en": "Unlike ultrasonic sensors that time sound waves, the VL53L1X measures distance using Time-of-Flight (ToF) light pulses. An eye-safe Class-1 940 nm infrared laser fires ultra-short light pulses toward a target, and a Single Photon Avalanche Diode (SPAD) array acts as a picosecond stopwatch for the returning photons. Since light travels ~30 cm per nanosecond, timing the round trip yields millimeter-accurate distances up to 4 meters over I²C.",
      "de": "Anders als Ultraschallsensoren misst der VL53L1X Abstände mit Lichtlaufzeit (Time-of-Flight). Ein augensicherer 940-nm-Infrarotlaser (Klasse 1) sendet extrem kurze Lichtpulse aus, während ein hochempfindliches SPAD-Fotodioden-Array wie eine Pikosekunden-Stoppuhr den zurückkehrenden Lichtblitz misst. Da Licht pro Nanosekunde ca. 30 cm zurücklegt, berechnet der Chip daraus millimetergenaue Distanzen bis 4 Meter und liefert sie über I²C.",
      "sq": "Ndryshe nga sensorët ultrasonikë që matin tingullin, VL53L1X mat distancën me kohën e fluturimit të dritës (Time-of-Flight). Një lazer infra i kuq 940 nm i sigurt për sytë (Klasa 1) lëshon pulse ultra të shkurtra, ndërsa një matricë fotodiodash SPAD vepron si kronometër pikosekondash për fotonet e kthyera. Duke matur kohën e udhëtimit vajtje-ardhje, çipi llogarit distanca me saktësi milimetrike deri në 4 metra përmes busit I²C."
    },
    "flow": {
      "en": [
        "940 nm IR Laser",
        "Target Reflection",
        "SPAD Stopwatch",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "940-nm-IR-Laser",
        "Objekt-Reflexion",
        "SPAD-Stoppuhr",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "Lazer IR 940 nm",
        "Reflektimi",
        "Kronometri SPAD",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: narrow laser beam unaffected by soft fabrics or echo angles (fixed address 0x29).",
      "de": "I²C-Bus: schmaler Laserstrahl, unempfindlich gegenüber Stoffen oder schrägen Flächen (feste Adresse 0x29).",
      "sq": "Busi I²C: rreze e ngushtë lazeri që nuk ndikohet nga pëlhurat ose këndet (adresa fikse 0x29)."
    },
    "extraTips": {
      "en": [
        "Remove any black cover cap if range stalls at ~20 cm (optical crosstalk); bright direct outdoor sunlight can wash out the 940 nm laser."
      ],
      "de": [
        "Falls Messungen bei ca. 20 cm hängen bleiben, schwarze Kappe entfernen (optisches Übersprechen); direktes Sonnenlicht draußen kann den 940-nm-Laser überstrahlen."
      ],
      "sq": [
        "Hiqni kapakun e zi nëse matja ngec te ~20 cm (ndërhyrje optike); dielli i fortë jashtë mund të pengojë lazerin 940 nm."
      ]
    }
  },
  "ina219": {
    "dir": "in",
    "electrical": {
      "en": "A microcontroller can only measure voltage, not current directly. The INA219 routes all load current through a precision 0.1 Ω shunt resistor (labeled R100) between VIN+ and VIN−. By Ohm’s Law (I = U / R), every 1 A creates a 100 mV voltage drop across the shunt. An internal 12-bit ADC with amplifier measures both this tiny shunt drop and the main supply voltage (VIN− to GND), computing voltage, current (mA), and power (mW) in hardware over I²C.",
      "de": "Ein Mikrocontroller kann nur Spannungen messen, keinen Strom direkt. Der INA219 leitet den gesamten Verbraucherstrom über einen präzisen 0,1-Ω-Shunt-Widerstand (R100) zwischen VIN+ und VIN−. Nach dem Ohm’schen Gesetz (I = U / R) erzeugt jedes Ampere genau 100 mV Spannungsabfall am Shunt. Ein interner 12-Bit-ADC mit Verstärker misst diesen winzigen Abfall sowie die Versorgungsspannung (VIN− gegen GND) und berechnet Spannung, Strom (mA) und Leistung (mW) direkt im Chip über I²C.",
      "sq": "Mikrokontrolluesi mat vetëm tension, jo rrymë direkt. INA219 kalon rrymën e ngarkesës përmes një rezistence precize shunt 0.1 Ω (R100) midis VIN+ dhe VIN−. Sipas ligjit të Omit (I = U / R), çdo amper krijon rënie 100 mV. Një ADC 12-bit i brendshëm mat tensionin e shuntit dhe të burimit, duke llogaritur V, mA dhe mW në harduer përmes I²C."
    },
    "flow": {
      "en": [
        "Load Current",
        "0.1 Ω Shunt (R100)",
        "12-bit ADC + Math",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "Verbraucherstrom",
        "0,1-Ω-Shunt (R100)",
        "12-Bit-ADC + Rechenwerk",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "Rryma e ngarkesës",
        "Shunt 0.1 Ω (R100)",
        "ADC 12-bit + Llogaritje",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: wire VIN+ / VIN− on the High-Side (between +supply and load) and share GND with K-Comp (address 0x40).",
      "de": "I²C-Bus: VIN+ / VIN− immer High-Side (vor dem Verbraucher) in Serie schalten und gemeinsame Masse (GND) verbinden (Adresse 0x40).",
      "sq": "Busi I²C: lidhni VIN+ / VIN− në anën High-Side (para ngarkesës) dhe ndani masën GND me K-Comp (adresa 0x40)."
    },
    "extraTips": {
      "en": [
        "High-Side rule: placing the INA219 after the load (Low-Side) causes 0.00 V bus voltage and 0.0 mW power; swapped VIN+/VIN− shows negative mA."
      ],
      "de": [
        "High-Side-Regel: Wird der Sensor hinter dem Verbraucher (Low-Side) angeschlossen, zeigt er 0,00 V Bus-Spannung und 0,0 mW Leistung; vertauschtes VIN+/VIN− liefert negative mA."
      ],
      "sq": [
        "Rregulli High-Side: vendosja pas ngarkesës (Low-Side) jep 0.00 V dhe 0.0 mW; ndërrimi i VIN+/VIN− jep rrymë negative."
      ]
    }
  },
  "tcs34725": {
    "dir": "in",
    "electrical": {
      "en": "The TCS34725 contains a microscopic grid of photodiodes covered with red, green, blue, and clear glass filters, plus an infrared-blocking filter so invisible IR light cannot distort color readings. Working like a tiny digital camera shutter, it collects light over a fixed integration time (e.g., 100 ms) into four 16-bit counters (R, G, B, Clear). An onboard pure-white LED illuminates solid objects evenly so the chip measures true reflected color over I²C.",
      "de": "Der TCS34725 enthält eine mikroskopische Matrix aus Fotodioden mit roten, grünen, blauen und klaren Farbfiltern sowie einem IR-Sperrfilter gegen verfälschendes Infrarotlicht. Wie der Verschluss einer Digitalkamera sammelt er Licht über eine feste Belichtungszeit (z. B. 100 ms) in vier 16-Bit-Zählern (R, G, B, Clear). Eine eingebaute weiße LED beleuchtet Objekte gleichmäßig, sodass der Chip die reflektierte Farbe exakt über I²C meldet.",
      "sq": "TCS34725 përmban një rrjet mikroskopik fotodiodash me filtra qelqi të kuq, të gjelbër, blu dhe transparent, plus një filtër bllokues IR që drita e padukshme të mos shtrembërojë ngjyrat. Ashtu si qepeni i një kamere dixhitale, ai mbledh dritën gjatë një kohe integrimi (p.sh. 100 ms) në katër numërues 16-bit (R, G, B, Clear), ndërsa LED-i i bardhë ndriçon objektin për matje të saktë përmes I²C."
    },
    "flow": {
      "en": [
        "White LED → Object",
        "RGB + Clear Filters",
        "4× 16-bit ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "Weiße LED → Objekt",
        "RGB- & Klarfilter",
        "4× 16-Bit-ADC",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "LED i bardhë → Objekt",
        "Filtra RGB + Clear",
        "4× ADC 16-bit",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: fixed address 0x29 — shines pure white light and reads reflected R/G/B ratios.",
      "de": "I²C-Bus: feste Adresse 0x29 — beleuchtet Objekte weiß und liefert reflektierte R/G/B-Anteile.",
      "sq": "Busi I²C: adresë fikse 0x29 — ndriçon objektin me dritë të bardhë dhe lexon raportet R/G/B."
    },
    "extraTips": {
      "en": [
        "If color readings stay near zero or noisy, move the object closer (ideal distance is 5–15 mm above the black lens)."
      ],
      "de": [
        "Bleiben Farbwerte nahe Null oder unruhig, Objekt näher heranhalten (optimaler Abstand: 5–15 mm über der schwarzen Linse)."
      ],
      "sq": [
        "Nëse vlerat e ngjyrave janë pranë zeros, afrojeni objektin (distanca ideale 5–15 mm mbi lenten e zezë)."
      ]
    }
  },
  "tb6612fng": {
    "dir": "out",
    "electrical": {
      "en": "A microcontroller pin delivers only ~20 mA — far too little to spin a DC motor. This shield pairs two chips: a tiny STM32 co-processor listens to 4-byte I²C commands from K-Comp and generates local direction and PWM signals, while the TB6612FNG dual MOSFET H-bridge switches high current (up to 1.2 A continuous per channel) from an external battery pack (VM). Reversing the H-bridge switches flips spin direction, pulsing controls speed, and shorting both leads triggers instant braking.",
      "de": "Ein Mikrocontroller-Pin liefert nur ~20 mA — viel zu wenig für einen Gleichstrommotor. Dieses Shield kombiniert zwei Chips: Ein kleiner STM32-Übersetzer empfängt 4-Byte-I²C-Befehle vom K-Comp und erzeugt lokal Richtungs- und PWM-Signale, während die doppelte MOSFET-H-Brücke TB6612FNG hohe Motorströme (bis 1,2 A Dauerstrom pro Kanal) aus einer externen Batterie (VM) schaltet. Durch Umschalten der Brücke dreht der Motor vorwärts, rückwärts, gebremst oder mit variabler PWM-Drehzahl.",
      "sq": "Një pin mikrokontrolluesi jep vetëm ~20 mA — shumë pak për një motor DC. Ky modul bashkon dy çipa: një ko-procesor STM32 merr komandat I²C nga K-Comp dhe gjeneron sinjalet e drejtimit dhe PWM, ndërsa ura e dyfishtë MOSFET H-Bridge TB6612FNG kalon rrymën e lartë (deri 1.2 A) nga një bateri e jashtme (VM) për rrotullim, shpejtësi dhe frenim."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "I²C + RESET",
        "STM32 Translator",
        "TB6612FNG H-Bridge + VM",
        "DC Motors A & B"
      ],
      "de": [
        "K-Comp V2",
        "I²C + RESET",
        "STM32-Übersetzer",
        "TB6612FNG H-Brücke + VM",
        "DC-Motoren A & B"
      ],
      "sq": [
        "K-Comp V2",
        "I²C + RESET",
        "Përkthyesi STM32",
        "Ura-H TB6612FNG + VM",
        "Motorët DC A & B"
      ]
    },
    "flowNote": {
      "en": "I²C bus (0x30): logic strictly on 3.3V + RESET wired to RST; motor power VM always from external battery with shared GND.",
      "de": "I²C-Bus (0x30): Logik streng an 3.3V + RST an RESET; Motorstrom VM immer aus externer Batterie mit gemeinsamer Masse (GND).",
      "sq": "Busi I²C (0x30): logjika vetëm në 3.3V + RST te RESET; ushqimi VM gjithmonë nga bateri e jashtme me GND të përbashkët."
    },
    "extraTips": {
      "en": [
        "Verify the back-side STBY solder jumper is bridged to I2C (not IO), and never run a 0-byte I²C scanner on this shield."
      ],
      "de": [
        "Auf der Rückseite prüfen, ob der STBY-Lötjumper auf I2C (nicht IO) steht, und keinen 0-Byte-I²C-Scanner auf dem Shield ausführen."
      ],
      "sq": [
        "Kontrolloni mbrapa që jumperi STBY të jetë lidhur me I2C (jo IO) dhe mos përdorni skaner I²C 0-byte."
      ]
    }
  },
  "drv2605l": {
    "dir": "out",
    "electrical": {
      "en": "Simple vibration motors feel sluggish when switched off because their spinning weight coasts slowly to a stop. The DRV2605L is a dedicated haptic co-processor containing a ROM library of 123 finely shaped voltage waveforms (clicks, buzzes, double-taps, heartbeat pulses). Its internal H-bridge amplifier applies a brief overdrive voltage spike to jerk the motor into motion instantly, then briefly reverses polarity (active braking) to stop it on a dime — all triggered by short I²C commands.",
      "de": "Einfache Vibrationsmotoren wirken beim Abschalten träge, weil die Unwucht langsam ausläuft. Der DRV2605L ist ein spezialisierter Haptik-Prozessor mit 123 fest gespeicherten Spannungskurven im ROM (Klicks, Doppel-Taps, Herzschlag). Sein interner H-Brücken-Verstärker startet den Motor mit einem kurzen Spannungsimpuls (Overdrive) und bremst ihn danach durch kurzes Umpolen (Active Braking) blitzartig ab — alles ausgelöst über kurze I²C-Befehle.",
      "sq": "Motorët e thjeshtë vibrues ndalen ngadalë pas fikjes për shkak të inercisë. DRV2605L është një ko-procesor haptik i dedikuar me 123 efekte të ruajtura në memorien ROM (klikime mekanike, goditje të dyfishta, rrahje zemre). Amplifikatori i brendshëm me urë-H jep një impuls të shkurtër tensioni për nisje të menjëhershme dhe pastaj përmbys shkurtimisht polaritetin (frenim aktiv) për ndalim të mprehtë përmes komandave I²C."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "I²C (SDA/SCL)",
        "DRV2605L ROM + Amp",
        "Active-Brake Drive",
        "Haptic Motor"
      ],
      "de": [
        "K-Comp V2",
        "I²C (SDA/SCL)",
        "DRV2605L ROM + Amp",
        "Active-Brake-Treiber",
        "Haptik-Motor"
      ],
      "sq": [
        "K-Comp V2",
        "I²C (SDA/SCL)",
        "ROM + Amp DRV2605L",
        "Frenim aktiv",
        "Motori haptik"
      ]
    },
    "flowNote": {
      "en": "I²C bus: K-Comp triggers effect IDs (1–123) while the DRV2605L manages motor physics autonomously (address 0x5A).",
      "de": "I²C-Bus: K-Comp startet Effekt-IDs (1–123), während der DRV2605L die Motorphysik selbstständig steuert (Adresse 0x5A).",
      "sq": "Busi I²C: K-Comp nis efektet (1–123) ndërsa DRV2605L menaxhon fizikën e motorit vetë (adresa 0x5A)."
    },
    "extraTips": {
      "en": [
        "Always terminate multi-effect waveform sequences with VIBE_STOP (0) in the next slot, otherwise the motor keeps buzzing continuously."
      ],
      "de": [
        "Bei Effekt-Sequenzen immer mit VIBE_STOP (0) im nächsten Slot abschließen — sonst brummt der Motor endlos weiter."
      ],
      "sq": [
        "Përfundoni gjithmonë sekuencat e efekteve me VIBE_STOP (0) në slotin pasues, përndryshe motori vibron pa ndalur."
      ]
    }
  },
  "cardkb": {
    "dir": "in",
    "electrical": {
      "en": "Wiring 50 individual pushbuttons directly to a microcontroller would require dozens of pins. The CardKB solves this with a dedicated onboard ATmega8A keyboard controller scanning a compact row-and-column switch matrix. Whenever you press a key (including Shift or Sym/Fn combinations), the onboard chip debounces the contact, translates the key into its exact ASCII byte, and holds it ready until K-Comp reads it cleanly over the 2-wire I²C bus.",
      "de": "50 einzelne Tasten direkt am Mikrocontroller würden Dutzende Pins verbrauchen. Das CardKB löst das mit einem eigenen Tastatur-Controller auf der Platine, der eine Zeilen-Spalten-Matrix abtastet. Bei jedem Tastendruck (inkl. Shift- und Sym/Fn-Kombinationen) entprellt der Chip den Kontakt, wandelt die Taste direkt in das passende ASCII-Zeichen um und hält dieses Byte bereit, bis das K-Comp es über den Zweidraht-I²C-Bus abholt.",
      "sq": "Lidhja direkte e 50 butonave te mikrokontrolluesi do të kërkonte dhjetëra pina. CardKB e zgjidh këtë me një kontrollues të dedikuar ATmega8A në pllakë që skanon vazhdimisht matricën e rreshtave dhe kolonave të tasteve. Kur shtypni një tast (përfshirë Shift ose Sym/Fn), çipi filtron dridhjet e kontaktit, e kthen në kodin e saktë ASCII dhe e mban gati për lexim nga K-Comp përmes busit I²C."
    },
    "flow": {
      "en": [
        "Key Press",
        "50-Key Matrix",
        "Onboard MCU (ASCII)",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "de": [
        "Tastendruck",
        "50-Tasten-Matrix",
        "Tastatur-MCU (ASCII)",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ],
      "sq": [
        "Shtypja e tastit",
        "Matrica 50-taste",
        "MCU e tastierës (ASCII)",
        "I²C (SDA/SCL)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "I²C bus: plugs into H1–H3 via a 4-pin Grove cable; delivers ready-to-use ASCII characters (address 0x5F).",
      "de": "I²C-Bus: wird per 4-Pin-Grove-Kabel an H1–H3 gesteckt und liefert fertige ASCII-Zeichen (Adresse 0x5F).",
      "sq": "Busi I²C: lidhet te H1–H3 me kabllo Grove 4-pin dhe jep karaktere të gatshme ASCII (adresa 0x5F)."
    },
    "extraTips": {
      "en": [
        "Each key press returns 0 when idle — check for a non-zero character in loop() before appending to your text buffer."
      ],
      "de": [
        "Im Ruhezustand liefert das Keyboard den Wert 0 — in loop() daher nur Zeichen ungleich 0 verarbeiten."
      ],
      "sq": [
        "Kur nuk shtypet asnjë tast kthen 0 — kontrolloni në loop() që vlera të jetë e ndryshme nga 0 para përpunimit."
      ]
    }
  },
  "pn532": {
    "dir": "bi",
    "electrical": {
      "en": "The PN532 is a 13.56 MHz Near Field Communication (NFC) transceiver with a printed copper coil antenna around its PCB edge. When active, the antenna generates a short-range alternating magnetic field. Passive NFC cards and keyfobs contain no battery: when held within 2–4 cm, their internal coil harvests energy inductively from the magnetic field, wakes up their microchip, and modulates data back to the PN532, which exchanges packets with K-Comp over I²C.",
      "de": "Der PN532 ist ein 13,56-MHz-NFC-Transceiver mit einer als Kupferbahn auf die Platine gedruckten Spulenantenne. Im Betrieb erzeugt sie ein hochfrequentes magnetisches Nahfeld. Passive NFC-Karten und Schlüsselanhänger haben keine eigene Batterie: Kommen sie auf 2–4 cm heran, gewinnen sie über Induktion Strom aus diesem Magnetfeld, starten ihren Mikrochip und senden ihre UID oder Speicherdaten per Lastmodulation zurück an den PN532 und über I²C ans K-Comp.",
      "sq": "PN532 është një marrës-dhënës NFC 13.56 MHz me antenë spirale bakri të shtypur rreth skajit të pllakës. Kur është aktiv, antena gjeneron një fushë magnetike alternative me rreze të shkurtër. Kartat pasive NFC nuk kanë bateri: kur afrohen në 2–4 cm, bobina e tyre merr energji me induksion nga fusha magnetike, ndez çipin e brendshëm dhe shkëmben të dhëna me K-Comp përmes busit I²C."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "I²C (SDA/SCL)",
        "PN532 + Coil Antenna",
        "13.56 MHz Field",
        "Passive NFC Tag"
      ],
      "de": [
        "K-Comp V2",
        "I²C (SDA/SCL)",
        "PN532 + Spulenantenne",
        "13,56-MHz-Feld",
        "Passiver NFC-Tag"
      ],
      "sq": [
        "K-Comp V2",
        "I²C (SDA/SCL)",
        "PN532 + Antena",
        "Fusha 13.56 MHz",
        "Etiketa NFC"
      ]
    },
    "flowNote": {
      "en": "I²C bus (bidirectional): set the tiny onboard mode switches strictly to 1=ON, 2=OFF for I²C (address 0x24).",
      "de": "I²C-Bus (bidirektional): die kleinen Modus-Schalter auf der Platine zwingend auf 1=ON, 2=OFF für I²C stellen (Adresse 0x24).",
      "sq": "Busi I²C (dydrejtimësh): vendosni çelësat e vegjël në pllakë rreptësisht në 1=ON, 2=OFF për I²C (adresa 0x24)."
    },
    "extraTips": {
      "en": [
        "Do not place the module directly on a metal desk — metal detunes the 13.56 MHz antenna and blocks tag detection."
      ],
      "de": [
        "Das Modul nicht direkt auf eine Metallfläche legen — Metall verstimmt die 13,56-MHz-Antenne und verhindert die Tag-Erkennung."
      ],
      "sq": [
        "Mos e vendosni modulin direkt mbi sipërfaqe metalike — metali çakordon antenën 13.56 MHz dhe bllokon leximin."
      ]
    }
  },
  "gy-neo6m": {
    "dir": "in",
    "electrical": {
      "en": "The NEO-6M contains a ceramic patch antenna and an ultra-sensitive 1.575 GHz radio receiver listening for atomic-clock timestamps broadcast by GPS satellites 20,200 km overhead. By measuring nanosecond arrival-time differences from at least three to four satellites (trilateration), its internal processor calculates latitude, longitude, altitude, speed, and UTC time. It then streams standard text sentences (NMEA protocol at 9600 baud) over serial UART to K-Comp.",
      "de": "Das NEO-6M-Modul besitzt eine Keramik-Patch-Antenne und einen hochempfindlichen 1,575-GHz-Funkempfänger für Atomuhr-Zeitstempel von GPS-Satelliten in 20.200 km Höhe. Aus den winzigen Laufzeitunterschieden der Signale von mindestens drei bis vier Satelliten (Trilateration) berechnet der interne Prozessor Position, Höhe, Geschwindigkeit und Weltzeit (UTC). Anschließend sendet er standardisierte Textzeilen (NMEA-Protokoll, 9600 Baud) seriell per UART ans K-Comp.",
      "sq": "Moduli NEO-6M përmban një antenë qeramike dhe një marrës radio shumë të ndjeshëm 1.575 GHz që dëgjon sinjalet kohore nga satelitët GPS rreth Tokës. Duke llogaritur diferencat në nanosekonda të mbërritjes së sinjalit nga të paktën tre deri në katër satelitë (trilaterim), procesori i brendshëm gjen koordinatat, lartësinë, shpejtësinë dhe kohën UTC, duke i dërguar si tekst NMEA (9600 baud) përmes UART te K-Comp."
    },
    "flow": {
      "en": [
        "GPS Satellites",
        "Ceramic Antenna",
        "NEO-6M Receiver",
        "UART (9600 NMEA)",
        "K-Comp V2"
      ],
      "de": [
        "GPS-Satelliten",
        "Keramik-Antenne",
        "NEO-6M-Empfänger",
        "UART (9600 NMEA)",
        "K-Comp V2"
      ],
      "sq": [
        "Satelitët GPS",
        "Antena qeramike",
        "Marrësi NEO-6M",
        "UART (9600 NMEA)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "UART serial: always cross-wire TX → K-Comp RX and RX → K-Comp TX; feed the parser continuously in loop().",
      "de": "UART seriell: TX und RX immer über Kreuz verbinden (TX → K-Comp RX, RX → K-Comp TX) und Daten in loop() fortlaufend einlesen.",
      "sq": "UART serik: lidhni gjithmonë kryq TX → K-Comp RX dhe RX → K-Comp TX; lexoni vazhdimisht në loop()."
    },
    "extraTips": {
      "en": [
        "First cold start takes 30–90 seconds to lock satellites; a blinking LED on the GPS module confirms a valid 3D fix."
      ],
      "de": [
        "Der erste Kaltstart dauert 30–90 Sekunden; eine blinkende LED am GPS-Modul signalisiert einen gültigen Satelliten-Fix."
      ],
      "sq": [
        "Nisja e parë kërkon 30–90 sekonda për sinjalin satelitor; LED-i që pulson tregon se pozicioni është fiksuar."
      ]
    }
  },
  "ch9329": {
    "dir": "out",
    "electrical": {
      "en": "The K-Comp’s ATmega328P cannot natively pretend to be a USB mouse or keyboard. The CH9329 bridges that gap: it acts as a dedicated UART-to-USB-HID translator chip. K-Comp sends structured binary command packets at 9600 baud over two digital pins (SoftwareSerial TX/RX). The CH9329 decodes those commands and sends official USB Human Interface Device reports to your laptop, which immediately reacts as if a real mouse or keyboard were plugged in.",
      "de": "Der ATmega328P des K-Comp kann sich gegenüber einem PC nicht selbst als USB-Maus oder Tastatur ausgeben. Der CH9329 schließt diese Lücke als spezieller UART-zu-USB-HID-Übersetzer: Das K-Comp sendet strukturierte Befehlspakete mit 9600 Baud über zwei Digitalpins (SoftwareSerial TX/RX). Der CH9329 wandelt diese in normierte USB-HID-Berichte um — dein Notebook reagiert sofort, als wäre eine echte Maus oder Tastatur eingesteckt.",
      "sq": "ATmega328P i K-Comp nuk mund të sillet vetë si maus apo tastierë USB. Çipi CH9329 shërben si përkthyes i dedikuar UART-në-USB-HID: K-Comp dërgon paketa komandash me 9600 baud përmes dy pinave dixhitalë (SoftwareSerial TX/RX), dhe CH9329 i shndërron ato në raporte standarde USB HID që kompjuteri i njeh menjëherë si maus dhe tastierë."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "UART (9600 Crossed)",
        "CH9329 HID Chip",
        "USB HID Packets",
        "PC Mouse / Keys"
      ],
      "de": [
        "K-Comp V2",
        "UART (9600 gekreuzt)",
        "CH9329 HID-Chip",
        "USB-HID-Pakete",
        "PC-Maus / Tastatur"
      ],
      "sq": [
        "K-Comp V2",
        "UART (9600 kryq)",
        "Çipi HID CH9329",
        "Paketa USB HID",
        "Maus / Tastierë PC"
      ]
    },
    "flowNote": {
      "en": "UART serial: cross-wire TX ↔ RX (Mode 0, 9600 baud) and use a START-button safety clutch so you never lose mouse control.",
      "de": "UART seriell: TX ↔ RX über Kreuz verbinden (Modus 0, 9600 Baud) und einen START-Totmannschalter einbauen, um die Mauskontrolle zu behalten.",
      "sq": "UART serik: lidhni kryq TX ↔ RX (Modaliteti 0, 9600 baud) dhe përdorni butonin START si siguresë për mausin."
    },
    "extraTips": {
      "en": [
        "Always call releaseAll() after key-combination macros (like Ctrl+C), otherwise the target PC thinks the modifier key is stuck down!"
      ],
      "de": [
        "Nach Tastenkombinationen (z. B. Strg+C) unbedingt releaseAll() aufrufen — sonst glaubt der PC, die Taste bleibt dauerhaft gedrückt!"
      ],
      "sq": [
        "Thërrisni gjithmonë releaseAll() pas kombinimeve të tasteve, përndryshe kompjuteri mendon se tasti ka mbetur i shtypur!"
      ]
    }
  },
  "as608": {
    "dir": "bi",
    "electrical": {
      "en": "The AS608 is an optical biometric scanner with its own built-in Digital Signal Processor (DSP) and flash storage. When a finger touches the glass prism, a bright internal LED illuminates the skin ridges and valleys so a miniature camera captures the pattern. The onboard DSP extracts mathematical feature points (minutiae) into a 512-byte template and matches it against stored IDs inside the sensor — keeping heavy image processing off K-Comp’s 2 KB SRAM and exchanging only compact UART packets.",
      "de": "Der AS608 ist ein optischer Fingerabdruckscanner mit eigenem Signalprozessor (DSP) und Flash-Speicher. Liegt ein Finger auf dem Glasprisma, beleuchtet eine helle LED die Hautrillen und eine Mini-Kamera nimmt das Muster auf. Der interne DSP extrahiert charakteristische Merkmale (Minutien) als 512-Byte-Modell und vergleicht sie direkt im Sensor — das schont die 2 KB SRAM des K-Comp, das nur kompakte Befehle per UART austauscht.",
      "sq": "AS608 është një skaner optik biometrik me procesor të brendshëm DSP dhe memorie flash. Kur gishti prek prizmin e qelqit, një LED ndriçon vijat e gishtit dhe kamera e brendshme i regjistron. DSP-ja i kthen në model matematik 512-byte dhe i krahason vetë brenda sensorit, duke dërguar vetëm paketa të shkurtra UART te K-Comp."
    },
    "flow": {
      "en": [
        "Finger on Prism",
        "LED + Optical Sensor",
        "AS608 DSP + Flash",
        "UART (3.3V Crossed)",
        "K-Comp V2"
      ],
      "de": [
        "Finger am Prisma",
        "LED + Optik-Sensor",
        "AS608 DSP + Flash",
        "UART (3.3V gekreuzt)",
        "K-Comp V2"
      ],
      "sq": [
        "Gishti mbi prizëm",
        "LED + Sensor optik",
        "DSP + Flash AS608",
        "UART (3.3V kryq)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "UART serial (bidirectional): strictly 3.3V power! Cross TX ↔ RX and keep jumper wires short.",
      "de": "UART seriell (bidirektional): streng an 3.3V anschließen! TX ↔ RX über Kreuz verbinden und Kabel kurz halten.",
      "sq": "UART serik (dydrejtimësh): rreptësisht 3.3V! Lidhni kryq TX ↔ RX dhe mbajini telat e shkurtër."
    },
    "extraTips": {
      "en": [
        "Never wire VCC to 5V — the AS608 silicon operates strictly at 3.3V and draws up to ~120 mA while scanning."
      ],
      "de": [
        "VCC niemals an 5V anschließen — der AS608 läuft strikt mit 3,3V und zieht beim Scannen kurzzeitig bis zu ~120 mA."
      ],
      "sq": [
        "Mos e lidhni kurrë VCC me 5V — çipi AS608 punon rreptësisht në 3.3V dhe tërheq deri në ~120 mA gjatë skanimit."
      ]
    }
  },
  "ld2410c": {
    "dir": "in",
    "electrical": {
      "en": "Unlike passive infrared (PIR) motion detectors that only trigger on moving heat, the LD2410C is a 24 GHz millimeter-wave FMCW (Frequency-Modulated Continuous-Wave) radar. Its planar patch antenna transmits low-power radio waves in a ~60° cone and analyzes tiny frequency shifts in the returning echoes. It detects both walking motion and microscopic chest movements of a stationary breathing person — even through plastic or thin wood enclosures — and streams distance/presence frames over UART.",
      "de": "Anders als einfache PIR-Bewegungsmelder ist der LD2410C ein 24-GHz-Millimeterwellen-Radar (FMCW-Verfahren wie in modernen Autos). Seine Patch-Antenne sendet schwache Funkwellen in einem ca. 60°-Kegel aus und wertet feinste Frequenzverschiebungen der Echos aus. So erkennt er nicht nur Bewegungen, sondern sogar die minimale Atembewegung still sitzender Personen — auch durch Kunststoff oder dünnes Holz — und sendet Distanz- und Präsenzdaten per UART.",
      "sq": "Ndryshe nga sensorët pasivë infra të kuq (PIR) që zbulojnë vetëm lëvizje të mëdha, LD2410C është një radar 24 GHz FMCW me valë milimetrike. Antena e tij lëshon valë radio me fuqi të ulët në një kon ~60° dhe analizon jehonat kthyese, duke zbuluar si lëvizjen ashtu edhe lëvizjet e imëta të kraharorit gjatë frymëmarrjes — madje edhe përmes plastikës ose drurit të hollë — duke dërguar korniza të dhënash përmes UART."
    },
    "flow": {
      "en": [
        "Human / Breathing",
        "24 GHz FMCW Radar",
        "Onboard Radar DSP",
        "UART (9600 Crossed)",
        "K-Comp V2"
      ],
      "de": [
        "Person / Atmung",
        "24-GHz-FMCW-Radar",
        "Interner Radar-DSP",
        "UART (9600 gekreuzt)",
        "K-Comp V2"
      ],
      "sq": [
        "Person / Frymëmarrje",
        "Radar 24 GHz FMCW",
        "DSP i radarit",
        "UART (9600 kryq)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "UART serial: cross TX ↔ RX and configure module to 9600 baud (factory 256000 baud is too fast for SoftwareSerial).",
      "de": "UART seriell: TX ↔ RX über Kreuz verbinden und Modul auf 9600 Baud umstellen (Werkseinstellung 256000 Baud ist zu schnell für SoftwareSerial).",
      "sq": "UART serik: lidhni kryq TX ↔ RX dhe vendosni modulin në 9600 baud (256000 baud e fabrikës është shumë shpejt për SoftwareSerial)."
    },
    "extraTips": {
      "en": [
        "If the Bluetooth phone app no longer connects after switching to 9600 baud, that is normal — the HLKRadarTool app expects 256000 baud."
      ],
      "de": [
        "Nach dem Umstellen auf 9600 Baud verbindet sich die Smartphone-App nicht mehr (sie erwartet 256000 Baud) — beide lassen sich nicht gleichzeitig nutzen."
      ],
      "sq": [
        "Pas kalimit në 9600 baud aplikacioni Bluetooth nuk lidhet më (kërkon 256000 baud) — nuk mund të përdoren njëkohësisht."
      ]
    }
  },
  "ld2450": {
    "dir": "in",
    "electrical": {
      "en": "The HLK-LD2450 is a 24 GHz multi-target millimeter-wave radar with multiple receiving antenna elements. By comparing both echo flight time (distance) and tiny phase differences between its antennas (angle of arrival), its onboard radar processor tracks the live 2D X/Y coordinates and speed of up to three moving people simultaneously within a 6-meter fan. It packages these live target coordinates into binary frames transmitted continuously over serial UART.",
      "de": "Der HLK-LD2450 ist ein 24-GHz-Mehrpersonen-Radar mit mehreren Empfangsantennen. Durch Auswerten von Signallaufzeit (Entfernung) und feinsten Phasenunterschieden zwischen den Antennen (Einfallswinkel) berechnet sein interner Prozessor gleichzeitig die 2D-X/Y-Koordinaten und Geschwindigkeit von bis zu drei sich bewegenden Personen im 6-Meter-Bereich. Die fertigen Zielkoordinaten werden laufend als kompakte Datenpakete über serielles UART gesendet.",
      "sq": "HLK-LD2450 është një radar 24 GHz për shumë objektiva me disa antena marrëse në pllakë. Duke krahasuar kohën e kthimit të jehonës (distancën) dhe diferencat e vogla të fazës midis antenave (këndin e mbërritjes), procesori i brendshëm i radarit gjurmon koordinatat 2D X/Y dhe shpejtësinë deri në tre persona në lëvizje brenda 6 metrave, duke i dërguar kornizat vazhdimisht përmes lidhjes serike UART."
    },
    "flow": {
      "en": [
        "Up to 3 Targets",
        "24 GHz Multi-Antenna",
        "X/Y Radar DSP",
        "UART (Crossed)",
        "K-Comp V2"
      ],
      "de": [
        "Bis zu 3 Personen",
        "24-GHz-Antennenarray",
        "X/Y-Radar-DSP",
        "UART (gekreuzt)",
        "K-Comp V2"
      ],
      "sq": [
        "Deri 3 persona",
        "Antena 24 GHz",
        "DSP X/Y i radarit",
        "UART (kryq)",
        "K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "UART serial: cross TX ↔ RX; lower baud rate to ≤19200 for reliable reception on the ATmega328P.",
      "de": "UART seriell: TX ↔ RX über Kreuz verbinden; Baudrate für stabilen ATmega328P-Empfang auf ≤19200 senken.",
      "sq": "UART serik: lidhni kryq TX ↔ RX; ulni baud rate në ≤19200 për lexim të qëndrueshëm në ATmega328P."
    },
    "extraTips": {
      "en": [
        "Mount the radar upright facing the room with no metal plates directly in front of the golden patch antennas."
      ],
      "de": [
        "Modul aufrecht in Richtung Raum montieren und keine Metallteile direkt vor den goldenen Patch-Antennen platzieren."
      ],
      "sq": [
        "Montojeni radarin drejt dhomës pa objekte metalike direkt përpara antenave të arta."
      ]
    }
  },
  "hc12": {
    "dir": "bi",
    "electrical": {
      "en": "Think of two HC-12 modules as walkie-talkies for digital text. When K-Comp sends characters as electrical 1s and 0s over the TX wire at 9600 baud, the HC-12’s radio chip modulates them onto a 433 MHz electromagnetic carrier wave and broadcasts it through the copper spring antenna. Across the room or schoolyard, a second HC-12 catches those faint ripples, demodulates them back into clean serial pulses, and feeds them into the receiving K-Comp’s RX pin.",
      "de": "Zwei HC-12-Module funktionieren wie Walkie-Talkies für digitalen Text. Sendet das K-Comp Zeichen als elektrische 1/0-Pulse mit 9600 Baud über TX, moduliert der Funkchip diese Daten auf eine 433-MHz-Funkwelle und strahlt sie über die Kupfer-Federantenne ab. Auf der Gegenseite fängt ein zweites HC-12-Modul die Wellen auf, demoduliert sie zurück in saubere serielle Impulse und reicht sie über den RX-Pin ans zweite K-Comp weiter.",
      "sq": "Dy module HC-12 funksionojnë si radiomarrës-dhënës (walkie-talkie) për tekst dixhital. Kur K-Comp dërgon 1 dhe 0 me 9600 baud te TX, çipi radio i modulon në valë 433 MHz përmes antenës spirale. Një HC-12 i dytë i kap këto valë, i kthen sërish në pulse serike dhe i dërgon në pinin RX të K-Comp tjetër."
    },
    "flow": {
      "en": [
        "K-Comp A",
        "UART (9600 Crossed)",
        "HC-12 + 433 MHz Antenna",
        "Radio Waves",
        "HC-12 → K-Comp B"
      ],
      "de": [
        "K-Comp A",
        "UART (9600 gekreuzt)",
        "HC-12 + 433-MHz-Antenne",
        "Funkwellen",
        "HC-12 → K-Comp B"
      ],
      "sq": [
        "K-Comp A",
        "UART (9600 kryq)",
        "HC-12 + Antena 433 MHz",
        "Valë radio",
        "HC-12 → K-Comp B"
      ]
    },
    "flowNote": {
      "en": "UART serial (bidirectional): requires 2 K-Comp boards to test; cross TXD → K-Comp RX and RXD → K-Comp TX.",
      "de": "UART seriell (bidirektional): zum Testen sind 2 K-Comp-Boards nötig; TXD → K-Comp RX und RXD → K-Comp TX kreuzen.",
      "sq": "UART serik (dydrejtimësh): kërkon 2 pllaka K-Comp për testim; lidhni kryq TXD → RX dhe RXD → TX."
    },
    "extraTips": {
      "en": [
        "When testing with a terminal, enable CR+LF (newline \\n) so line-based receive functions know when a message ends."
      ],
      "de": [
        "Im Serial Monitor Zeilenende (NL / CR+LF) aktivieren, damit zeilenbasierte Empfangsfunktionen das Nachrichtenende erkennen."
      ],
      "sq": [
        "Aktivizoni CR+LF (rresht i ri \\n) në terminal që funksionet e pranimit të dallojnë fundin e mesazhit."
      ]
    }
  },
  "hc05": {
    "dir": "bi",
    "electrical": {
      "en": "The HC-05 is a classic 2.4 GHz Bluetooth Serial Port Profile (SPP) wireless bridge. Internally, its radio transceiver converts standard 9600-baud UART text bytes from K-Comp into frequency-hopping Bluetooth packets paired with a smartphone or laptop, and reverses the process for incoming commands. Plugging it straight into the dedicated K-Comp onboard Bluetooth slot connects power and routes TX/RX cleanly to pins D6 and D7 via DIP switches S1-7 and S1-8.",
      "de": "Das HC-05-Modul ist eine klassische 2,4-GHz-Bluetooth-Seriellbrücke (SPP). Sein Funkchip wandelt normale 9600-Baud-UART-Zeichen vom K-Comp in verschlüsselte Bluetooth-Funkpakete für Smartphone oder PC um — und umgekehrt für empfangene Befehle. Durch direktes Einstecken in den K-Comp-Onboard-Steckplatz werden Stromversorgung sowie die gekreuzten TX/RX-Leitungen über die DIP-Schalter S1-7 und S1-8 sauber auf D6 und D7 geschaltet.",
      "sq": "HC-05 është një urë serike Bluetooth 2.4 GHz. Çipi i tij radio kthen bajtet serike UART 9600 baud nga K-Comp në paketa Bluetooth për telefonin ose kompjuterin dhe anasjelltas. Futja direkte në slotin e integruar të K-Comp lidh automatikisht ushqimin dhe linjat TX/RX te D6/D7 përmes çelësave DIP S1-7 dhe S1-8."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "Slot D6/D7 (S1-7,8)",
        "HC-05 Bluetooth Chip",
        "2.4 GHz Radio",
        "Smartphone / PC"
      ],
      "de": [
        "K-Comp V2",
        "Slot D6/D7 (S1-7,8)",
        "HC-05 Bluetooth-Chip",
        "2,4-GHz-Funk",
        "Smartphone / PC"
      ],
      "sq": [
        "K-Comp V2",
        "Sloti D6/D7 (S1-7,8)",
        "Çipi Bluetooth HC-05",
        "Radio 2.4 GHz",
        "Smartphone / PC"
      ]
    },
    "flowNote": {
      "en": "Onboard Wireless Slot (bidirectional): no jumper wires required — simply flip DIP S1-7 and S1-8 ON.",
      "de": "Onboard-Wireless-Slot (bidirektional): keine Jumper-Kabel nötig — einfach DIP S1-7 und S1-8 auf ON stellen.",
      "sq": "Sloti i integruar Wireless (dydrejtimësh): nuk duhen tela jumper — vetëm ndizni DIP S1-7 dhe S1-8."
    },
    "extraTips": {
      "en": [
        "If typed messages from a phone app are ignored, enable \"CR+LF\" (newline) in the Bluetooth terminal app settings."
      ],
      "de": [
        "Werden gesendete Texte aus der Smartphone-App ignoriert, in den App-Einstellungen Zeilenende „CR+LF“ aktivieren."
      ],
      "sq": [
        "Nëse teksti nga aplikacioni i telefonit injorohet, aktivizoni \"CR+LF\" në cilësimet e terminalit Bluetooth."
      ]
    }
  },
  "esp8266": {
    "dir": "bi",
    "electrical": {
      "en": "The ESP-01 houses a 32-bit ESP8266 Wi-Fi system-on-chip with a built-in 2.4 GHz PCB trace antenna. Rather than running TCP/IP networking inside K-Comp’s tiny 2 KB RAM, K-Comp sends simple serial AT commands over pins D6/D7 via DIP S1-7 and S1-8. On the K-Comp PCB, the LD1117V33 regulator powers the module strictly at 3.3V, while an onboard resistor voltage divider safely drops K-Comp’s 5V transmit signal down to 3.3V for the ESP-01 RX input.",
      "de": "Auf dem ESP-01 sitzt ein 32-Bit-ESP8266-WLAN-Chip samt gedruckter 2,4-GHz-Platinenantenne. Statt das gesamte Netzwerkprotokoll im knappen 2-KB-RAM des K-Comp abzubilden, sendet das K-Comp einfache serielle AT-Befehle über D6/D7 (via S1-7 und S1-8). Der Onboard-Spannungsregler LD1117V33 versorgt den Steckplatz sauber mit 3,3V, und ein eingebauter Widerstandsspannungsteiler senkt das 5V-Sendesignal des K-Comp sicher auf 3,3V für den ESP-01-Eingang.",
      "sq": "ESP-01 përmban një çip 32-bit Wi-Fi ESP8266 me antenë 2.4 GHz të shtypur në pllakë. Në vend që protokolli i rrjetit të zërë 2 KB RAM të K-Comp, K-Comp dërgon komanda serike AT përmes D6/D7 (via S1-7 dhe S1-8). Rregullatori i integruar e ushqen saktësisht me 3.3V dhe ndarësi i rezistencave ul sinjalin 5V në 3.3V për siguri."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "Slot D6/D7 (3.3V Divider)",
        "ESP-01 Wi-Fi SoC",
        "2.4 GHz Wi-Fi",
        "Network / Server"
      ],
      "de": [
        "K-Comp V2",
        "Slot D6/D7 (3,3V-Teiler)",
        "ESP-01 WLAN-SoC",
        "2,4-GHz-WLAN",
        "Netzwerk / Server"
      ],
      "sq": [
        "K-Comp V2",
        "Sloti D6/D7 (3.3V)",
        "Çipi Wi-Fi ESP-01",
        "Wi-Fi 2.4 GHz",
        "Rrjeti / Serveri"
      ]
    },
    "flowNote": {
      "en": "Onboard Wireless Slot (bidirectional): plugs directly into the 8-pin ESP-01 socket with DIP S1-7 & S1-8 ON.",
      "de": "Onboard-Wireless-Slot (bidirektional): wird direkt in die 8-Pin-ESP-01-Buchse gesteckt (DIP S1-7 & S1-8 ON).",
      "sq": "Sloti i integruar Wireless (dydrejtimësh): futet direkt në bazën 8-pin ESP-01 me DIP S1-7 dhe S1-8 ON."
    },
    "extraTips": {
      "en": [
        "Wi-Fi transmission causes brief current bursts up to ~200 mA — make sure your USB power supply is stable."
      ],
      "de": [
        "Beim WLAN-Senden entstehen kurze Stromspitzen bis ~200 mA — auf eine stabile USB-Stromversorgung achten."
      ],
      "sq": [
        "Transmetimi Wi-Fi krijon kulme rryme deri ~200 mA — sigurohuni që furnizimi USB të jetë i qëndrueshëm."
      ]
    }
  },
  "sg90-180": {
    "dir": "out",
    "electrical": {
      "en": "Inside the compact blue housing sit a DC motor, a nylon reduction gearbox, a built-in potentiometer wired to the output shaft, and a miniature control circuit. Instead of varying voltage, K-Comp sends a repeating 50 Hz Pulse-Width Modulation (PWM) signal every 20 ms on the orange wire. A 1.0 ms pulse commands 0°, 1.5 ms centers at 90°, and 2.0 ms drives to 180°. The internal controller constantly compares shaft feedback against the pulse width and locks the arm in place.",
      "de": "Im kleinen blauen Gehäuse stecken ein Gleichstrommotor, ein Kunststoff-Untersetzungsgetriebe, ein Rückmelde-Potentiometer an der Abtriebsachse und eine kleine Regelelektronik. Das K-Comp sendet alle 20 ms (50 Hz) einen kurzen PWM-Impuls über das orange Kabel: ~1,0 ms bedeutet 0°, ~1,5 ms entspricht 90° (Mitte) und ~2,0 ms fährt auf 180°. Der interne Regler vergleicht ständig Ist- und Soll-Winkel und hält den Arm exakt in Position.",
      "sq": "Brenda kutisë blu ndodhen një motor DC, ingranazhe najloni, një potenciometër matës në bosht dhe një qark kontrolli. K-Comp dërgon një sinjal PWM 50 Hz çdo 20 ms në telin portokalli: 1.0 ms jep 0°, 1.5 ms jep 90° dhe 2.0 ms jep 180°. Kontrolluesi i brendshëm krahason vazhdimisht këndin real dhe e mban krahun të fiksuar."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "PWM Pulse (1–2 ms)",
        "Servo Controller",
        "DC Motor + Gearbox",
        "Exact Angle (0°–180°)"
      ],
      "de": [
        "K-Comp V2",
        "PWM-Puls (1–2 ms)",
        "Servo-Regler",
        "DC-Motor + Getriebe",
        "Zielwinkel (0°–180°)"
      ],
      "sq": [
        "K-Comp V2",
        "Puls PWM (1–2 ms)",
        "Kontrolluesi i servos",
        "Motor DC + Ingranazhe",
        "Këndi i saktë (0°–180°)"
      ]
    },
    "flowNote": {
      "en": "PWM output: connect the orange signal wire to any hardware PWM pin (~D3, ~D5, ~D6, ~D9, ~D10, ~D11).",
      "de": "PWM-Ausgang: orange Signalleitung an einen beliebigen PWM-Pin (~D3, ~D5, ~D6, ~D9, ~D10, ~D11) anschließen.",
      "sq": "Dalje PWM: lidhni telin portokalli te çdo pin PWM (~D3, ~D5, ~D6, ~D9, ~D10, ~D11)."
    },
    "extraTips": {
      "en": [
        "Use setServoAngle() for 180° servos — speed commands meant for 360° continuous servos are safely ignored by the library."
      ],
      "de": [
        "Für 180°-Servos setServoAngle() verwenden — Geschwindigkeitsbefehle für 360°-Servos werden von der Bibliothek als Schutz ignoriert."
      ],
      "sq": [
        "Përdorni setServoAngle() për servot 180° — komandat e shpejtësisë për 360° injorohen automatikisht nga biblioteka."
      ]
    }
  },
  "sg90-360": {
    "dir": "out",
    "electrical": {
      "en": "A 360° continuous-rotation SG90 uses the same 50 Hz PWM pulse signal on the orange wire as a standard servo, but its mechanical stop is removed and its internal feedback potentiometer is fixed at center. Because the internal controller always thinks the shaft is at 90°, a 1.5 ms pulse (value 90) holds the motor stopped. Shorter pulses (<90) spin it progressively faster in one direction, while longer pulses (>90) spin it faster in the opposite direction — ideal for compact robot wheels.",
      "de": "Ein 360°-Endlosservo nutzt dasselbe 50-Hz-PWM-Signal am orangen Kabel, besitzt aber keinen mechanischen Anschlag und ein fest auf Mittelstellung fixiertes Rückmelde-Potentiometer. Da die Elektronik stets glaubt, auf 90° zu stehen, bedeutet ein 1,5-ms-Puls (90) Stillstand. Kürzere Pulse (<90) drehen den Motor stufenlos schneller in die eine Richtung, längere Pulse (>90) in die Gegenrichtung — ideal als kompakter Radantrieb.",
      "sq": "Një servo 360° me rrotullim të vazhdueshëm përdor të njëjtin sinjal PWM 50 Hz në telin portokalli, por pa ndalesë mekanike dhe me potenciometër të fiksuar në qendër. Një puls 1.5 ms (90) e ndalon motorin, pulset më të shkurtra (<90) e rrotullojnë në një drejtim dhe pulset më të gjata (>90) në drejtimin e kundërt."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "PWM Pulse (1–2 ms)",
        "Servo Controller",
        "DC Motor + Gearbox",
        "Continuous Rotation"
      ],
      "de": [
        "K-Comp V2",
        "PWM-Puls (1–2 ms)",
        "Servo-Regler",
        "DC-Motor + Getriebe",
        "Endlos-Drehung"
      ],
      "sq": [
        "K-Comp V2",
        "Puls PWM (1–2 ms)",
        "Kontrolluesi i servos",
        "Motor DC + Ingranazhe",
        "Rrotullim i vazhdueshëm"
      ]
    },
    "flowNote": {
      "en": "PWM output: pulse width controls rotation speed and direction (cannot hold a specific degree angle).",
      "de": "PWM-Ausgang: die Pulsbreite steuert Drehrichtung und Geschwindigkeit (hält keinen festen Gradwinkel).",
      "sq": "Dalje PWM: gjerësia e pulsit kontrollon shpejtësinë dhe drejtimin (nuk mban një kënd fiks)."
    },
    "extraTips": {
      "en": [
        "Use setServoSpeed() for 360° servos — angle commands meant for 180° servos are blocked by the library to prevent unexpected spinning."
      ],
      "de": [
        "Für 360°-Servos setServoSpeed() nutzen — Winkelbefehle für 180°-Servos werden von der Bibliothek bewusst geblockt."
      ],
      "sq": [
        "Përdorni setServoSpeed() për servot 360° — komandat e këndit për 180° bllokohen nga biblioteka për të shmangur rrotullimin e gabuar."
      ]
    }
  },
  "hcsr04-sg90": {
    "dir": "bi",
    "electrical": {
      "en": "This radar combo unites two distinct principles on one mount: an SG90 positional servo sweeps the sensor across 0°–180° using 50 Hz PWM pulses, while the HC-SR04 ultrasonic module measures distance at each angle. Sending a 10 µs HIGH trigger pulse causes the left transducer to emit eight 40 kHz sound bursts. The right transducer catches the returning echo and outputs a HIGH pulse whose duration in microseconds directly gives distance via (Time × 343 m/s) / 2.",
      "de": "Diese Radar-Kombination vereint zwei Prinzipien auf einer Halterung: Ein SG90-Servo schwenkt den Kopf per 50-Hz-PWM-Impulsen von 0° bis 180°, während der Ultraschallsensor HC-SR04 an jedem Winkel die Entfernung misst. Ein 10-µs-Startpuls an TRIG sendet acht 40-kHz-Schallimpulse aus; der Empfänger misst das Echo und liefert an ECHO einen HIGH-Puls, aus dessen Mikrosekunden-Dauer sich die Distanz per (Zeit × 343 m/s) / 2 ergibt.",
      "sq": "Ky kombinim radari bashkon dy parime elektrike në një mbajtëse: servoja SG90 lëviz kokën nga 0° në 180° përmes impulseve PWM 50 Hz, ndërsa sensori ultrasonik HC-SR04 mat distancën në çdo kënd. Një impuls 10 µs në pinin TRIG lëshon tetë valë zanore 40 kHz, dhe kohëzgjatja e impulsit kthyes HIGH në ECHO lejon K-Comp të llogarisë distancën përmes formulës (Koha × 343 m/s) / 2."
    },
    "flow": {
      "en": [
        "K-Comp V2 (PWM + TRIG)",
        "SG90 Sweep + 40 kHz Sound",
        "Object Echo",
        "ECHO Pulse Width",
        "Distance Map (K-Comp)"
      ],
      "de": [
        "K-Comp V2 (PWM + TRIG)",
        "SG90-Schwenk + 40-kHz-Schall",
        "Objekt-Echo",
        "ECHO-Pulsdauer",
        "Distanzkarte (K-Comp)"
      ],
      "sq": [
        "K-Comp V2 (PWM + TRIG)",
        "Lëvizje SG90 + Tingull 40 kHz",
        "Jehona e objektit",
        "Gjerësia e ECHO",
        "Harta e distancës"
      ]
    },
    "flowNote": {
      "en": "Combined PWM + Digital I/O: PWM sweeps the servo; TRIG (output) and ECHO (input) measure sound flight time.",
      "de": "Kombiniertes PWM + Digital-I/O: PWM schwenkt den Servo; TRIG (Ausgang) und ECHO (Eingang) messen die Schalllaufzeit.",
      "sq": "PWM + I/O Dixhitale: PWM lëviz servon; TRIG (dalje) dhe ECHO (hyrje) matin kohën e udhëtimit të tingullit."
    },
    "extraTips": {
      "en": [
        "Soft fabrics absorb ultrasound and sharply angled walls reflect sound away — wait ~30–50 ms between pings to avoid ghost echoes."
      ],
      "de": [
        "Weiche Stoffe schlucken Ultraschall und schräge Wände lenken ihn ab — zwischen zwei Messungen ~30–50 ms warten, um Geisterechos zu vermeiden."
      ],
      "sq": [
        "Pëlhurat e buta thithin tingullin dhe muret e pjerrëta e devijojnë — prisni ~30–50 ms midis matjeve për të shmangur jehonat fantazmë."
      ]
    }
  },
  "vib-motor": {
    "dir": "out",
    "electrical": {
      "en": "A flat coin DC motor with an off-center internal weight shakes whenever its shaft spins. Because spinning motors draw too much current for a microcontroller pin and generate reverse-voltage spikes when stopped, the breakout board includes a MOSFET transistor acting as an electronic switch plus a flyback protection diode. K-Comp drives the transistor gate with rapid 5V PWM pulses: higher duty cycles keep power on longer each millisecond, creating stronger vibration.",
      "de": "Im flachen Scheibenmotor dreht sich ein kleines Unwuchtgewicht und versetzt das Modul in Vibration. Da ein Motor zu viel Strom für einen Mikrocontroller-Pin zieht und beim Abschalten Spannungsspitzen erzeugt, sitzt auf der Platine ein MOSFET-Transistor als elektronischer Schalter samt Schutzdiode. Das K-Comp steuert diesen Schalter mit schnellen 5V-PWM-Pulsen: Je länger die Einschaltdauer pro Millisekunde (Duty Cycle), desto stärker die Vibration.",
      "sq": "Një motor i vogël DC me peshë të çekuilibruar krijon dridhje kur rrotullohet. Për të mbrojtur pinin e mikrokontrolluesit nga rryma e lartë dhe tensioni i kundërt, moduli ka një transistor MOSFET si çelës elektronik dhe diodë mbrojtëse. K-Comp e kontrollon me PWM 5V: sa më i lartë cikli i punës, aq më e fortë dridhja."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "PWM Duty Cycle",
        "MOSFET Switch",
        "5V Motor Current",
        "Unbalanced Vibration"
      ],
      "de": [
        "K-Comp V2",
        "PWM-Tastgrad",
        "MOSFET-Schalter",
        "5V-Motorstrom",
        "Unwucht-Vibration"
      ],
      "sq": [
        "K-Comp V2",
        "Sinjali PWM",
        "Çelësi MOSFET",
        "Rryma 5V e motorit",
        "Dridhja mekanike"
      ]
    },
    "flowNote": {
      "en": "PWM output: connect IN to any hardware PWM pin (~D3, ~D5, ~D6, ~D9, ~D10, ~D11) to adjust vibration strength.",
      "de": "PWM-Ausgang: IN an einen beliebigen PWM-Pin (~D3, ~D5, ~D6, ~D9, ~D10, ~D11) für stufenlose Vibrationsstärke.",
      "sq": "Dalje PWM: lidhni IN te çdo pin PWM (~D3, ~D5, ~D6, ~D9, ~D10, ~D11) për të rregulluar fuqinë e dridhjes."
    },
    "extraTips": {
      "en": [
        "Minimum startup intensity is ~80–100 (out of 255) to overcome internal friction; always call updateVibration() in loop() when using timed pulses."
      ],
      "de": [
        "Anlauf-Schwelle beachten: unter Intensität ~80–100 (von 255) brummt der Motor nur ohne anzulaufen; bei Zeitimpulsen updateVibration() in loop() aufrufen."
      ],
      "sq": [
        "Pragu minimal i nisjes është ~80–100 (nga 255) për të kapërcyer fërkimin; thërrisni updateVibration() në loop() për impulse me kohë."
      ]
    }
  },
  "dc-motor": {
    "dir": "out",
    "electrical": {
      "en": "Inside a brushed DC gearmotor, current flowing through copper armature coils inside a permanent-magnet stator generates electromagnetic torque (Lorentz force) that spins the shaft, while plastic reduction gears trade high RPM for usable wheel torque. Reversing current polarity reverses spin direction. Because startup stall currents reach 300–800 mA and inductive kickback voltages spike when stopping, a DC motor must never touch ATmega328P pins directly — it always connects through an H-bridge driver like the TB6612FNG.",
      "de": "Im Gleichstrom-Getriebemotor erzeugt Strom durch Kupferspulen im Feld eines Permanentmagneten ein Drehmoment (Lorentzkraft), das über ein Untersetzungsgetriebe kräftig ein Rad antreibt. Umpolen kehrt die Drehrichtung um. Da Anlaufströme 300–800 mA erreichen und beim Abschalten hohe Induktionsspannungen entstehen, darf ein DC-Motor niemals direkt an ATmega328P-Pins — er läuft zwingend über eine H-Brücke wie das TB6612FNG-Shield.",
      "sq": "Brenda motorit DC me ingranazhe, rryma në bobinat e bakrit brenda fushës së magnetit krijon moment rrotullues (forca e Lorencit), ndërsa ndërrimi i polaritetit kthen drejtimin. Për shkak të rrymave të larta të nisjes (300–800 mA) dhe tensionit induktiv, motori DC nuk lidhet kurrë direkt te pinat e ATmega328P, por gjithmonë përmes një ure-H si TB6612FNG."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "I²C → TB6612FNG",
        "External Battery (VM)",
        "H-Bridge Polarity/PWM",
        "Wheel Rotation"
      ],
      "de": [
        "K-Comp V2",
        "I²C → TB6612FNG",
        "Externe Batterie (VM)",
        "H-Brücke Polung/PWM",
        "Rad-Drehung"
      ],
      "sq": [
        "K-Comp V2",
        "I²C → TB6612FNG",
        "Bateri e jashtme (VM)",
        "Ura-H Polaritet/PWM",
        "Rrotullimi i rrotës"
      ]
    },
    "flowNote": {
      "en": "Driver-only actuator: wires exclusively to TB6612FNG motor outputs (A1/A2 or B1/B2), powered by an external battery pack.",
      "de": "Nur über Treiber: wird ausschließlich an die Motorausgänge (A1/A2 oder B1/B2) des TB6612FNG mit externer Batterie angeschlossen.",
      "sq": "Vetëm me draiver: lidhet ekskluzivisht te daljet e motorit (A1/A2 ose B1/B2) të TB6612FNG me bateri të jashtme."
    },
    "extraTips": {
      "en": [
        "If a robot wheel spins backwards compared to your code, simply swap its two wires at the TB6612FNG screw terminal."
      ],
      "de": [
        "Dreht ein Rad falsch herum, einfach die beiden Motorkabel an der Schraubklemme des TB6612FNG tauschen."
      ],
      "sq": [
        "Nëse një rrotë rrotullohet mbrapsht, thjesht ndërroni dy telat e saj te terminali i TB6612FNG."
      ]
    }
  },
  "mq135": {
    "dir": "in",
    "electrical": {
      "en": "Under the stainless-steel flame-arrestor mesh sits a heated tin-dioxide (SnO₂) semiconductor coating. An internal heater coil warms this layer to operating temperature (~150 mA from 5V). In clean air, oxygen molecules sit on the surface and keep its electrical resistance high. When volatile organic compounds (VOCs), CO₂-rich stale breath, or ammonia touch the hot surface, chemical reactions free electrons and lower the resistance — creating a higher analog voltage on AOUT read by K-Comp’s 10-bit ADC.",
      "de": "Unter dem Metallgitter sitzt eine beheizte Zinndioxid-Halbleiterschicht (SnO₂). Eine interne Heizspirale bringt sie auf Betriebstemperatur (~150 mA aus 5V). In frischer Luft bindet Sauerstoff Elektronen und hält den elektrischen Widerstand hoch. Treffen flüchtige organische Gase (VOCs) oder verbrauchte Raumluft auf die heiße Schicht, sinkt der Widerstand — über einen Spannungsteiler steigt die analoge Ausgangsspannung an AOUT, die der 10-Bit-ADC des K-Comp misst.",
      "sq": "Nën rrjetën metalike ndodhet një shtresë gjysmëpërçuese SnO₂ e ngrohur nga një rezistencë e brendshme (~150 mA në 5V). Në ajër të pastër rezistenca e saj mbetet e lartë. Kur gazet VOC ose ajri i ndenjur prekin shtresën e nxehtë, rezistenca bie dhe tensioni analog në AOUT rritet, duke u lexuar nga ADC 10-bit i K-Comp."
    },
    "flow": {
      "en": [
        "Stale Air / VOCs",
        "Heated SnO₂ Layer",
        "Resistance Drop",
        "Analog 0–5V (AOUT)",
        "K-Comp 10-bit ADC"
      ],
      "de": [
        "Raumluft / VOCs",
        "Heiz-SnO₂-Schicht",
        "Widerstand sinkt",
        "Analog 0–5V (AOUT)",
        "K-Comp 10-Bit-ADC"
      ],
      "sq": [
        "Ajër i ndenjur / VOC",
        "Shtresa e nxehtë SnO₂",
        "Rënia e rezistencës",
        "Analog 0–5V (AOUT)",
        "ADC 10-bit K-Comp"
      ]
    },
    "flowNote": {
      "en": "Analog input: connect AOUT to any free analog pin (A3 or A0 with S1-3 OFF); calibrate in fresh air.",
      "de": "Analogeingang: AOUT an einen freien Analog-Pin (A3 oder A0 mit S1-3 OFF) anschließen und an frischer Luft kalibrieren.",
      "sq": "Hyrje analoge: lidhni AOUT te një pin analog i lirë (A3 ose A0 me S1-3 OFF) dhe kalibrojeni në ajër të pastër."
    },
    "extraTips": {
      "en": [
        "Always calibrate the baseline in clean, fresh air after a 1–2 minute warm-up — cold readings drift heavily."
      ],
      "de": [
        "Basiswert nach 1–2 Minuten Aufwärmzeit immer an sauberer Frischluft kalibrieren — im kalten Zustand driften die Werte stark."
      ],
      "sq": [
        "Kalibroni gjithmonë bazën në ajër të pastër pas 1–2 minutash ngrohje — leximet e ftohta devijojnë ndjeshëm."
      ]
    }
  },
  "mq2": {
    "dir": "in",
    "electrical": {
      "en": "The MQ-2 contains a tiny ceramic tube coated with tin-dioxide (SnO₂) and warmed by an internal 5V heating coil (~150 mA). In clean air, its resistance stays high. When smoke, butane, propane, or methane molecules pass through the protective wire mesh and contact the heated catalyst, they reduce the sensor’s electrical resistance. Wired as a voltage divider on the module PCB, this resistance drop raises the analog voltage on AOUT (0–5V) for K-Comp’s ADC.",
      "de": "Im MQ-2 befindet sich ein kleines Keramikröhrchen mit Zinndioxid-Schicht (SnO₂), das von einer 5V-Heizspirale erwärmt wird (~150 mA). In sauberer Luft ist sein Widerstand hoch. Gelangen Rauch, Butan, Propan oder Methan durch das Schutzgitter an die heiße Schicht, sinkt der elektrische Widerstand deutlich. Über den Spannungsteiler auf der Modulplatine steigt dadurch die analoge Spannung an AOUT (0–5V) für den K-Comp-ADC.",
      "sq": "MQ-2 përmban një tub të vogël qeramik të veshur me shtresë gjysmëpërçuese SnO₂ dhe të ngrohur nga një spirale e brendshme 5V (~150 mA). Në ajër të pastër rezistenca e saj mbetet e lartë. Kur molekulat e tymit, butanit ose propanit kalojnë rrjetën mbrojtëse dhe prekin shtresën e nxehtë, rezistenca bie ndjeshëm dhe ndarësi i tensionit në pllakë rrit tensionin analog në AOUT (0–5V) për ADC-në e K-Comp."
    },
    "flow": {
      "en": [
        "Smoke / Gas",
        "Heated SnO₂ Element",
        "Voltage Divider",
        "Analog 0–5V (AOUT)",
        "K-Comp 10-bit ADC"
      ],
      "de": [
        "Rauch / Gas",
        "Heiz-SnO₂-Element",
        "Spannungsteiler",
        "Analog 0–5V (AOUT)",
        "K-Comp 10-Bit-ADC"
      ],
      "sq": [
        "Tym / Gaz",
        "Elementi i nxehtë SnO₂",
        "Ndarësi i tensionit",
        "Analog 0–5V (AOUT)",
        "ADC 10-bit K-Comp"
      ]
    },
    "flowNote": {
      "en": "Analog input: outputs a continuous 0–5V voltage proportional to combustible gas/smoke concentration.",
      "de": "Analogeingang: liefert eine stufenlose 0–5V-Spannung proportional zur Rauch-/Gaskonzentration.",
      "sq": "Hyrje analoge: jep një tension të vazhdueshëm 0–5V proporcional me përqendrimin e tymit/gazit."
    },
    "extraTips": {
      "en": [
        "Wait 1–2 minutes for the internal heater to stabilize before calibrating in clean air; watch total 5V USB mA if combining multiple MQ sensors."
      ],
      "de": [
        "Vor der Frischluft-Kalibrierung 1–2 Minuten aufwärmen lassen; bei mehreren MQ-Sensoren das 5V-USB-Stromlimit (500 mA) im Blick behalten."
      ],
      "sq": [
        "Prisni 1–2 minuta për ngrohje para kalibrimit në ajër të pastër; kontrolloni kufirin USB 500 mA kur përdorni disa sensorë MQ."
      ]
    }
  },
  "mq7": {
    "dir": "in",
    "electrical": {
      "en": "The MQ-7 is tuned chemically for carbon monoxide (CO) using a heated tin-dioxide (SnO₂) sensing layer inside a protective mesh cap. Powered from 5V (~150 mA), the internal heating coil keeps the semiconductor active so CO molecules reacting on its surface release charge carriers and lower its resistance. The breakout board converts this changing resistance through a fixed load resistor into a 0–5V analog signal on AOUT, which K-Comp samples with its 10-bit ADC.",
      "de": "Der MQ-7 ist chemisch auf Kohlenmonoxid (CO) abgestimmt und nutzt eine beheizte Zinndioxid-Schicht (SnO₂) unter dem Metallgitter (~150 mA an 5V). Treffen CO-Moleküle auf die heiße Halbleiteroberfläche, werden Ladungsträger freigesetzt und der elektrische Widerstand sinkt. Ein Lastwiderstand auf der Modulplatine bildet daraus einen Spannungsteiler und liefert an AOUT ein 0–5V-Analogsignal für den 10-Bit-ADC des K-Comp.",
      "sq": "MQ-7 është i përshtatur kimikisht për monoksidin e karbonit (CO) me një shtresë gjysmëpërçuese SnO₂ të ngrohur brenda kapakut mbrojtës (~150 mA në 5V). Kur molekulat CO reagojnë në sipërfaqen e nxehtë të katalizatorit, ato çlirojnë bartës ngarkese dhe ulin rezistencën elektrike të sensorit. Së bashku me rezistencën ngarkuese në pllakë, kjo krijon një sinjal analog 0–5V në AOUT për ADC-në 10-bit të K-Comp."
    },
    "flow": {
      "en": [
        "CO Gas",
        "Heated SnO₂ Layer",
        "Voltage Divider",
        "Analog 0–5V (AOUT)",
        "K-Comp 10-bit ADC"
      ],
      "de": [
        "CO-Gas",
        "Heiz-SnO₂-Schicht",
        "Spannungsteiler",
        "Analog 0–5V (AOUT)",
        "K-Comp 10-Bit-ADC"
      ],
      "sq": [
        "Gazi CO",
        "Shtresa e nxehtë SnO₂",
        "Ndarësi i tensionit",
        "Analog 0–5V (AOUT)",
        "ADC 10-bit K-Comp"
      ]
    },
    "flowNote": {
      "en": "Analog input: connects to a free analog pin (A3 or A0 with S1-3 OFF); warm-up required before calibration.",
      "de": "Analogeingang: wird an einen freien Analog-Pin (A3 oder A0 mit S1-3 OFF) angeschlossen; Aufwärmzeit vor Kalibrierung nötig.",
      "sq": "Hyrje analoge: lidhet te një pin analog i lirë (A3 ose A0 me S1-3 OFF); kërkon ngrohje para kalibrimit."
    },
    "extraTips": {
      "en": [
        "Do not touch the metal cap during operation — the heater becomes noticeably hot; calibrate baseline only in clean room air."
      ],
      "de": [
        "Metallkappe im Betrieb nicht anfassen — die Heizung wird spürbar heiß; Nullpunkt nur an sauberer Raumluft kalibrieren."
      ],
      "sq": [
        "Mos e prekni kapakun metalik gjatë punës — ngrohësi nxehet dukshëm; kalibroni bazën vetëm në ajër të pastër."
      ]
    }
  },
  "mq3": {
    "dir": "in",
    "electrical": {
      "en": "The MQ-3 detects ethanol and alcohol vapor using a heated tin-dioxide (SnO₂) semiconductor element tailored for high alcohol sensitivity. An internal 5V heater warms the sensing layer (~150 mA). When alcohol vapor drifts through the mesh onto the hot catalyst, oxidation lowers the sensor’s resistance dramatically. Together with the breakout board’s load resistor, this creates a rising 0–5V analog voltage at AOUT that K-Comp’s ADC converts into a 0–1023 digital reading.",
      "de": "Der MQ-3 erkennt Ethanol- und Alkoholdämpfe über eine speziell abgestimmte, beheizte Zinndioxid-Schicht (SnO₂, ~150 mA an 5V). Gelangt Alkoholdampf durch das Metallgitter auf die heiße Katalysatorfläche, sinkt der elektrische Widerstand stark ab. Zusammen mit dem Lastwiderstand auf der Platine entsteht an AOUT eine steigende 0–5V-Analogspannung, die der K-Comp-ADC in einen digitalen Messwert (0–1023) wandelt.",
      "sq": "MQ-3 zbulon avujt e etanolit dhe alkoolit me një element gjysmëpërçues SnO₂ të ngrohur nga një spirale e brendshme 5V (~150 mA). Kur avujt e alkoolit kalojnë përmes rrjetës metalike mbi sipërfaqen e nxehtë të katalizatorit, oksidimi ul ndjeshëm rezistencën elektrike të sensorit. Përmes ndarësit të tensionit në pllakën e modulit, kjo prodhon një tension analog në rritje 0–5V në AOUT që ADC-ja e K-Comp e kthen në vlerë dixhitale."
    },
    "flow": {
      "en": [
        "Alcohol Vapor",
        "Heated SnO₂ Layer",
        "Voltage Divider",
        "Analog 0–5V (AOUT)",
        "K-Comp 10-bit ADC"
      ],
      "de": [
        "Alkoholdampf",
        "Heiz-SnO₂-Schicht",
        "Spannungsteiler",
        "Analog 0–5V (AOUT)",
        "K-Comp 10-Bit-ADC"
      ],
      "sq": [
        "Avuj alkooli",
        "Shtresa e nxehtë SnO₂",
        "Ndarësi i tensionit",
        "Analog 0–5V (AOUT)",
        "ADC 10-bit K-Comp"
      ]
    },
    "flowNote": {
      "en": "Analog input: responds quickly to sanitizer vapor held nearby — always test vapor only, never liquid drops.",
      "de": "Analogeingang: reagiert rasch auf Desinfektionsmittel-Dampf in der Nähe — immer nur Dampf testen, niemals Flüssigkeit auftropfen.",
      "sq": "Hyrje analoge: reagon shpejt ndaj avujve të dezinfektantit — testoni vetëm avullin, kurrë pika lëngu."
    },
    "extraTips": {
      "en": [
        "After exposure to strong alcohol vapor, the sensor needs 15–30 seconds in fresh air to recover back to its clean baseline."
      ],
      "de": [
        "Nach starkem Alkoholdampf braucht der Sensor 15–30 Sekunden an frischer Luft, bis der Wert wieder auf das Ausgangsniveau fällt."
      ],
      "sq": [
        "Pas ekspozimit ndaj avujve të fortë, sensorit i duhen 15–30 sekonda në ajër të pastër për t’u kthyer në nivelin bazë."
      ]
    }
  },
  "soil-moisture": {
    "dir": "in",
    "electrical": {
      "en": "Unlike cheap resistive probes that pass DC current directly through wet dirt and rust away within days, this capacitive sensor seals its copper electrodes under waterproof solder mask. The two prongs act as plates of a capacitor surrounded by soil. Because water has a very high dielectric constant, wetter soil strongly increases capacitance. An onboard 555 timer oscillator converts that capacitance shift into a smooth analog voltage — where MORE water produces a LOWER output voltage.",
      "de": "Im Gegensatz zu einfachen Widerstandssonden, die Gleichstrom durch nasse Erde leiten und rasch korrodieren, sind die Kupferbahnen hier isoliert versiegelt. Die beiden Zinken wirken wie ein Kondensator im Boden: Da Wasser eine sehr hohe Dielektrizitätszahl besitzt, verändert Feuchtigkeit das elektrische Feld und erhöht die Kapazität. Ein 555-Timer-Chip auf der Platine wandelt das in eine analoge Spannung um — je FEUCHTER die Erde, desto NIEDRIGER die Spannung!",
      "sq": "Ndryshe nga sondat e lira rezistive që kalojnë rrymë direkte në dhe dhe ndryshken brenda pak ditësh, ky sensor kapacitiv mban elektrodat e bakrit të izoluara nën shtresë mbrojtëse. Dy krahët veprojnë si pllakat e një kondensatori në tokë: uji rrit fort konstantën dielektrike dhe kapacitetin. Një çip 555 Timer e kthen këtë ndryshim në tension analog — sa më i LAGËSHT dheu, aq më i ULËT tensioni në dalje!"
    },
    "flow": {
      "en": [
        "Soil Moisture",
        "PCB Capacitor Prongs",
        "555 Timer IC",
        "Analog Voltage (Inverted)",
        "K-Comp 10-bit ADC"
      ],
      "de": [
        "Bodenfeuchte",
        "PCB-Kondensator",
        "555-Timer-IC",
        "Analogspannung (invertiert)",
        "K-Comp 10-Bit-ADC"
      ],
      "sq": [
        "Lagështia e dheut",
        "Kondensatori PCB",
        "Çipi 555 Timer",
        "Tension analog (i përmbysur)",
        "ADC 10-bit K-Comp"
      ]
    },
    "flowNote": {
      "en": "Analog input: inverted voltage (dry = high ADC value, wet = low ADC value); the library maps it to 0–100%.",
      "de": "Analogeingang: invertierte Logik (trocken = hoher Messwert, nass = niedriger Messwert); die Bibliothek rechnet auf 0–100 % um.",
      "sq": "Hyrje analoge: logjikë e përmbysur (i thatë = vlerë e lartë, i lagësht = vlerë e ulët); biblioteka e kthen në 0–100%."
    },
    "extraTips": {
      "en": [
        "Calibrate once by noting the raw value in dry air (0%) and in a glass of water up to the white line (100%)."
      ],
      "de": [
        "Für exakte Prozentwerte einmal den Rohwert in trockener Luft (0 %) und im Wasserglas bis zur weißen Linie (100 %) kalibrieren."
      ],
      "sq": [
        "Kalibrojeni një herë duke shënuar vlerën në ajër të thatë (0%) dhe në ujë deri te vija e bardhë (100%)."
      ]
    }
  },
  "ky039": {
    "dir": "in",
    "electrical": {
      "en": "The KY-039 is a bare-bones optical pulse detector using Photoplethysmography (PPG) with just two active components: a bright 940 nm infrared LED and a light-sensitive phototransistor facing each other. Placing your fingertip gently between them lets infrared light pass through your tissue. Every heartbeat pushes an extra wave of blood into your capillaries, momentarily blocking a tiny fraction of IR light and causing a microscopic dip in the analog output voltage read by K-Comp’s ADC.",
      "de": "Der KY-039 ist ein minimalistischer optischer Pulssensor nach dem PPG-Prinzip mit genau zwei Bauteilen: einer 940-nm-Infrarot-LED und einem lichtempfindlichen Fototransistor. Legt man die Fingerkuppe locker dazwischen, durchleuchtet das Infrarotlicht das Gewebe. Bei jedem Herzschlag strömt kurzzeitig mehr Blut in die Kapillaren, schluckt einen winzigen Teil des Lichts und erzeugt eine feine Welle in der analogen Ausgangsspannung für den K-Comp-ADC.",
      "sq": "KY-039 është një sensor i thjeshtë optik pulsi (PPG) me vetëm dy pjesë: një LED infra të kuqe 940 nm dhe një fototransistor. Kur vendosni gishtin lehtë mes tyre, çdo rrahje zemre sjell një valë gjaku që bllokon pak dritë IR dhe krijon një rënie të vogël në tensionin analog që lexohet nga ADC-ja e K-Comp."
    },
    "flow": {
      "en": [
        "IR LED → Finger",
        "Capillary Blood Wave",
        "Phototransistor",
        "Micro Analog Ripple",
        "K-Comp ADC + Filter"
      ],
      "de": [
        "IR-LED → Finger",
        "Blutwelle im Finger",
        "Fototransistor",
        "Feine Analogspannung",
        "K-Comp ADC + Filter"
      ],
      "sq": [
        "IR LED → Gishti",
        "Vala e gjakut",
        "Fototransistori",
        "Valëzim i vogël analog",
        "ADC + Filtër K-Comp"
      ]
    },
    "flowNote": {
      "en": "Analog input: raw tiny signal requiring continuous fast polling — never use delay() inside loop().",
      "de": "Analogeingang: sehr kleines Rohsignal — kontinuierlich ohne blockierendes delay() in loop() abtasten.",
      "sq": "Hyrje analoge: sinjal shumë i imët që kërkon lexim të vazhdueshëm — mos përdorni kurrë delay() në loop()."
    },
    "extraTips": {
      "en": [
        "Avoid the \"death grip\": pressing too hard squeezes blood out of your fingertip and makes the pulse wave disappear completely."
      ],
      "de": [
        "Nicht fest drücken: zu starker Druck quetscht das Blut aus der Fingerkuppe, sodass kein Pulssignal mehr messbar ist."
      ],
      "sq": [
        "Mos e shtypni fort gishtin: presioni i lartë largon gjakun nga maja e gishtit dhe zhduk sinjalin e pulsit."
      ]
    }
  },
  "ad8232": {
    "dir": "in",
    "electrical": {
      "en": "Every heartbeat triggers tiny bio-electrical waves (~1 mV) across your skin — far too weak and noisy for a microcontroller to measure directly. The AD8232 is a specialized instrumentation amplifier powered strictly at 3.3V. Using three adhesive gel electrodes (RA, LA, RL), it amplifies the tiny voltage difference between left and right sides while canceling 50 Hz room-hum interference and outputs a clean 0–3.3V analog ECG waveform on OUTPUT. Two digital pins (LO+ / LO−) flag loose electrodes.",
      "de": "Jeder Herzschlag erzeugt winzige bioelektrische Spannungswellen (~1 mV) auf der Haut — viel zu schwach und verrauscht für einen direkten Mikrocontroller-Eingang. Der AD8232 ist ein spezialisierter Instrumentenverstärker (streng 3,3V!): Über drei Klebeelektroden (RA, LA, RL) verstärkt er die winzige Differenzspannung, filtert 50-Hz-Netzbrummen heraus und liefert an OUTPUT eine saubere 0–3,3V-EKG-Kurve. Zwei Digitalpins (LO+ / LO−) melden sofort abgelöste Elektroden.",
      "sq": "Çdo rrahje zemre krijon valë bio-elektrike shumë të dobëta (~1 mV) në lëkurë — tepër të vogla dhe me zhurmë për t’u matur direkt. AD8232 është një amplifikator i specializuar instrumentimi (rreptësisht 3.3V!) që përmes tre elektrodave me xhel (RA, LA, RL) zmadhon diferencën e tensionit, eliminon zhurmën 50 Hz të rrjetit dhe nxjerr valën e pastër EKG 0–3.3V në OUTPUT, ndërsa LO+ / LO− sinjalizojnë elektrodat e shkëputura."
    },
    "flow": {
      "en": [
        "Heart Bio-Signal (~1 mV)",
        "3 Gel Electrodes",
        "AD8232 Amp + Filter",
        "Analog OUT + LO+/LO−",
        "K-Comp ADC + Digital"
      ],
      "de": [
        "Herz-Biosignal (~1 mV)",
        "3 Klebeelektroden",
        "AD8232 Verstärker",
        "Analog OUT + LO+/LO−",
        "K-Comp ADC + Digital"
      ],
      "sq": [
        "Biosinjali (~1 mV)",
        "3 Elektroda me xhel",
        "Amplifikatori AD8232",
        "Analog OUT + LO+/LO−",
        "ADC + Dixhital K-Comp"
      ]
    },
    "flowNote": {
      "en": "Analog + 2 Digital inputs: strictly 3.3V! OUTPUT → analog pin; LO+ / LO− → digital pins for lead-off detection.",
      "de": "Analog + 2 Digitaleingänge: streng 3,3V! OUTPUT → Analog-Pin; LO+ / LO− → Digital-Pins zur Elektroden-Erkennung.",
      "sq": "Analog + 2 Hyrje Dixhitale: rreptësisht 3.3V! OUTPUT → pin analog; LO+ / LO− → pina dixhitalë për kontroll elektrodash."
    },
    "extraTips": {
      "en": [
        "Sit still during measurement — flexing arm or chest muscles generates strong EMG noise that masks the ECG heartbeat wave."
      ],
      "de": [
        "Während der Messung ruhig sitzen — Muskelanspannung in Armen oder Brust erzeugt starke Störsignale, die die EKG-Kurve überdecken."
      ],
      "sq": [
        "Qëndroni pa lëvizur gjatë matjes — tensionimi i muskujve krijon zhurmë që mbulon valën EKG."
      ]
    }
  },
  "ir-rx": {
    "dir": "in",
    "electrical": {
      "en": "To stop sunlight or room lamps from triggering false button presses, the 21-button remote flashes its invisible 940 nm infrared LED at a rapid 38 kHz carrier frequency. Inside the dark receiver dome sits a photodiode paired with a 38 kHz bandpass filter and demodulator that outputs clean digital NEC pulse-distance gaps (~1.1 ms for 0, ~2.2 ms for 1). Because these pulses last microseconds, OUT must connect to hardware interrupt pin D2 (INT0) or ~D3 (INT1) so K-Comp decodes presses in the background.",
      "de": "Damit Sonnenlicht oder Zimmerlampen keine Fehlsignale auslösen, blinkt die 21-Tasten-Fernbedienung ihre unsichtbare 940-nm-IR-LED exakt 38.000-mal pro Sekunde (38-kHz-Träger). Im dunklen Empfänger filtert eine Demodulator-Schaltung genau diese Frequenz heraus und liefert saubere NEC-Digitalimpulse (kurzer Abstand = 0, langer Abstand = 1). Da die Pulse nur Mikrosekunden dauern, muss OUT an einen Hardware-Interrupt-Pin (D2 oder ~D3), damit das K-Comp Tastendrücke im Hintergrund erkennt.",
      "sq": "Për të shmangur ndërhyrjen e dritës së diellit, telekomanda pulson LED-in infra të kuq 940 nm me frekuencë 38 kHz. Marrësi ka një filtër dhe demodulator 38 kHz që nxjerr impulse dixhitale NEC (hapësirë e shkurtër = 0, e gjatë = 1). Për shkak të shpejtësisë, OUT duhet lidhur rreptësisht te pini me interrupt D2 ose ~D3."
    },
    "flow": {
      "en": [
        "IR Remote (38 kHz)",
        "Photodiode + Filter",
        "NEC Pulse Stream",
        "INT Pin (D2 / ~D3)",
        "K-Comp Interrupt ISR"
      ],
      "de": [
        "IR-Fernbedienung (38 kHz)",
        "Fotodiode + Filter",
        "NEC-Pulscode",
        "INT-Pin (D2 / ~D3)",
        "K-Comp Interrupt"
      ],
      "sq": [
        "Telekomanda IR (38 kHz)",
        "Fotodiodë + Filtër",
        "Kodi NEC",
        "Pini INT (D2 / ~D3)",
        "Interrupt i K-Comp"
      ]
    },
    "flowNote": {
      "en": "Hardware Interrupt input: works ONLY on D2 (INT0) or ~D3 (INT1) — wiring to any other pin leaves the code blind!",
      "de": "Hardware-Interrupt-Eingang: funktioniert NUR an D2 (INT0) oder ~D3 (INT1) — an anderen Pins empfängt der Code nichts!",
      "sq": "Hyrje Interrupt harduerik: punon VETËM në D2 (INT0) ose ~D3 (INT1) — në pina të tjerë kodi nuk lexon asgjë!"
    },
    "extraTips": {
      "en": [
        "If the red LED on the receiver blinks when pressing a remote button but code shows nothing, check that OUT is on D2 or ~D3!"
      ],
      "de": [
        "Blinkt die rote LED am Empfänger bei Tastendruck, aber dein Code reagiert nicht, prüfe ob OUT wirklich an D2 oder ~D3 steckt!"
      ],
      "sq": [
        "Nëse LED-i i kuq në marrës pulson por kodi nuk reagon, kontrolloni që OUT të jetë lidhur në D2 ose ~D3!"
      ]
    }
  },
  "ir-tx": {
    "dir": "out",
    "electrical": {
      "en": "The IR transmitter is a high-power 940 nm infrared LED driven through a small switching transistor on the breakout board so K-Comp can safely pulse higher peak currents for longer range. Just like a TV remote, the library rapidly modulates the DAT pin at 38 kHz bursts timed to standard NEC, Sony, or Samsung bit patterns. Because human eyes cannot see 940 nm light, the signal stays completely invisible while reaching receivers across the classroom.",
      "de": "Der IR-Sender besteht aus einer leistungsstarken 940-nm-Infrarot-LED, die über einen kleinen Schalttransistor auf der Platine angesteuert wird, damit das K-Comp sicher höhere Impulsströme für gute Reichweite schalten kann. Wie eine echte Fernbedienung moduliert die Bibliothek den DAT-Pin mit 38-kHz-Pulspaketen im NEC-, Sony- oder Samsung-Format — für das menschliche Auge unsichtbar, für Empfänger quer durch den Raum klar lesbar.",
      "sq": "Transmetuesi IR është një LED i fuqishëm infra i kuq 940 nm i drejtuar përmes një transistori çelës në pllakë, në mënyrë që K-Comp të kalojë rryma më të larta pulsuese për rreze më të madhe. Ashtu si një telekomandë e vërtetë televizori, biblioteka modulon shpejt pinin DAT me paketa pulsesh 38 kHz sipas protokolleve NEC, Sony ose Samsung — krejtësisht të padukshme për syrin, por të qarta për marrësin."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "38 kHz Coded Pulses",
        "Transistor + 940 nm LED",
        "Invisible IR Beam",
        "IR Receiver / TV"
      ],
      "de": [
        "K-Comp V2",
        "38-kHz-Pulscode",
        "Transistor + 940-nm-LED",
        "Unsichtbares IR-Licht",
        "IR-Empfänger / TV"
      ],
      "sq": [
        "K-Comp V2",
        "Pulse të koduara 38 kHz",
        "Transistor + LED 940 nm",
        "Rreze IR e padukshme",
        "Marrësi IR / TV"
      ]
    },
    "flowNote": {
      "en": "Digital/PWM output: point the clear dome directly toward the target IR receiver (line-of-sight required).",
      "de": "Digital-/PWM-Ausgang: klare LED-Kuppel direkt auf den Ziel-Empfänger ausrichten (Sichtverbindung nötig).",
      "sq": "Dalje Dixhitale/PWM: drejtojeni kupolën e tejdukshme drejt marrësit IR (kërkon pamje të drejtpërdrejtë)."
    },
    "extraTips": {
      "en": [
        "Avoid placing objects right in front of the emitter dome and test with a smartphone camera — phone sensors reveal the 940 nm purple glow!"
      ],
      "de": [
        "Sichtfeld frei halten und mit der Smartphone-Kamera testen — viele Handykameras machen das 940-nm-IR-Licht violett sichtbar!"
      ],
      "sq": [
        "Mbajeni pamjen të lirë dhe testojeni me kamerën e telefonit — sensori i kamerës shfaq dritën IR si shkëlqim vjollcë!"
      ]
    }
  },
  "rf433-tx": {
    "dir": "out",
    "electrical": {
      "en": "This compact FS1000A module is a 433.92 MHz ASK/OOK (Amplitude Shift Keying / On-Off Keying) radio transmitter built around a SAW resonator oscillator. Whenever K-Comp drives the DATA pin HIGH, the transmitter broadcasts a 433 MHz radio carrier through its antenna; when DATA is LOW, the carrier turns off. The RadioHead (RH_ASK) library encodes your bytes with balanced bit timing and a checksum so a companion 433 MHz receiver can recover short packets reliably.",
      "de": "Dieses kompakte FS1000A-Modul ist ein 433,92-MHz-ASK/OOK-Funksender (On-Off-Keying) mit einem präzisen SAW-Resonator. Schaltet das K-Comp den DATA-Pin auf HIGH, sendet der Oszillator ein 433-MHz-Funksignal über die Antenne; bei LOW verstummt der Träger. Die Bibliothek (RH_ASK) verpackt deine Daten mit synchronisierten Bit-Mustern und Prüfsumme, sodass ein 433-MHz-Empfänger kurze Nachrichten zuverlässig dekodiert.",
      "sq": "Ky modul kompakt FS1000A është një transmetues radio 433.92 MHz ASK/OOK (On-Off Keying) me rezonator preciz SAW. Kur K-Comp e çon pinin DATA në HIGH, oshilatori transmeton valën bartëse 433 MHz përmes antenës; kur DATA është LOW, bartësi fiket. Biblioteka RadioHead (RH_ASK) paketon bajtet tuaja me sinkronizim bitash dhe shumë kontrolli që marrësi 433 MHz t’i rikuperojë mesazhet me besueshmëri."
    },
    "flow": {
      "en": [
        "K-Comp V2 (RH_ASK)",
        "Digital DATA Pin",
        "433 MHz SAW Oscillator",
        "17.3 cm Wire Antenna",
        "433 MHz Radio Waves"
      ],
      "de": [
        "K-Comp V2 (RH_ASK)",
        "Digitaler DATA-Pin",
        "433-MHz-SAW-Oszillator",
        "17,3-cm-Drahtantenne",
        "433-MHz-Funkwellen"
      ],
      "sq": [
        "K-Comp V2 (RH_ASK)",
        "Pini dixhital DATA",
        "Oshilatori 433 MHz",
        "Antenë teli 17.3 cm",
        "Valë radio 433 MHz"
      ]
    },
    "flowNote": {
      "en": "Digital output (one-way): wire DATA to any free digital pin; attach a 17.3 cm straight wire antenna for good range.",
      "de": "Digitalausgang (Einweg): DATA an einen freien Digital-Pin; eine 17,3 cm lange Drahtantenne erhöht die Reichweite enorm.",
      "sq": "Dalje dixhitale (njëdrejtimëshe): lidhni DATA te çdo pin dixhital i lirë; shtoni tel 17.3 cm si antenë."
    },
    "extraTips": {
      "en": [
        "Keep packets short (e.g., 1–16 bytes) and note that RH_ASK uses Timer1 internally (avoid pairing with SG90 servos on the same board)."
      ],
      "de": [
        "Pakete kurz halten (z. B. 1–16 Byte); RH_ASK nutzt intern Timer1 (daher nicht zusammen mit SG90-Servos auf demselben Board kombinieren)."
      ],
      "sq": [
        "Mbani paketat e shkurtra (1–16 bajt); RH_ASK përdor Timer1, ndaj shmangni kombinimin me servo SG90 në të njëjtën pllakë."
      ]
    }
  },
  "rf433-rx": {
    "dir": "in",
    "electrical": {
      "en": "This 433.92 MHz ASK/OOK receiver listens continuously for amplitude-modulated radio bursts from a 433 MHz transmitter. Its tuned LC coil and amplifier detect the 433 MHz carrier wave picked up by the antenna and convert carrier presence into digital HIGH/LOW pulses on the DATA pin. Because ambient radio noise creates constant random toggles when no transmitter is sending, the RH_ASK library watches continuously for a valid preamble and checksum before delivering a verified message.",
      "de": "Dieser 433,92-MHz-ASK/OOK-Empfänger lauscht dauerhaft auf Funkpakete eines 433-MHz-Senders. Sein abgestimmter Schwingkreis und Verstärker erkennen den an der Antenne empfangenen 433-MHz-Träger und wandeln ihn in digitale HIGH/LOW-Pulse am DATA-Pin um. Da Funkrauschen im Ruhezustand ständig Zufallspulse erzeugt, wartet die RH_ASK-Bibliothek gezielt auf eine gültige Präambel samt Prüfsumme, bevor sie eine Nachricht ausgibt.",
      "sq": "Ky marrës radio 433.92 MHz ASK/OOK dëgjon vazhdimisht sinjalet me amplitudë të moduluar nga një transmetues 433 MHz. Qarku rezonues LC dhe amplifikatori i tij kapin valën bartëse përmes antenës dhe e kthejnë praninë e saj në impulse dixhitale HIGH/LOW në pinin DATA. Meqë zhurma e ambientit krijon impulse të rastësishme në gjendje qetësie, biblioteka RH_ASK filtron sinjalin dhe pranon vetëm paketa me preambulë dhe kontroll të saktë."
    },
    "flow": {
      "en": [
        "433 MHz Radio Waves",
        "17.3 cm Antenna",
        "RF Receiver + Amp",
        "Digital DATA Pin",
        "K-Comp V2 (RH_ASK)"
      ],
      "de": [
        "433-MHz-Funkwellen",
        "17,3-cm-Antenne",
        "RF-Empfänger + Amp",
        "Digitaler DATA-Pin",
        "K-Comp V2 (RH_ASK)"
      ],
      "sq": [
        "Valë radio 433 MHz",
        "Antenë 17.3 cm",
        "Marrësi RF + Amp",
        "Pini dixhital DATA",
        "K-Comp V2 (RH_ASK)"
      ]
    },
    "flowNote": {
      "en": "Digital input (one-way): connect DATA to any free digital pin; both center DATA pins on the board are electrically identical.",
      "de": "Digitaleingang (Einweg): DATA an einen freien Digital-Pin anschließen; die beiden mittleren DATA-Pins sind intern verbunden.",
      "sq": "Hyrje dixhitale (njëdrejtimëshe): lidhni DATA te çdo pin dixhital i lirë; dy pinat e mesit DATA janë identikë."
    },
    "extraTips": {
      "en": [
        "Keep the receiver away from motors or OLED wiring if range drops — switching electronics can emit 433 MHz interference."
      ],
      "de": [
        "Empfänger möglichst etwas entfernt von Motoren oder Displays platzieren, da Schaltstörungen die 433-MHz-Reichweite mindern können."
      ],
      "sq": [
        "Mbajeni marrësin larg motorëve nëse ulet rrezja — qarqet me zhurmë elektrike mund të pengojnë sinjalin 433 MHz."
      ]
    }
  },
  "ds18b20": {
    "dir": "in",
    "electrical": {
      "en": "Sealed inside a waterproof stainless-steel probe sits a precision semiconductor temperature chip with an onboard 12-bit ADC and a unique 64-bit serial ID. Instead of analog voltage, it speaks the bidirectional 1-Wire protocol over a single yellow data wire. Because both K-Comp and the sensor only pull the line LOW, a 4.7 kΩ pull-up resistor between DATA and 5V is electrically required to pull the line back HIGH — on the K-Comp lab probe, this resistor is already built in!",
      "de": "In der wasserdichten Edelstahlhülse steckt ein digitaler Halbleiter-Temperatursensor mit eingebautem 12-Bit-ADC und eindeutiger 64-Bit-Seriennummer. Er kommuniziert bidirektional über das 1-Wire-Protokoll auf einer einzigen gelben Datenleitung. Da sowohl K-Comp als auch Sensor die Leitung nur aktiv auf LOW ziehen, ist elektrisch ein 4,7-kΩ-Pull-up-Widerstand zwischen DATA und 5V nötig, um die Leitung wieder auf HIGH zu ziehen — in der K-Comp-Laborsonde ist dieser bereits integriert!",
      "sq": "Brenda sondës së papërshkueshme nga uji prej inoksi ndodhet një sensor dixhital temperature me ADC 12-bit. Ai komunikon në dy drejtime përmes protokollit 1-Wire në një tel të vetëm të verdhë. Elektrikisht kërkohet një rezistencë pull-up 4.7 kΩ midis DATA dhe 5V për ta kthyer linjën në HIGH — në sondën e laboratorit K-Comp kjo rezistencë është tashmë e integruar!"
    },
    "flow": {
      "en": [
        "Liquid / Air Heat",
        "Steel Probe + Sensor",
        "12-bit Internal ADC",
        "1-Wire Bus (4.7 kΩ)",
        "K-Comp Digital Pin"
      ],
      "de": [
        "Temperatur (Medium)",
        "Edelstahlsonde + Chip",
        "Interner 12-Bit-ADC",
        "1-Wire-Bus (4,7 kΩ)",
        "K-Comp Digital-Pin"
      ],
      "sq": [
        "Nxehtësia e mjedisit",
        "Sonda inoks + Çipi",
        "ADC 12-bit i brendshëm",
        "Busi 1-Wire (4.7 kΩ)",
        "Pin dixhital K-Comp"
      ]
    },
    "flowNote": {
      "en": "1-Wire digital bus (bidirectional): connect the yellow DATA wire to any free digital pin (D2–D13).",
      "de": "1-Wire-Digitalbus (bidirektional): gelbe Datenleitung an einen beliebigen freien Digital-Pin (D2–D13) anschließen.",
      "sq": "Busi dixhital 1-Wire (dydrejtimësh): lidhni telin e verdhë DATA te çdo pin dixhital i lirë (D2–D13)."
    },
    "extraTips": {
      "en": [
        "A reading of -127.0 °C means wiring is loose or disconnected; a constant +85.0 °C means the sensor just powered up and has not finished its first conversion."
      ],
      "de": [
        "Zeigt der Sensor -127,0 °C an, fehlt die Verbindung; konstante +85,0 °C bedeuten, dass die erste Messung nach dem Einschalten noch läuft."
      ],
      "sq": [
        "Vlera -127.0 °C tregon lidhje të shkëputur; vlera fikse +85.0 °C tregon se matja e parë pas ndezjes nuk ka mbaruar ende."
      ]
    }
  },
  "hx711": {
    "dir": "in",
    "electrical": {
      "en": "A microcontroller cannot measure weight directly, so this scale converts force in three stages. Weight pushes down on an aluminum bending beam whose thin cutout necks flex microscopically like a stiff spring. Four glued foil strain gauges wired as a Wheatstone bridge change resistance as the metal stretches, creating a microvolt signal too tiny for K-Comp’s 10-bit ADC. The HX711 chip amplifies it up to 128×, digitizes it at 24-bit resolution, and clocks the data to K-Comp over two digital pins (DT & SCK).",
      "de": "Ein Mikrocontroller kann Gewicht nicht direkt messen — diese Waage wandelt Kraft in drei Stufen um: Gewicht biegt einen Aluminium-Biegebalken an seinen dünnen Stellen mikroskopisch wie eine steife Feder. Vier aufgeklebte Dehnungsmessstreifen in einer Wheatstone-Brücke ändern dabei ihren Widerstand und erzeugen winzige Mikrovolt-Signale. Der HX711 verstärkt dieses Signal bis zu 128-fach, digitalisiert es hochpräzise mit 24 Bit und überträgt es über zwei Digitalpins (DT & SCK) ans K-Comp.",
      "sq": "Mikrokontrolluesi nuk mund ta masë peshën direkt, ndaj kjo peshore e konverton forcën në tre faza. Pesha përkul mikroskopikisht shufrën e aluminit si një sustë e fortë; katër matës deformimi të lidhur në urë Wheatstone ndryshojnë rezistencën dhe krijojnë një sinjal mikrovolt shumë të vogël. Çipi HX711 e zmadhon sinjalin deri në 128×, e konverton me rezolucion 24-bit dhe ia dërgon K-Comp përmes dy pinave dixhitalë (DT & SCK)."
    },
    "flow": {
      "en": [
        "Weight Force",
        "Aluminum Beam Flex",
        "Wheatstone Bridge",
        "HX711 24-bit Amp",
        "DT/SCK → K-Comp V2"
      ],
      "de": [
        "Gewichtskraft",
        "Alu-Biegebalken",
        "Wheatstone-Brücke",
        "HX711 24-Bit-Amp",
        "DT/SCK → K-Comp V2"
      ],
      "sq": [
        "Forca e peshës",
        "Përkulja e shufrës",
        "Ura Wheatstone",
        "Amp 24-bit HX711",
        "DT/SCK → K-Comp V2"
      ]
    },
    "flowNote": {
      "en": "2-wire clocked digital input: connect DT (Data) and SCK (Clock) to any two free digital pins.",
      "de": "Zweidraht-Digitalinterface: DT (Daten) und SCK (Takt) an zwei beliebige freie Digital-Pins anschließen.",
      "sq": "Ndërfaqe dixhitale me 2 tela: lidhni DT (Të dhëna) dhe SCK (Ora) te dy pina dixhitalë të lirë."
    },
    "extraTips": {
      "en": [
        "Use proper spacers so the center of the aluminum bar can flex freely — bolting it flat against a table prevents bending and yields zero weight."
      ],
      "de": [
        "Mit Distanzhülsen (Z-Montage) befestigen, damit sich der Balken frei biegen kann — liegt er flach auf, misst die Waage fast 0 g."
      ],
      "sq": [
        "Përdorni ndarës (montim në formë Z) që shufra të përkulet lirshëm — nëse prek tavolinën nuk do të matë peshën."
      ]
    }
  },
  "tft-gc9a01": {
    "dir": "out",
    "electrical": {
      "en": "This 1.28-inch circular color display packs a 240×240 pixel TFT-LCD glass matrix illuminated by a white LED backlight and controlled by an onboard display driver with its own video frame buffer. Instead of storing 115 KB of color pixels inside K-Comp’s 2 KB SRAM, K-Comp sends compact drawing commands (lines, shapes, text, gauges) over the two-wire I²C bus (SDA/SCL at address 0x3D). The display controller updates its internal pixel memory and drives every RGB subpixel continuously.",
      "de": "Dieses runde 1,28-Zoll-Farbdisplay besitzt eine 240×240-Pixel-TFT-LCD-Matrix mit weißer Hintergrundbeleuchtung und eigenem Grafikspeicher im Display-Controller. Statt 115 KB Bilddaten im knappen 2-KB-SRAM des K-Comp zu halten, sendet das K-Comp kompakte Zeichenbefehle (Linien, Kreise, Text, Zeiger) über den Zweidraht-I²C-Bus (SDA/SCL, Adresse 0x3D). Der Display-Controller aktualisiert seinen internen Bildspeicher und steuert alle RGB-Pixel selbstständig an.",
      "sq": "Ky ekran rrethor me ngjyra 1.28\" ka matricë 240×240 pikselë TFT-LCD me ndriçim prapa dhe memorie grafike të vetën. Në vend që pikselët të zënë 2 KB SRAM të K-Comp, K-Comp dërgon komanda kompakte vizatimi përmes busit I²C (SDA/SCL, adresa 0x3D), ndërsa kontrolluesi i ekranit përditëson vazhdimisht të gjithë pikselët RGB."
    },
    "flow": {
      "en": [
        "K-Comp V2",
        "I²C Commands (0x3D)",
        "TFT Controller + VRAM",
        "240×240 RGB Matrix",
        "Round Color Screen"
      ],
      "de": [
        "K-Comp V2",
        "I²C-Befehle (0x3D)",
        "TFT-Controller + VRAM",
        "240×240-RGB-Matrix",
        "Rundes Farbdisplay"
      ],
      "sq": [
        "K-Comp V2",
        "Komanda I²C (0x3D)",
        "Kontrolluesi + VRAM",
        "Matrica 240×240 RGB",
        "Ekrani rrethor me ngjyra"
      ]
    },
    "flowNote": {
      "en": "I²C bus (0x3D): connect VCC, GND, SCL, and SDA to any I²C header (H1–H3); leave unused pins unconnected.",
      "de": "I²C-Bus (0x3D): VCC, GND, SCL und SDA an H1–H3 anschließen; die ausgegrauten Pins bleiben frei.",
      "sq": "Busi I²C (0x3D): lidhni VCC, GND, SCL dhe SDA te H1–H3; pinat e hijezuar mbeten të palidhur."
    },
    "extraTips": {
      "en": [
        "Only redraw areas that actually changed (instead of clearing the full screen every frame) for crisp, flicker-free animations over I²C."
      ],
      "de": [
        "Für flüssige, flackerfreie Anzeigen nur die geänderten Bereiche neu zeichnen statt bei jedem Durchlauf den gesamten Bildschirm zu löschen."
      ],
      "sq": [
        "Rivizatoni vetëm zonat që ndryshojnë në vend që të fshini të gjithë ekranin çdo cikël për animacion të pastër pa dridhje."
      ]
    }
  }
};
