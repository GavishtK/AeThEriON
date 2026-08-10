#include <WiFi.h>
#include <WebSocketsServer.h>
#include <Wire.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

#include "config.h"
#include "rgb.h"
#include "imu.h"
#include "graphics.h"
#include "web.h"

WebSocketsServer webSocket = WebSocketsServer(81);

/* ============================================================
   FREERTOS — I2C bus is shared by MPU6050 + OLED.
   A mutex serialises access so the OLED task never
   collides with IMU reads in the main loop.
   ============================================================ */

SemaphoreHandle_t i2cMutex = NULL;

// ============================================================
// OLED TASK
//   Runs independently at 25 FPS.
//   Does NOT block wireless telemetry.
// ============================================================

void oledTask(void* param)
{
    const TickType_t period = pdMS_TO_TICKS(1000 / DISPLAY_FPS);

    for (;;)
    {
        if (xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(50)))
        {
            IMUData data = getIMU();
            drawPFD(data);
            xSemaphoreGive(i2cMutex);
        }

        vTaskDelay(period);
    }
}

// ============================================================
// WEBSOCKET EVENT
// ============================================================

void webSocketEvent(
    uint8_t num,
    WStype_t type,
    uint8_t* payload,
    size_t length
)
{
    if (type == WStype_CONNECTED)
    {
        Serial.println("Browser connected!");
    }

    if (type == WStype_DISCONNECTED)
    {
        Serial.println("Browser disconnected!");
    }
}

// ============================================================
// SETUP
// ============================================================

void setup()
{
    Serial.begin(115200);

    // --------------------------------------------------------
    // OLED
    // --------------------------------------------------------

    initDisplay();
    initRGB();

    rgbRed();
    bootScreen();

    delay(1500);

    // Initializing — purple
    rgbPurple();

    // --------------------------------------------------------
    // IMU
    // --------------------------------------------------------

    initIMU();

    calibrateIMU();

    Wire.setClock(400000);  // 400 kHz — reliable for MPU6050 + OLED

    // --------------------------------------------------------
    // Wi-Fi (Access Point mode)
    // The ESP32 creates its own network so the browser
    // connects directly — no external WiFi required.
    // --------------------------------------------------------

    WiFi.mode(WIFI_AP);

    WiFi.softAP(
        AP_SSID,
        AP_PASSWORD,
        AP_CHANNEL,
        AP_HIDDEN,
        AP_MAX_CONN
    );

    Serial.println("Wi-Fi AP started");
    Serial.print("Aetherion AP: ");
    Serial.println(AP_SSID);

    Serial.print("IP: ");
    Serial.println(WiFi.softAPIP());

    // --------------------------------------------------------
    // WebSocket
    // --------------------------------------------------------

    webSocket.begin();
    webSocket.onEvent(webSocketEvent);

    Serial.println("WebSocket server started on port 81");

    // --------------------------------------------------------
    // HTTP Web Server
    // Serves the dashboard files (index.html, CSS, JS) from
    // LittleFS so the browser can load the web UI.
    // --------------------------------------------------------

    initFileSystem();
    initWebServer();

    // --------------------------------------------------------
    // Loading
    // --------------------------------------------------------

    rgbPurple();

    for (int p = 0; p <= 96; p++)
    {
        loadingScreen(p);
        delay(15);
    }

    rgbBlue();
    readyScreen();
    delay(1000);
    rgbGreen();

    // --------------------------------------------------------
    // OLED task — created LAST so loading/ready screens
    // (which also use I2C) finish before the task starts.
    // --------------------------------------------------------

    i2cMutex = xSemaphoreCreateMutex();

    if (i2cMutex != NULL)
    {
        xTaskCreatePinnedToCore(
            oledTask,
            "oledTask",
            4096,
            NULL,
            OLED_TASK_PRIO,
            NULL,
            0
        );
    }
}

// ============================================================
// LOOP
//   Main loop is now purely:
//     1. HTTP web server
//     2. WebSocket networking
//     3. IMU read (I2C, mutex-protected)
//     4. Telemetry broadcast at 50 Hz
//
//   OLED drawing happens in oledTask (separate FreeRTOS task).
// ============================================================

void loop()
{
    // --- HTTP web server (serves dashboard files) ---
    handleWebClient();

    // --- WebSocket networking (no I2C) ---
    webSocket.loop();

    // --- IMU read (I2C mutex-protected) ---
    if (xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(5)))
    {
        updateIMU();
        xSemaphoreGive(i2cMutex);
    }

    // --- Telemetry broadcast at 50 Hz ---
    static unsigned long lastSend = 0;
    unsigned long now = millis();

    if (now - lastSend >= 20)
    {
        lastSend = now;

        IMUData imu = getIMU();

        char data[256];

        snprintf(
            data,
            sizeof(data),

            "{\"t\":%lu,"
            "\"roll\":%.2f,"
            "\"pitch\":%.2f,"
            "\"gForce\":%.2f,"
            "\"ax\":%.3f,"
            "\"ay\":%.3f,"
            "\"az\":%.3f,"
            "\"gx\":%.3f,"
            "\"gy\":%.3f,"
            "\"gz\":%.3f}",

            now,
            imu.roll,
            imu.pitch,
            imu.gForce,
            imu.ax,
            imu.ay,
            imu.az,
            imu.gx,
            imu.gy,
            imu.gz
        );

        webSocket.broadcastTXT(data);
    }

    yield();
}
