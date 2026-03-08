#include <SPI.h>
#include <MFRC522.h>
#include <DS3232RTC.h>
#include <Wire.h>
#include <TimeLib.h>



#define SS_PIN  D4
#define RST_PIN D0

MFRC522 mfrc522(SS_PIN, RST_PIN);
DS3232RTC myRTC;
int bincollected;

void setup()
{
  Serial.begin(115200);
  Wire.begin();
  myRTC.begin();
  setSyncProvider([](){return myRTC.get();});
  if(timeStatus() != timeSet)
  {
      Serial.print("unable to sync");
  }
  else
  {
    Serial.print("RTC has set the system time");
  }
  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("Scan your card!");
}

void loop()
{
  bincollected = 0;
  // Wait for card!
  if(mfrc522.PICC_IsNewCardPresent()
  && mfrc522.PICC_ReadCardSerial())
  {
    bincollected = 1;
    Serial.println("bincollected");
    delay(2000);
        Serial.print("Card UID: ");

    // Print card ID!
    for(byte i = 0; i < mfrc522.uid.size; i++)
    {
      Serial.print(mfrc522.uid.uidByte[i], HEX);
      Serial.print(" ");
    }
  }

  int hr = hour();//reads hour
  int min = minute();//reads min
  int sec = second();//reads sec
  if(hr < 10) Serial.print("0");
  Serial.print(hr);
  Serial.print(":");
  if(min < 10) Serial.print("0");
  Serial.print(min);
  Serial.print(":");
  if(sec < 10) Serial.print("0");
  Serial.print(sec);
  Serial.println();
  delay(1000);
}