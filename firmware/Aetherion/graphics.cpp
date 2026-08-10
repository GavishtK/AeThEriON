#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <math.h>

#include "config.h"
#include "graphics.h"

// ============================================================
// OLED
// ============================================================

U8G2_SH1106_128X64_NONAME_F_HW_I2C
u8g2(U8G2_R0, U8X8_PIN_NONE);


// ============================================================
// AIRCRAFT BITMAP
// ============================================================

const unsigned char aircraftBitmap[] PROGMEM =
{
    0x00,0x18,0x00,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x7E,0x00,
    0x00,0xFF,0x00,
    0xC0,0xFF,0x03,
    0xE0,0xFF,0x07,
    0xF8,0xFF,0x1F,
    0xFC,0xBD,0x3F,
    0x04,0x3C,0x20,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x3C,0x00,
    0x00,0x7E,0x00,
    0x00,0xFF,0x00,
    0x00,0x18,0x00
};

void drawAircraftBitmap()
{
    u8g2.drawXBMP(
        52,
        20,
        24,
        24,
        aircraftBitmap
    );
}


// ============================================================
// BATTERY
// ============================================================

void drawBattery(int percent)
{
    // Outline
    u8g2.drawFrame(2, 2, 16, 8);

    // Positive terminal
    u8g2.drawBox(18, 4, 2, 4);

    // Fill
    int w = map(percent, 0, 100, 0, 14);

    u8g2.drawBox(3, 3, w, 6);
}


// ============================================================
// WIFI ICON
// ============================================================

void drawWiFi(bool connected)
{
    if (!connected)
        return;

    const int x = 120;
    const int y = 8;

    u8g2.drawDisc(x, y, 1);

    u8g2.drawCircle(
        x, y, 3,
        U8G2_DRAW_UPPER_LEFT | U8G2_DRAW_UPPER_RIGHT
    );

    u8g2.drawCircle(
        x, y, 5,
        U8G2_DRAW_UPPER_LEFT | U8G2_DRAW_UPPER_RIGHT
    );

    u8g2.drawCircle(
        x, y, 7,
        U8G2_DRAW_UPPER_LEFT | U8G2_DRAW_UPPER_RIGHT
    );
}


// ============================================================
// ROLL SCALE
// ============================================================

void drawRollScale(float roll)
{
    const int cx = 64;
    const int cy = 34;
    const int r  = 24;

    // Arc
    for (int a = -60; a <= 60; a++)
    {
        float rad = (a - 90) * PI / 180.0f;

        int x = cx + r * cos(rad);
        int y = cy + r * sin(rad);

        u8g2.drawPixel(x, y);
    }

    // Tick marks
    int ticks[] =
    {
        -60, -45, -30, -20, -10,
        0,
        10, 20, 30, 45, 60
    };

    for (int i = 0; i < 11; i++)
    {
        float rad =
            (ticks[i] - 90) * PI / 180.0f;

        int inner = r - 2;

        if (abs(ticks[i]) == 30)
            inner = r - 4;

        if (abs(ticks[i]) == 60)
            inner = r - 6;

        if (ticks[i] == 0)
            inner = r - 7;

        int x1 =
            cx + inner * cos(rad);

        int y1 =
            cy + inner * sin(rad);

        int x2 =
            cx + r * cos(rad);

        int y2 =
            cy + r * sin(rad);

        u8g2.drawLine(
            x1,
            y1,
            x2,
            y2
        );
    }

    // Fixed top pointer
    u8g2.drawTriangle(
        cx - 4,
        6,
        cx + 4,
        6,
        cx,
        12
    );

    // Roll pointer
    float rr =
        (roll - 90) * PI / 180.0f;

    int px =
        cx + (r - 1) * cos(rr);

    int py =
        cy + (r - 1) * sin(rr);

    u8g2.drawDisc(
        px,
        py,
        2
    );
}


// ============================================================
// DISPLAY INITIALIZATION
// ============================================================

void initDisplay()
{
    Wire.begin(
        SDA_PIN,
        SCL_PIN
    );

    u8g2.begin();
}


// ============================================================
// BOOT SCREEN
// ============================================================

void bootScreen()
{
    u8g2.clearBuffer();

    u8g2.setFont(
        u8g2_font_logisoso16_tf
    );

    u8g2.drawStr(
        5,
        22,
        "AETHERION"
    );

    u8g2.setFont(
        u8g2_font_ncenB10_tr
    );

    u8g2.drawStr(
        30,
        42,
        "AI"
    );

    u8g2.setFont(
        u8g2_font_5x8_tr
    );

    u8g2.drawStr(
        35,
        60,
        "Version 1.0"
    );

    u8g2.sendBuffer();
}


