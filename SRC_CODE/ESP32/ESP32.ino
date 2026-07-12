#include <WiFi.h>
#include <FirebaseESP32.h>
#include <DHT.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <Wire.h>
#include <MPU9250_WE.h> // Thư viện tối ưu cho dòng MPU9250 / MPU6500 / MPU9255
#include <ESP32Servo.h> // Thư viện điều khiển Servo tiêu chuẩn trên ESP32

// --- 1. THÔNG TIN KẾT NỐI (Đã đồng bộ theo hệ thống của bạn) ---
const char* ssid = "Gà gáy";     
const char* password = "meomeo123"; 

#define FIREBASE_HOST "uav-3adeb-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "QOEObmfCSCI7Q7ZbNJN6VfFSlulgklGhwh8TLAmT"

// --- 2. SƠ ĐỒ CHÂN (Đbg: KHÔNG CÒN TRÙNG LẶP / XUNG ĐỘT PIN) ---
#define DHTPIN        23     // ĐÃ ĐỔI: Chuyển sang chân 23 để né chân Servo số 5
#define DHTTYPE       DHT11
#define BUZZER_PIN    4      // Còi báo động
#define LED_PIN       2      // LED báo hiệu dán trên bo mạch ESP32
#define MQ135_PIN     34     // Chân Analog đọc cảm biến khói khí ga (Chân Input thuần)

#define SERVO_PAN_PIN 18     // Chân Servo trục ngang (Pan) - Khớp uav-control.js
#define SERVO_TILT_PIN 5     // Chân Servo trục dọc (Tilt) - Khớp uav-control.js

#define MPU9250_ADDR  0x68   // Địa chỉ I2C mặc định của MPU

// --- 3. KHỞI TẠO CÁC ĐỐI TƯỢNG LINH KIỆN ---
DHT dht(DHTPIN, DHTTYPE);
MPU9250_WE mpu = MPU9250_WE(MPU9250_ADDR); 
Servo servoPan;  
Servo servoTilt; 

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
FirebaseJson json;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600); // Múi giờ Việt Nam (+7)

// Các biến quản lý thời gian (Kỹ thuật Millis chống nghẽn mạng)
unsigned long lastSensorUpdate = 0;
unsigned long lastHistoryLog = 0;
unsigned long lastControlCheck = 0;
unsigned long lastGetSettings = 0;

// Các biến lưu ngưỡng cảnh báo mặc định (Sẽ cập nhật từ Web)
float thresholdTemp = 40.0;
float thresholdGas = 500.0;
bool isMpuReady = false;

// =========================================================================
// HÀM KHỞI TẠO HỆ THỐNG (SETUP)
// =========================================================================
void setup() {
  Serial.begin(115200);
  
  // Cấu hình linh kiện xuất tín hiệu
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  // Khởi động cảm biến môi trường dht
  dht.begin();

  // Kích hoạt cổng giao tiếp I2C phần cứng (SDA = GPIO 21, SCL = GPIO 22)
  Wire.begin(21, 22); 
  
  if (!mpu.init()) {
    Serial.println("[-] CẢNH BÁO: Không tìm thấy module MPU9250/6500/9255!");
    isMpuReady = false;
  } else {
    Serial.println("[+] MPU9250/6500/9255 kết nối thành công!");
    isMpuReady = true;
    
    mpu.autoOffsets(); // Tự động lấy điểm cân bằng tĩnh ban đầu khi UAV đứng yên
    mpu.setAccRange(MPU9250_ACC_RANGE_8G);
    mpu.setGyrRange(MPU9250_GYRO_RANGE_500);
  }

  // Khởi tạo kênh phát xung PWM 50Hz cho 2 động cơ Servo
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoPan.setPeriodHertz(50);
  servoTilt.setPeriodHertz(50);
  
  // FIX LỖI VỌT: Khóa chặt góc đệm bằng 0 độ trước khi cấp xung chân ra
  servoPan.write(0);
  servoTilt.write(0);
  
  // Tiến hành kích hoạt chân xuất xung dải rộng 180 độ (500us - 2400us)
  servoPan.attach(SERVO_PAN_PIN, 500, 2400);
  servoTilt.attach(SERVO_TILT_PIN, 500, 2400);
  
  Serial.println("[+] Đã cố định góc ban đầu 2 Servo = 0 độ (Chống vọt)");

  // Tiến hành thiết lập mạng WiFi cục bộ
  WiFi.begin(ssid, password);
  Serial.print("[*] WiFi Đang kết nối");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); 
    Serial.print(".");
  }
  Serial.println("\n[V] Đã kết nối WiFi thành công!");

  // Liên kết thông số cấu hình mật mã bảo mật với Firebase
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  
  fbdo.setResponseSize(1024);
  Firebase.setReadTimeout(fbdo, 1000 * 15);
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true); // Tự động kết nối lại nếu UAV bay xa yếu sóng

  timeClient.begin();
  Serial.println("[HỆ THỐNG] Đã sẵn sàng đồng bộ thông số!");
}

