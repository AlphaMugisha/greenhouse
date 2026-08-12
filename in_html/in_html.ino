#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>

// =====================================================
// Wi-Fi
// =====================================================

const char* WIFI_SSID = "NGA_LAB_WIFI";
const char* WIFI_PASSWORD = "NGA@2026!";

// =====================================================
// Supabase
// =====================================================

const char* SUPABASE_URL =
  "https://sjokemojlhvwsiexnlcn.supabase.co";

// IMPORTANT:
// Put your EXACT working Supabase publishable key here.
const char* SUPABASE_KEY =
  "sb_publishable_bxneUVEnXbVkNdPPST-i7w_dmv2sKpl";

// =====================================================
// DHT11
// =====================================================

#define DHTPIN 18
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

// Counts how many reads have failed in a row.
// Resets as soon as the DHT11 gives a good reading again.
int consecutiveErrors = 0;

// =====================================================
// Error reporting
// =====================================================

// A fault that sticks around would post a new row every
// loop, so the same error type is only sent once a
// minute. A different error type always goes through.
#define ERROR_THROTTLE_MS 60000

String lastErrorType = "";
unsigned long lastErrorSentAt = 0;

// Set when Wi-Fi fails, sent once the connection is back
// (an error cannot be posted while the link is down).
bool wifiErrorPending = false;

// =====================================================
// Function declarations
// =====================================================

void connectToWiFi();
void sendToSupabase(float temperature, float humidity);
void sendSensorError(String errorType, String errorMessage);
void reportError(String errorType, String errorMessage);
String jsonEscape(String value);

// =====================================================
// Setup
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  dht.begin();

  Serial.println();
  Serial.println("================================");
  Serial.println("     ESP32 GREENHOUSE MONITOR");
  Serial.println("================================");

  // ---------------------------------------------------
  // Connect to Wi-Fi
  // ---------------------------------------------------

  connectToWiFi();

  Serial.println("--------------------------------");
}

// =====================================================
// Main Loop
// =====================================================

void loop() {

  // ---------------------------------------------------
  // Make sure Wi-Fi is connected
  // ---------------------------------------------------

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println();
    Serial.println("Wi-Fi disconnected!");
    Serial.println("Trying to reconnect...");

    connectToWiFi();
  }

  // ---------------------------------------------------
  // Read DHT11
  // ---------------------------------------------------

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  // ---------------------------------------------------
  // Check sensor
  // ---------------------------------------------------

  if (isnan(humidity) || isnan(temperature)) {

    consecutiveErrors++;

    Serial.println();
    Serial.println("================================");
    Serial.println("ERROR: FAILED TO READ DHT11!");
    Serial.println("================================");

    Serial.println("Temperature reading: INVALID");
    Serial.println("Humidity reading: INVALID");

    Serial.print("Failed reads in a row: ");
    Serial.println(consecutiveErrors);

    // Send error to Supabase
    reportError(
      "DHT11_READ_ERROR",
      "Failed to read temperature or humidity from DHT11"
    );

    delay(5000);

    return;
  }

  // ---------------------------------------------------
  // Good reading, so clear any error state
  // ---------------------------------------------------

  consecutiveErrors = 0;

  // ---------------------------------------------------
  // Display sensor readings
  // ---------------------------------------------------

  Serial.println();
  Serial.println("------ SENSOR READING ------");

  Serial.print("Temperature: ");
  Serial.print(temperature, 2);
  Serial.println(" °C");

  Serial.print("Humidity: ");
  Serial.print(humidity, 2);
  Serial.println(" %");

  // ---------------------------------------------------
  // Send normal data to Supabase
  // ---------------------------------------------------

  sendToSupabase(temperature, humidity);

  // ---------------------------------------------------
  // Wait 5 seconds
  // ---------------------------------------------------

  delay(5000);
}

// =====================================================
// Connect to Wi-Fi
// =====================================================

