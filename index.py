import RPi.GPIO as GPIO
import time

# Ignore GPIO warnings
GPIO.setwarnings(False)

# Set GPIO mode
GPIO.setmode(GPIO.BCM)

# Set up GPIO pins
TRIG = 21
ECHO = 20
GPIO.setup(TRIG, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)

def distance():
    # Ensure the trigger pin is low
    GPIO.output(TRIG, False)
    time.sleep(0.1)

    # Send a 10us pulse to trigger
    GPIO.output(TRIG, True)
    time.sleep(0.00001)
    GPIO.output(TRIG, False)

    # Measure the pulse length from the echo pin
    pulse_start = time.time()
    while GPIO.input(ECHO) == 0:
        pulse_start = time.time()

    pulse_end = time.time()
    while GPIO.input(ECHO) == 1:
        pulse_end = time.time()

    # Calculate pulse duration
    pulse_duration = pulse_end - pulse_start

    # Speed of sound is 34300 cm/s
    # Divide by 2 because the pulse travels to the object and back again
    distance = (pulse_duration * 34300) / 2

    return distance

try:
    while True:
        dist = distance()
        print("Distance: {:.2f} cm".format(dist))
        time.sleep(1)

except KeyboardInterrupt:
    GPIO.cleanup()