// =========================================================================
// CHU KỲ HOẠT ĐỘNG CHÍNH (LOOP)
// =========================================================================
void loop() {
  timeClient.update();

  // 1. ĐỒNG BỘ NGƯỠNG CẢNH BÁO TỪ WEB ĐỂ TỰ ĐỘNG HÓA (Mỗi 5 giây)
  if (millis() - lastGetSettings > 5000) {
    lastGetSettings = millis();
    if (Firebase.getFloat(fbdo, "/settings/thresholds/temperatureMax")) {
      thresholdTemp = fbdo.floatData(); // Cập nhật ngưỡng nhiệt độ Admin đặt
    }
    if (Firebase.getFloat(fbdo, "/settings/thresholds/gasMax")) {
      thresholdGas = fbdo.floatData();  // Cập nhật ngưỡng khí ga Admin đặt
    }
  }

  // 2. ĐỌC CẢM BIẾN & XỬ LÝ VƯỢT NGƯỠNG & ĐẨY DASHBOARD THỜI GIAN THỰC (Mỗi 3 giây)
  if (millis() - lastSensorUpdate >= 3000) {
    lastSensorUpdate = millis();
    
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    int gas = analogRead(MQ135_PIN);

    // Chống trả về giá trị trống (NaN) nếu tuột dây cảm biến
    if (isnan(t)) t = 0.0;
    if (isnan(h)) h = 0.0;

    // Đọc số liệu định hướng UAV từ MPU
    float roll = 0.0, pitch = 0.0, yaw = 0.0; 
    if (isMpuReady) {
      xyzFloat angles = mpu.getAngles();
      roll = angles.x;
      pitch = angles.y;
      
      // Tính toán mô phỏng trục xoay Yaw dựa trên vận tốc góc Z tích phân thời gian
      xyzFloat gyroResult = mpu.getGyrValues();
      static float calculated_yaw = 0.0;
      calculated_yaw += (gyroResult.z * 3.0); 
      if (calculated_yaw > 360.0) calculated_yaw -= 360.0;
      if (calculated_yaw < 0.0) calculated_yaw += 360.0;
      yaw = calculated_yaw;
    } else {
      isMpuReady = mpu.init(); // Quét lại thiết bị I2C ngầm nếu lỏng dây
    }

    // In thông số kiểm tra ra màn hình máy tính
    Serial.printf("Temp: %.1fC | Humi: %.1f%% | Gas: %d | Roll: %.1f | Pitch: %.1f | Yaw: %.1f\n", t, h, gas, roll, pitch, yaw);

    // --- LOGIC TỰ ĐỘNG HÓA: KÍCH HOẠT KHI VƯỢT NGƯỠNG CẢNH BÁO ---
    if (t > thresholdTemp || gas > thresholdGas) {
      digitalWrite(BUZZER_PIN, HIGH); // Còi kêu liên tục báo động
      digitalWrite(LED_PIN, HIGH);    // Đèn LED sáng rực
      
      // Đẩy lệnh đồng bộ ngược lên Web để hiển thị trạng thái đang hú còi/sáng đèn
      Firebase.setInt(fbdo, "/control/buzzer", 1);
      Firebase.setInt(fbdo, "/control/led", 1);
    }

    // --- GỬI ĐÓNG GÓI JSON LÊN DASHBOARD TRẠM MẶT ĐẤT ---
    json.clear();
    json.add("temp", t);
    json.add("humi", h);
    json.add("dust", gas); // Tên "dust" giữ nguyên để khớp code cũ web của bạn
    
    // Đóng gói mpu lồng bên trong nhánh /sensor theo đúng cấu hình ảnh cây Firebase của bạn
    FirebaseJson jsonMpu;
    jsonMpu.add("roll", roll);
    jsonMpu.add("pitch", pitch);
    jsonMpu.add("yaw", yaw);
    json.add("mpu", jsonMpu);
    
    Firebase.setJSON(fbdo, "/sensor", json);
  }

  // 3. ĐỌC LỆNH ĐIỀU KHIỂN THỦ CÔNG TỪ WEB (Quét nhanh mỗi 0.5 giây)
  if (millis() - lastControlCheck > 500) {
    lastControlCheck = millis();
    
    // Đọc trạng thái nút bấm LED từ Web
    if (Firebase.getInt(fbdo, "/control/led")) {
      digitalWrite(LED_PIN, fbdo.intData() == 1 ? HIGH : LOW);
    }
    
    // Đọc trạng thái nút bấm CÒI từ Web
    if (Firebase.getInt(fbdo, "/control/buzzer")) {
      digitalWrite(BUZZER_PIN, fbdo.intData() == 1 ? HIGH : LOW);
    }

    // Đọc góc xoay từ thanh trượt Slider Ngang (Pan Servo) trên Web
    if (Firebase.getInt(fbdo, "/control/pan")) {
      int anglePan = fbdo.intData();
      if (anglePan > 180) anglePan = 180; // Giới hạn góc biên cơ khí bảo vệ Gimbal
      if (anglePan < 0)  anglePan = 0;
      servoPan.write(anglePan);
    }

    // Đọc góc xoay từ thanh trượt Slider Dọc (Tilt Servo) trên Web
    if (Firebase.getInt(fbdo, "/control/tilt")) {
      int angleTilt = fbdo.intData();
      if (angleTilt > 360) angleTilt = 360; // Giới hạn góc biên cơ khí
      if (angleTilt < 0)  angleTilt = 0;
      servoTilt.write(angleTilt);
    }
  }

  // 4. GHI NHẬT KÝ HÀNH TRÌNH ĐỊNH KỲ VÀO HỘP ĐEN HỆ THỐNG (Mỗi 1 phút)
  if (millis() - lastHistoryLog >= 60000) {
    lastHistoryLog = millis();
    
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    int gas = analogRead(MQ135_PIN);

    // Các thông số tọa độ GPS bay mẫu phục vụ bản đồ Live Map
    float lat = 10.762622; 
    float lng = 106.660172;
    float alt = 15.5; 

    FirebaseJson log;
    log.add("timestamp", timeClient.getFormattedTime());
    log.add("temp", isnan(t) ? 0 : t);
    log.add("humi", isnan(h) ? 0 : h);
    log.add("gas", gas);   
    log.add("lat", lat);   
    log.add("lng", lng);   
    log.add("alt", alt);   
    
    Firebase.pushJSON(fbdo, "/uav_logs", log);
  }
}