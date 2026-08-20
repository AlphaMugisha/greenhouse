#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// =====================================================
// WIFI
// =====================================================

const char* WIFI_SSID = "NGA_LAB_WIFI";
const char* WIFI_PASSWORD = "NGA@2026!";


// =====================================================
// SUPABASE
// =====================================================

const char* SUPABASE_URL = "https://sjokemojlhvwsiexnlcn.supabase.co";

// Put your Supabase PUBLISHABLE/ANON key here
const char* SUPABASE_KEY = "sb_publishable_bxneUVEnXbVkNdPPST-i7w_dmv2sKpl";


// =====================================================
// DHT11
// =====================================================

#define DHT_PIN 19
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);


// =====================================================
// RELAY
// =====================================================

#define RELAY_PIN 18

// Fan turns ON when temperature is greater than 10°C
float temperatureLimit = 1.9;


// Active-LOW relay: LOW closes the contact and starts the fan.
// Every fan change goes through here so the polarity is written once.
void applyFan(bool on) {

  digitalWrite(
    RELAY_PIN,
    on ? LOW : HIGH
  );
}


// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("==============================");
  Serial.println("   GREENHOUSE ESP32 SYSTEM");
  Serial.println("==============================");

  // -----------------------------
  // Relay
  // -----------------------------

  pinMode(RELAY_PIN, OUTPUT);

  // Start with the fan off until the first reading decides
  applyFan(false);


  // -----------------------------
  // DHT11
  // -----------------------------

  dht.begin();

  Serial.println("DHT11 started.");
  Serial.println("DHT11 DATA: GPIO 19");

  Serial.println("Relay: GPIO 18");

  
  // -----------------------------
  // WiFi
  // -----------------------------

  Serial.println();
  Serial.println("Connecting to WiFi...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30) {

    delay(500);

    Serial.print(".");

    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("WiFi connected!");

    Serial.print("ESP32 IP address: ");
    Serial.println(WiFi.localIP());

  } else {

    Serial.println("ERROR: Could not connect to WiFi.");

    sendError(
      "WIFI_ERROR",
      "ESP32 could not connect to WiFi"
    );
  }

  Serial.println();
  Serial.println("System ready.");
  Serial.println("==============================");
}


// =====================================================
// SEND ERROR TO SUPABASE
// =====================================================

void sendError(String errorType, String errorMessage) {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("Cannot send error: WiFi disconnected.");

    return;
  }


  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/sensor_errors";

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
    String("Bearer ") + SUPABASE_KEY
  );

  http.addHeader(
    "Prefer",
    "return=minimal"
  );


  // Create JSON

  String json = "{";

  json += "\"error_type\":\"";
  json += errorType;
  json += "\",";

  json += "\"error_message\":\"";
  json += errorMessage;
  json += "\"";

  json += "}";


  Serial.println();
  Serial.println("Sending error to Supabase:");
  Serial.println(json);


  int responseCode = http.POST(json);


  Serial.print("Error HTTP Response: ");
  Serial.println(responseCode);


  if (responseCode > 0) {

    Serial.println("Error sent successfully.");

  } else {

    Serial.print("Error sending error: ");
    Serial.println(http.errorToString(responseCode));
  }


  http.end();
}


// =====================================================
// READ FAN COMMAND FROM SUPABASE
// =====================================================

// The dashboard cannot reach this board directly, so commands are
// left in device_state and picked up here once per loop.
//
// Both the fan mode and the master switch arrive in one request.
//
// Anything unexpected - no WiFi, a failed request, a malformed body -
// falls back to fan "auto" with the system ON. That is deliberate: a
// greenhouse that loses its downlink must keep cooling itself, so the
// failure mode is "carry on", never "shut down".

// Both values come back through references rather than a struct. The
// Arduino IDE generates prototypes for every function and places them
// above the whole sketch, so a custom return type would be named
// before it is declared and the sketch would not compile.

