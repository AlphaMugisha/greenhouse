#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =====================================================
// WIFI
// =====================================================

const char* WIFI_SSID = "NGA_LAB_WIFI";
const char* WIFI_PASSWORD = "NGA@2026!";


// =====================================================
// SUPABASE
// =====================================================

const char* SUPABASE_URL = "https://sjokemojlhvwsiexnlcn.supabase.co";

const char* SUPABASE_KEY = "sb_publishable_bxneUVEnXbVkNdPPST-i7w_dmv2sKpl";


// =====================================================
// DHT21
// =====================================================

#define DHT_PIN 4
#define DHT_TYPE DHT21

DHT dht(DHT_PIN, DHT_TYPE);


// =====================================================
// RELAY
// =====================================================

#define RELAY_PIN 18


// =====================================================
// HYSTERESIS TEMPERATURE SETTINGS
// =====================================================
//
// FAN ON  -> 40°C or higher
// FAN OFF -> 30°C or lower
//
// Between 30°C and 40°C:
// Keep the previous fan state.
//
// IMPORTANT:
// If the ESP32 starts at 35°C, the fan stays OFF.
// The fan only turns ON after temperature reaches 40°C.
//

float fanOnTemperature = 40.0;
float fanOffTemperature = 30.0;


// =====================================================
// OLED
// =====================================================

#define OLED_SDA 33
#define OLED_SCL 32

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  OLED_RESET
);


// =====================================================
// FAN CONTROL
// =====================================================

void applyFan(bool on) {

  // Relay is ACTIVE-LOW
  //
  // LOW  = FAN ON
  // HIGH = FAN OFF

  digitalWrite(
    RELAY_PIN,
    on ? LOW : HIGH
  );
}


// =====================================================
// OLED DISPLAY
// =====================================================

void updateOLED(
  float temperature,
  float humidity,
  bool fanStatus,
  bool systemOn
) {

  display.clearDisplay();

  display.setTextColor(
    SSD1306_WHITE
  );


  // ===================================================
  // TITLE
  // ===================================================

  display.setTextSize(1);

  display.setCursor(
    0,
    0
  );

  display.println(
    "GREENHOUSE SYSTEM"
  );


  display.drawLine(
    0,
    10,
    127,
    10,
    SSD1306_WHITE
  );


  // ===================================================
  // TEMPERATURE
  // ===================================================

  display.setTextSize(1);

  display.setCursor(
    0,
    16
  );

  display.print(
    "Temp: "
  );


  display.setTextSize(2);

  display.print(
    temperature,
    1
  );


  display.setTextSize(1);

  display.println(
    " C"
  );


  // ===================================================
  // HUMIDITY
  // ===================================================

  display.setCursor(
    0,
    36
  );

  display.print(
    "Humidity: "
  );

  display.print(
    humidity,
    1
  );

  display.println(
    " %"
  );


  // ===================================================
  // FAN
  // ===================================================

  display.setCursor(
    0,
    52
  );

  display.print(
    "Fan: "
  );


  if (!systemOn) {

    display.println(
      "OFF"
    );

  } else if (fanStatus) {

    display.println(
      "ON"
    );

  } else {

    display.println(
      "OFF"
    );
  }


  display.display();
}


// =====================================================
// SEND ERROR TO SUPABASE
// =====================================================

void sendError(
  String errorType,
  String errorMessage
) {

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    Serial.println(
      "Cannot send error: WiFi disconnected."
    );

    return;
  }


  HTTPClient http;


  String url =
    String(SUPABASE_URL) +
    "/rest/v1/sensor_errors";


  http.begin(url);


  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "apikey",
    SUPABASE_KEY
  );

  http.addHeader(
    "Authorization",
    String("Bearer ") +
    SUPABASE_KEY
  );

  http.addHeader(
    "Prefer",
    "return=minimal"
  );


  String json = "{";


  json += "\"error_type\":\"";

  json += errorType;

  json += "\",";


  json += "\"error_message\":\"";

  json += errorMessage;

  json += "\"";


  json += "}";


  Serial.println();

  Serial.println(
    "Sending error to Supabase:"
  );

  Serial.println(
    json
  );


  int responseCode =
    http.POST(
      json
    );


  Serial.print(
    "Error HTTP Response: "
  );

  Serial.println(
    responseCode
  );


  if (
    responseCode > 0
  ) {

    Serial.println(
      "Error sent successfully."
    );

  } else {

    Serial.print(
      "Error sending error: "
    );

    Serial.println(
      http.errorToString(
        responseCode
      )
    );
  }


  http.end();
}


