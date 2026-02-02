import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ✅ API KEY ของคุณ
const firebaseConfig = {
    apiKey: "AIzaSyBRVm1va6y4JMMd7uaBFndafGaOTAVq11A",
    authDomain: "mrprmap.firebaseapp.com",
    projectId: "mrprmap",
    storageBucket: "mrprmap.firebasestorage.app",
    messagingSenderId: "968493022387",
    appId: "1:968493022387:web:4612f180a5ecef32fe04c6"
};

let db;
let map, selectedPos = null, activeTab = 'text';
let canvas, ctx, isDrawing = false, penColor = '#000000', compressedImg = null;
let markers = {};
let currentViewId = null;

// Profile Data
let userProfile = {
    name: 'Guest',
    avatar: null
};

// --- INIT APP ---
window.initApp = function() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        document.getElementById('statusText').innerText = "Connected! Loading Map...";
        document.getElementById('statusText').classList.add('text-green-400');
        
        listenToCloudPosts();

        // Init Profile
        window.initProfile();

        setTimeout(() => {
            document.getElementById('splashScreen').style.opacity = '0';
            document.getElementById('map').style.opacity = '1';
            setTimeout(() => {
                document.getElementById('splashScreen').style.display = 'none';
                document.getElementById('mainUI').classList.remove('hidden');
                document.getElementById('mainUI').classList.remove('opacity-0');
            }, 800);
        }, 2500);

    } catch (e) {
        console.error("Firebase Error:", e);
        document.getElementById('statusText').innerText = "Connection Failed.";
        document.getElementById('statusText').classList.add('text-red-500');
    }
}

// --- FIREBASE LISTENERS ---
function listenToCloudPosts() {
    const q = query(collection(db, "mrpr_posts"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                const p = { ...data, id: change.doc.id };
                window.renderMarker(p);
            }
            if (change.type === "removed") {
                window.removeMarkerFromMap(change.doc.id);
            }
        });
    });
}

// --- PROFILE SYSTEM ---
window.initProfile = function() {
    const saved = localStorage.getItem('mrpr_profile');
    if(saved) {
        userProfile = JSON.parse(saved);
        updateProfileUI();
    } else {
        // If no profile, show modal after splash
        setTimeout(() => openProfileModal(), 3000);
    }
}

function updateProfileUI() {
    document.getElementById('btnProfileName').innerText = userProfile.name;
    if(userProfile.avatar) {
        document.getElementById('btnProfileAvatar').src = userProfile.avatar;
        document.getElementById('btnProfileAvatar').classList.remove('hidden');
        document.getElementById('btnProfileIcon').classList.add('hidden');
    }
}

window.openProfileModal = function() {
    document.getElementById('profileNameInput').value = userProfile.name !== 'Guest' ? userProfile.name : '';
    if(userProfile.avatar) {
        document.getElementById('profilePreview').src = userProfile.avatar;
        document.getElementById('profilePreview').classList.remove('hidden');
        document.getElementById('profileIconPlaceholder').classList.add('hidden');
    }
    document.getElementById('profileModal').classList.remove('hidden');
    document.getElementById('profileModal').classList.add('flex');
}

window.closeProfileModal = function() {
    document.getElementById('profileModal').classList.add('hidden');
    document.getElementById('profileModal').classList.remove('flex');
}

window.handleProfileImage = function(input) {
    if(!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        resizeImage(e.target.result, 150, 150, (resizedBase64) => {
            document.getElementById('profilePreview').src = resizedBase64;
            document.getElementById('profilePreview').classList.remove('hidden');
            document.getElementById('profileIconPlaceholder').classList.add('hidden');
        });
    };
    reader.readAsDataURL(input.files[0]);
}

window.saveProfile = function() {
    const name = document.getElementById('profileNameInput').value.trim();
    const avatarSrc = document.getElementById('profilePreview').src;
    const hasAvatar = !document.getElementById('profilePreview').classList.contains('hidden');
    
    if(!name) return alert('กรุณาตั้งชื่อ');

    userProfile.name = name;
    userProfile.avatar = hasAvatar ? avatarSrc : null;
    
    localStorage.setItem('mrpr_profile', JSON.stringify(userProfile));
    updateProfileUI();
    closeProfileModal();
}

