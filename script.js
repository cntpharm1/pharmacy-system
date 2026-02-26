const GAS_URL = "https://script.google.com/macros/s/AKfycbwCwBOhCPNdwWLzBEtMi5jw5npFYd87T-8ijKSMroT_zzNL92A1E243QGWlTCML6DA5/exec";
const LIFF_ID = "2009129539-XFnH7GWq";

let isLiffInitialized = false;

// 1. ฟังก์ชันเริ่มต้นสำหรับหน้าแรก (index.html)
async function initLiff() {
    if (isLiffInitialized) return; // ถ้า init แล้วไม่ต้องทำซ้ำ
    try {
        await liff.init({ liffId: LIFF_ID });
        isLiffInitialized = true;
        if (!liff.isLoggedIn()) {
            if (!liff.isInClient()) {
                document.getElementById("login-container").style.display = "block";
                document.getElementById("loading-container").style.display = "none";
            } else {
                liff.login();
            }
        } else {
            const profile = await liff.getProfile();
            checkUserStatus(profile.userId);
        }
    } catch (err) {
        console.error(err);
    }
}

// 2. เช็คว่าลงทะเบียนหรือยัง
// แก้ไขฟังก์ชัน checkUserStatus ใน script.js
// 2. ฟังก์ชันเช็คสถานะแบบ JSONP (แก้ปัญหา CORS)
function checkUserStatusJSONP(userId) {
    // สร้างชื่อฟังก์ชันชั่วคราวบน Window เพื่อให้ GAS เรียกกลับมาได้
    const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
    
    window[callbackName] = function(data) {
        console.log("Data received via JSONP:", data);
        
        if (data.registered) {
            Swal.fire({
                icon: 'success',
                title: 'ลงทะเบียนเรียบร้อยแล้ว',
                text: 'กำลังปิดหน้าต่างแอป...',
                timer: 2000,
                showConfirmButton: false
            });
            
            // ส่งข้อความยืนยันเข้า LINE (ถ้าทำได้)
            liff.sendMessages([{ type: 'text', text: '📢 ท่านได้ลงทะเบียนระบบยาเรียบร้อยแล้ว' }])
                .catch(e => console.log("Send msg failed (PC)"));

            setTimeout(() => liff.closeWindow(), 2000);
        } else {
            // ยังไม่ลงทะเบียน ส่งไปหน้า register.html
            window.location.href = "register.html";
        }

        // ลบแท็ก script และฟังก์ชันชั่วคราวออกเพื่อประหยัดทรัพยากร
        delete window[callbackName];
        document.getElementById(callbackName).remove();
    };

    // สร้างแท็ก <script> เพื่อยิงไปหา GAS
    const script = document.createElement('script');
    script.src = `${GAS_URL}?action=checkUser&userId=${userId}&callback=${callbackName}&t=${Date.now()}`;
    script.id = callbackName;
    document.body.appendChild(script);
}

// 3. ฟังก์ชันสำหรับหน้าลงทะเบียน (register.html)
async function initRegisterPage() {
    await liff.init({ liffId: LIFF_ID });
    const profile = await liff.getProfile();
    
    // เติมข้อมูลจาก LINE Profile
    document.getElementById("lineId").value = profile.userId;
    document.getElementById("userName").value = profile.displayName;
    if (profile.pictureUrl) {
        const img = document.getElementById("userImg");
        img.src = profile.pictureUrl;
        img.style.display = "inline-block";
    }

    // ดึงรายชื่อหอผู้ป่วยจาก Sheets
    loadWards();
}

async function loadWards() {
    const res = await fetch(`${GAS_URL}?action=getWards`);
    const wards = await res.json();
    const select = document.getElementById("wardList");
    select.innerHTML = '<option value="">เลือกหอผู้ป่วย</option>';
    wards.forEach(ward => {
        const opt = document.createElement("option");
        opt.value = ward;
        opt.innerHTML = ward;
        select.appendChild(opt);
    });
}

// 4. จัดการส่งฟอร์มลงทะเบียน
document.getElementById("regForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    Swal.fire({
        title: 'กำลังบันทึกข้อมูล...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const data = {
        action: "register",
        lineId: document.getElementById("lineId").value,
        name: document.getElementById("userName").value,
        ward: document.getElementById("wardList").value
    };

    try {
        const res = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.status === "success") {
            Swal.fire({
                icon: 'success',
                title: 'ลงทะเบียนสำเร็จ',
                showConfirmButton: false,
                timer: 2000
            }).then(() => {
                // ส่งข้อความยืนยันเข้า LINE
                liff.sendMessages([{
                    type: 'text',
                    text: `✅ ลงทะเบียนสำเร็จ\nคุณ: ${data.name}\nหอผู้ป่วย: ${data.ward}`
                }]).then(() => liff.closeWindow());
            });
        }
    } catch (err) {
        Swal.fire("Error", "การบันทึกล้มเหลว", "error");
    }
});

if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
    window.onload = initLiff;
}
