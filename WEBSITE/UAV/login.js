import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAB7eK8WWL9idKsrk85piXRO7ANEka23DA",
  authDomain: "uav-3adeb.firebaseapp.com",
  projectId: "uav-3adeb",
  storageBucket: "uav-3adeb.firebasestorage.app",
  messagingSenderId: "644516545190",
  appId: "1:644516545190:web:107db1a0ed67550ddfea67",
  databaseURL: "https://uav-3adeb-default-rtdb.asia-southeast1.firebasedatabase.app",
  measurementId: "G-MCG9E6DV3E"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const authForm = document.getElementById('authForm');
const message = document.getElementById('message');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const confirmPassGroup = document.getElementById('confirmPassGroup');
const mainBtn = document.getElementById('mainBtn');
const formDescription = document.getElementById('formDescription');

let isLoginMode = true;

tabLogin.addEventListener('click', () => {
    isLoginMode = true;
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    confirmPassGroup.style.display = "none";
    document.getElementById('confirmPassword').required = false;
    mainBtn.innerText = "LOGIN";
    formDescription.innerText = "Vui lòng đăng nhập để điều khiển";
    message.innerHTML = "";
});

tabRegister.addEventListener('click', () => {
    isLoginMode = false;
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    confirmPassGroup.style.display = "block";
    document.getElementById('confirmPassword').required = true;
    mainBtn.innerText = "SIGN UP";
    formDescription.innerText = "Tạo tài khoản mới để truy cập hệ thống";
    message.innerHTML = "";
});

authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    message.className = "";
    message.innerHTML = "Đang xử lý...";

    if (isLoginMode) {
        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                message.innerHTML = "Đăng nhập thành công! Đang chuyển hướng...";
                message.className = "success";
                setTimeout(() => window.location.href = "dashboard.html", 1000);
            })
            .catch((error) => {
                message.innerHTML = "Lỗi: Sai tài khoản hoặc mật khẩu.";
                message.className = "error";
            });
    } else {
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (password !== confirmPassword) {
            message.innerHTML = "Mật khẩu xác nhận không trùng khớp.";
            message.className = "error";
            return;
        }

        createUserWithEmailAndPassword(auth, email, password)
            .then(() => {
                message.innerHTML = "Đăng ký thành công! Đang chuyển hướng...";
                message.className = "success";
                setTimeout(() => window.location.href = "dashboard.html", 1500);
            })
            .catch((error) => {
                message.className = "error";
                // Bổ sung bắt các mã lỗi chính xác của Firebase Auth
                if (error.code === 'auth/email-already-in-use') {
                    message.innerHTML = "Email này đã được đăng ký.";
                } else if (error.code === 'auth/invalid-email') {
                    message.innerHTML = "Định dạng Email không hợp lệ.";
                } else if (error.code === 'auth/weak-password') {
                    message.innerHTML = "Mật khẩu quá yếu! Yêu cầu từ 6 ký tự trở lên.";
                } else {
                    message.innerHTML = "Lỗi hệ thống: " + error.message;
                }
            });
    }
});