#ifndef IMU_H
#define IMU_H

struct IMUData
{
    float ax, ay, az;
    float gx, gy, gz;

    float roll;
    float pitch;
    float gForce;
};

void initIMU();
void calibrateIMU();
void updateIMU();
IMUData getIMU();

#endif