// --- MAP & POSTS ---
// Init Map
map = L.map('map', { zoomControl: false }).setView([13.7563, 100.5018], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

window.locateUser = function() {
    const icon = document.getElementById('iconLocate');
    icon.className = "fa-solid fa-circle-notch fa-spin text-cyan-400";
    map.locate({setView: true, maxZoom: 16});
}
map.on('locationfound', (e) => {
    document.getElementById('iconLocate').className = "fa-solid fa-location-crosshairs text-cyan-400";
    L.circle(e.latlng, e.accuracy/2, {color:'#06b6d4', fillColor:'#06b6d4', fillOpacity: 0.2}).addTo(map);
    L.marker(e.latlng).addTo(map);
});

window.startAddMode = function() { 
    document.getElementById('mainUI').classList.add('hidden'); 
    document.getElementById('addModeUI').classList.remove('hidden'); 
    document.getElementById('addModeUI').classList.add('flex'); 
}
window.cancelAddMode = function() { 
    document.getElementById('mainUI').classList.remove('hidden'); 
    document.getElementById('addModeUI').classList.add('hidden'); 
    document.getElementById('addModeUI').classList.remove('flex'); 
}
window.confirmLocation = function() {
    selectedPos = map.getCenter();
    document.getElementById('postAsName').innerText = userProfile.name;
    if(userProfile.avatar) {
        document.getElementById('postAsAvatar').src = userProfile.avatar;
    } else {
         document.getElementById('postAsAvatar').src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOTA5MDkwIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0yMCAyMXYtMmE0IDQgMCAwIDAtNC00SDhhNCA0IDAgMCAwLTQgNHYyIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+PC9zdmc+';
    }
    
    document.getElementById('contentModal').classList.remove('hidden');
    setTimeout(() => { document.getElementById('modalBackdrop').classList.remove('opacity-0'); document.getElementById('modalContent').classList.remove('translate-y-full'); }, 10);
    resizeCanvas();
}
window.closeModal = function() {
    document.getElementById('modalBackdrop').classList.add('opacity-0');
    document.getElementById('modalContent').classList.add('translate-y-full');
    setTimeout(() => { document.getElementById('contentModal').classList.add('hidden'); cancelAddMode(); resetForm(); }, 300);
}
window.switchTab = function(t) {
    activeTab = t;
    ['text','image','draw'].forEach(x => {
        const btn = document.getElementById(`tab-${x}`);
        const pnl = document.getElementById(`panel-${x}`);
        if(x===t){ 
            btn.classList.add('bg-white','text-cyan-600','shadow'); btn.classList.remove('text-gray-500');
            pnl.classList.remove('hidden'); 
        } else { 
            btn.classList.remove('bg-white','text-cyan-600','shadow'); btn.classList.add('text-gray-500');
            pnl.classList.add('hidden'); 
        }
    });
    if(t==='draw') setTimeout(resizeCanvas, 100);
}

window.savePost = async function() {
    let content = null;
    if(activeTab==='text') content = document.getElementById('textContent').value.trim();
    else if(activeTab==='image') content = compressedImg;
    else content = canvas.toDataURL();

    if(!content) return alert('กรุณาใส่ข้อมูล');

    const postData = {
        lat: selectedPos.lat,
        lng: selectedPos.lng,
        type: activeTab,
        content: content,
        author: userProfile.name,
        authorAvatar: userProfile.avatar,
        time: new Date().toLocaleString('th-TH')
    };

    try {
        await addDoc(collection(db, "mrpr_posts"), {
            ...postData,
            createdAt: serverTimestamp()
        });
        closeModal();
    } catch (e) {
        alert("Error saving: " + e.message);
    }
}

window.renderMarker = function(p) {
    let thumb = '';
    if(p.type==='text') thumb = `<div class="w-12 h-12 rounded-full bg-white border-2 border-cyan-500 flex items-center justify-center text-cyan-600 shadow-[0_4px_10px_rgba(0,0,0,0.3)]"><i class="fa-solid fa-comment-dots text-xl"></i></div>`;
    else thumb = `<img src="${p.content}" class="w-14 h-14 rounded-full border-2 border-white shadow-lg object-cover bg-gray-100">`;

    let avatarBadge = '';
    if(p.authorAvatar) {
        avatarBadge = `<img src="${p.authorAvatar}" class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border border-white shadow-md z-10 bg-gray-200">`;
    } else {
         avatarBadge = `<div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border border-white shadow-md z-10 bg-gray-300 flex items-center justify-center text-[10px] text-gray-600"><i class="fa-solid fa-user"></i></div>`;
    }

    const html = `
        <div class="marker-anim relative flex flex-col items-center cursor-pointer hover:scale-110 transition-transform group" onclick="openViewModal('${encodeURIComponent(JSON.stringify(p))}')">
            <div class="relative">
                ${thumb}
                ${avatarBadge}
            </div>
            <div class="mt-1 bg-gray-900/90 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur border border-white/20 font-bold max-w-[80px] truncate shadow group-hover:bg-cyan-600 transition-colors">${p.author}</div>
        </div>`;
    
    const marker = L.marker([p.lat, p.lng], { 
        icon: L.divIcon({ className: 'bg-transparent border-none', html: html, iconSize: [60, 80], iconAnchor: [30, 40] }) 
    }).addTo(map);
    markers[p.id] = marker;
}

window.removeMarkerFromMap = function(id) {
    if (markers[id]) { map.removeLayer(markers[id]); delete markers[id]; }
}

window.openViewModal = function(jsonStr) {
    const p = JSON.parse(decodeURIComponent(jsonStr));
    currentViewId = p.id;
    
    document.getElementById('viewAuthor').innerText = p.author;
    document.getElementById('viewTime').innerText = p.time || '';
    
    const avatarEl = document.getElementById('viewAvatar');
    const placeholderEl = document.getElementById('viewAvatarPlaceholder');
    if(p.authorAvatar) {
        avatarEl.src = p.authorAvatar;
        avatarEl.classList.remove('hidden');
        placeholderEl.classList.add('hidden');
    } else {
        avatarEl.classList.add('hidden');
        placeholderEl.classList.remove('hidden');
    }

    const img = document.getElementById('viewImage');
    const txt = document.getElementById('viewText');
    
    if(p.type==='text') { img.classList.add('hidden'); txt.classList.remove('hidden'); txt.innerText = p.content; }
    else { txt.classList.add('hidden'); img.classList.remove('hidden'); img.src = p.content; }
    
    document.getElementById('viewModal').classList.remove('hidden');
}
window.closeViewModal = function() { document.getElementById('viewModal').classList.add('hidden'); currentViewId = null; }

window.deleteCurrentPost = async function() {
    if(currentViewId && confirm('ยืนยันที่จะลบโพสต์นี้?')) {
        try {
            await deleteDoc(doc(db, "mrpr_posts", currentViewId));
            closeViewModal();
        } catch (e) {
            alert("Error: " + e.message);
        }
    }
}

// Helpers
function resizeImage(base64Str, maxWidth, maxHeight, callback) {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
        const cvs = document.createElement('canvas'); const ctx = cvs.getContext('2d');
        let w = img.width, h = img.height;
        if(w > h) { if(w > maxWidth) { h *= maxWidth / w; w = maxWidth; } } 
        else { if(h > maxHeight) { w *= maxHeight / h; h = maxHeight; } }
        cvs.width = w; cvs.height = h; ctx.drawImage(img, 0, 0, w, h);
        callback(cvs.toDataURL('image/jpeg', 0.8));
    };
}