// ============================================================
// LOADING SCREEN
// ============================================================

void loadingScreen(int progress)
{
    u8g2.clearBuffer();

    u8g2.setFont(
        u8g2_font_ncenB08_tr
    );

    u8g2.drawStr(
        18,
        15,
        "Initializing"
    );

    u8g2.drawFrame(
        15,
        30,
        98,
        10
    );

    if (progress < 0)
        progress = 0;

    if (progress > 96)
        progress = 96;

    u8g2.drawBox(
        16,
        31,
        progress,
        8
    );

    u8g2.sendBuffer();
}


// ============================================================
// READY SCREEN
// ============================================================

void readyScreen()
{
    u8g2.clearBuffer();

    u8g2.setFont(
        u8g2_font_ncenB10_tr
    );

    u8g2.drawStr(
        35,
        25,
        "READY"
    );

    u8g2.drawCircle(
        64,
        45,
        8
    );

    u8g2.drawDisc(
        64,
        45,
        3
    );

    u8g2.sendBuffer();
}


// ============================================================
// MAIN PFD
// ============================================================

void drawPFD(IMUData imu)
{
    u8g2.clearBuffer();

    // --------------------------------------------------------
    // Top instruments
    // --------------------------------------------------------

    drawRollScale(imu.roll);

    drawBattery(85);

    drawWiFi(true);


    // --------------------------------------------------------
    // Center
    // --------------------------------------------------------

    const int cx = 64;
    const int cy = 32;

    float angle =
        imu.roll * PI / 180.0f;

    float c = cos(angle);
    float s = sin(angle);


    // --------------------------------------------------------
    // Pitch offset
    // --------------------------------------------------------

    int pitchOffset =
        (int)(imu.pitch * 1.5);


    // --------------------------------------------------------
    // Pitch Ladder
    // --------------------------------------------------------

    for (
        int pitch = -40;
        pitch <= 40;
        pitch += 10
    )
    {
        int y =
            pitch * 2 - pitchOffset;

        // Skip horizon
        if (pitch == 0)
            continue;

        int halfLength = 15;

        float x1 = -halfLength;
        float y1 = y;

        float x2 = halfLength;
        float y2 = y;

        float rx1 =
            x1 * c - y1 * s;

        float ry1 =
            x1 * s + y1 * c;

        float rx2 =
            x2 * c - y2 * s;

        float ry2 =
            x2 * s + y2 * c;

        u8g2.drawLine(
            cx + (int)rx1,
            cy + (int)ry1,
            cx + (int)rx2,
            cy + (int)ry2
        );
    }


    // --------------------------------------------------------
    // Main Horizon
    // --------------------------------------------------------

    int len = 45;

    u8g2.drawLine(
        cx,
        cy,
        cx + (int)(len * c),
        cy + (int)(len * s)
    );

    u8g2.drawLine(
        cx,
        cy,
        cx - (int)(len * c),
        cy - (int)(len * s)
    );


    // --------------------------------------------------------
    // Aircraft gap
    // --------------------------------------------------------

    u8g2.setDrawColor(0);

    u8g2.drawBox(
        cx - 10,
        cy - 2,
        20,
        5
    );

    u8g2.setDrawColor(1);


    // --------------------------------------------------------
    // Aircraft
    // --------------------------------------------------------

    drawAircraftBitmap();


    // --------------------------------------------------------
    // Bottom values
    // --------------------------------------------------------

    u8g2.setFont(
        u8g2_font_5x8_tr
    );


    // Roll
    u8g2.setCursor(
        2,
        62
    );

    u8g2.print("R:");
    u8g2.print(
        imu.roll,
        0
    );


    // G-force
    char gStr[12];

    sprintf(
        gStr,
        "G:%.2f",
        imu.gForce
    );

    u8g2.setCursor(
        48,
        62
    );

    u8g2.print(gStr);


    // Pitch
    char pitchStr[16];

    sprintf(
        pitchStr,
        "P:%d",
        (int)imu.pitch
    );

    int w =
        u8g2.getStrWidth(
            pitchStr
        );

    u8g2.setCursor(
        128 - w,
        62
    );

    u8g2.print(
        pitchStr
    );


    // --------------------------------------------------------
    // Send OLED buffer
    // --------------------------------------------------------

    u8g2.sendBuffer();
}