// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Përshkrime të plota në gjuhën shqipe për të 43 modulet e jashtme K-Comp V2
export default {
  'bmp280': {
    friendlyName: 'Sensor i Shtypjes & Temperaturës',
    subtitle: 'Temperaturë & Shtypje Barometrike',
    maxReason: 'Përdor adresën fikse standarde I²C 0x76 në busin e përbashkët.',
    studentInfo: {
      whatItDoes: 'Mat shtypjen atmosferike (barometër) dhe temperaturën. Meqë shtypja e ajrit bie kur ngjitesh më lart, mund të vlerësojë edhe lartësinë mbi nivelin e detit!',
      howToConnect: 'Lidhe 4 pinat aktivë (VCC, GND, SCL, SDA) me cilindo header I²C të K-Comp (H1, H2 ose H3). Lëri pa lidhur pinat e hirtë CSB dhe SDO.',
      ideas: ['Stacion meteorologjik i klasës', 'Matës i katit të ashensorit / lartësisë', 'Alarm i rënies së shtypjes para stuhisë'],
      tips: ['Adresa standarde I²C është 0x76.', 'Punon me logjikë 3.3V dhe 5V, ndaj H1–H3 funksionojnë drejtpërdrejt.', 'Zë rreth 140 B RAM.']
    }
  },
  'aht10': {
    friendlyName: 'Sensor i Lagështisë & Temperaturës',
    subtitle: 'Temperaturë & Lagështi Relative',
    maxReason: 'Adresë fikse I²C 0x38 — vetëm një për bus I²C si parazgjedhje.',
    studentInfo: {
      whatItDoes: 'Mat sa e lagësht është ajri (lagështia relative në %) së bashku me temperaturën e saktë të dhomës.',
      howToConnect: 'Lidhe VIN, GND, SCL dhe SDA me cilindo header të lirë I²C (H1–H3) në K-Comp.',
      ideas: ['Monitor inteligjent i komoditetit të ajrit', 'Kontrollues lagështie për serrë', 'Testues i lagështisë së frymëmarrjes'],
      tips: ['Përdor adresën I²C 0x38.', 'Fryj lehtë afër tij për ta testuar — lagështia rritet menjëherë!', 'Përfshi <kcomp_AHT10.h> (me AHT10 të mëdha).']
    }
  },
  'max30102': {
    friendlyName: 'Sensor i Pulsit & Oksigjenit',
    subtitle: 'Oksimetër Optik i Pulsit & SpO2',
    maxReason: 'Adresë fikse I²C 0x57 (nuk mund të ndryshohet).',
    studentInfo: {
      whatItDoes: 'Ndriçon me dritë të kuqe dhe infra të kuqe në majën e gishtit për të matur pulsin (rrahje në minutë) dhe nivelin e oksigjenit në gjak (SpO2), njësoj si orët inteligjente!',
      howToConnect: 'Lidhe VIN, GND, SCL dhe SDA me cilindo header I²C të K-Comp (H1–H3). Lëre INT pa lidhur.',
      ideas: ['Matës pulsi për fitnes në OLED', 'Lojë reagimi dhe stresi me pulsin', 'Demo e detektorit të gënjeshtrës'],
      tips: ['Vendose gishtin lehtë — shtypja e fortë e shtyn gjakun dhe e prish matjen.', 'Mbaje gishtin pa lëvizur 5–10 sekonda për vlerë të pastër BPM.', 'Përdor adresën I²C 0x57.']
    }
  },
  'gy302': {
    friendlyName: 'Sensor i Dritës (Lux)',
    subtitle: 'Intensiteti i Dritës së Ambientit (Lux)',
    maxReason: 'Adresë standarde I²C 0x23 (lëre ADDR pa lidhur).',
    studentInfo: {
      whatItDoes: 'Mat saktë ndriçimin rreth pllakës në Lux — nga dhoma e errët (1 lux) deri te rrezet e forta të diellit (50,000+ lux).',
      howToConnect: 'Lidhe VCC, GND, SCL dhe SDA me cilindo header I²C të K-Comp (H1–H3). Lëre ADDR pa lidhur.',
      ideas: ['Dritë nate automatike', 'Demo e ndriçimit automatik të ekranit', 'Alarm me rreze lazer'],
      tips: ['Shumë ekonomik në RAM (~65 B).', 'Mbuloje me dorë dritaren e vogël të sensorit për të parë vlerën të bjerë menjëherë.']
    }
  },
  'paj7620u2': {
    friendlyName: 'Sensor i Gjesteve',
    subtitle: 'Njohje e 9 Gjesteve të Dorës',
    maxReason: 'Adresë fikse I²C 0x73.',
    studentInfo: {
      whatItDoes: 'Njeh 9 gjeste të dorës në ajër (lart, poshtë, majtas, djathtas, para, prapa, orar, kundërorar dhe tundje) pa prekur asgjë!',
      howToConnect: 'Lidhe VCC, GND, SCL dhe SDA me cilindo header I²C të K-Comp (H1–H3). Lëre INT pa lidhur.',
      ideas: ['Kontrollues pa prekje për Snake ose Pong', 'Kontrollues muzike / prezantimesh me dorë', 'Kyç magjik dere me gjeste'],
      tips: ['Distanca më e mirë është 5–15 cm mbi dritaren e errët të sensorit.', 'Lëvize dorën qartë mbi sensor — shumë shpejt ose shumë afër mund të humbasë gjestin.']
    }
  },
  'bmi160': {
    friendlyName: 'Sensor i Lëvizjes & Pjerrësisë (IMU)',
    subtitle: 'Xhiroskop & Akselerometër me 6 Boshte',
    shortWarn: 'Anashkalo pinin 3V3 mes VIN & GND! Lidhe 5V strikt në VIN.',
    protoNote: 'Vendoset drejtpërdrejt në fushën e kuqe Prototyping Area për matje të qëndrueshme (anashkalo pinin 3V3!).',
    maxReason: 'Adresë standarde I²C 0x69 (ndan 0x69 me SPS-30 nëse SAO nuk lidhet me GND).',
    studentInfo: {
      whatItDoes: 'Ndjen pjerrësinë 3D, nxitimin (forca G) dhe shpejtësinë e rrotullimit (xhiroskop) — i njëjti lloj çipi si në telefona dhe kontrollues lojërash.',
      howToConnect: 'Vendoset bukur në fushën e kuqe Prototyping Area! Lidhe VIN→5V, GND→GND, SCL→SCL, SDA→SDA në H1–H3. E RËNDËSISHME: anashkalo pinin 3V3 menjëherë pranë VIN!',
      ideas: ['Labirint me sferë i kontrolluar me anim në OLED', 'Nivel dixhital (libelë)', 'Numërues hapash / zar që hidhet me tundje'],
      tips: ['KURRË mos lidh 5V te pini 3V3 — përdor VIN!', 'Nëse përdor edhe sensorin e pluhurit SPS-30, lidhe SAO të BMI160 me GND që adresa të kalojë nga 0x69 në 0x68.']
    }
  },
  'as7343': {
    friendlyName: 'Sensor i Spektrit të Dritës',
    subtitle: 'Sensor Spektral me 14 Kanale (380–1000nm)',
    maxReason: 'Adresë fikse I²C 0x39.',
    studentInfo: {
      whatItDoes: 'Ndan dritën në 14 gjatësi vale të veçanta ngjyrash (nga vjollca nëpër ngjyrat e dukshme deri te infra e kuqe e afërt), si një mini-spektrometër laboratori.',
      howToConnect: 'Lidhe VIN, GND, SCL dhe SDA me cilindo header I²C të K-Comp (H1–H3).',
      ideas: ['Analizues i shëndetit të bimëve / gjetheve', 'Klasifikues ngjyrash për pije ose karamele', 'Testues i spektrit të llambave LED'],
      tips: ['Ka një LED të vogël të bardhë të integruar që mund ta ndezësh në kod për ndriçim të njëtrajtshëm.', 'Adresa I²C është 0x39 (përplaset nëse AHT10 është vendosur në 0x39).']
    }
  },
  'as7331': {
    friendlyName: 'Sensor i Dritës UV',
    subtitle: 'Sensor Spektral UV-A, UV-B & UV-C',
    maxReason: 'Adresë standarde I²C 0x74.',
    studentInfo: {
      whatItDoes: 'Mat dritën e padukshme ultravjollcë të ndarë në brezat UV-A, UV-B dhe UV-C — perfekt për testimin e rrezeve të diellit dhe syzeve të diellit!',
      howToConnect: 'Lidhe VCC, GND, SCL dhe SDA me cilindo header I²C të K-Comp (H1–H3). Lëre REA pa lidhur.',
      ideas: ['Testues i kremit të diellit / syzeve UV', 'Stema paralajmëruese e indeksit UV', 'Detektor i elektrikut UV'],
      tips: ['Dritat normale LED të brendshme lëshojnë pothuajse zero UV — testo pranë dritares me diell ose me elektrik UV.', 'KURRË mos shiko drejtpërdrejt në llambat UV-C!']
    }
  },
  'sps30': {
    friendlyName: 'Sensor i Pluhurit të Imët (PM)',
    subtitle: 'Sensor Lazer PM1.0 / PM2.5 / PM4 / PM10',
    shortWarn: 'Adresë I²C 0x69 (lidhe SAO→GND te BMI160 nëse i përdor të dy).',
    maxReason: 'Adresë fikse I²C 0x69 dhe tërheq ~60mA për ventilatorin e lazerit.',
    studentInfo: {
      whatItDoes: 'Përdor një ventilator të vogël të brendshëm dhe rreze lazer për të numëruar grimcat mikroskopike të pluhurit në ajër (PM1.0, PM2.5, PM4 dhe PM10).',
      howToConnect: 'Lidhe 4 telat aktivë (VCC, SDA, SCL, GND) drejtpërdrejt me cilindo header I²C të K-Comp (H1–H3). Lëre pa lidhur pinin e hirtë SEL.',
      ideas: ['Semafor i cilësisë së ajrit në klasë', 'Detektor tymi nga printeri 3D / saldimi', 'Regjistrues portativ i pluhurit'],
      tips: ['Kërkon ushqim 5V për ventilatorin e brendshëm.', 'Ndan adresën 0x69 me GY-BMI160 — lidhe SAO→GND te BMI160 nëse i përdor bashkë.']
    }
  },
  'vl53l1x': {
    friendlyName: 'Sensor Lazer i Distancës',
    subtitle: 'Distancë Lazer Time-of-Flight (400 cm)',
    maxReason: 'Adresë standarde I²C 0x29 (përplaset me TCS34725 nëse bashkohen).',
    studentInfo: {
      whatItDoes: 'Mat distancë të saktë deri në 4 metra (400 cm) duke matur kohën e kthimit të një pulsi lazer të padukshëm — shumë më i saktë dhe më i ngushtë se ultrazëri!',
      howToConnect: 'Lidhe VIN, GND, SDA dhe SCL me cilindo header I²C të K-Comp (H1–H3). Lëri INT dhe SHUT pa lidhur.',
      ideas: ['Metër lazer në OLED', 'Numërues njerëzish në hyrje', 'Shmangie pengesash për robot'],
      tips: ['Hiqe shiritin mbrojtës të verdhë mbi lenten e vogël para testimit!', 'Ndan adresën 0x29 me sensorin e ngjyrave TCS34725 — mos i lidh të dy në të njëjtën kohë.']
    }
  },
  'ina219': {
    friendlyName: 'Sensor i Rrymës & Tensionit',
    subtitle: 'Sensor i Rrymës DC, Tensionit & Fuqisë',
    maxReason: 'Adresë standarde I²C 0x40.',
    studentInfo: {
      whatItDoes: 'Mat sa tension DC (V), rrymë (mA) dhe fuqi (mW) po konsumon një qark tjetër, bateri ose panel diellor.',
      howToConnect: 'Lidhe VCC, GND, SCL dhe SDA me cilindo header I²C (H1–H3). Lidhe pajisjen që mat NË SERI përmes terminalit të gjelbër VIN+ / VIN−.',
      ideas: ['Matës i fuqisë së panelit diellor', 'Testues i kapacitetit USB / baterisë', 'Monitor i ngarkesës së motorit'],
      tips: ['KURRË mos lidh bateri drejtpërdrejt mes VIN+ dhe VIN− pa ngarkesë (shkakton lidhje të shkurtër!).', 'Përballon deri në 26V dhe 3.2A në terminalin me vida.']
    }
  },
  'tcs34725': {
    friendlyName: 'Sensor RGB i Ngjyrave',
    subtitle: 'Kolorimetër RGB + Dritë e Pastër',
    maxReason: 'Adresë fikse I²C 0x29 (nuk mund të ndryshohet).',
    studentInfo: {
      whatItDoes: 'Zbulon vlerat e së Kuqes, Gjelbrës, Blusë dhe ndriçimit të objekteve para tij që kodi yt të dallojë ngjyrat.',
      howToConnect: 'Lidhe VIN, GND, SCL dhe SDA me cilindo header I²C të K-Comp (H1–H3). Lëri LED, INT dhe 3V3 pa lidhur.',
      ideas: ['Ndarës ngjyrash për karamele', 'Lojë kuizi me ngjyra', 'Robot ndjekës i zonave me ngjyra'],
      tips: ['Mbaji objektet me ngjyrë 1–2 cm larg për saktësi maksimale.', 'Adresë fikse 0x29 — nuk mund të ndajë busin I²C me sensorin lazer VL53L1X.']
    }
  },
  'tb6612fng': {
    friendlyName: 'Shield Drejtues i Dyfishtë Motori',
    subtitle: 'Shield Drejtues I²C për 2 Motorë DC',
    shortWarn: 'Logjikë 3.3V VETËM + RST→RESET. Bateri e jashtme 6–12V në VM. (Shield i 2-të: uro AD0 → 0x2F)',
    maxReason: 'Mbështet deri në 2 shield-e (0x30 + 0x2F me urën AD0) për robotë 4WD.',
    studentInfo: {
      whatItDoes: 'Ushqen dhe kontrollon në mënyrë të sigurt shpejtësinë dhe drejtimin e 2 motorëve DC përmes I²C (deri në 4 motorë me dy shield-e!). Mikrokontrolluesit nuk mund të drejtojnë motorë drejtpërdrejt.',
      howToConnect: 'Lidhe 3V3 → K-Comp 3.3V (JO 5V!), RST → K-Comp RESET dhe GND/D1(SCL)/D2(SDA) në një header I²C. Ushqe motorët me bateri të jashtme 6–12V në terminalet VM/GND.',
      ideas: ['Makinë robotike autonome 2WD ose 4WD', 'Rover me telekomandë', 'Mini shirit transportues me motor'],
      tips: ['KRITIKE: Logjika punon VETËM me 3.3V — kurrë mos lidh 5V në 3V3!', 'Gjithmonë lidhe RST → RESET dhe mbaje motorUpdate() në loop().', 'Për shield të dytë, saldo urën AD0 mbrapa për adresën 0x2F.']
    }
  },
  'drv2605l': {
    friendlyName: 'Drejtues Haptik (Dridhje)',
    subtitle: 'Drejtues Efektesh Haptike I²C + Motor ERM',
    maxReason: 'Adresë fikse I²C 0x5A.',
    studentInfo: {
      whatItDoes: 'Drejton një motor dridhjeje me 123 efekte haptike si në smartphone — klikime të mprehta, trokitje të dyfishta, rrahje zemre dhe rritje të buta!',
      howToConnect: 'Lidhe VIN, GND, SCL dhe SDA me cilindo header I²C të K-Comp (H1–H3). Telat e motorit të vogël lidhen te pad-et +/− të drejtuesit.',
      ideas: ['Kontrollues lojërash me dridhje', 'Kohëmatës i heshtur / sinjalizues Morse', 'Navigator taktil për aksesueshmëri'],
      tips: ['Përdor adresën I²C 0x5A.', 'Shumë më inteligjent se një motor i thjeshtë dridhjeje sepse efektet luhen automatikisht pa bllokuar kodin.']
    }
  },
  'cardkb': {
    friendlyName: 'Mini Tastierë QWERTY',
    subtitle: 'Mini Tastierë I²C M5Stack',
    maxReason: 'Adresë fikse I²C 0x5F.',
    studentInfo: {
      whatItDoes: 'Një tastierë e plotë QWERTY sa gishti që dërgon çdo shtypje tasti në K-Comp përmes I²C — shkruaj mesazhe, fjalëkalime ose komanda direkt në pllakë!',
      howToConnect: 'Lidhe 4 telat Grove në cilindo header I²C (H1–H3): E kuqe=5V, E zezë=GND, E verdhë=SDA, E bardhë=SCL.',
      ideas: ['Mini chat me radio (me HC-12)', 'Kasafortë me fjalëkalim ose lojë kuizi', 'Editor teksti / kalkulator në OLED'],
      tips: ['Mbështet tastet Shift dhe Sym/Fn për numra dhe shenja pikësimi.', 'Shumë e lehtë në RAM (~60 B).']
    }
  },
  'pn532': {
    friendlyName: 'Lexues Kartash NFC / RFID',
    subtitle: 'Lexues & Shkrues 13.56MHz RFID / NFC',
    shortWarn: 'Çelësi DIP në modul për I²C: SW1=ON, SW2=OFF.',
    maxReason: 'Adresë fikse I²C 0x24 dhe përdor ~240 B SRAM.',
    studentInfo: {
      whatItDoes: 'Lexon dhe shkruan çelësa, karta inteligjente dhe karta nxënësish NFC pa kontakt nga disa centimetra larg — e njëjta teknologji si pagesa me kartë!',
      howToConnect: 'Vendose çelësin e vogël në pllakën e kuqe në modalitetin I²C (SW1 = ON, SW2 = OFF), pastaj lidhe VCC, GND, SDA dhe SCL në cilindo header I²C (H1–H3).',
      ideas: ['Sistem aksesi elektronik për dollap / derë', 'Skaner prezence në klasë', 'Jukebox ose figurina lojërash me NFC'],
      tips: ['90% e problemeve me PN532 vijnë nga çelësat e vegjël — verifiko SW1=ON, SW2=OFF!', 'Përdor ~240 B RAM; kaloje OLED në modalitetin Paged nëse RAM-i ngushtohet.']
    }
  },
  'gy-neo6m': {
    friendlyName: 'Marrës GPS i Vendndodhjes',
    subtitle: 'GPS Satelitor u-blox 6M NMEA',
    maxReason: 'Përdor SoftwareSerial UART — ATmega328P mund të dëgjojë vetëm një portë SoftwareSerial në të njëjtën kohë.',
    studentInfo: {
      whatItDoes: 'Merr sinjale nga satelitët GPS për të llogaritur gjerësinë, gjatësinë gjeografike, shpejtësinë dhe kohën e saktë UTC kudo në Tokë.',
      howToConnect: 'Lidhe VCC→5V dhe GND→GND. KRYQËZO telat e të dhënave: TX i modulit → pini RX i K-Comp, dhe RX i modulit → pini TX i K-Comp (p.sh. D6/D7).',
      ideas: ['Shpejtësimatës & matës distance për biçikletë', 'Busull për gjueti thesari / geocaching', 'Orë dixhitale me kohë satelitore'],
      tips: ['Kërkon pamje të hapur nga qielli (ose pranë dritares) — kapja e parë e satelitit mund të zgjasë 1–3 minuta!', 'Mos harro të kryqëzosh TX ↔ RX.']
    }
  },
  'ch9329': {
    friendlyName: 'Përshtatës USB Tastierë & Maus',
    subtitle: 'Emulator UART-në-USB Tastierë & Maus',
    maxReason: 'Përdor SoftwareSerial UART dhe vepron si një pajisje e vetme USB HID.',
    studentInfo: {
      whatItDoes: 'Lidhet në portën USB të kompjuterit dhe e bën K-Comp të sillet si tastierë ose maus i vërtetë USB — lëviz kursorin me Joystick ose dërgo shkurtore me butona!',
      howToConnect: 'Lidhe 5V→5V, GND→GND dhe KRYQËZO pinat e të dhënave: TX i modulit → RX i K-Comp, RX i modulit → TX i K-Comp. Lidhe anën USB në PC.',
      ideas: ['Kontrollues lojërash PC me anim (me GY-BMI160)', 'Tastierë makro për shkurtore', 'Maus me Joystick për aksesueshmëri'],
      tips: ['MOS i lëviz jumper-at e verdhë të konfigurimit në pllakë!', 'Nëse lidhet në D6/D7, çelësat DIP S1-7 dhe S1-8 duhet të jenë FIKUR (OFF).']
    }
  },
  'as608': {
    friendlyName: 'Skaner i Gjurmëve të Gishtave',
    subtitle: 'Skaner Optik Biometrik i Gjurmëve',
    maxReason: 'Përdor SoftwareSerial UART (vetëm një marrës aktiv mbështetet pastër në AVR).',
    studentInfo: {
      whatItDoes: 'Kap dhe njeh gjurmët e gishtave të njeriut përmes një sensori optik me dritë të gjelbër dhe ruan shabllonet në memorien e vet të brendshme.',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe kryqëzo TX → RX i K-Comp dhe RX → TX i K-Comp (dy pina dixhitalë të lirë).',
      ideas: ['Kuti thesari ose dollap biometrik', 'Çkyçje sekrete për PC (me CH9329)', 'Alarm aksesi me shumë përdorues'],
      tips: ['Mbaji telat jumper të shkurtër — 57600 baud në SoftwareSerial është i ndjeshëm ndaj kontakteve të dobëta.', 'Regjistro gishtin fillimisht me kodin shembull të regjistrimit.']
    }
  },
  'ld2410c': {
    friendlyName: 'Radar i Pranisë Njerëzore',
    subtitle: 'Detektor Pranie 24GHz mmWave',
    shortWarn: 'Ul shpejtësinë baud të radarit në ≤19200 për AVR SoftwareSerial.',
    maxReason: 'Përdor SoftwareSerial UART (një marrës SoftwareSerial në ATmega328P).',
    studentInfo: {
      whatItDoes: 'Një radar me valë milimetrike 24 GHz që zbulon si njerëz në lëvizje ASHTU EDHE plotësisht pa lëvizur (edhe frymëmarrjen!) deri në 5 metra — madje edhe përmes plastikës ose drurit të hollë.',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe kryqëzo TX → RX i K-Comp dhe RX → TX i K-Comp.',
      ideas: ['Llambë tavoline që qëndron ndezur ndërsa rri ulur', 'Numërues i pranisë në dhomë', 'Ekran që zgjohet pa prekje'],
      tips: ['Shpejtësia nga fabrika është 256000 baud — ule në 9600 ose 19200 me aplikacionin HLKRadarTool që AVR SoftwareSerial ta lexojë pastër!', 'Shmang objektet metalike direkt para radarit.']
    }
  },
  'ld2450': {
    friendlyName: 'Radar Lëvizjeje me Shumë Objektiva',
    subtitle: 'Radar 24GHz Gjurmues XY (3 Persona)',
    shortWarn: 'Ul shpejtësinë baud të radarit në ≤19200 për AVR SoftwareSerial.',
    maxReason: 'Përdor SoftwareSerial UART (një marrës SoftwareSerial në ATmega328P).',
    studentInfo: {
      whatItDoes: 'Gjurmon drejtpërdrejt pozicionin X/Y dhe shpejtësinë e deri në 3 personave në lëvizje njëkohësisht me radar 24 GHz — mund të vizatosh pika radari live në OLED!',
      howToConnect: 'Lidhe 5V→5V, GND→GND dhe kryqëzo TX → RX i K-Comp dhe RX → TX i K-Comp në header-in 4-pinësh.',
      ideas: ['Ekran radari sci-fi live në OLED', 'Alarm dhome me zona', 'Dritë me servo që të ndjek automatikisht'],
      tips: ['Si te LD2410C, ul shpejtësinë baud në ≤19200 për AVR SoftwareSerial.', 'Më i miri në gjurmimin e personave në lëvizje brenda një koni 6 metra.']
    }
  },
  'hc12': {
    friendlyName: 'Marrës-Dhënës Radio me Rreze të Gjatë',
    subtitle: 'Transceiver UART 433MHz me Rreze të Gjatë',
    maxReason: 'Përdor SoftwareSerial UART; një modul radio për pllakë K-Comp.',
    studentInfo: {
      whatItDoes: 'Si një walkie-talkie për të dhëna teksti — lejon dy pllaka K-Comp të dërgojnë mesazhe te njëra-tjetra nëpër klasë ose oborrin e shkollës (qindra metra)!',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe kryqëzo TXD → RX i K-Comp dhe RXD → TX i K-Comp. Lëre SET pa lidhur për mesazhe normale.',
      ideas: ['Chat pa tela me dy pllaka (me CardKB)', 'Stacion moti i jashtëm + ekran i brendshëm', 'Lojë Tic-Tac-Toe pa tela me 2 lojtarë'],
      tips: ['Sigurohu që antena spirale prej bakri është lidhur para transmetimit.', 'Nëse disa grupe testojnë në të njëjtën dhomë, ndrysho kanalin me komanda AT!']
    }
  },
  'hc05': {
    friendlyName: 'Modul Bluetooth',
    subtitle: 'Bluetooth 2.0 Serial (Fole e Integruar)',
    shortWarn: 'Përdor folenë e integruar wireless (S1-7 & S1-8 ON → rezervon D6/D7).',
    maxReason: 'Futët drejtpërdrejt në folenë e vetme Wireless në pllakë (nuk ndahet me ESP-8266).',
    studentInfo: {
      whatItDoes: 'Shton komunikim klasik serial Bluetooth që të dërgosh komanda nga një aplikacion Android në K-Comp ose të shfaqësh të dhëna sensorësh në telefon.',
      howToConnect: 'Fute drejtpërdrejt në folenë e dedikuar HC-05 në pllakën K-Comp — nuk duhen tela jumper! Sigurohu që çelësat DIP S1-7 dhe S1-8 janë NDEZUR (ON).',
      ideas: ['Makinë robotike e kontrolluar nga telefoni', 'Panel sensorësh pa tela në smartphone', 'Kontrollues LED / sinjalizuesi me Bluetooth'],
      tips: ['Përdor D6 dhe D7 brenda pllakës përmes S1-7 & S1-8.', 'Nuk mund të vendoset në të njëjtën kohë me modulin Wi-Fi ESP-8266.', 'Kodi PIN standard i Bluetooth është zakonisht 1234 ose 0000.']
    }
  },
  'esp8266': {
    friendlyName: 'Modul Wi-Fi',
    subtitle: 'Modul Wi-Fi 2.4GHz (Fole e Integruar)',
    shortWarn: 'Përdor folenë e integruar wireless (S1-7 & S1-8 ON → rezervon D6/D7).',
    maxReason: 'Futët drejtpërdrejt në folenë e vetme 2×4 Wireless (nuk ndahet me HC-05).',
    studentInfo: {
      whatItDoes: 'Lidh K-Comp me një rrjet Wi-Fi 2.4 GHz që pllaka jote të ofrojë një faqe të vogël uebi ose të dërgojë të dhëna sensorësh në rrjet!',
      howToConnect: 'Fute drejtpërdrejt në folenë 2×4 ESP8266 në pllakën K-Comp (3.3V rregullohet automatikisht). Mbaji çelësat DIP S1-7 dhe S1-8 NDEZUR (ON).',
      ideas: ['Faqe uebi Wi-Fi për temperaturën e klasës', 'Buton njoftimi IoT', 'Servo ose LED i kontrolluar nga shfletuesi'],
      tips: ['Mbështet vetëm rrjete Wi-Fi 2.4 GHz (jo 5 GHz).', 'Rezervon D6 & D7 përmes S1-7 & S1-8; nuk mund të përdoret bashkë me HC-05.']
    }
  },
  'sg90-180': {
    friendlyName: 'Servomotor me Kënd (0–180°)',
    subtitle: 'Mikro Servo Pozicional (0°–180°)',
    maxReason: 'Deri në 3 servo përshtaten mirë me pinat PWM dhe kufirin 5V USB.',
    studentInfo: {
      whatItDoes: 'Një motor i vogël me ingranazhe që lëviz krahun e tij në çdo kënd të saktë mes 0° dhe 180° dhe e mban atë pozicion fort.',
      howToConnect: 'Teli portokalli → cilido pin PWM (~D9, ~D3, ~D5, ~D6, ~D10 ose ~D11), I kuq → 5V, Kafe → GND. Nëse përdor ~D9, çelësi DIP S1-6 (Buzzer) fiket.',
      ideas: ['Krah robotik / kokë lëvizëse (2–3 servo)', 'Trarë automatik ose shpërndarës karamelesh', 'Tregues analog me akrep'],
      tips: ['Mund të shtosh deri në 3 servo SG90 për projekt!', 'KURRË mos e rrotullo krahun me forcë me dorë kur ka rrymë — dëmton dhëmbëzorët plastikë.']
    }
  },
  'sg90-360': {
    friendlyName: 'Servomotor me Rrotullim të Vazhdueshëm',
    subtitle: 'Mikro Servo me Rrotullim 360°',
    maxReason: 'Deri në 3 servo përshtaten mirë me pinat PWM dhe kufirin 5V USB.',
    studentInfo: {
      whatItDoes: 'Duket si një SG90 normal, por rrotullohet vazhdimisht si rrotë! Në vend të këndit, kodi yt cakton shpejtësinë dhe drejtimin (orar, ndal, kundërorar).',
      howToConnect: 'Teli portokalli → cilido pin PWM (~D9, ~D3, ~D5, ~D6, ~D10 ose ~D11), I kuq → 5V, Kafe → GND.',
      ideas: ['Mini çikrik ose ashensor', 'Platformë rrotulluese ekspozimi', 'Mini rover kompakt me 2 rrota'],
      tips: ['90 = ndal, <90 = rrotullim në një anë, >90 = rrotullim në anën tjetër.', 'Mund të vendosësh deri në 3 servo në një projekt.']
    }
  },
  'hcsr04-sg90': {
    friendlyName: 'Radar Ultrazëri Rrotullues',
    subtitle: 'Skaner Ultrazëri mbi Servo',
    maxReason: 'Përdor 2 pina dixhitalë + 1 pin PWM për një kullë skanimi.',
    studentInfo: {
      whatItDoes: 'Monton një sensor distance me ultrazë mbi një servo SG90 që të skanojë majtas-djathtas dhe të hartojë pengesat para K-Comp si sonar!',
      howToConnect: 'Lidhe HC-SR04 VCC/GND + TRIG/ECHO në pina dixhitalë, dhe servon SG90 në një pin PWM (~D9) + 5V/GND.',
      ideas: ['Radar sonar 180° në OLED', 'Kullë roboti për shmangien e pengesave', 'Gjurmues i këndit të pengesave'],
      tips: ['Prit ~30 ms mes matjeve me ultrazë që jehonat e vjetra të mos ngatërrojnë leximin.', 'Fike folenë e integruar të Ultrazërit nëse përdor D10/D11 jashtë.']
    }
  },
  'vib-motor': {
    friendlyName: 'Motor Dridhjeje',
    subtitle: 'Modul Haptik 9000 RPM (MOSFET)',
    maxReason: 'Deri në 2 motorë (p.sh. reagim majtas/djathtas) në pina PWM brenda rrymës së sigurt.',
    studentInfo: {
      whatItDoes: 'Një motor i vogël i sheshtë dridhjeje (si në smartphone) me drejtues tranzistori të integruar që të dridhet nga lehtë deri në maksimum.',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe IN → cilido pin PWM (~D9, ~D3, ~D5, ~D6, ~D10 ose ~D11).',
      ideas: ['Kohëmatës / alarm i heshtur', 'Navigator haptik majtas/djathtas (përdor 2!)', 'Reagim dridhjeje për goditje në lojë'],
      tips: ['Meqë ka drejtues MOSFET të integruar, lidhet sigurt direkt në pin PWM (ndryshe nga motorët DC të zhveshur!).']
    }
  },
  'dc-motor': {
    friendlyName: 'Motor DC me Ingranazh / Rrotë',
    subtitle: 'Motor me Ingranazh TT 1:48 (~200 RPM)',
    shortWarn: 'KURRË mos e lidh direkt me K-Comp! Lidhe te TB6612FNG A1/A2 ose B1/B2.',
    maxReason: 'Deri në 4 motorë (2 për shield TB6612FNG × max 2 shield-e = robot 4WD).',
    studentInfo: {
      whatItDoes: 'Një motor klasik i verdhë DC me ingranazhe dhe çift rrotullues të lartë për rrota robotësh ose shirita transportues.',
      howToConnect: 'KURRË mos e lidh direkt me K-Comp! Lidhe dy telat e motorit VETËM në daljet A1/A2 ose B1/B2 të shield-it TB6612FNG.',
      ideas: ['Makinë robotike 2WD ose 4WD', 'Garues ndjekës i vijës', 'Rrotë fati me motor'],
      tips: ['Lidhja e drejtpërdrejtë në pinat e ATmega328P e dëmton përgjithmonë mikrokontrolluesin nga rryma e lartë dhe goditjet e tensionit!', 'Shto fillimisht shield-in TB6612FNG.']
    }
  },
  'mq135': {
    friendlyName: 'Sensor Gazi i Cilësisë së Ajrit',
    subtitle: 'NH3, NOx, CO2, Benzen & Tym',
    maxReason: 'Ngrohësi i brendshëm tërheq ~150mA dhe K-Comp ka vetëm 2 pina analogë të lirueshëm (A3, A0).',
    studentInfo: {
      whatItDoes: 'Zbulon ajrin e ndenjur, gazet e lidhura me CO2, amoniakun, tymin dhe avujt duke matur ndryshimin e rezistencës së rrjetës së ngrohur.',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe AO (Dalja Analoge) → A3 (ose A0 nëse DIP S1-3 Potenciometri është OFF). Lëre DO pa lidhur.',
      ideas: ['Sinjal „Hap dritaren!“ në klasë', 'Semafor i cilësisë së ajrit në OLED', 'Detektor parfumi / deodoranti'],
      tips: ['Ngrohet ndjeshëm — është normale! Ngrohësi i brendshëm kërkon 1–3 minuta për t’u stabilizuar.', 'Përfshi <kcomp_MQSensors.h>.']
    }
  },
  'mq2': {
    friendlyName: 'Sensor i Tymit & Gazit',
    subtitle: 'LPG, Propan, Metan & Tym',
    maxReason: 'Ngrohësi i brendshëm tërheq ~150mA dhe hyrjet analoge janë të kufizuara (A3, A0).',
    studentInfo: {
      whatItDoes: 'Reagon fort ndaj tymit, gazit të gatimit (LPG/propan) dhe metanit — i shkëlqyer për një prototip alarmi tymi në laborator.',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe AO → A3 (ose A0 me S1-3 OFF).',
      ideas: ['Demo e alarmit të rrjedhjes së gazit', 'Detektor tymi me sinjalizues & LED të kuq', 'Grafik me shtylla i nivelit të gazit në OLED'],
      tips: ['Vetëm për demo edukative — KURRË mos u mbështet te ai si alarm i vërtetë sigurie në shtëpi!', 'Tërheq ~150mA dhe ngrohet gjatë punës.']
    }
  },
  'mq7': {
    friendlyName: 'Sensor i Monoksidit të Karbonit',
    subtitle: 'Sensor i Përqendrimit të Gazit CO',
    maxReason: 'Ngrohësi i brendshëm tërheq ~150mA dhe hyrjet analoge janë të kufizuara (A3, A0).',
    studentInfo: {
      whatItDoes: 'Zbulon përqendrimin e gazit Monoksid Karboni (CO) si tension analog që K-Comp e lexon me analogRead().',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe AO → A3 (ose A0 me S1-3 OFF).',
      ideas: ['Panel paralajmërues i cilësisë së ajrit', 'Monitor mjedisor me shumë sensorë', 'Alarm pragu me sinjalizues'],
      tips: ['VETËM sensor edukativ — JO i certifikuar për alarme sigurie jete për CO!', 'Ngrohësi i brendshëm ngrohet (~150mA).']
    }
  },
  'mq3': {
    friendlyName: 'Sensor i Avujve të Alkoolit',
    subtitle: 'Sensor i Përqendrimit të Etanolit / Alkoolit',
    maxReason: 'Ngrohësi i brendshëm tërheq ~150mA dhe hyrjet analoge janë të kufizuara (A3, A0).',
    studentInfo: {
      whatItDoes: 'Zbulon avujt e etanolit / alkoolit në ajër — mund ta testosh sigurt në laborator me një pikë dezinfektues duarsh mbi një shami afër tij!',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe AO → A3 (ose A0 me S1-3 OFF).',
      ideas: ['Testues i avujve të dezinfektuesit', 'Demo e mini-alkooltestit në OLED', 'Monitor i ajrosjes së laboratorit'],
      tips: ['Lër ~60 sekonda ngrohje për vlerë bazë të qëndrueshme.', 'KURRË mos pikë dezinfektues të lëngshëm direkt mbi rrjetën e nxehtë metalike!']
    }
  },
  'soil-moisture': {
    friendlyName: 'Sensor i Lagështisë së Tokës',
    subtitle: 'Sondë Kapacitive pa Korrozion',
    maxReason: 'K-Comp ka maksimumi 2 pina analogë të jashtëm (A3 dhe A0 me S1-3 OFF).',
    studentInfo: {
      whatItDoes: 'Mat sa e lagësht ose e thatë është toka e luleve pa u ndryshkur (përdor kapacitet në vend të metalit të ekspozuar!).',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe AOUT → A3 (ose A0 me S1-3 OFF).',
      ideas: ['Monitor inteligjent bime „Më ujit!“', 'Krahasim lagështie për dy bimë (deri 2 sonda)', 'Ujitje automatike me servo'],
      tips: ['KURRË mos e fut pllakën në ujë/tokë përtej vijës së bardhë të ndërprerë!', 'Numra analogë më të ulët = tokë MË E LAGËSHT; numra më të lartë = tokë E THATË.']
    }
  },
  'ky039': {
    friendlyName: 'Sensor i Pulsit të Gishtit',
    subtitle: 'Puls Optik IR në Gisht',
    maxReason: 'Sensor optik pulsi për një përdorues + një instancë biblioteke.',
    studentInfo: {
      whatItDoes: 'Përdor një LED infra të kuq dhe detektor drite për të kapur ndryshimet e vogla të ndriçimit sa herë pulson gjaku në gisht.',
      howToConnect: 'Lidhe 5V→5V, GND→GND dhe SIG → A3 (ose A0 me S1-3 OFF).',
      ideas: ['Valë e pulsit live në Serial Plotter', 'Sinjalizues pulsi me LED të kuq', 'Lojë biofeedback për frymëmarrje të qetë'],
      tips: ['Mbuloje sensorin me dorë — dritat e forta të tavanit shkaktojnë zhurmë 50 Hz!', 'Për vlera BPM më të sakta, sensori I²C MAX30102 lexohet më lehtë.']
    }
  },
  'ad8232': {
    friendlyName: 'Sensor EKG i Sinjalit të Zemrës',
    subtitle: 'Elektrokardiogram me 1 Kanal (EKG)',
    shortWarn: 'VETËM 3.3V (5V e shkatërron çipin)! Përdor laptopin me bateri kur mban elektrodat.',
    protoNote: 'Vendose në fushën e kuqe Prototyping Area për ta mbajtur të qëndrueshme lidhjen 3.3V dhe prizën e elektrodave.',
    maxReason: 'Një modul i vetëm EKG me 1 pin analog + 2 dixhitalë dhe ushqim strikt 3.3V.',
    studentInfo: {
      whatItDoes: 'Mat sinjalet e vogla elektrike të zemrës (elektrokardiogram / EKG) përmes elektrodave ngjitëse, si një monitor zemre spitalor!',
      howToConnect: 'STRIKT lidhe 3.3V → K-Comp 3.3V (KURRË 5V!), GND→GND, OUTPUT→A3 dhe LO+/LO− në dy pina dixhitalë (p.sh. D7/D6) për zbulimin e shkëputjes së elektrodave.',
      ideas: ['Grafik EKG live në Serial Plotter', 'Monitor zemre në kohë reale në OLED', 'Alarm i shkëputjes së elektrodave'],
      tips: ['RREZIK: 5V e shkatërron menjëherë çipin AD8232 — verifiko 3.3V dy herë!', 'SIGURI: Shkëpute GJITHMONË karikuesin e laptopit (puno VETËM ME BATERI) kur mban elektroda EKG!']
    }
  },
  'ir-rx': {
    friendlyName: 'Marrës Infra i Kuq (Telekomandë)',
    subtitle: 'Demodulator Infra i Kuq 38kHz (NEC)',
    maxReason: 'Përdor një interrupt harduerik (D2 ose ~D3) me një dekoder ISR në sfond.',
    studentInfo: {
      whatItDoes: 'Merr impulse të padukshme infra të kuqe 38 kHz nga telekomanda me 21 butona që ta kontrollosh K-Comp nga ana tjetër e dhomës!',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe OUT strikt në pinin e interrupt-it D2 (INT0) ose ~D3 (INT1).',
      ideas: ['Robot ose servo me telekomandë', 'Navigim i menusë në OLED pa tela', 'Buzzer kuizi me telekomandë'],
      tips: ['Duhet lidhur në D2 ose ~D3 — pinat e zakonshëm dixhitalë nuk aktivizojnë interrupt-in e shpejtë.', 'Kërkon vijë shikimi të drejtpërdrejtë mes telekomandës dhe sensorit.']
    }
  },
  'ir-tx': {
    friendlyName: 'Dhënës Infra i Kuq (Telekomandë)',
    subtitle: 'Diodë Dërguese Infra e Kuqe 38kHz',
    maxReason: 'Përdor gjenerimin harduerik Timer2 me një instancë dhënësi.',
    studentInfo: {
      whatItDoes: 'Dërgon sinjale të padukshme infra të kuqe 38 kHz — shndërroje K-Comp në telekomandën tënde të programueshme për TV, projektor ose robot!',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe DAT → një pin PWM (rekomandohet ~D3).',
      ideas: ['Telekomandë universale për projektorin e klasës', 'Lojë laser-tag infra e kuqe (me Marrës IR)', 'Dërgues mesazhesh sekrete IR mes dy pllakave'],
      tips: ['Trik argëtues: drejto kamerën e telefonit te LED-i IR gjatë transmetimit — shumë kamera e shohin dritën e padukshme vjollcë!']
    }
  },
  'rf433-tx': {
    friendlyName: 'Dhënës Radio 433 MHz',
    subtitle: 'Dhënës RF ASK 433 MHz (FS1000A)',
    shortWarn: 'Shto një tel 17.3 cm në pad-in ANT për rreze > 1 m.',
    protoNote: 'Vendose në fushën e kuqe Prototyping Area për qasje të pastër dhe antenë vertikale.',
    maxReason: 'RadioHead RH_ASK përdor Timer1 me një instancë dhënësi për pllakë.',
    studentInfo: {
      whatItDoes: 'Transmeton paketa të thjeshta radio në 433 MHz te një Marrës 433 MHz në pllakë tjetër — punon edhe përmes mureve pa vijë shikimi!',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe DATA → cilido pin dixhital i lirë (p.sh. D12 ose D8).',
      ideas: ['Zile dere pa tela', 'Dërgues i sensorit të motit në distancë', 'Telekomandë e thjeshtë makine RC'],
      tips: ['Ngjit një tel të drejtë 17.3 cm te pad-i ANT — pa antenë rrezja është nën 1 metër!', 'Vetëm një drejtim: kombinoje me një Marrës 433 MHz në një K-Comp tjetër.']
    }
  },
  'rf433-rx': {
    friendlyName: 'Marrës Radio 433 MHz',
    subtitle: 'Marrës RF ASK 433 MHz (MX-RM-5V)',
    shortWarn: 'Shto një tel 17.3 cm në pad-in ANT për marrje të pastër.',
    protoNote: 'Vendose në fushën e kuqe Prototyping Area për qasje të pastër dhe antenë të qëndrueshme.',
    maxReason: 'RadioHead RH_ASK përdor Timer1 me një instancë marrësi për pllakë.',
    studentInfo: {
      whatItDoes: 'Dëgjon paketa radio 433 MHz të dërguara nga një Dhënës 433 MHz në një K-Comp tjetër ose telekomandë e thjeshtë RF.',
      howToConnect: 'Lidhe VCC→5V, GND→GND dhe DATA → cilido pin dixhital i lirë (p.sh. D2 ose D8).',
      ideas: ['Marrës alarmi pa tela me OLED + sinjalizues', 'Hapës porte/garazhi me servo', 'Ekran i brendshëm për sensor të jashtëm'],
      tips: ['Saldo një tel të drejtë 17.3 cm në pad-in ANT për marrje të pastër.', 'Përdor Timer1 (shmang kombinimin me Servo në të njëjtën pllakë nëse vëren dridhje).']
    }
  },
  'ds18b20': {
    friendlyName: 'Sondë Temperature e Papërshkueshme nga Uji',
    subtitle: 'Sondë Temperature 1-Wire Rezistente ndaj Ujit',
    shortWarn: 'E pajisur paraprakisht me rezistencën 4.7 kΩ pull-up — lidhe direkt me 5V, GND & pin dixhital.',
    maxReason: 'Deri në 2 sonda punojnë shkëlqyeshëm (p.sh. temperaturë e brendshme vs. e jashtme).',
    studentInfo: {
      whatItDoes: 'Një sondë temperature prej çeliku inoks e papërshkueshme nga uji që mund ta zhytësh direkt në ujë, çaj, borë ose tokë (−55 °C deri +125 °C)!',
      howToConnect: 'Sonda e laboratorit vjen tashmë me rezistencën 4.7 kΩ pull-up të integruar — nuk duhet rezistencë shtesë në breadboard! Lidhe E kuqe → 5V, E zezë → GND dhe E verdhë (DQ) → cilido pin dixhital i lirë (p.sh. D8).',
      ideas: ['Alarm i temperaturës së çajit / çokollatës', 'Termometër akuariumi me alarm', 'Regjistrues me 2 sonda (brenda vs. jashtë)'],
      tips: ['Rezistenca pull-up është tashmë e montuar në sondën e laboratorit — nuk ke nevojë ta shtosh vetë!', 'Zhyt vetëm majën metalike & kabllon e zezë — mbaje konektorin të thatë.']
    }
  },
  'hx711': {
    friendlyName: 'Peshore Dixhitale / Sensor Peshe',
    subtitle: 'ADC 24-Bit për Qeliza Peshe (50 kg)',
    protoNote: 'Përdor fushën e kuqe Prototyping Area për të lidhur pastër 4 gjysmë-urat e peshës në një urë Wheatstone.',
    maxReason: 'Përdor 2 pina dixhitalë dhe një instancë kalibrimi në kcomp_HX711.h.',
    studentInfo: {
      whatItDoes: 'Lexon ndryshime të vogla tensioni nga qelizat metalike të peshës që të ndërtosh peshoren tënde të saktë dixhitale!',
      howToConnect: 'Lidhe VCC→5V, GND→GND, DT (Të dhëna) → D2 dhe SCK (Ora) → D8 (ose dy pina dixhitalë të lirë). Lidhe qelizat e peshës në E+/E−/A+/A−.',
      ideas: ['Peshore dixhitale me gramë në OLED', 'Gjurmues i peshës së shishes së ujit', 'Matës i peshës së çantës / pakos'],
      tips: ['Thirri gjithmonë tareHX711() pa asgjë mbi peshore në fillim për ta zeruar.', 'Kalibroje një herë me një peshë të njohur (p.sh. shishe uji 500 ml plot ≈ 500 g).']
    }
  },
  'tft-gc9a01': {
    friendlyName: 'Ekran i Rrumbullakët me Ngjyra (1.28")',
    subtitle: 'Ekran IPS RGB 240×240 (I²C)',
    shortWarn: 'Lidhe përmes I²C (H1–H3). Përdor OLED Paged nëse kombinon të dy ekranet.',
    maxReason: 'Adresë e vetme I²C (0x3D) dhe ~220 B SRAM.',
    studentInfo: {
      whatItDoes: 'Një ekran rrethor 240×240 IPS me ngjyra të plota — ideal për faqe ore inteligjente, shpejtësimatës, tregues dhe sy roboti të animuar!',
      howToConnect: 'Lidhe 4 pinat aktivë I²C (VCC, GND, SCL, SDA) me cilindo header I²C të K-Comp (H1–H3). Lëri pa lidhur pinat e hirtë DC, CS dhe RST.',
      ideas: ['Faqe ore inteligjente / orë analoge', 'Shpejtësimatës makine ose matës pjerrësie', 'Sy roboti i animuar me shprehje'],
      tips: ['Nëse përdor TË DY ekranet (OLED + TFT rrethor), kaloje OLED në modalitetin Paged për të kursyer 864 B SRAM.', 'Adresa I²C është 0x3D (nuk përplaset me OLED në 0x3C).']
    }
  }
};
