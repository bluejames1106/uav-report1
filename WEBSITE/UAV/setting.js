// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAB7eK8WWL9idKsrk85piXRO7ANEka23DA",
    authDomain: "uav-3adeb.firebaseapp.com",
    projectId: "uav-3adeb",
    databaseURL: "https://uav-3adeb-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "uav-3adeb.firebasestorage.app",
    messagingSenderId: "644516545190",
    appId: "1:644516545190:web:107db1a0ed67550ddfea67"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Cấu hình Email có quyền Admin
const ADMIN_EMAIL = "admin@uav.com"; // THAY EMAIL CỦA BẠN VÀO ĐÂY

// 2. Kiểm tra quyền và hiển thị thông tin khi tải trang
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('userEmail').value = user.email;
        
        // Kiểm tra quyền Admin
        if (user.email !== ADMIN_EMAIL) {
            disableAdminFeatures();
        }
        
        // Lấy dữ liệu ngưỡng hiện tại từ Firebase
        loadCurrentThresholds();
    } else {
        // Nếu chưa đăng nhập, đá về trang login
        window.location.href = "index.html";
    }
});

function disableAdminFeatures() {
    const btn = document.getElementById('btn-admin-save');
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
    btn.innerText = "Quyền hạn hạn chế";
    document.getElementById('admin-msg').style.display = "block";
    
    // Khóa luôn các ô input
    document.getElementById('thresholdTemp').readOnly = true;
    document.getElementById('thresholdHumi').readOnly = true;
    document.getElementById('thresholdGas').readOnly = true;
}

// 3. Hàm tải dữ liệu ngưỡng từ Firebase
function loadCurrentThresholds() {
    database.ref('settings/thresholds').once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data) {
            document.getElementById('thresholdTemp').value = data.temperatureMax ;
            document.getElementById('thresholdHumi').value = data.humidityMin ;
            document.getElementById('thresholdGas').value = data.gasMax ;
        }
    });
}

// 4. Hàm cập nhật mật khẩu
function updatePassword() {
    const user = auth.currentUser;
    const newPass = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmPass').value;

    if (newPass.length < 6) {
        alert("Mật khẩu phải có ít nhất 6 ký tự!");
        return;
    }

    if (newPass !== confirmPass) {
        alert("Mật khẩu xác nhận không khớp!");
        return;
    }

    user.updatePassword(newPass).then(() => {
        alert("Chúc mừng! Mật khẩu đã được thay đổi thành công.");
        document.getElementById('newPass').value = "";
        document.getElementById('confirmPass').value = "";
    }).catch((error) => {
        if (error.code === 'auth/requires-recent-login') {
            alert("Vì lý do bảo mật, bạn cần đăng nhập lại để thực hiện thao tác này.");
            logout();
        } else {
            alert("Lỗi: " + error.message);
        }
    });
}

// 5. Hàm lưu ngưỡng (Chỉ chạy nếu là Admin)
function saveThresholds() {
    const user = auth.currentUser;
    if (user.email !== ADMIN_EMAIL) return;

    const temp = document.getElementById('thresholdTemp').value;
    const humi = document.getElementById('thresholdHumi').value;
    const gas = document.getElementById('thresholdGas').value;

    database.ref('settings/thresholds').set({
        temperatureMax: parseFloat(temp),
        humidityMin: parseFloat(humi),
        gasMax: parseFloat(gas),
        lastUpdatedBy: user.email,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert("Hệ thống đã cập nhật ngưỡng cảnh báo mới!");
    }).catch(err => alert("Lỗi lưu dữ liệu: " + err.message));
}

// 6. Các hàm bổ trợ
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('closed');
    document.getElementById('main-content').classList.toggle('shifted');
}

function logout() {
    auth.signOut().then(() => {
        window.location.href = "index.html";
    });
}

// Giả lập kiểm tra ESP32
database.ref('sensor').limitToLast(1).on('value', () => {
    const status = document.getElementById('esp-status');
    status.innerText = "Connecting";
    status.className = "status-val online";
});