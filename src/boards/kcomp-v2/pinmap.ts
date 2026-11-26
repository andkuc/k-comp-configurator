// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// K-Comp V2 (ATmega328P) Complete Declarative BoardProfile (Zero Hardcoded Engine Rules)
import type { BoardProfile } from '../../types';

export const KCOMP_V2_BOARD: BoardProfile = {
  "id": "kcomp-v2",
  "name": "K-Comp V2 (ATmega328P)",
  "shortName": "K-Comp V2",
  "badge": "K2",
  "mcu": "atmega328p",
  "svgAsset": "assets/kcomp-v2.svg",
  "viewBox": {
    "width": 532,
    "height": 358
  },
  "canvasPlacement": {
    "tx": 354,
    "ty": 134,
    "scale": 1.15
  },
  "electrical": {
    "logicVoltage": 5,
    "sramBytes": 2048,
    "sramBaseOverheadBytes": 210,
    "flashBytes": 32768,
    "usbMaxMa": 500,
    "baseCurrentMa": 45
  },
  "capabilities": {
    "hasPinMux": false,
    "hardwareUartCount": 1,
    "hasDipSwitches": true,
    "hasBreadboard": true,
    "hasWirelessSlot": true,
    "hasOnboardPeripherals": true,
    "hasWifi": false
  },
  "powerPinPriority": {
    "GND": [
      "PWR_GND1",
      "PWR_GND2",
      "TOP_GND"
    ],
    "POWER_5V": [
      "PWR_5V"
    ],
    "POWER_3V3": [
      "PWR_3V3"
    ],
    "RESET": [
      "PWR_RESET"
    ]
  },
  "i2cHeaderOrder": [
    "H2",
    "H1",
    "H3"
  ],
  "defaultI2cPins": {
    "sda": "A4",
    "scl": "A5"
  },
  "breadboard": {
    "cols": 16,
    "colX": [
      293.5,
      303.0,
      312.5,
      322.0,
      331.5,
      341.0,
      350.5,
      360.0,
      369.5,
      379.0,
      388.5,
      398.0,
      407.5,
      417.0,
      426.5,
      436.0
    ],
    "topY": [
      24,
      36,
      48,
      58
    ],
    "botY": [
      78,
      90,
      102,
      112
    ]
  },
  "onboardZones": [
    {
      "id": "onboard_oled",
      "x": 321,
      "y": 127,
      "w": 76,
      "h": 88,
      "rx": 4,
      "accent": "#38bdf8",
      "flashRect": {
        "x": 323,
        "y": 129,
        "w": 72,
        "h": 84
      }
    },
    {
      "id": "onboard_joystick",
      "x": 87,
      "y": 191,
      "w": 86,
      "h": 94,
      "rx": 4,
      "accent": "#34d399",
      "flashRect": {
        "x": 89,
        "y": 193,
        "w": 82,
        "h": 90
      }
    },
    {
      "id": "onboard_led",
      "x": 286,
      "y": 266,
      "w": 36,
      "h": 36,
      "rx": 18,
      "accent": "#ef4444",
      "flashRect": {
        "x": 288,
        "y": 268,
        "w": 32,
        "h": 32
      }
    },
    {
      "id": "onboard_pot",
      "x": 202,
      "y": 286,
      "w": 56,
      "h": 68,
      "rx": 4,
      "accent": "#fbbf24",
      "flashRect": {
        "x": 204,
        "y": 288,
        "w": 52,
        "h": 64
      }
    },
    {
      "id": "onboard_start",
      "x": 392,
      "y": 266,
      "w": 40,
      "h": 30,
      "rx": 5,
      "accent": "#22c55e",
      "flashRect": {
        "x": 394,
        "y": 268,
        "w": 36,
        "h": 26
      }
    },
    {
      "id": "onboard_select",
      "x": 328,
      "y": 266,
      "w": 40,
      "h": 30,
      "rx": 5,
      "accent": "#0ea5e9",
      "flashRect": {
        "x": 330,
        "y": 268,
        "w": 36,
        "h": 26
      }
    },
    {
      "id": "onboard_buzzer",
      "x": 427,
      "y": 153,
      "w": 50,
      "h": 50,
      "rx": 25,
      "accent": "#facc15",
      "flashRect": {
        "x": 429,
        "y": 155,
        "w": 46,
        "h": 46
      }
    },
    {
      "id": "onboard_distance",
      "x": 455,
      "y": 28,
      "w": 61,
      "h": 126,
      "rx": 5,
      "accent": "#38bdf8",
      "flashRect": {
        "x": 456,
        "y": 30,
        "w": 58,
        "h": 122
      }
    },
    {
      "id": "onboard_wireless",
      "x": 177,
      "y": 191,
      "w": 120,
      "h": 78,
      "rx": 4,
      "accent": "#c084fc",
      "flashRect": {
        "x": 179,
        "y": 193,
        "w": 116,
        "h": 74
      }
    }
  ],
  "onboardPeripherals": [
    {
      "id": "onboard_oled",
      "name": "OLED Display 0.96\"",
      "pinInfo": "I2C 0x3C (A4/A5)",
      "defaultEnabled": true,
      "hardwired": true,
      "sram": 1024,
      "sramPaged": 160,
      "modeToggle": true,
      "dip": null,
      "codeFull": {
        "includes": [
          "#include <kcomp_oled.h>"
        ],
        "setup": [
          "if (!initDisplay()) {",
          "  Serial.println(F(\"CRITICAL ERROR: OLED init failed!\"));",
          "  while (1);",
          "}"
        ],
        "loop": []
      },
      "codePaged": {
        "includes": [
          "#include <kcomp_oled_paged.h>"
        ],
        "setup": [
          "if (!initDisplay()) {",
          "  Serial.println(F(\"CRITICAL ERROR: OLED (paged) init failed!\"));",
          "  while (1);",
          "}"
        ],
        "loop": [
          "// Use paged draw loop to save ~864 B SRAM"
        ]
      },
      "shortName": "OLED",
      "accent": "#38bdf8",
      "currentMa": 20,
      "i2cAddr": "0x3C"
    },
    {
      "id": "onboard_joystick",
      "name": "Analog Joystick",
      "pinInfo": "A1 (VRX) / A2 (VRY)",
      "defaultEnabled": true,
      "hardwired": true,
      "sram": 35,
      "dip": null,
      "code": {
        "includes": [
          "#include <kcomp_joystick.h>"
        ],
        "setup": [
          "initJoystick();"
        ],
        "loop": [
          "// int x = getJoystickXValue(); int y = getJoystickYValue();"
        ]
      },
      "shortName": "Joystick",
      "accent": "#34d399",
      "currentMa": 5,
      "pins": [
        {
          "pinId": "A1",
          "roleSuffix": "VRX",
          "hardwired": true
        },
        {
          "pinId": "A2",
          "roleSuffix": "VRY",
          "hardwired": true
        }
      ]
    },
    {
      "id": "onboard_led",
      "name": "Red LED",
      "pinInfo": "~D5 (via S1-2)",
      "defaultEnabled": true,
      "dip": 2,
      "sram": 12,
      "code": {
        "includes": [
          "#include <kcomp_led.h>"
        ],
        "setup": [
          "initLed();"
        ],
        "loop": []
      },
      "shortName": "Red LED",
      "accent": "#ef4444",
      "currentMa": 15,
      "pins": [
        {
          "pinId": "D5",
          "dip": 2
        }
      ]
    },
    {
      "id": "onboard_pot",
      "name": "Potentiometer",
      "pinInfo": "A0 (via S1-3)",
      "defaultEnabled": true,
      "dip": 3,
      "sram": 12,
      "code": {
        "includes": [
          "#include <kcomp_potentiometer.h>"
        ],
        "setup": [
          "initPotentiometer();"
        ],
        "loop": [
          "// int val = getPotentiometerValue(); // 0..100%"
        ]
      },
      "shortName": "Pot",
      "accent": "#fbbf24",
      "currentMa": 2,
      "pins": [
        {
          "pinId": "A0",
          "dip": 3
        }
      ]
    },
    {
      "id": "onboard_start",
      "name": "START Button",
      "pinInfo": "~D3 (via S1-4)",
      "defaultEnabled": true,
      "dip": 4,
      "sram": 24,
      "code": {
        "includes": [
          "#include <kcomp_button_start.h>"
        ],
        "setup": [
          "initButtonStart();"
        ],
        "loop": [
          "pollStartButton();"
        ]
      },
      "shortName": "START",
      "accent": "#22c55e",
      "currentMa": 1,
      "pins": [
        {
          "pinId": "D3",
          "dip": 4
        }
      ]
    },
    {
      "id": "onboard_select",
      "name": "SELECT Button",
      "pinInfo": "D4 (via S1-5)",
      "defaultEnabled": true,
      "dip": 5,
      "sram": 24,
      "code": {
        "includes": [
          "#include <kcomp_button_select.h>"
        ],
        "setup": [
          "initButtonSelect();"
        ],
        "loop": [
          "pollSelectButton();"
        ]
      },
      "shortName": "SELECT",
      "accent": "#0ea5e9",
      "currentMa": 1,
      "pins": [
        {
          "pinId": "D4",
          "dip": 5
        }
      ]
    },
    {
      "id": "onboard_buzzer",
      "name": "Passive Buzzer",
      "pinInfo": "~D9 (via S1-6)",
      "defaultEnabled": true,
      "dip": 6,
      "sram": 38,
      "code": {
        "includes": [
          "#include <kcomp_buzzer.h>"
        ],
        "setup": [
          "initBuzzer();"
        ],
        "loop": [
          "updateMelody();"
        ]
      },
      "shortName": "Buzzer",
      "accent": "#facc15",
      "currentMa": 25,
      "pins": [
        {
          "pinId": "D9",
          "dip": 6
        }
      ]
    },
    {
      "id": "onboard_distance",
      "name": "Ultrasonic Slot",
      "pinInfo": "TRIG D10 / ECHO D11",
      "defaultEnabled": true,
      "dip": null,
      "sram": 30,
      "code": {
        "includes": [
          "#include <kcomp_distance.h>"
        ],
        "setup": [
          "initDistanceSensor();"
        ],
        "loop": [
          "// int distMM = getDistanceMM();"
        ]
      },
      "shortName": "Distance",
      "accent": "#38bdf8",
      "currentMa": 15,
      "pins": [
        {
          "pinId": "D10",
          "roleSuffix": "TRIG"
        },
        {
          "pinId": "D11",
          "roleSuffix": "ECHO"
        }
      ],
      "conflictPins": [
        "D10",
        "D11"
      ],
      "conflictWarningKey": "warn.ultrasonicConflict"
    }
  ],
  "defaultCodeProfile": "kcomp-avr",
  "supportedCodeProfiles": [
    "kcomp-avr"
  ],
  "targetMeta": {
    "flashProtocol": "stk500v1",
    "defaultBaud": 115200
  },
  "flashProfile": {
    "protocol": "stk500v1",
    "uploadBaud": 115200,
    "fallbackUploadBauds": [57600],
    "flashSizeBytes": 32256,
    "pageSizeBytes": 128,
    "signature": [0x1e, 0x95, 0x0f],
    "resetChain": ["mcp2221-webhid", "cdc-dtr", "manual"],
    "autoResetDipSwitchId": 1,
    "usbFilters": [
      { "vendorId": 0x04d8, "productId": 0x00dd }
    ],
    "acceptedFileExtensions": [".hex", ".ihex"],
    "supportsVerify": true
  },
  "mechanical": {
    "widthMm": 135.0,
    "heightMm": 91.0,
    "cornerRadiusMm": 2.0,
    "origin": "top-left",
    "mountingHoles": [
      {
        "id": "MH1",
        "xMm": 4.5,
        "yMm": 4.5,
        "drillMm": 3.2,
        "plated": false
      },
      {
        "id": "MH2",
        "xMm": 130.5,
        "yMm": 4.5,
        "drillMm": 3.2,
        "plated": false
      },
      {
        "id": "MH3",
        "xMm": 4.5,
        "yMm": 86.5,
        "drillMm": 3.2,
        "plated": false
      },
      {
        "id": "MH4",
        "xMm": 130.5,
        "yMm": 86.5,
        "drillMm": 3.2,
        "plated": false
      }
    ],
    "headers": [
      {
        "id": "HDR_DIGITAL_TOP",
        "label": "Top Digital & I2C Header",
        "xMm": 23.37,
        "yMm": 9.4,
        "pitchMm": 2.54,
        "pinCount": 18,
        "orientationDeg": 0,
        "pins": [
          "TOP_SCL",
          "TOP_SDA",
          "TOP_AREF",
          "TOP_GND",
          "D13",
          "D12",
          "D11",
          "D10",
          "D9",
          "D8",
          "D7",
          "D6",
          "D5",
          "D4",
          "D3",
          "D2",
          "D1",
          "D0"
        ]
      },
      {
        "id": "HDR_POWER_ANALOG",
        "label": "Power & Analog Header",
        "xMm": 28.45,
        "yMm": 46.86,
        "pitchMm": 2.54,
        "pinCount": 12,
        "orientationDeg": 0,
        "pins": [
          "PWR_RESET",
          "PWR_3V3",
          "PWR_5V",
          "PWR_GND1",
          "PWR_GND2",
          "PWR_VIN",
          "A0",
          "A1",
          "A2",
          "A3",
          "A4",
          "A5"
        ]
      }
    ]
  },
  "pins": {
    "EXT_VIN": {
      "label": "EXT VIN",
      "group": "power",
      "caps": [
        "VIN"
      ],
      "shared": true,
      "x": 53.0,
      "y": 232.5
    },
    "EXT_GND": {
      "label": "EXT GND",
      "group": "power",
      "caps": [
        "GND"
      ],
      "shared": true,
      "x": 61.0,
      "y": 232.5
    },
    "TOP_SCL": {
      "label": "TOP SCL (A5)",
      "group": "i2c",
      "pinNum": "A5",
      "caps": [
        "I2C_SCL"
      ],
      "shared": true,
      "x": 92.0,
      "y": 37.0
    },
    "TOP_SDA": {
      "label": "TOP SDA (A4)",
      "group": "i2c",
      "pinNum": "A4",
      "caps": [
        "I2C_SDA"
      ],
      "shared": true,
      "x": 102.0,
      "y": 37.0
    },
    "TOP_AREF": {
      "label": "AREF",
      "group": "power",
      "caps": [
        "AREF"
      ],
      "x": 112.0,
      "y": 37.0
    },
    "TOP_GND": {
      "label": "TOP GND",
      "group": "power",
      "caps": [
        "GND"
      ],
      "shared": true,
      "x": 122.0,
      "y": 37.0
    },
    "D13": {
      "label": "D13",
      "group": "digital",
      "pinNum": "13",
      "caps": [
        "DIGITAL"
      ],
      "freeDefault": true,
      "note": "Free by default",
      "x": 132.0,
      "y": 37.0,
      "signalPin": true
    },
    "D12": {
      "label": "D12",
      "group": "digital",
      "pinNum": "12",
      "caps": [
        "DIGITAL"
      ],
      "freeDefault": true,
      "note": "Free by default",
      "x": 142.0,
      "y": 37.0,
      "signalPin": true
    },
    "D11": {
      "label": "~D11 (PWM)",
      "group": "digital",
      "pinNum": "11",
      "caps": [
        "DIGITAL",
        "PWM"
      ],
      "onboardSlot": "distance_echo",
      "note": "Shared with onboard Ultrasonic ECHO",
      "x": 152.0,
      "y": 37.0,
      "signalPin": true
    },
    "D10": {
      "label": "~D10 (PWM)",
      "group": "digital",
      "pinNum": "10",
      "caps": [
        "DIGITAL",
        "PWM"
      ],
      "onboardSlot": "distance_trig",
      "note": "Shared with onboard Ultrasonic TRIG / Joystick SW",
      "x": 162.0,
      "y": 37.0,
      "signalPin": true
    },
    "D9": {
      "label": "~D9 (PWM)",
      "group": "digital",
      "pinNum": "9",
      "caps": [
        "DIGITAL",
        "PWM"
      ],
      "dip": 6,
      "onboard": "buzzer",
      "note": "Shared with Onboard Buzzer (set S1-6 OFF for external use)",
      "x": 172.0,
      "y": 37.0,
      "signalPin": true
    },
    "D8": {
      "label": "D8",
      "group": "digital",
      "pinNum": "8",
      "caps": [
        "DIGITAL"
      ],
      "freeDefault": true,
      "note": "Free by default",
      "x": 182.0,
      "y": 37.0,
      "signalPin": true
    },
    "D7": {
      "label": "D7",
      "group": "digital",
      "pinNum": "7",
      "caps": [
        "DIGITAL"
      ],
      "dip": 8,
      "onboard": "wireless_tx",
      "note": "Shared with Wireless Slot TX (set S1-8 OFF for external use)",
      "x": 204.0,
      "y": 37.0,
      "signalPin": true
    },
    "D6": {
      "label": "~D6 (PWM)",
      "group": "digital",
      "pinNum": "6",
      "caps": [
        "DIGITAL",
        "PWM"
      ],
      "dip": 7,
      "onboard": "wireless_rx",
      "note": "Shared with Wireless Slot RX (set S1-7 OFF for external use)",
      "x": 214.0,
      "y": 37.0,
      "signalPin": true
    },
    "D5": {
      "label": "~D5 (PWM)",
      "group": "digital",
      "pinNum": "5",
      "caps": [
        "DIGITAL",
        "PWM"
      ],
      "dip": 2,
      "onboard": "red_led",
      "note": "Shared with Red LED (set S1-2 OFF for external use)",
      "x": 224.0,
      "y": 37.0,
      "signalPin": true
    },
    "D4": {
      "label": "D4",
      "group": "digital",
      "pinNum": "4",
      "caps": [
        "DIGITAL"
      ],
      "dip": 5,
      "onboard": "select_btn",
      "note": "Shared with SELECT button (set S1-5 OFF for external use)",
      "x": 234.0,
      "y": 37.0,
      "signalPin": true
    },
    "D3": {
      "label": "~D3 (PWM/INT1)",
      "group": "digital",
      "pinNum": "3",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "dip": 4,
      "onboard": "start_btn",
      "note": "Shared with START button (set S1-4 OFF for external use)",
      "x": 244.0,
      "y": 37.0,
      "signalPin": true
    },
    "D2": {
      "label": "D2 (INT0)",
      "group": "digital",
      "pinNum": "2",
      "caps": [
        "DIGITAL",
        "INT"
      ],
      "freeDefault": true,
      "note": "Free by default; Hardware Interrupt INT0",
      "x": 254.0,
      "y": 37.0,
      "signalPin": true
    },
    "D1": {
      "label": "D1 (TX)",
      "group": "digital",
      "pinNum": "1",
      "caps": [
        "DIGITAL"
      ],
      "blocked": true,
      "reason": "Reserved for USB Optiboot Serial TX",
      "x": 264.0,
      "y": 37.0,
      "signalPin": true
    },
    "D0": {
      "label": "D0 (RX)",
      "group": "digital",
      "pinNum": "0",
      "caps": [
        "DIGITAL"
      ],
      "blocked": true,
      "reason": "Reserved for USB Optiboot Serial RX",
      "x": 274.0,
      "y": 37.0,
      "signalPin": true
    },
    "H1_VCC": {
      "label": "I2C H1 VCC (5V)",
      "group": "i2c_h1",
      "caps": [
        "5V",
        "H1_VCC"
      ],
      "shared": true,
      "x": 145.0,
      "y": 78.5,
      "headerId": "H1",
      "headerRole": "VCC"
    },
    "H1_GND": {
      "label": "I2C H1 GND",
      "group": "i2c_h1",
      "caps": [
        "GND",
        "H1_GND"
      ],
      "shared": true,
      "x": 155.0,
      "y": 78.5,
      "headerId": "H1",
      "headerRole": "GND"
    },
    "H1_SCL": {
      "label": "I2C H1 SCL",
      "group": "i2c_h1",
      "caps": [
        "I2C_SCL",
        "H1_SCL"
      ],
      "shared": true,
      "x": 165.0,
      "y": 78.5,
      "headerId": "H1",
      "headerRole": "SCL"
    },
    "H1_SDA": {
      "label": "I2C H1 SDA",
      "group": "i2c_h1",
      "caps": [
        "I2C_SDA",
        "H1_SDA"
      ],
      "shared": true,
      "x": 175.0,
      "y": 78.5,
      "headerId": "H1",
      "headerRole": "SDA"
    },
    "PWR_NC": {
      "label": "NC",
      "group": "power",
      "caps": [],
      "x": 131.0,
      "y": 184.5
    },
    "PWR_IOREF": {
      "label": "IOREF",
      "group": "power",
      "caps": [
        "IOREF"
      ],
      "x": 141.0,
      "y": 184.5
    },
    "PWR_RESET": {
      "label": "POWER RESET",
      "group": "power",
      "caps": [
        "RESET"
      ],
      "shared": true,
      "x": 151.0,
      "y": 184.5
    },
    "PWR_3V3": {
      "label": "POWER 3.3V",
      "group": "power",
      "caps": [
        "3V3"
      ],
      "shared": true,
      "x": 161.0,
      "y": 184.5
    },
    "PWR_5V": {
      "label": "POWER 5V",
      "group": "power",
      "caps": [
        "5V"
      ],
      "shared": true,
      "x": 171.0,
      "y": 184.5
    },
    "PWR_GND1": {
      "label": "POWER GND (1)",
      "group": "power",
      "caps": [
        "GND"
      ],
      "shared": true,
      "x": 181.0,
      "y": 184.5
    },
    "PWR_GND2": {
      "label": "POWER GND (2)",
      "group": "power",
      "caps": [
        "GND"
      ],
      "shared": true,
      "x": 191.0,
      "y": 184.5
    },
    "PWR_VIN": {
      "label": "POWER VIN",
      "group": "power",
      "caps": [
        "VIN"
      ],
      "shared": true,
      "x": 201.0,
      "y": 184.5
    },
    "A0": {
      "label": "A0 (Analog)",
      "group": "analog",
      "pinNum": "A0",
      "caps": [
        "ANALOG",
        "DIGITAL"
      ],
      "dip": 3,
      "onboard": "potentiometer",
      "note": "Shared with Onboard Potentiometer (set S1-3 OFF for external use)",
      "x": 220.0,
      "y": 184.5,
      "signalPin": true
    },
    "A1": {
      "label": "A1 (Joystick X)",
      "group": "analog",
      "pinNum": "A1",
      "caps": [
        "ANALOG"
      ],
      "blocked": true,
      "reason": "Hardwired to Onboard Joystick VRX (cannot disconnect via S1)",
      "x": 230.0,
      "y": 184.5,
      "signalPin": true
    },
    "A2": {
      "label": "A2 (Joystick Y)",
      "group": "analog",
      "pinNum": "A2",
      "caps": [
        "ANALOG"
      ],
      "blocked": true,
      "reason": "Hardwired to Onboard Joystick VRY (cannot disconnect via S1)",
      "x": 240.0,
      "y": 184.5,
      "signalPin": true
    },
    "A3": {
      "label": "A3 (Analog)",
      "group": "analog",
      "pinNum": "A3",
      "caps": [
        "ANALOG",
        "DIGITAL"
      ],
      "freeDefault": true,
      "note": "Free by default (best primary analog pin)",
      "x": 250.0,
      "y": 184.5,
      "signalPin": true
    },
    "A4": {
      "label": "A4 (I2C SDA)",
      "group": "analog",
      "pinNum": "A4",
      "caps": [
        "I2C_SDA"
      ],
      "shared": true,
      "note": "I2C Bus SDA (shared with OLED & H1-H3)",
      "x": 260.0,
      "y": 184.5
    },
    "A5": {
      "label": "A5 (I2C SCL)",
      "group": "analog",
      "pinNum": "A5",
      "caps": [
        "I2C_SCL"
      ],
      "shared": true,
      "note": "I2C Bus SCL (shared with OLED & H1-H3)",
      "x": 270.0,
      "y": 184.5
    },
    "HC05_VCC": {
      "label": "HC-05 Slot VCC",
      "group": "slot_hc05",
      "caps": [
        "SLOT_HC05"
      ],
      "x": 200.0,
      "y": 209.0
    },
    "HC05_GND": {
      "label": "HC-05 Slot GND",
      "group": "slot_hc05",
      "caps": [
        "SLOT_HC05"
      ],
      "x": 200.0,
      "y": 221.0
    },
    "HC05_TX": {
      "label": "HC-05 Slot TX",
      "group": "slot_hc05",
      "caps": [
        "SLOT_HC05"
      ],
      "x": 200.0,
      "y": 233.0
    },
    "HC05_RX": {
      "label": "HC-05 Slot RX",
      "group": "slot_hc05",
      "caps": [
        "SLOT_HC05"
      ],
      "x": 200.0,
      "y": 245.0
    },
    "ESP_GND": {
      "label": "ESP8266 Slot GND",
      "group": "slot_esp",
      "caps": [
        "SLOT_ESP"
      ],
      "x": 226.0,
      "y": 214.0
    },
    "ESP_TX": {
      "label": "ESP8266 Slot TX",
      "group": "slot_esp",
      "caps": [
        "SLOT_ESP"
      ],
      "x": 234.0,
      "y": 214.0
    },
    "ESP_CHPD": {
      "label": "ESP8266 Slot CHPD",
      "group": "slot_esp",
      "caps": [
        "SLOT_ESP"
      ],
      "x": 226.0,
      "y": 224.0
    },
    "ESP_NC1": {
      "label": "ESP8266 NC",
      "group": "slot_esp",
      "caps": [],
      "x": 234.0,
      "y": 224.0
    },
    "ESP_RES": {
      "label": "ESP8266 Slot RES",
      "group": "slot_esp",
      "caps": [
        "SLOT_ESP"
      ],
      "x": 226.0,
      "y": 234.0
    },
    "ESP_NC2": {
      "label": "ESP8266 NC",
      "group": "slot_esp",
      "caps": [],
      "x": 234.0,
      "y": 234.0
    },
    "ESP_3V3": {
      "label": "ESP8266 Slot 3V3",
      "group": "slot_esp",
      "caps": [
        "SLOT_ESP"
      ],
      "x": 226.0,
      "y": 244.0
    },
    "ESP_RX": {
      "label": "ESP8266 Slot RX",
      "group": "slot_esp",
      "caps": [
        "SLOT_ESP"
      ],
      "x": 234.0,
      "y": 244.0
    },
    "DIST_GND": {
      "label": "DISTANCE GND",
      "group": "distance",
      "caps": [
        "DIST_GND"
      ],
      "x": 462.89,
      "y": 76.69
    },
    "DIST_ECHO": {
      "label": "DISTANCE ECHO",
      "group": "distance",
      "caps": [
        "DIST_ECHO"
      ],
      "x": 462.89,
      "y": 86.69
    },
    "DIST_TRIG": {
      "label": "DISTANCE TRIG",
      "group": "distance",
      "caps": [
        "DIST_TRIG"
      ],
      "x": 462.89,
      "y": 96.69
    },
    "DIST_VCC": {
      "label": "DISTANCE VCC",
      "group": "distance",
      "caps": [
        "DIST_VCC"
      ],
      "x": 462.89,
      "y": 106.69
    },
    "H2_SDA": {
      "label": "I2C H2 SDA",
      "group": "i2c_h2",
      "caps": [
        "I2C_SDA",
        "H2_SDA"
      ],
      "shared": true,
      "x": 414.5,
      "y": 173.0,
      "headerId": "H2",
      "headerRole": "SDA"
    },
    "H2_SCL": {
      "label": "I2C H2 SCL",
      "group": "i2c_h2",
      "caps": [
        "I2C_SCL",
        "H2_SCL"
      ],
      "shared": true,
      "x": 414.5,
      "y": 183.0,
      "headerId": "H2",
      "headerRole": "SCL"
    },
    "H2_GND": {
      "label": "I2C H2 GND",
      "group": "i2c_h2",
      "caps": [
        "GND",
        "H2_GND"
      ],
      "shared": true,
      "x": 414.5,
      "y": 193.0,
      "headerId": "H2",
      "headerRole": "GND"
    },
    "H2_VCC": {
      "label": "I2C H2 VCC (5V)",
      "group": "i2c_h2",
      "caps": [
        "5V",
        "H2_VCC"
      ],
      "shared": true,
      "x": 414.5,
      "y": 203.0,
      "headerId": "H2",
      "headerRole": "VCC"
    },
    "H3_VCC": {
      "label": "I2C H3 VCC (5V)",
      "group": "i2c_h3",
      "caps": [
        "5V",
        "H3_VCC"
      ],
      "shared": true,
      "x": 454.5,
      "y": 217.0,
      "headerId": "H3",
      "headerRole": "VCC"
    },
    "H3_GND": {
      "label": "I2C H3 GND",
      "group": "i2c_h3",
      "caps": [
        "GND",
        "H3_GND"
      ],
      "shared": true,
      "x": 454.5,
      "y": 227.0,
      "headerId": "H3",
      "headerRole": "GND"
    },
    "H3_SCL": {
      "label": "I2C H3 SCL",
      "group": "i2c_h3",
      "caps": [
        "I2C_SCL",
        "H3_SCL"
      ],
      "shared": true,
      "x": 454.5,
      "y": 237.0,
      "headerId": "H3",
      "headerRole": "SCL"
    },
    "H3_SDA": {
      "label": "I2C H3 SDA",
      "group": "i2c_h3",
      "caps": [
        "I2C_SDA",
        "H3_SDA"
      ],
      "shared": true,
      "x": 454.5,
      "y": 247.0,
      "headerId": "H3",
      "headerRole": "SDA"
    }
  },
  "dipSwitches": [
    {
      "id": 1,
      "pin": "RESET",
      "name": "Auto-Reset (MCP2221)",
      "defaultOn": true,
      "lockedOn": true,
      "note": "Keep ON for USB Sketch Upload!"
    },
    {
      "id": 2,
      "pin": "D5",
      "name": "Red LED (~D5)",
      "defaultOn": true,
      "onboardId": "onboard_led",
      "note": "OFF if ~D5 is used externally"
    },
    {
      "id": 3,
      "pin": "A0",
      "name": "Potentiometer (A0)",
      "defaultOn": true,
      "onboardId": "onboard_pot",
      "note": "OFF if A0 is used externally"
    },
    {
      "id": 4,
      "pin": "D3",
      "name": "START Button (~D3)",
      "defaultOn": true,
      "onboardId": "onboard_start",
      "note": "OFF if ~D3 is used externally"
    },
    {
      "id": 5,
      "pin": "D4",
      "name": "SELECT Button (D4)",
      "defaultOn": true,
      "onboardId": "onboard_select",
      "note": "OFF if D4 is used externally"
    },
    {
      "id": 6,
      "pin": "D9",
      "name": "Buzzer (~D9)",
      "defaultOn": true,
      "onboardId": "onboard_buzzer",
      "note": "OFF if ~D9 is used externally (e.g. Servo)"
    },
    {
      "id": 7,
      "pin": "D6",
      "name": "Wireless Slot RX (~D6)",
      "defaultOn": true,
      "onboardId": "wireless_rx",
      "note": "ON only for onboard HC-05 / ESP-8266; OFF for external D6"
    },
    {
      "id": 8,
      "pin": "D7",
      "name": "Wireless Slot TX (D7)",
      "defaultOn": true,
      "onboardId": "wireless_tx",
      "note": "ON only for onboard HC-05 / ESP-8266; OFF for external D7"
    }
  ],
  "i2cHeaders": {
    "H1": {
      "label": "I2C Header H1 (Top-Left)",
      "VCC": "H1_VCC",
      "GND": "H1_GND",
      "SCL": "H1_SCL",
      "SDA": "H1_SDA",
      "supportsBreadboardHub": true
    },
    "H2": {
      "label": "I2C Header H2 (Mid-Right)",
      "VCC": "H2_VCC",
      "GND": "H2_GND",
      "SCL": "H2_SCL",
      "SDA": "H2_SDA",
      "supportsBreadboardHub": true
    },
    "H3": {
      "label": "I2C Header H3 (Bottom-Right)",
      "VCC": "H3_VCC",
      "GND": "H3_GND",
      "SCL": "H3_SCL",
      "SDA": "H3_SDA",
      "supportsBreadboardHub": true
    }
  }
};
