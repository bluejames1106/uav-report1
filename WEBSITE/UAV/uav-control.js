/**
 * ==========================================================================
 * uav-control.js - Trạm Điều Khiển Mặt Đất (Ground Control Station)
 * Chức năng: Nhận Telemetry MPU, Livestream Camera & Điều khiển Servo Gimbal
 * Hệ thống: SkyLink UAV
 * ==========================================================================
 */

// 1. CẤU HÌNH THÔNG SỐ KẾT NỐI FIREBASE (Đồng bộ chính xác từ hệ thống cũ)
const firebaseConfig = {
    apiKey: "AIzaSyAB7eK8WWL9idKsrk85piXRO7ANEka23DA",
    authDomain: "uav-3adeb.firebaseapp.com",
    databaseURL: "https://uav-3adeb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "uav-3adeb",
    storageBucket: "uav-3adeb.firebasestorage.app",
    messagingSenderId: "644516545190",
    appId: "1:644516545190:web:107db1a0ed67550ddfea67",
    measurementId: "G-MCG9E6DV3E"
};

// Khởi tạo ứng dụng Firebase và dịch vụ Realtime Database
firebase.initializeApp(firebaseConfig);
const database = firebase.database();


// 2. LOGIC ĐÓNG / MỞ SIDEBAR MENU (Thanh điều hướng bên hông)
function toggleSidebar() {
    // Thêm hoặc xóa class 'closed' để thu hẹp/mở rộng thanh Menu
    document.getElementById('sidebar').classList.toggle('closed');
    // Đồng thời co giãn vùng hiển thị nội dung chính để vừa vặn màn hình
    document.getElementById('main-content').classList.toggle('expanded');
}


// 3. XỬ LÝ LUỒNG LIVESTREAM CAMERA TỪ NGROK
function connectCamera() {
    // Lấy chuỗi đường dẫn URL mà người dùng dán vào ô Input
    let url = document.getElementById('ngrok-url-input').value.trim();
    
    // Kiểm tra nếu ô nhập trống thì cảnh báo và dừng xử lý
    if (!url) {
        alert("Vui lòng dán đường link URL do Ngrok cung cấp!");
        return;
    }
    
    // Thuật toán tự động kiểm tra và thêm đuôi định tuyến luồng video '/stream'
    // ESP32-CAM phát luồng MJPEG chuẩn qua đường dẫn: http://<ip_hoac_ngrok>/stream
    if (!url.endsWith('/stream')) {
        if (url.endsWith('/')) {
            url += 'stream'; // Nếu có dấu gạch chéo cuối cùng thì chỉ thêm 'stream'
        } else {
            url += '/stream'; // Nếu chưa có thì thêm đầy đủ '/stream'
        }
    }
    
    // Gán đường dẫn URL hoàn chỉnh vào thuộc tính 'src' của thẻ ảnh img để trình duyệt nạp video
    document.getElementById('camera-stream').src = url;
}


// 4. ĐIỀU KHIỂN GÓC QUAY 2 SERVO GIMBAL (Bắn lệnh lên Firebase)
function controlServo(axis, value) {
    // Bước a: Cập nhật ngay lập tức con số góc độ (0 - 180°) hiển thị trên giao diện Web
    document.getElementById(`${axis}-val`).innerText = value;
    
    // Bước b: Đẩy dữ liệu góc xoay dạng số nguyên lên nhánh tương ứng trên Firebase Realtime DB
    // Đường dẫn trên cơ sở dữ liệu: control/pan hoặc control/tilt
    database.ref(`control/${axis}`).set(parseInt(value));
}

// LẮNG NGHE ĐỒNG BỘ NGƯỢC: Nếu có thiết bị khác (hoặc chính ESP32) thay đổi góc Servo trên Firebase,
// giao diện thanh trượt trên Web sẽ tự động nhảy theo để khớp trạng thái thực tế.
database.ref('control').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        // Đồng bộ thanh trượt Trục Ngang (Pan Servo)
        if (data.pan !== undefined) {
            document.getElementById('slider-pan').value = data.pan;
            document.getElementById('pan-val').innerText = data.pan;
        }
        // Đồng bộ thanh trượt Trục Dọc (Tilt Servo)
        if (data.tilt !== undefined) {
            document.getElementById('slider-tilt').value = data.tilt;
            document.getElementById('tilt-val').innerText = data.tilt;
        }
    }
});