void connectToWiFi() {

  WiFi.mode(WIFI_STA);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30) {

    delay(500);

    Serial.print(".");

    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("Wi-Fi connected!");

    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());

    // ---------------------------------------------------
    // Report a dropout now that there is a link again
    // ---------------------------------------------------

    if (wifiErrorPending) {

      wifiErrorPending = false;

      reportError(
        "WIFI_CONNECTION_ERROR",
        "Device lost Wi-Fi and reconnected after " +
          String(attempts) + " attempts"
      );
    }

  } else {

    Serial.println("ERROR: Could not connect to Wi-Fi!");

    // Cannot post it yet, so remember to send it
    // once the connection comes back.
    wifiErrorPending = true;
  }
}

// =====================================================
// Report an Error (with throttling)
// =====================================================

// Everything in the sketch reports errors through here
// so a stuck fault cannot fill the table with one row
// every five seconds.

void reportError(String errorType, String errorMessage) {

  unsigned long now = millis();

  bool sameAsLast = (errorType == lastErrorType);

  bool tooSoon =
    (now - lastErrorSentAt) < ERROR_THROTTLE_MS;

  if (sameAsLast && tooSoon && lastErrorSentAt != 0) {

    Serial.print("Error not sent (same type within ");
    Serial.print(ERROR_THROTTLE_MS / 1000);
    Serial.println("s): " + errorType);

    return;
  }

  lastErrorType = errorType;
  lastErrorSentAt = now;

  sendSensorError(errorType, errorMessage);
}

// =====================================================
// Escape a String for JSON
// =====================================================

String jsonEscape(String value) {

  value.replace("\\", "\\\\");
  value.replace("\"", "\\\"");
  value.replace("\n", " ");
  value.replace("\r", " ");

  return value;
}

// =====================================================
// Send Normal Sensor Data to Supabase
// =====================================================

void sendToSupabase(float temperature, float humidity) {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println();
    Serial.println("ERROR: Wi-Fi disconnected!");
    Serial.println("Data was NOT sent.");

    return;
  }

  // ---------------------------------------------------
  // HTTPS client
  // ---------------------------------------------------

  WiFiClientSecure client;

  // Testing only
  client.setInsecure();

  HTTPClient https;

  // ---------------------------------------------------
  // Supabase REST endpoint
  // ---------------------------------------------------

  String endpoint =
    String(SUPABASE_URL) + "/rest/v1/sensor_data";

  Serial.println();
  Serial.println("Sending data to Supabase...");

  Serial.print("Endpoint: ");
  Serial.println(endpoint);

  // ---------------------------------------------------
  // Start HTTPS connection
  // ---------------------------------------------------

  if (!https.begin(client, endpoint)) {

    Serial.println(
      "ERROR: Could not initialize HTTPS connection"
    );

    return;
  }

  Serial.println("HTTPS connection initialized!");

  // ---------------------------------------------------
  // Headers
  // ---------------------------------------------------

  https.addHeader(
    "Content-Type",
    "application/json"
  );

  https.addHeader(
    "apikey",
    SUPABASE_KEY
  );

  https.addHeader(
    "Authorization",
    "Bearer " + String(SUPABASE_KEY)
  );

  https.addHeader(
    "Prefer",
    "return=minimal"
  );

  // ---------------------------------------------------
  // JSON
  // ---------------------------------------------------

  String jsonData = "{";

  jsonData += "\"temperature\":";
  jsonData += String(temperature, 2);
  jsonData += ",";

  jsonData += "\"humidity\":";
  jsonData += String(humidity, 2);

  jsonData += "}";

  Serial.print("JSON: ");
  Serial.println(jsonData);

  // ---------------------------------------------------
  // POST
  // ---------------------------------------------------

  int httpResponseCode =
    https.POST(jsonData);

  // ---------------------------------------------------
  // Response
  // ---------------------------------------------------

  Serial.print("HTTP Response: ");
  Serial.println(httpResponseCode);

  // Held until the connection below is closed, because
  // reporting it opens a second HTTPS client and two TLS
  // sessions at once will exhaust memory on the ESP32.
  String uploadError = "";

  if (httpResponseCode > 0) {

    String response =
      https.getString();

    Serial.print("Supabase response: ");
    Serial.println(response);

    if (httpResponseCode == 201) {

      Serial.println(
        "SUCCESS! Data saved to Supabase!"
      );

    } else {

      Serial.println(
        "WARNING: Request completed, but check Supabase."
      );

      uploadError =
        "Supabase rejected the reading with HTTP " +
        String(httpResponseCode) + ": " + response;
    }

  } else {

    Serial.print(
      "ERROR sending data: "
    );

    Serial.println(
      https.errorToString(httpResponseCode)
    );

    uploadError =
      "Could not reach Supabase: " +
      https.errorToString(httpResponseCode);
  }

  // ---------------------------------------------------
  // Close connection
  // ---------------------------------------------------

  https.end();

  // ---------------------------------------------------
  // Now safe to report an upload failure
  // ---------------------------------------------------

  if (uploadError.length() > 0) {

    reportError("SUPABASE_UPLOAD_ERROR", uploadError);
  }
}

