#include <WiFi.h>
#include <WebSocketsServer.h>

#include "config.h"
#include "rgb.h"
#include "imu.h"
#include "graphics.h"

const char* ssid = "EACCESS-M1";
const char* password = "hostelnet";

WebSocketsServer webSocket = WebSocketsServer(81);


// ============================================================
// WebSocket event
// ============================================================

void webSocketEvent(
    uint8_t num,
    WStype_t type,
    uint8_t *payload,
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


    // --------------------------------------------------------
    // IMU
    // --------------------------------------------------------

    initIMU();

    calibrateIMU();


    // --------------------------------------------------------
    // Wi-Fi
    // --------------------------------------------------------

    WiFi.mode(WIFI_STA);

    WiFi.begin(
        ssid,
        password
    );

    Serial.println(
        "Connecting to Wi-Fi..."
    );

    while (
        WiFi.status() != WL_CONNECTED
    )
    {
        delay(500);

        Serial.print(".");
    }

    Serial.println();

    Serial.println(
        "Wi-Fi connected!"
    );

    Serial.print(
        "AeroGyro IP: "
    );

    Serial.println(
        WiFi.localIP()
    );


    // --------------------------------------------------------
    // WebSocket
    // --------------------------------------------------------

    webSocket.begin();

    webSocket.onEvent(
        webSocketEvent
    );

    Serial.println(
        "WebSocket server started on port 81"
    );


    // --------------------------------------------------------
    // Loading
    // --------------------------------------------------------

    rgbPurple();

    for (
        int p = 0;
        p <= 96;
        p++
    )
    {
        loadingScreen(p);

        delay(15);
    }

    rgbBlue();

    readyScreen();

    delay(1000);

    rgbGreen();
}


// ============================================================
// LOOP
// ============================================================

void loop()
{
    webSocket.loop();

    updateIMU();

    IMUData imu = getIMU();

    // ========================================================
    // OLED
    // ========================================================

    static unsigned long lastOLED = 0;

    unsigned long now = millis();

    if (now - lastOLED >= 40)
    {
        lastOLED = now;

        drawPFD(imu);
    }


    // ========================================================
    // WebSocket
    // ========================================================

    static unsigned long lastSend = 0;

    if (now - lastSend >= 20)
    {
        lastSend = now;

        char data[160];

        snprintf(
            data,
            sizeof(data),

            "{\"roll\":%.2f,"
            "\"pitch\":%.2f,"
            "\"gForce\":%.2f,"
            "\"gx\":%.3f,"
            "\"gy\":%.3f,"
            "\"gz\":%.3f}",

            imu.roll,
            imu.pitch,
            imu.gForce,
            imu.gx,
            imu.gy,
            imu.gz
        );

        webSocket.broadcastTXT(data);
    }

    yield();
}