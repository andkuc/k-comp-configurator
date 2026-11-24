// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// K-Comp V2 Exact Pin Coordinates & Hardware Constraints
// Extracted 1:1 from assets/kcomp-v2.svg (viewBox 0 0 532 358)
window.KCOMP_BOARD = {
  viewBox: { width: 532, height: 358 },
  sramTotal: 2048,
  sramBaseOverhead: 210,
  pins: {
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 37.0
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
    "y": 78.5
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
    "y": 78.5
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
    "y": 78.5
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
    "y": 78.5
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
    "y": 184.5
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
    "y": 184.5
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
    "y": 184.5
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
    "y": 184.5
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
    "y": 173.0
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
    "y": 183.0
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
    "y": 193.0
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
    "y": 203.0
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
    "y": 217.0
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
    "y": 227.0
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
    "y": 237.0
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
    "y": 247.0
  }
},
  dipSwitches: [
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
  i2cHeaders: {
  "H1": {
    "label": "I2C Header H1 (Top-Left)",
    "VCC": "H1_VCC",
    "GND": "H1_GND",
    "SCL": "H1_SCL",
    "SDA": "H1_SDA"
  },
  "H2": {
    "label": "I2C Header H2 (Mid-Right)",
    "VCC": "H2_VCC",
    "GND": "H2_GND",
    "SCL": "H2_SCL",
    "SDA": "H2_SDA"
  },
  "H3": {
    "label": "I2C Header H3 (Bottom-Right)",
    "VCC": "H3_VCC",
    "GND": "H3_GND",
    "SCL": "H3_SCL",
    "SDA": "H3_SDA"
  }
}
};
