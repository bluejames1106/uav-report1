#include "esp_camera.h"
#include <WiFi.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// Cấu hình chân camera chuẩn cho mạch ESP32-CAM AI-Thinker
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define LED_RED_GPIO      33 // LED đỏ báo trạng thái phía sau mạch

// ĐIỀN THÔNG TIN WIFI CỦA BẠN VÀO ĐÂY
const char *ssid = "Gà gáy";
const char *password = "meomeo123";

WiFiServer server(81); // Tạo luồng phát video tại cổng 81

void handleStream() {
  WiFiClient client = server.available();
  if (!client) return;

  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: multipart/x-mixed-replace; boundary=frame");
  client.println();

  while (client.connected()) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Loi lay khung hinh camera");
      break;
    }

    client.printf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %lu\r\n\r\n", fb->len);
    client.write(fb->buf, fb->len);
    client.print("\r\n");

    esp_camera_fb_return(fb);
    delay(30); 
  }
  client.stop();
}

void setup() {
  // SỬA LỖI TẠI ĐÂY: Thêm dấu gạch dưới (_) để tương thích bản 3.3.8
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); 
  
  Serial.begin(115200);
  pinMode(LED_RED_GPIO, OUTPUT);
  digitalWrite(LED_RED_GPIO, HIGH); // Tắt đèn LED đỏ ban đầu

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA; 
  config.jpeg_quality = 12;
  config.fb_count = 1;
  config.fb_location = CAMERA_FB_IN_DRAM;

  if (esp_camera_init(&config) != ESP_OK) {
    while(true) { // Nháy LED liên tục nếu lỗi phần cứng camera
      digitalWrite(LED_RED_GPIO, LOW);  delay(100);
      digitalWrite(LED_RED_GPIO, HIGH); delay(100);
    }
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_RED_GPIO, LOW);  delay(250); // Nháy chậm khi đang kết nối WiFi
    digitalWrite(LED_RED_GPIO, HIGH); delay(250);
  }

  // Nháy nhanh 5 lần báo hiệu kết nối WiFi thành công
  for(int i=0; i<5; i++) {
    digitalWrite(LED_RED_GPIO, LOW);  delay(80);
    digitalWrite(LED_RED_GPIO, HIGH); delay(80);
  }

  server.begin();
  Serial.print("[+] Camera san sang! Xem luong tai link: http://");
  Serial.print(WiFi.localIP());
  Serial.println(":81");
}

void loop() {
  handleStream(); 
}