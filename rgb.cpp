#include <Arduino.h>

#include "config.h"
#include "rgb.h"

void initRGB()
{
    pinMode(RED_PIN, OUTPUT);
    pinMode(GREEN_PIN, OUTPUT);
    pinMode(BLUE_PIN, OUTPUT);

    rgbOff();
}

void rgbOff()
{
    digitalWrite(RED_PIN, LOW);
    digitalWrite(GREEN_PIN, LOW);
    digitalWrite(BLUE_PIN, LOW);
}

void rgbRed()
{
    rgbOff();
    digitalWrite(RED_PIN, HIGH);
}

void rgbGreen()
{
    rgbOff();
    digitalWrite(GREEN_PIN, HIGH);
}

void rgbBlue()
{
    rgbOff();
    digitalWrite(BLUE_PIN, HIGH);
}

void rgbYellow()
{
    rgbOff();
    digitalWrite(RED_PIN, HIGH);
    digitalWrite(GREEN_PIN, HIGH);
}

void rgbPurple()
{
    rgbOff();
    digitalWrite(RED_PIN, HIGH);
    digitalWrite(BLUE_PIN, HIGH);
}

void rgbCyan()
{
    rgbOff();
    digitalWrite(GREEN_PIN, HIGH);
    digitalWrite(BLUE_PIN, HIGH);
}

void rgbWhite()
{
    digitalWrite(RED_PIN, HIGH);
    digitalWrite(GREEN_PIN, HIGH);
    digitalWrite(BLUE_PIN, HIGH);
}