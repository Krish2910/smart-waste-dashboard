#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include "ThingSpeak.h"
#include "DHT.h"
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

int lcdColumns = 16;
int lcdRows = 2;

const char* ssid = "iman";
const char* passphrase = "iman@12345";

WiFiClient client;
LiquidCrystal_I2C lcd(0x27, lcdColumns, lcdRows);

unsigned long myChannelno = 2904419;
const char* myWriteAPIkey = "5BRL63QZR7CJ8P3W";

const int trigPin = D6;
const int echoPin = D7;

#define SOUND_SPEED 0.034
#define DHTPIN D3        // ✅ D3 not D5!
#define DHTTYPE DHT11
#define LDR_PIN A0

DHT dht(DHTPIN, DHTTYPE);

long duration;
float current_distance = 0.0;
float fill_percentage = 0.0;
float empty_distance = 25.6;
float full_distance = 0.5;
unsigned long lastTime = 0;
unsigned long timerDelay = 15000;
float t = 0.0;
float h = 0.0;
float f = 0.0;
int ldrvalue;

void setup()
{
  Serial.begin(115200);

  // DHT first — before everything!
  dht.begin();
  delay(3000);  // stabilize!

  lcd.init();
  lcd.backlight();

  // Welcome message!
  lcd.setCursor(0, 0);
  lcd.print("Smart Dustbin   ");
  lcd.setCursor(0, 1);
  lcd.print("Initializing... ");
  delay(2000);
  lcd.clear();
  lcd.setCursor(0, 0);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, passphrase);
  Serial.println("Connecting to WiFi");

  lcd.print("Connecting WiFi ");
  lcd.setCursor(0, 1);
  lcd.print("Please wait...  ");

  while(WiFi.status() != WL_CONNECTED)
  {
    Serial.print(".");
    delay(200);
  }

  Serial.println("Connected!");
  Serial.println(WiFi.localIP());

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connected! ");
  lcd.setCursor(0, 1);
  lcd.print("                ");
  delay(2000);
  lcd.clear();
  lcd.setCursor(0, 0);

  Wire.begin();
  ThingSpeak.begin(client);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(LDR_PIN,A0);
}

void loop()
{
  // STEP 1: READ ULTRASONIC DISTANCE
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  duration = pulseIn(echoPin, HIGH);
  current_distance = ((duration * SOUND_SPEED) / 2);

  // Calculate fill% AFTER measuring distance!
  fill_percentage = ((empty_distance - current_distance)
                   / (empty_distance - full_distance)) * 100;
  if(fill_percentage < 0) fill_percentage = 0;
  if(fill_percentage > 100) fill_percentage = 100;

  Serial.print("Distance: ");
  Serial.println(current_distance);
  Serial.print("Fill %: ");
  Serial.println(fill_percentage);

  // Show fill level on LCD
  lcd.setCursor(0, 0);
  lcd.print("Fill Level:     ");
  lcd.setCursor(0, 1);
  lcd.print(fill_percentage);
  lcd.print("%             ");
  delay(3000);
  lcd.clear();
  lcd.setCursor(0, 0);

  // Bin full alert!
  if(fill_percentage >= 80)
  {
    Serial.println("BIN FULL!");
    lcd.print("BIN FULL!       ");
    lcd.setCursor(0, 1);
    lcd.print("Alert Sent!     ");
    delay(2000);
    lcd.clear();
    lcd.setCursor(0, 0);
  }

  // STEP 2: READ DHT11
  if((millis() - lastTime) > timerDelay)
  {
    // Power stabilization!
    digitalWrite(trigPin, LOW);
    delay(500);

    // First reading — throw away!
    dht.readHumidity();
    dht.readTemperature();
    delay(2000);  // wait between readings!

    // Second reading — use this!
    h = dht.readHumidity();
    t = dht.readTemperature();
    f = dht.readTemperature(true);

    Serial.print("Raw h = ");
    Serial.println(h);
    Serial.print("Raw t = ");
    Serial.println(t);

    if(isnan(h) || isnan(t) || isnan(f))
    {
      Serial.println(F("Failed to read from DHT!"));
      // no return — no upload of bad data!
    }
    else
    {
      // TEMPERATURE ALERTS
      if(t > 50.0)
      {
        Serial.println("FIRE ALERT!");
        lcd.print("FIRE ALERT!     ");
        lcd.setCursor(0, 1);
        lcd.print(t);
        lcd.print(" C          ");
        delay(3000);
        lcd.clear();
        lcd.setCursor(0, 0);
      }
      else if(t > 30.0)
      {
        Serial.println("Above room temp");
        Serial.println(t);
        lcd.print("Above room temp ");
        lcd.setCursor(0, 1);
        lcd.print(t);
        lcd.print(" C          ");
        delay(2000);
        lcd.clear();
        lcd.setCursor(0, 0);
      }
      else
      {
        Serial.println("Below room temp");
        Serial.println(t);
        lcd.print("Below room temp ");
        lcd.setCursor(0, 1);
        lcd.print(t);
        lcd.print(" C          ");
        delay(2000);
        lcd.clear();
        lcd.setCursor(0, 0);
      }

      // HUMIDITY DISPLAY
      Serial.print("Humidity: ");
      Serial.println(h);
      lcd.print("Humidity:       ");
      lcd.setCursor(0, 1);
      lcd.print(h);
      lcd.print("%             ");
      delay(2000);
      lcd.clear();
      lcd.setCursor(0, 0);

      // HUMIDITY ALERT
      if(h > 70)
      {
        Serial.println("HIGH HUMIDITY - Alert Municipality!");
        lcd.print("High Humidity!  ");
        lcd.setCursor(0, 1);
        lcd.print("Call Municipal! ");
        delay(3000);
        lcd.clear();
        lcd.setCursor(0, 0);
      }

      ldrvalue = analogRead(LDR_PIN);
      Serial.print("LDR value");
      Serial.println(ldrvalue);
      if(ldrvalue > 150)
      {
        Serial.println("lid is open!");
      }
      else
      {
        Serial.println("lid is closed");
      }
      delay(1000);

      // SEND TO THINGSPEAK
      ThingSpeak.setField(2, fill_percentage);
      ThingSpeak.setField(6, h);
      ThingSpeak.setField(7, t);
      ThingSpeak.setField(8,ldrvalue);
      ThingSpeak.writeFields(myChannelno, myWriteAPIkey);
      Serial.println("ThingSpeak updated!");
      delay(15000);

    } // else closes

    lastTime = millis(); // reset timer!

  } // if(millis()) closes

} 