// 5. LẮNG NGHE VÀ ĐỒ THỊ HÓA DỮ LIỆU TELEMETRY CẢM BIẾN MPU
// Lắng nghe thời gian thực tại nhánh: sensor -> mpu
database.ref('sensor/mpu').on('value', (snapshot) => {
    const mpu = snapshot.val();
    
    if (mpu) {
        // --- Bước 5.1: Xuất số liệu thô (Dạng số thập phân) ra màn hình giao diện ---
        // Hàm .toFixed(1) giúp ép dữ liệu chỉ lấy 1 chữ số sau dấu phẩy cho gọn gàng
        document.getElementById('mpu-roll').innerText = mpu.roll.toFixed(1);
        document.getElementById('mpu-pitch').innerText = mpu.pitch.toFixed(1);
        document.getElementById('mpu-yaw').innerText = mpu.yaw.toFixed(1);

        // --- Bước 5.2: Tính toán thuật toán chuyển đổi góc sang tỷ lệ % cho thanh Progress Bar ---
        // Quy ước kỹ thuật phổ biến của UAV:
        // Trục Roll (Nghiêng cánh) và Pitch (Gật đầu) thường dao động trong khoảng lý thuyết từ -90° đến +90°.
        // Trục Yaw (Hướng la bàn đầu máy bay) quay vòng tròn từ 0° đến 360°.
        
        // Công thức đổi dải đo Roll/Pitch từ dải [-90, 90] sang dải phần trăm [0, 100]:
        // Phần trăm = ((Góc_hiện_tại + biên_độ_âm) / tổng_dải_đo) * 100
        let rollPercent = ((mpu.roll + 90) / 180) * 100;
        let pitchPercent = ((mpu.pitch + 90) / 180) * 100;
        
        // Công thức đổi dải đo Yaw từ dải [0, 360] sang dải phần trăm [0, 100]:
        let yawPercent = (mpu.yaw / 360) * 100;

        // --- Bước 5.3: Cập nhật độ rộng (Width) của các thanh đồ họa fill màu ---
        // Hàm Math.min(Math.max(percent, 0), 100) dùng để giới hạn giá trị chặt chẽ trong khoảng 0% đến 100%,
        // phòng trường hợp nhiễu cảm biến MPU gửi góc vượt quá giới hạn làm vỡ khung CSS.
        document.getElementById('bar-roll').style.width = `${Math.min(Math.max(rollPercent, 0), 100)}%`;
        document.getElementById('bar-pitch').style.width = `${Math.min(Math.max(pitchPercent, 0), 100)}%`;
        document.getElementById('bar-yaw').style.width = `${Math.min(Math.max(yawPercent, 0), 100)}%`;

        // --- Bước 5.4: Đóng dấu mốc thời gian (Timestamp) nhận dữ liệu ---
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById('last-telemetry').innerText = `Dữ liệu nhận lúc: ${now}`;
        
        // Chuyển dòng thông báo trạng thái kết nối trên Header thành màu xanh hoạt động
        document.getElementById('connection-status').innerText = "● Telemetry Connected";
        document.getElementById('connection-status').className = "status-online";
    }
}, (error) => {
    // BẮT LỖI: Trường hợp mất mạng internet hoặc Firebase từ chối quyền đọc dữ liệu
    console.error("Lỗi đồng bộ dữ liệu dòng MPU:", error);
    
    // Chuyển dòng thông báo trạng thái kết nối trên Header thành màu đỏ báo động
    document.getElementById('connection-status').innerText = "● Telemetry Lost";
    document.getElementById('connection-status').className = "status-offline";
});