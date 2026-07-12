// Cấu hình Firebase đồng bộ
const firebaseConfig = {
  apiKey: "AIzaSyAB7eK8WWL9idKsrk85piXRO7ANEka23DA",
  authDomain: "uav-3adeb.firebaseapp.com",
  projectId: "uav-3adeb",
  databaseURL: "https://uav-3adeb-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "uav-3adeb.firebasestorage.app",
  messagingSenderId: "644516545190",
  appId: "1:644516545190:web:107db1a0ed67550ddfea67"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const database = firebase.database();
const historyBody = document.getElementById('historyBody');

// Giả sử ESP32 gửi dữ liệu vào nhánh 'uav_logs'
const logsRef = database.ref('uav_logs');

// Lấy 50 bản ghi mới nhất
logsRef.limitToLast(50).on('value', (snapshot) => {
    historyBody.innerHTML = ""; // Xóa nội dung cũ
    const data = snapshot.val();
    
    if (data) {
        // Chuyển object thành array và đảo ngược để hiện mới nhất lên đầu
        const logArray = Object.keys(data).map(key => data[key]).reverse();

        logArray.forEach(log => {
            const row = `
                <tr>
                    <td>${log.timestamp || '---'}</td>
                    <td>${log.temp || '--'}</td>
                    <td>${log.humi || '--'}</td>
                    <td>${log.gas || '--'}</td>
                    <td>${log.lat?.toFixed(6) || '0'}, ${log.lng?.toFixed(6) || '0'}</td>
                    <td>${log.alt || '0'}</td>
                </tr>
            `;
            historyBody.insertAdjacentHTML('beforeend', row);
        });
    } else {
        historyBody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Chưa có dữ liệu lịch sử.</td></tr>";
    }
});

// Xử lý nút xóa nhật ký
document.getElementById('clearLogBtn').addEventListener('click', () => {
    if(confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử?")) {
        logsRef.remove();
    }
});