// =====================================================
// GET DEVICE STATE
// =====================================================

void getDeviceState(
  String &fanMode,
  bool &systemOn
) {

  // Default values

  fanMode = "auto";

  systemOn = true;


  if (
    WiFi.status() != WL_CONNECTED
  ) {

    return;
  }


  HTTPClient http;


  String url =
    String(SUPABASE_URL) +
    "/rest/v1/device_state?id=eq.1&select=fan_mode,system_on";


  http.begin(
    url
  );


  http.addHeader(
    "apikey",
    SUPABASE_KEY
  );

  http.addHeader(
    "Authorization",
    String("Bearer ") +
    SUPABASE_KEY
  );

  http.addHeader(
    "Accept",
    "application/vnd.pgrst.object+json"
  );


  int responseCode =
    http.GET();


  if (
    responseCode == 200
  ) {

    String body =
      http.getString();


    // =================================================
    // FAN MODE
    // =================================================

    int start =
      body.indexOf(
        "\"fan_mode\":\""
      );


    if (
      start >= 0
    ) {

      start += 12;


      int end =
        body.indexOf(
          "\"",
          start
        );


      if (
        end > start
      ) {

        String value =
          body.substring(
            start,
            end
          );


        if (
          value == "on" ||
          value == "off" ||
          value == "auto"
        ) {

          fanMode =
            value;
        }
      }
    }


    // =================================================
    // SYSTEM ON
    // =================================================

    int sys =
      body.indexOf(
        "\"system_on\":"
      );


    if (
      sys >= 0
    ) {

      if (
        body.substring(
          sys + 12,
          sys + 17
        ) == "false"
      ) {

        systemOn = false;
      }
    }

  } else {

    Serial.print(
      "Could not read commands. HTTP "
    );

    Serial.println(
      responseCode
    );
  }


  http.end();
}


// =====================================================
// SEND SENSOR DATA TO SUPABASE
// =====================================================

void sendSensorData(
  float temperature,
  float humidity,
  bool fanStatus,
  bool systemOn
) {

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    Serial.println(
      "WiFi disconnected."
    );


    sendError(
      "WIFI_ERROR",
      "WiFi disconnected while sending sensor data"
    );


    return;
  }


  HTTPClient http;


  String url =
    String(SUPABASE_URL) +
    "/rest/v1/sensor_data";


  http.begin(
    url
  );


  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "apikey",
    SUPABASE_KEY
  );

  http.addHeader(
    "Authorization",
    String("Bearer ") +
    SUPABASE_KEY
  );

  http.addHeader(
    "Prefer",
    "return=minimal"
  );


  // ===================================================
  // CREATE JSON
  // ===================================================

  String json = "{";


  json += "\"temperature\":";

  json += String(
    temperature,
    1
  );


  json += ",\"humidity\":";

  json += String(
    humidity,
    1
  );


  json += ",\"fan_status\":";


  json +=
    fanStatus
      ? "true"
      : "false";


  json += ",\"system_on\":";


  json +=
    systemOn
      ? "true"
      : "false";


  json += "}";


  // ===================================================
  // SERIAL OUTPUT
  // ===================================================

  Serial.println();

  Serial.println(
    "Sending data to Supabase:"
  );

  Serial.println(
    json
  );


  // ===================================================
  // SEND
  // ===================================================

  int responseCode =
    http.POST(
      json
    );


  Serial.print(
    "Supabase HTTP Response: "
  );

  Serial.println(
    responseCode
  );


  if (
    responseCode > 0
  ) {

    String response =
      http.getString();


    Serial.print(
      "Supabase Response: "
    );

    Serial.println(
      response
    );


    if (
      responseCode == 201
    ) {

      Serial.println(
        "SUCCESS! Data saved to Supabase."
      );

    } else {

      Serial.println(
        "Supabase returned another response code."
      );
    }

  } else {

    Serial.print(
      "ERROR sending data: "
    );

    Serial.println(
      http.errorToString(
        responseCode
      )
    );


    sendError(
      "SUPABASE_ERROR",
      "Failed to send sensor data to Supabase"
    );
  }


  http.end();
}


// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(
    115200
  );


  delay(
    1000
  );


  Serial.println();

  Serial.println(
    "=============================="
  );

  Serial.println(
    "   GREENHOUSE ESP32 SYSTEM"
  );

  Serial.println(
    "=============================="
  );


  // ===================================================
  // RELAY
  // ===================================================

  pinMode(
    RELAY_PIN,
    OUTPUT
  );


  // Make sure fan starts OFF

  applyFan(
    false
  );


  // ===================================================
  // DHT21
  // ===================================================

  dht.begin();


  Serial.println(
    "DHT21 started."
  );


  Serial.println(
    "DHT21 DATA: GPIO 4"
  );


  Serial.println(
    "Relay: GPIO 18"
  );


  // ===================================================
  // TEMPERATURE SETTINGS
  // ===================================================

  Serial.println();

  Serial.println(
    "Fan temperature control:"
  );


  Serial.println(
    "Fan ON  at 40.0 C"
  );


  Serial.println(
    "Fan OFF at 30.0 C"
  );


  Serial.println(
    "Between 30 C and 40 C: keep previous state"
  );


  // ===================================================
  // OLED
  // ===================================================

  Serial.println();

  Serial.println(
    "Starting OLED..."
  );


  Wire.begin(
    OLED_SDA,
    OLED_SCL
  );


  if (
    !display.begin(
      SSD1306_SWITCHCAPVCC,
      OLED_ADDRESS
    )
  ) {

    Serial.println(
      "ERROR: OLED not found!"
    );

  } else {

    Serial.println(
      "OLED started successfully."
    );


    display.clearDisplay();


    display.setTextColor(
      SSD1306_WHITE
    );


    display.setTextSize(
      1
    );


    display.setCursor(
      0,
      0
    );


    display.println(
      "GREENHOUSE"
    );


    display.println();


    display.println(
      "Starting system..."
    );


    display.display();


    delay(
      2000
    );
  }


  // ===================================================
  // WIFI
  // ===================================================

  Serial.println();

  Serial.println(
    "Connecting to WiFi..."
  );


  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );


  int attempts = 0;


  while (
    WiFi.status() != WL_CONNECTED &&
    attempts < 30
  ) {

    delay(
      500
    );


    Serial.print(
      "."
    );


    attempts++;
  }


  Serial.println();


  if (
    WiFi.status() == WL_CONNECTED
  ) {

    Serial.println(
      "WiFi connected!"
    );


    Serial.print(
      "ESP32 IP address: "
    );


    Serial.println(
      WiFi.localIP()
    );

  } else {

    Serial.println(
      "ERROR: Could not connect to WiFi."
    );


    // Do not call sendError here because WiFi
    // is not connected.
  }


  Serial.println();

  Serial.println(
    "System ready."
  );


  Serial.println(
    "=============================="
  );
}


// =====================================================
// MAIN LOOP
// =====================================================

