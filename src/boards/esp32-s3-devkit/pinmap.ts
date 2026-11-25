// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Standard ESP32-S3-DevKitC-1 (N16R8, 44-Pin) Complete Declarative BoardProfile
import type { BoardProfile } from '../../types';

export const ESP32_S3_DEVKIT_BOARD: BoardProfile = {
  "id": "esp32-s3-devkit",
  "name": "ESP32-S3 DevKitC-1 (N16R8)",
  "shortName": "ESP32-S3 DevKit",
  "badge": "S3",
  "mcu": "esp32s3",
  "svgAsset": "assets/esp32-s3-devkit.svg",
  "viewBox": {
    "width": 264,
    "height": 516
  },
  "canvasPlacement": {
    "tx": 512,
    "ty": 56,
    "scale": 1.12
  },
  "electrical": {
    "logicVoltage": 3.3,
    "sramBytes": 524288,
    "sramBaseOverheadBytes": 32768,
    "flashBytes": 16777216,
    "psramBytes": 8388608,
    "usbMaxMa": 500,
    "baseCurrentMa": 80
  },
  "capabilities": {
    "hasPinMux": true,
    "hardwareUartCount": 3,
    "strappingPins": [
      "GPIO0",
      "GPIO3",
      "GPIO45",
      "GPIO46"
    ],
    "adc1Pins": [
      "GPIO1",
      "GPIO2",
      "GPIO3",
      "GPIO4",
      "GPIO5",
      "GPIO6",
      "GPIO7",
      "GPIO8",
      "GPIO9",
      "GPIO10"
    ],
    "adc2WifiConflictPins": [
      "GPIO11",
      "GPIO12",
      "GPIO13",
      "GPIO14",
      "GPIO15",
      "GPIO16",
      "GPIO17",
      "GPIO18"
    ],
    "hasDipSwitches": false,
    "hasBreadboard": false,
    "hasWirelessSlot": false,
    "hasOnboardPeripherals": true,
    "hasWifi": true
  },
  "powerPinPriority": {
    "GND": [
      "GND_L1",
      "GND_R1",
      "GND_R2",
      "GND_R3"
    ],
    "POWER_5V": [
      "5V_L"
    ],
    "POWER_3V3": [
      "3V3_L1",
      "3V3_L2"
    ],
    "RESET": [
      "RST"
    ]
  },
  "i2cHeaderOrder": [
    "I2C0"
  ],
  "defaultI2cPins": {
    "sda": "GPIO8",
    "scl": "GPIO9"
  },
  "i2cHeaders": {
    "I2C0": {
      "label": "I2C Bus 0 (GPIO8 SDA / GPIO9 SCL)",
      "VCC": "3V3_L1",
      "GND": "GND_L1",
      "SCL": "GPIO9",
      "SDA": "GPIO8"
    }
  },
  "dipSwitches": [],
  "carrier": {
    "id": "breadboard-center",
    "defaultEnabled": true,
    "localBounds": {
      "minX": -128,
      "minY": 14,
      "maxX": 392,
      "maxY": 516
    },
    "canvasPlacement": {
      "tx": 518,
      "ty": 62,
      "scale": 1.06
    },
    "leftHoleXs": [
      -12,
      -29,
      -46,
      -63
    ],
    "rightHoleXs": [
      276,
      293,
      310,
      327
    ],
    "rowYs": [
      76.0,
      95.0,
      114.0,
      133.0,
      152.0,
      171.0,
      190.0,
      209.0,
      228.0,
      247.0,
      266.0,
      285.0,
      304.0,
      323.0,
      342.0,
      361.0,
      380.0,
      399.0,
      418.0,
      437.0,
      456.0,
      475.0
    ],
    "powerRails": [
      {
        "id": "BB_L_3V3",
        "side": "left",
        "netId": "NET_3V3",
        "label": "+3.3V",
        "color": "#fb923c",
        "stripeColor": "#f97316",
        "x": -92,
        "ys": [
          76.0,
          95.0,
          114.0,
          133.0,
          152.0,
          171.0,
          190.0,
          209.0,
          228.0,
          247.0,
          266.0,
          285.0,
          304.0,
          323.0,
          342.0,
          361.0,
          380.0,
          399.0,
          418.0,
          437.0,
          456.0,
          475.0
        ],
        "feederPinId": "3V3_L1"
      },
      {
        "id": "BB_L_GND",
        "side": "left",
        "netId": "NET_GND",
        "label": "GND",
        "color": "#64748b",
        "stripeColor": "#3b82f6",
        "x": -110,
        "ys": [
          76.0,
          95.0,
          114.0,
          133.0,
          152.0,
          171.0,
          190.0,
          209.0,
          228.0,
          247.0,
          266.0,
          285.0,
          304.0,
          323.0,
          342.0,
          361.0,
          380.0,
          399.0,
          418.0,
          437.0,
          456.0,
          475.0
        ],
        "feederPinId": "GND_L1"
      },
      {
        "id": "BB_R_5V",
        "side": "right",
        "netId": "NET_5V",
        "label": "+5V",
        "color": "#ef4444",
        "stripeColor": "#ef4444",
        "x": 356,
        "ys": [
          76.0,
          95.0,
          114.0,
          133.0,
          152.0,
          171.0,
          190.0,
          209.0,
          228.0,
          247.0,
          266.0,
          285.0,
          304.0,
          323.0,
          342.0,
          361.0,
          380.0,
          399.0,
          418.0,
          437.0,
          456.0,
          475.0
        ],
        "feederPinId": "5V_L"
      },
      {
        "id": "BB_R_GND",
        "side": "right",
        "netId": "NET_GND",
        "label": "GND",
        "color": "#64748b",
        "stripeColor": "#3b82f6",
        "x": 374,
        "ys": [
          76.0,
          95.0,
          114.0,
          133.0,
          152.0,
          171.0,
          190.0,
          209.0,
          228.0,
          247.0,
          266.0,
          285.0,
          304.0,
          323.0,
          342.0,
          361.0,
          380.0,
          399.0,
          418.0,
          437.0,
          456.0,
          475.0
        ],
        "feederPinId": "GND_R2"
      }
    ]
  },
  "onboardZones": [
    {
      "id": "onboard_wifi",
      "x": 84,
      "y": 164,
      "w": 96,
      "h": 26,
      "rx": 12,
      "accent": "#38bdf8",
      "flashRect": {
        "x": 84,
        "y": 164,
        "w": 96,
        "h": 26
      }
    },
    {
      "id": "onboard_rgb_led",
      "x": 110,
      "y": 312,
      "w": 44,
      "h": 38,
      "rx": 6,
      "accent": "#c084fc",
      "flashRect": {
        "x": 110,
        "y": 312,
        "w": 44,
        "h": 38
      }
    }
  ],
  "onboardPeripherals": [
    {
      "id": "onboard_wifi",
      "name": "Wi-Fi / BLE Radio",
      "shortName": "Wi-Fi/BLE",
      "pinInfo": "2.4 GHz (ADC2 lock)",
      "defaultEnabled": false,
      "hardwired": false,
      "sram": 49152,
      "dip": null,
      "accent": "#38bdf8",
      "currentMa": 120,
      "isWifiRadio": true,
      "code": {
        "includes": [
          "#include <WiFi.h>"
        ],
        "setup": [
          "WiFi.mode(WIFI_STA); // Note: ADC2 pins cannot be used while Wi-Fi is active"
        ],
        "loop": []
      }
    },
    {
      "id": "onboard_rgb_led",
      "name": "Onboard RGB LED",
      "shortName": "RGB LED",
      "pinInfo": "GPIO48",
      "defaultEnabled": false,
      "hardwired": false,
      "sram": 64,
      "dip": null,
      "accent": "#c084fc",
      "currentMa": 20,
      "pins": [
        {
          "pinId": "GPIO48",
          "roleLabel": "RGB LED"
        }
      ],
      "code": {
        "defines": [
          "#define ONBOARD_RGB_PIN 48"
        ],
        "setup": [
          "// rgbLedWrite(ONBOARD_RGB_PIN, 0, 16, 32); // Built-in addressable RGB LED"
        ],
        "loop": []
      }
    }
  ],
  "defaultCodeProfile": "generic-scaffold",
  "supportedCodeProfiles": [
    "generic-scaffold",
    "kcomp-portable"
  ],
  "targetMeta": {
    "flashProtocol": "esptool",
    "defaultBaud": 115200
  },
  "mechanical": {
    "widthMm": 27.94,
    "heightMm": 69.0,
    "cornerRadiusMm": 1.5,
    "origin": "top-left",
    "mountingHoles": [
      {
        "id": "MH1",
        "xMm": 2.5,
        "yMm": 2.5,
        "drillMm": 2.2,
        "plated": false
      },
      {
        "id": "MH2",
        "xMm": 25.44,
        "yMm": 2.5,
        "drillMm": 2.2,
        "plated": false
      },
      {
        "id": "MH3",
        "xMm": 2.5,
        "yMm": 66.5,
        "drillMm": 2.2,
        "plated": false
      },
      {
        "id": "MH4",
        "xMm": 25.44,
        "yMm": 66.5,
        "drillMm": 2.2,
        "plated": false
      }
    ],
    "headers": [
      {
        "id": "J1",
        "label": "Left 22-Pin Header",
        "xMm": 1.27,
        "yMm": 11.43,
        "pitchMm": 2.54,
        "pinCount": 22,
        "orientationDeg": 90,
        "pins": [
          "3V3_L1",
          "3V3_L2",
          "RST",
          "GPIO4",
          "GPIO5",
          "GPIO6",
          "GPIO7",
          "GPIO15",
          "GPIO16",
          "GPIO17",
          "GPIO18",
          "GPIO8",
          "GPIO3",
          "GPIO46",
          "GPIO9",
          "GPIO10",
          "GPIO11",
          "GPIO12",
          "GPIO13",
          "GPIO14",
          "5V_L",
          "GND_L1"
        ]
      },
      {
        "id": "J3",
        "label": "Right 22-Pin Header",
        "xMm": 26.67,
        "yMm": 11.43,
        "pitchMm": 2.54,
        "pinCount": 22,
        "orientationDeg": 90,
        "pins": [
          "GND_R1",
          "GPIO43",
          "GPIO44",
          "GPIO1",
          "GPIO2",
          "GPIO42",
          "GPIO41",
          "GPIO40",
          "GPIO39",
          "GPIO38",
          "GPIO37",
          "GPIO36",
          "GPIO35",
          "GPIO0",
          "GPIO45",
          "GPIO48",
          "GPIO47",
          "GPIO21",
          "GPIO20",
          "GPIO19",
          "GND_R2",
          "GND_R3"
        ]
      }
    ],
    "keepOutZones": [
      {
        "id": "ANTENNA_KEEPOUT",
        "reason": "2.4 GHz Wi-Fi/BLE PCB antenna — no copper pour",
        "xMm": 4.5,
        "yMm": 0.0,
        "widthMm": 18.94,
        "heightMm": 8.0,
        "side": "both"
      }
    ]
  },
  "pins": {
    "3V3_L1": {
      "label": "3.3V (Left #1)",
      "group": "power",
      "caps": [
        "3V3"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 76.0,
      "shared": true
    },
    "3V3_L2": {
      "label": "3.3V (Left #2)",
      "group": "power",
      "caps": [
        "3V3"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 95.0,
      "shared": true
    },
    "RST": {
      "label": "EN / Reset",
      "group": "power",
      "caps": [
        "RESET"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 114.0,
      "shared": true,
      "note": "Hardware Reset (EN)"
    },
    "GPIO4": {
      "label": "GPIO4 (ADC1)",
      "group": "analog",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 133.0,
      "pinNum": "4",
      "signalPin": true,
      "adcChannel": "ADC1",
      "capHint": "ADC1/PWM",
      "freeDefault": true
    },
    "GPIO5": {
      "label": "GPIO5 (ADC1)",
      "group": "analog",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 152.0,
      "pinNum": "5",
      "signalPin": true,
      "adcChannel": "ADC1",
      "capHint": "ADC1/PWM",
      "freeDefault": true
    },
    "GPIO6": {
      "label": "GPIO6 (ADC1)",
      "group": "analog",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 171.0,
      "pinNum": "6",
      "signalPin": true,
      "adcChannel": "ADC1",
      "capHint": "ADC1/PWM",
      "freeDefault": true
    },
    "GPIO7": {
      "label": "GPIO7 (ADC1)",
      "group": "analog",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 190.0,
      "pinNum": "7",
      "signalPin": true,
      "adcChannel": "ADC1",
      "capHint": "ADC1/PWM",
      "freeDefault": true
    },
    "GPIO15": {
      "label": "GPIO15 (ADC2)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 209.0,
      "pinNum": "15",
      "signalPin": true,
      "adcChannel": "ADC2",
      "capHint": "ADC2/PWM",
      "freeDefault": true
    },
    "GPIO16": {
      "label": "GPIO16 (ADC2)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 228.0,
      "pinNum": "16",
      "signalPin": true,
      "adcChannel": "ADC2",
      "capHint": "ADC2/PWM",
      "freeDefault": true
    },
    "GPIO17": {
      "label": "GPIO17 (UART1 TX)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 247.0,
      "pinNum": "17",
      "signalPin": true,
      "adcChannel": "ADC2",
      "capHint": "UART1/ADC2",
      "freeDefault": true
    },
    "GPIO18": {
      "label": "GPIO18 (UART1 RX)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 266.0,
      "pinNum": "18",
      "signalPin": true,
      "adcChannel": "ADC2",
      "capHint": "UART1/ADC2",
      "freeDefault": true
    },
    "GPIO8": {
      "label": "GPIO8 (I2C SDA)",
      "group": "i2c",
      "caps": [
        "I2C_SDA",
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 285.0,
      "pinNum": "8",
      "signalPin": false,
      "shared": true,
      "adcChannel": "ADC1",
      "capHint": "SDA/ADC1",
      "note": "Default I2C SDA (GPIO Matrix)"
    },
    "GPIO3": {
      "label": "GPIO3 (Strapping)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 304.0,
      "pinNum": "3",
      "signalPin": true,
      "adcChannel": "ADC1",
      "strapping": true,
      "strappingNote": "JTAG source strapping pin",
      "capHint": "STRAP/ADC1"
    },
    "GPIO46": {
      "label": "GPIO46 (Strapping)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "INT"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 323.0,
      "pinNum": "46",
      "signalPin": true,
      "strapping": true,
      "strappingNote": "Boot mode & ROM log strapping pin",
      "capHint": "STRAP"
    },
    "GPIO9": {
      "label": "GPIO9 (I2C SCL)",
      "group": "i2c",
      "caps": [
        "I2C_SCL",
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 342.0,
      "pinNum": "9",
      "signalPin": false,
      "shared": true,
      "adcChannel": "ADC1",
      "capHint": "SCL/ADC1",
      "note": "Default I2C SCL (GPIO Matrix)"
    },
    "GPIO10": {
      "label": "GPIO10 (ADC1)",
      "group": "analog",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 361.0,
      "pinNum": "10",
      "signalPin": true,
      "adcChannel": "ADC1",
      "capHint": "ADC1/PWM",
      "freeDefault": true
    },
    "GPIO11": {
      "label": "GPIO11 (ADC2)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 380.0,
      "pinNum": "11",
      "signalPin": true,
      "adcChannel": "ADC2",
      "capHint": "ADC2/PWM",
      "freeDefault": true
    },
    "GPIO12": {
      "label": "GPIO12 (ADC2)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 399.0,
      "pinNum": "12",
      "signalPin": true,
      "adcChannel": "ADC2",
      "capHint": "ADC2/PWM",
      "freeDefault": true
    },
    "GPIO13": {
      "label": "GPIO13 (ADC2)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 418.0,
      "pinNum": "13",
      "signalPin": true,
      "adcChannel": "ADC2",
      "capHint": "ADC2/PWM",
      "freeDefault": true
    },
    "GPIO14": {
      "label": "GPIO14 (ADC2)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 437.0,
      "pinNum": "14",
      "signalPin": true,
      "adcChannel": "ADC2",
      "capHint": "ADC2/PWM",
      "freeDefault": true
    },
    "5V_L": {
      "label": "5V (USB VBUS)",
      "group": "power",
      "caps": [
        "5V"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 456.0,
      "shared": true,
      "note": "5V supply only — GPIOs are strictly 3.3V logic!"
    },
    "GND_L1": {
      "label": "GND (Left)",
      "group": "power",
      "caps": [
        "GND"
      ],
      "approach": "left",
      "x": 28.0,
      "y": 475.0,
      "shared": true
    },
    "GND_R1": {
      "label": "GND (Right Top)",
      "group": "power",
      "caps": [
        "GND"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 76.0,
      "shared": true
    },
    "GPIO43": {
      "label": "GPIO43 (UART0 TX)",
      "group": "digital",
      "caps": [
        "DIGITAL"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 95.0,
      "pinNum": "43",
      "signalPin": true,
      "blocked": true,
      "reason": "Reserved for USB-UART Console (TX0)",
      "capHint": "TX0"
    },
    "GPIO44": {
      "label": "GPIO44 (UART0 RX)",
      "group": "digital",
      "caps": [
        "DIGITAL"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 114.0,
      "pinNum": "44",
      "signalPin": true,
      "blocked": true,
      "reason": "Reserved for USB-UART Console (RX0)",
      "capHint": "RX0"
    },
    "GPIO1": {
      "label": "GPIO1 (ADC1)",
      "group": "analog",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 133.0,
      "pinNum": "1",
      "signalPin": true,
      "adcChannel": "ADC1",
      "capHint": "ADC1/PWM",
      "freeDefault": true
    },
    "GPIO2": {
      "label": "GPIO2 (ADC1)",
      "group": "analog",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT",
        "ANALOG"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 152.0,
      "pinNum": "2",
      "signalPin": true,
      "adcChannel": "ADC1",
      "capHint": "ADC1/PWM",
      "freeDefault": true
    },
    "GPIO42": {
      "label": "GPIO42",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 171.0,
      "pinNum": "42",
      "signalPin": true,
      "capHint": "PWM/INT",
      "freeDefault": true
    },
    "GPIO41": {
      "label": "GPIO41",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 190.0,
      "pinNum": "41",
      "signalPin": true,
      "capHint": "PWM/INT",
      "freeDefault": true
    },
    "GPIO40": {
      "label": "GPIO40",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 209.0,
      "pinNum": "40",
      "signalPin": true,
      "capHint": "PWM/INT",
      "freeDefault": true
    },
    "GPIO39": {
      "label": "GPIO39",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 228.0,
      "pinNum": "39",
      "signalPin": true,
      "capHint": "PWM/INT",
      "freeDefault": true
    },
    "GPIO38": {
      "label": "GPIO38",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 247.0,
      "pinNum": "38",
      "signalPin": true,
      "capHint": "PWM/INT",
      "freeDefault": true
    },
    "GPIO37": {
      "label": "GPIO37 (PSRAM)",
      "group": "digital",
      "caps": [
        "DIGITAL"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 266.0,
      "pinNum": "37",
      "signalPin": true,
      "blocked": true,
      "reason": "Reserved for Octal PSRAM (N16R8)",
      "capHint": "PSRAM"
    },
    "GPIO36": {
      "label": "GPIO36 (PSRAM)",
      "group": "digital",
      "caps": [
        "DIGITAL"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 285.0,
      "pinNum": "36",
      "signalPin": true,
      "blocked": true,
      "reason": "Reserved for Octal PSRAM (N16R8)",
      "capHint": "PSRAM"
    },
    "GPIO35": {
      "label": "GPIO35 (PSRAM)",
      "group": "digital",
      "caps": [
        "DIGITAL"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 304.0,
      "pinNum": "35",
      "signalPin": true,
      "blocked": true,
      "reason": "Reserved for Octal PSRAM (N16R8)",
      "capHint": "PSRAM"
    },
    "GPIO0": {
      "label": "GPIO0 (BOOT Strap)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 323.0,
      "pinNum": "0",
      "signalPin": true,
      "strapping": true,
      "strappingNote": "BOOT strapping pin — keep HIGH at reset",
      "capHint": "BOOT"
    },
    "GPIO45": {
      "label": "GPIO45 (Strapping)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 342.0,
      "pinNum": "45",
      "signalPin": true,
      "strapping": true,
      "strappingNote": "Flash voltage strapping pin",
      "capHint": "STRAP"
    },
    "GPIO48": {
      "label": "GPIO48 (RGB LED)",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 361.0,
      "pinNum": "48",
      "signalPin": true,
      "onboard": "rgb_led",
      "capHint": "RGB/PWM",
      "note": "Shared with onboard WS2812 RGB LED"
    },
    "GPIO47": {
      "label": "GPIO47",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 380.0,
      "pinNum": "47",
      "signalPin": true,
      "capHint": "PWM/INT",
      "freeDefault": true
    },
    "GPIO21": {
      "label": "GPIO21",
      "group": "digital",
      "caps": [
        "DIGITAL",
        "PWM",
        "INT"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 399.0,
      "pinNum": "21",
      "signalPin": true,
      "capHint": "PWM/INT",
      "freeDefault": true
    },
    "GPIO20": {
      "label": "GPIO20 (USB D+)",
      "group": "digital",
      "caps": [
        "DIGITAL"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 418.0,
      "pinNum": "20",
      "signalPin": true,
      "blocked": true,
      "reason": "Reserved for native USB-OTG D+",
      "capHint": "USB D+"
    },
    "GPIO19": {
      "label": "GPIO19 (USB D-)",
      "group": "digital",
      "caps": [
        "DIGITAL"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 437.0,
      "pinNum": "19",
      "signalPin": true,
      "blocked": true,
      "reason": "Reserved for native USB-OTG D-",
      "capHint": "USB D-"
    },
    "GND_R2": {
      "label": "GND (Right #2)",
      "group": "power",
      "caps": [
        "GND"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 456.0,
      "shared": true
    },
    "GND_R3": {
      "label": "GND (Right #3)",
      "group": "power",
      "caps": [
        "GND"
      ],
      "approach": "right",
      "x": 236.0,
      "y": 475.0,
      "shared": true
    }
  }
};
