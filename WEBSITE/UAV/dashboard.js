// 1. Firebase Configuration
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 2. Sidebar Toggle Logic
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('closed');
    document.getElementById('main-content').classList.toggle('expanded');
}

// 3. Initialize Chart.js
const ctx = document.getElementById('realtimeChart').getContext('2d');
const maxPoints = 20;

const realtimeChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Temp (°C)',
                borderColor: '#e94560',
                backgroundColor: 'rgba(233, 69, 96, 0.1)',
                data: [],
                borderWidth: 2,
                tension: 0.4,
                yAxisID: 'y'
            },
            {
                label: 'Humi (%)',
                borderColor: '#4ade80',
                backgroundColor: 'rgba(74, 222, 128, 0.1)',
                data: [],
                borderWidth: 2,
                tension: 0.4,
                yAxisID: 'y'
            },
            {
                label: 'Dust (PPM)',
                borderColor: '#facc15',
                data: [],
                borderWidth: 2,
                yAxisID: 'y1'
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { grid: { color: '#ffffff05' }, ticks: { color: '#94a3b8' } },
            y: { position: 'left', grid: { color: '#ffffff05' }, ticks: { color: '#94a3b8' } },
            y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#facc15' } }
        },
        plugins: { legend: { labels: { color: '#fff' } } }
    }
});

// 4. Update UI & Chart
function updateDashboard(temp, humi, dust) {
    // Update text values
    document.getElementById('temp-val').innerText = temp;
    document.getElementById('humi-val').innerText = humi;
    document.getElementById('dust-val').innerText = dust;

    // Update Chart
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (realtimeChart.data.labels.length > maxPoints) {
        realtimeChart.data.labels.shift();
        realtimeChart.data.datasets.forEach(ds => ds.data.shift());
    }

    realtimeChart.data.labels.push(now);
    realtimeChart.data.datasets[0].data.push(temp);
    realtimeChart.data.datasets[1].data.push(humi);
    realtimeChart.data.datasets[2].data.push(dust);
    realtimeChart.update('none');

    // Update Last Time
    document.getElementById('last-update').innerText = `Last update: ${now}`;

    // Dust Alert logic
    const airStatus = document.getElementById('air-status');
    if (dust > 1000) {
        airStatus.innerText = "Warning: Poor Air!";
        airStatus.style.color = "#ff4d4d";
    } else {
        airStatus.innerText = "Air Quality: Good";
        airStatus.style.color = "#4ade80";
    }
}

// 5. Firebase Listener
database.ref('sensor').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        updateDashboard(data.temp, data.humi, data.dust);
    }
}, (error) => {
    console.error(error);
    document.getElementById('connection-status').innerText = "● Offline";
    document.getElementById('connection-status').className = "status-offline";
});
// 6. Logic điều khiển thiết bị
let deviceStates = {
    led: false,
    buzzer: false
};

function toggleDevice(device) {
    // Đảo trạng thái
    deviceStates[device] = !deviceStates[device];
    
    // Gửi giá trị (0 hoặc 1) lên Firebase
    const value = deviceStates[device] ? 1 : 0;
    database.ref('control/' + device).set(value);
    
    // Cập nhật giao diện nút bấm ngay lập tức
    updateButtonUI(device, deviceStates[device]);
}

function updateButtonUI(device, state) {
    const btn = document.getElementById('btn-' + device);
    if (state) {
        btn.innerText = "ON";
        btn.classList.add('active');
    } else {
        btn.innerText = "OFF";
        btn.classList.remove('active');
    }
}

// Lắng nghe trạng thái thực tế từ Firebase (để đồng bộ nếu có nhiều người dùng)
database.ref('control').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        if (data.led !== undefined) {
            deviceStates.led = data.led === 1;
            updateButtonUI('led', deviceStates.led);
        }
        if (data.buzzer !== undefined) {
            deviceStates.buzzer = data.buzzer === 1;
            updateButtonUI('buzzer', deviceStates.buzzer);
        }
    }
});