window.handleImage = function(input){ 
    if(!input.files[0]) return;
    const reader=new FileReader();
    reader.onload=(e)=>{
        resizeImage(e.target.result, 600, 600, (result) => {
            compressedImg = result;
            document.getElementById('imgPreview').src = compressedImg;
            document.getElementById('imgPreview').classList.remove('hidden');
            document.getElementById('imgPlaceholder').classList.add('hidden');
        });
    }; reader.readAsDataURL(input.files[0]);
}

window.initCanvas = function(){ canvas=document.getElementById('drawingCanvas'); ctx=canvas.getContext('2d'); ['mousedown','mousemove','mouseup','touchstart','touchmove','touchend'].forEach(e=>canvas.addEventListener(e,draw,{passive:false})); }
window.resizeCanvas = function(){ 
    const p=canvas.parentElement; if(p.clientWidth){ 
        const t=document.createElement('canvas'); t.width=canvas.width; t.height=canvas.height; t.getContext('2d').drawImage(canvas,0,0);
        canvas.width=p.clientWidth; canvas.height=220; 
        ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=3; ctx.strokeStyle=penColor; ctx.drawImage(t,0,0); 
    } 
}
function draw(e){ 
    const r=canvas.getBoundingClientRect(); const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left; const y=(e.touches?e.touches[0].clientY:e.clientY)-r.top;
    if(['mousedown','touchstart'].includes(e.type)){ e.preventDefault(); isDrawing=true; ctx.beginPath(); ctx.moveTo(x,y); }
    else if(['mouseup','touchend'].includes(e.type)){ isDrawing=false; }
    else if(isDrawing){ e.preventDefault(); ctx.lineTo(x,y); ctx.stroke(); }
}
window.setColor = function(c){ penColor=c; ctx.strokeStyle=c; }
window.clearCanvas = function(){ ctx.clearRect(0,0,canvas.width,canvas.height); }
window.resetForm = function(){ document.getElementById('textContent').value=''; compressedImg=null; document.getElementById('imgPreview').classList.add('hidden'); document.getElementById('imgPlaceholder').classList.remove('hidden'); clearCanvas(); }

window.addEventListener('load', ()=>{ initCanvas(); initApp(); });
