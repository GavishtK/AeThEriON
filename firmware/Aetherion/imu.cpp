#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#include "imu.h"

Adafruit_MPU6050 mpu;

IMUData imu;

float rollOffset = 0;
float pitchOffset = 0;

void initIMU()
{
    if (!mpu.begin())
    {
        while (1);
    }
}

void calibrateIMU()
{
    float rollSum = 0;
    float pitchSum = 0;

    sensors_event_t a, g, temp;

    const int samples = 200;

    for (int i = 0; i < samples; i++)
    {
        mpu.getEvent(&a, &g, &temp);

        float roll =
            -atan2(a.acceleration.y,
                   a.acceleration.z) * 180.0 / PI;

        float pitch =
            atan2(
                a.acceleration.x,
                sqrt(
                    a.acceleration.y * a.acceleration.y +
                    a.acceleration.z * a.acceleration.z))
            * 180.0 / PI;

        rollSum += roll;
        pitchSum += pitch;

        delay(5);
    }

    rollOffset = rollSum / samples;
    pitchOffset = pitchSum / samples;
}

void updateIMU()
{
    sensors_event_t a, g, temp;

    mpu.getEvent(&a, &g, &temp);

    imu.ax = a.acceleration.x;
    imu.ay = a.acceleration.y;
    imu.az = a.acceleration.z;
    imu.gForce =
    sqrt(
        imu.ax * imu.ax +
        imu.ay * imu.ay +
        imu.az * imu.az
    ) / 9.81;
    imu.gx = g.gyro.x;
    imu.gy = g.gyro.y;
    imu.gz = g.gyro.z;

    imu.roll =
        -atan2(imu.ay, imu.az) * 180.0 / PI
        - rollOffset;

    imu.pitch =
        atan2(
            imu.ax,
            sqrt(
                imu.ay * imu.ay +
                imu.az * imu.az))
        * 180.0 / PI
        - pitchOffset;
}

IMUData getIMU()
{
    return imu;
}