void getDeviceState(String &fanMode, bool &systemOn) {

  fanMode = "auto";
  systemOn = true;


  if (WiFi.status() != WL_CONNECTED) {

    return;
  }


  HTTPClient http;

  String url =
    String(SUPABASE_URL) +
    "/rest/v1/device_state?id=eq.1&select=fan_mode,system_on";

  http.begin(url);

  http.addHeader(
    "apikey",
    SUPABASE_KEY
  );

  http.addHeader(
    "Authorization",
    String("Bearer ") + SUPABASE_KEY
  );

  // Ask PostgREST for a single object instead of an array
  http.addHeader(
    "Accept",
    "application/vnd.pgrst.object+json"
  );


  int responseCode = http.GET();


  if (responseCode == 200) {

    String body = http.getString();

    // Body looks like: {"fan_mode":"on","system_on":true}


    // ---- fan mode ----

    int start = body.indexOf("\"fan_mode\":\"");

    if (start >= 0) {

      start += 12;

      int end = body.indexOf("\"", start);

      if (end > start) {

        String value = body.substring(start, end);

        if (
          value == "on" ||
          value == "off" ||
          value == "auto"
        ) {

          fanMode = value;
        }
      }
    }


    // ---- master switch ----

    // Only an explicit false turns the system off. A missing or
    // unreadable field leaves it running.

    int sys = body.indexOf("\"system_on\":");

    if (sys >= 0) {

      if (body.substring(sys + 12, sys + 17) == "false") {

        systemOn = false;
      }
    }

  } else {

    Serial.print("Could not read commands. HTTP ");
    Serial.println(responseCode);
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

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("WiFi disconnected.");

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
    String("Bearer ") + SUPABASE_KEY
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
  json += String(temperature, 1);


  json += ",\"humidity\":";
  json += String(humidity, 1);


  json += ",\"fan_status\":";

  if (fanStatus) {

    json += "true";

  } else {

    json += "false";
  }


  json += ",\"system_on\":";

  if (systemOn) {

    json += "true";

  } else {

    json += "false";
  }


  json += "}";


  // ===================================================
  // SERIAL OUTPUT
  // ===================================================

  Serial.println();
  Serial.println("Sending data to Supabase:");

  Serial.println(json);


  // ===================================================
  // SEND
  // ===================================================

  int responseCode = http.POST(json);


  Serial.print("Supabase HTTP Response: ");
  Serial.println(responseCode);


  if (responseCode > 0) {

    String response = http.getString();

    Serial.print("Supabase Response: ");
    Serial.println(response);


    if (responseCode == 201) {

      Serial.println("SUCCESS! Data saved to Supabase.");

    } else {

      Serial.println("Supabase returned another response code.");
    }

  } else {

    Serial.print("ERROR sending data: ");
    Serial.println(http.errorToString(responseCode));


    sendError(
      "SUPABASE_ERROR",
      "Failed to send sensor data to Supabase"
    );
  }


  http.end();
}


// =====================================================
// MAIN LOOP
// =====================================================

void loop() {

  // ===================================================
  // CHECK WIFI
  // ===================================================

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("WiFi disconnected. Reconnecting...");

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

      delay(500);

      Serial.print(".");

      attempts++;
    }


    Serial.println();


    if (WiFi.status() == WL_CONNECTED) {

      Serial.println("WiFi reconnected!");

    } else {

      Serial.println("Could not reconnect to WiFi.");

      sendError(
        "WIFI_ERROR",
        "ESP32 could not reconnect to WiFi"
      );

      delay(5000);

      return;
    }
  }


  // ===================================================
  // READ FAN COMMAND
  // ===================================================

  // Read before the sensor, so a manual override still works
  // when the DHT11 is broken.

  String fanMode;
  bool systemOn;

  getDeviceState(fanMode, systemOn);

  Serial.print("System: ");
  Serial.println(systemOn ? "ON" : "STANDBY");

  Serial.print("Fan mode: ");
  Serial.println(fanMode);


  // ===================================================
  // READ DHT11
  // ===================================================

  float temperature = dht.readTemperature();

  float humidity = dht.readHumidity();


  // ===================================================
  // CHECK SENSOR
  // ===================================================

  if (
    isnan(temperature) ||
    isnan(humidity)
  ) {

    Serial.println();
    Serial.println("ERROR: DHT11 reading failed!");


    // A dead sensor must not take the fan away from the operator.
    // "auto" has nothing to work with here, so the fan is left
    // exactly as it was.

    if (!systemOn) {

      applyFan(false);

      Serial.println("System on standby: fan off.");

    } else if (fanMode == "on") {

      applyFan(true);

      Serial.println("Fan forced ON by dashboard.");

    } else if (fanMode == "off") {

      applyFan(false);

      Serial.println("Fan forced OFF by dashboard.");
    }


    sendError(
      "DHT_ERROR",
      "DHT11 returned an invalid temperature or humidity reading"
    );


    delay(5000);

    return;
  }


  // ===================================================
  // FAN CONTROL
  // ===================================================

  bool fanStatus;


  if (!systemOn) {

    // -----------------------------------------------
    // STANDBY: outranks the fan command and the
    // temperature rule. Readings still go to Supabase,
    // nothing is actuated.
    // -----------------------------------------------

    fanStatus = false;

  } else if (fanMode == "on") {

    // -----------------------------------------------
    // FORCED ON BY THE DASHBOARD
    // -----------------------------------------------

    fanStatus = true;

  } else if (fanMode == "off") {

    // -----------------------------------------------
    // FORCED OFF BY THE DASHBOARD
    // -----------------------------------------------

    fanStatus = false;

  } else {

    // -----------------------------------------------
    // AUTO: the temperature decides
    // -----------------------------------------------

    fanStatus = temperature > temperatureLimit;
  }


  applyFan(fanStatus);


  // ===================================================
  // DISPLAY DATA IN SERIAL MONITOR
  // ===================================================

  Serial.println();
  Serial.println("==============================");

  Serial.print("Temperature: ");
  Serial.print(temperature, 1);
  Serial.println(" °C");


  Serial.print("Humidity: ");
  Serial.print(humidity, 1);
  Serial.println(" %");


  Serial.print("Fan status: ");

  if (fanStatus) {

    Serial.println("ON");

  } else {

    Serial.println("OFF");
  }


  Serial.println("==============================");


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
  Serial.println("Waiting 5 seconds...");

  delay(5000);
}