void loop() {

  // ===================================================
  // CHECK WIFI
  // ===================================================

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    Serial.println(
      "WiFi disconnected. Reconnecting..."
    );


    WiFi.disconnect();


    WiFi.begin(
      WIFI_SSID,
      WIFI_PASSWORD
    );


    int attempts = 0;


    while (
      WiFi.status() != WL_CONNECTED &&
      attempts < 20
    ) {

      delay(
        500
      );


      Serial.print(
        "."
      );


      attempts++;
    }


    Serial.println();


    if (
      WiFi.status() == WL_CONNECTED
    ) {

      Serial.println(
        "WiFi reconnected!"
      );

    } else {

      Serial.println(
        "Could not reconnect to WiFi."
      );


      delay(
        5000
      );


      return;
    }
  }


  // ===================================================
  // READ FAN COMMAND
  // ===================================================

  String fanMode;

  bool systemOn;


  getDeviceState(
    fanMode,
    systemOn
  );


  Serial.print(
    "System: "
  );


  Serial.println(
    systemOn
      ? "ON"
      : "STANDBY"
  );


  Serial.print(
    "Fan mode: "
  );


  Serial.println(
    fanMode
  );


  // ===================================================
  // READ DHT21
  // ===================================================

  float temperature =
    dht.readTemperature();


  float humidity =
    dht.readHumidity();


  // ===================================================
  // CHECK SENSOR
  // ===================================================

  if (
    isnan(temperature) ||
    isnan(humidity)
  ) {

    Serial.println();

    Serial.println(
      "ERROR: DHT21 reading failed!"
    );


    // =================================================
    // OLED ERROR DISPLAY
    // =================================================

    display.clearDisplay();


    display.setTextColor(
      SSD1306_WHITE
    );


    display.setTextSize(
      1
    );


    display.setCursor(
      0,
      0
    );


    display.println(
      "GREENHOUSE SYSTEM"
    );


    display.drawLine(
      0,
      10,
      127,
      10,
      SSD1306_WHITE
    );


    display.setCursor(
      0,
      20
    );


    display.println(
      "DHT21 ERROR!"
    );


    display.println();


    display.println(
      "Check sensor wiring."
    );


    display.display();


    // =================================================
    // FAN CONTROL DURING SENSOR ERROR
    // =================================================

    if (
      !systemOn
    ) {

      applyFan(
        false
      );


      Serial.println(
        "System on standby: fan off."
      );

    }

    else if (
      fanMode == "on"
    ) {

      applyFan(
        true
      );


      Serial.println(
        "Fan forced ON by dashboard."
      );

    }

    else if (
      fanMode == "off"
    ) {

      applyFan(
        false
      );


      Serial.println(
        "Fan forced OFF by dashboard."
      );
    }


    sendError(
      "DHT_ERROR",
      "DHT21 returned an invalid temperature or humidity reading"
    );


    delay(
      5000
    );


    return;
  }


  // ===================================================
  // FAN CONTROL
  // ===================================================

  bool fanStatus;


  // ===================================================
  // SYSTEM OFF
  // ===================================================

  if (
    !systemOn
  ) {

    fanStatus = false;
  }


  // ===================================================
  // MANUAL FAN ON
  // ===================================================

  else if (
    fanMode == "on"
  ) {

    fanStatus = true;
  }


  // ===================================================
  // MANUAL FAN OFF
  // ===================================================

  else if (
    fanMode == "off"
  ) {

    fanStatus = false;
  }


  // ===================================================
  // AUTOMATIC MODE
  // ===================================================

  else {

    // This remembers the previous automatic
    // fan state between loop cycles.

    static bool previousFanStatus = false;


    // =================================================
    // 40°C OR HIGHER -> FAN ON
    // =================================================

    if (
      temperature >= fanOnTemperature
    ) {

      previousFanStatus = true;


      Serial.println(
        "Temperature reached 40°C -> FAN ON"
      );
    }


    // =================================================
    // 30°C OR LOWER -> FAN OFF
    // =================================================

    else if (
      temperature <= fanOffTemperature
    ) {

      previousFanStatus = false;


      Serial.println(
        "Temperature dropped to 30°C -> FAN OFF"
      );
    }


    // =================================================
    // BETWEEN 30°C AND 40°C
    // =================================================

    else {

      Serial.println(
        "Temperature between 30°C and 40°C -> keeping previous fan state"
      );
    }


    fanStatus =
      previousFanStatus;
  }


  // ===================================================
  // APPLY FAN
  // ===================================================

  applyFan(
    fanStatus
  );


  // ===================================================
  // UPDATE OLED
  // ===================================================

  updateOLED(
    temperature,
    humidity,
    fanStatus,
    systemOn
  );


  // ===================================================
  // SERIAL MONITOR
  // ===================================================

  Serial.println();

  Serial.println(
    "=============================="
  );


  Serial.print(
    "Temperature: "
  );


  Serial.print(
    temperature,
    1
  );


  Serial.println(
    " °C"
  );


  Serial.print(
    "Humidity: "
  );


  Serial.print(
    humidity,
    1
  );


  Serial.println(
    " %"
  );


  Serial.print(
    "Fan status: "
  );


  if (
    fanStatus
  ) {

    Serial.println(
      "ON"
    );

  } else {

    Serial.println(
      "OFF"
    );
  }


  Serial.println(
    "=============================="
  );


  // ===================================================
  // SEND TO SUPABASE
  // ===================================================

  sendSensorData(
    temperature,
    humidity,
    fanStatus,
    systemOn
  );


  // ===================================================
  // WAIT
  // ===================================================

  Serial.println();

  Serial.println(
    "Waiting 5 seconds..."
  );


  delay(
    5000
  );
}