// =====================================================
// Send an Error to Supabase
// =====================================================

void sendSensorError(String errorType, String errorMessage) {

  // ---------------------------------------------------
  // Check Wi-Fi
  // ---------------------------------------------------

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println(
      "ERROR: Cannot send sensor error."
    );

    Serial.println(
      "Wi-Fi is disconnected."
    );

    return;
  }

  // ---------------------------------------------------
  // HTTPS client
  // ---------------------------------------------------

  WiFiClientSecure client;

  // Testing only
  client.setInsecure();

  HTTPClient https;

  // ---------------------------------------------------
  // Error table endpoint
  // ---------------------------------------------------

  String endpoint =
    String(SUPABASE_URL) + "/rest/v1/sensor_errors";

  Serial.println();
  Serial.println("Sending sensor error to Supabase...");

  Serial.print("Error endpoint: ");
  Serial.println(endpoint);

  // ---------------------------------------------------
  // Start HTTPS connection
  // ---------------------------------------------------

  if (!https.begin(client, endpoint)) {

    Serial.println(
      "ERROR: Could not initialize HTTPS connection for sensor error."
    );

    return;
  }

  Serial.println(
    "HTTPS error connection initialized!"
  );

  // ---------------------------------------------------
  // Headers
  // ---------------------------------------------------

  https.addHeader(
    "Content-Type",
    "application/json"
  );

  https.addHeader(
    "apikey",
    SUPABASE_KEY
  );

  https.addHeader(
    "Authorization",
    "Bearer " + String(SUPABASE_KEY)
  );

  https.addHeader(
    "Prefer",
    "return=minimal"
  );

  // ---------------------------------------------------
  // Error JSON
  // ---------------------------------------------------

  String errorData = "{";

  errorData += "\"error_type\":\"";
  errorData += jsonEscape(errorType);
  errorData += "\",";

  errorData += "\"error_message\":\"";
  errorData += jsonEscape(errorMessage);
  errorData += "\"";

  errorData += "}";

  Serial.print("Error JSON: ");
  Serial.println(errorData);

  // ---------------------------------------------------
  // POST error
  // ---------------------------------------------------

  int httpResponseCode =
    https.POST(errorData);

  // ---------------------------------------------------
  // Response
  // ---------------------------------------------------

  Serial.print(
    "Error HTTP Response: "
  );

  Serial.println(httpResponseCode);

  if (httpResponseCode > 0) {

    String response =
      https.getString();

    Serial.print(
      "Supabase error response: "
    );

    Serial.println(response);

    if (httpResponseCode == 201) {

      Serial.println(
        "SUCCESS! Sensor error saved to Supabase!"
      );

    } else {

      Serial.println(
        "WARNING: Sensor error request completed."
      );
    }

  } else {

    Serial.print(
      "ERROR sending sensor error: "
    );

    Serial.println(
      https.errorToString(httpResponseCode)
    );
  }

  // ---------------------------------------------------
  // Close connection
  // ---------------------------------------------------

  https.end();
}