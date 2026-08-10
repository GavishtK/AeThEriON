#ifndef GRAPHICS_H
#define GRAPHICS_H

#include "imu.h"

void initDisplay();
void bootScreen();
void loadingScreen(int progress);
void readyScreen();
void drawPFD(IMUData imu);

#endif