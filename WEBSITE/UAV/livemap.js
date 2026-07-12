import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAB7eK8WWL9idKsrk85piXRO7ANEka23DA",
  authDomain: "uav-3adeb.firebaseapp.com",
  projectId: "uav-3adeb",
  storageBucket: "uav-3adeb.firebasestorage.app",
  messagingSenderId: "644516545190",
  databaseURL: "https://uav-3adeb-default-rtdb.asia-southeast1.firebasedatabase.app",
  appId: "1:644516545190:web:107db1a0ed67550ddfea67"
  
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Khởi tạo bản đồ
const map = L.map('map').setView([21.0285, 105.8542], 16);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

const uavIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/683/683525.png',
    iconSize: [45, 45], iconAnchor: [22, 22]
});

const marker = L.marker([21.0285, 105.8542], { icon: uavIcon }).addTo(map);

// Lắng nghe dữ liệu
onValue(ref(db, 'uav_status'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const { lat, lng, alt, battery } = data;
        marker.setLatLng([lat, lng]);
        map.panTo([lat, lng]);

        document.getElementById('lat').innerText = lat.toFixed(6);
        document.getElementById('lng').innerText = lng.toFixed(6);
        document.getElementById('alt').innerText = alt;
        document.getElementById('battery').innerText = battery || 0;

        // Cập nhật trạng thái kết nối ở Sidebar
        const dot = document.getElementById('statusDot');
        dot.style.background = "#22c55e";
        dot.style.boxShadow = "0 0 10px #22c55e";
        document.getElementById('statusText').innerText = "System Live";
    }
});