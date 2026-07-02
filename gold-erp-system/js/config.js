// ==========================================
// 1. SETUP PWA WEBAPK (PuTriMas)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('Service Worker PuTriMas Aktif!', reg.scope);
        }).catch(err => console.log('SW Gagal:', err));
    });
}

// ==========================================
// 2. STATE GLOBAL & VARIABEL DASAR
// ==========================================
const { jsPDF } = window.jspdf;
const IS_PREVIEW = true;
let sessionUser = null; let currentCart = []; let editAptId = null; let editGoldId = null;
let dbUsers = [], dbGoldSettings = [], dbAppointments = [], dbFinance = [], dbTemplates = [], dbTestimonials = [], dbServices = [];

// State Paginasi & Memori
let aptPaging = { page: 1, limit: 5 };
let userHistPaging = { page: 1, limit: 10, startDate: '', endDate: '' }; // Variabel baru untuk riwayat pelanggan
let adminFinancePaging = { page: 1, limit: 10, startDate: '', endDate: '', type: 'ALL', category: 'ALL', kadar: 'ALL' }; // State Baru Jurnal Keuangan Admin
let goldPaging = { page: 1, limit: 10, search: '', sortBy: 'URUTAN' }; // State Paginasi Parameter Emas
let selectedTransaksi = [];
let GLOBAL_MULTIPLIER = 2326; let GLOBAL_MULTIPLIER_SILVER = 15000;
let appConfig = {};
let userPaging = { lastDoc: null, firstDoc: null, page: 1, limit: 10 };
let userSearchTimeout = null;
let testiPaging = { lastDoc: null, firstDoc: null, page: 1, limit: 5 };

const DEFAULT_CONFIG = {
    isMaintenance: false, showGraph: true, allowBuy: true, limitTrxEmas: 5, limitTrxJasa: 5, 
    timeSlots: ["09:00 - 10:30 WIB", "10:30 - 12:00 WIB", "13:00 - 14:30 WIB", "15:30 - 17:00 WIB"],
    notaName: "JUAL EMAS UNTUNG", notaAddress: "Ds.Kudukeras,Kec.Babakan, Cirebon", notaPhone: "0852-9550-2517", notaStyle: "SANGAT_BESAR",
    storeTagline: "Jual Emas Mudah dan Menguntungkan", storeOpen: true, storeCloseReason: "Libur Hari Raya", storeOpenTime: "Besok Jam 09:00 WIB",
    promoText: "TERIMA JUAL EMAS\nHARGA TINGGI\n•Emas rusak\n•Emas patah\n•Emas sisa sebelah\n•Emas tanpa surat\n•Emas luar daerah\n•Emas luar negeri\n•Logam mulia\n•Antam\n•Emas kuning\n•Emas putih",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m13!1m8!1m3!1d990.2752898578937!2d108.7221757!3d-6.8784828!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zNsKwNTInNDAuMyJTIDEwOMKwNDMnMjAuNyJF!5e0!3m2!1sid!2sid!4v1779984211748!5m2!1sid!2sid",
    mapClickUrl: "https://maps.app.goo.gl/rEziEvSWc1Qkd9eu5", qrisUrl: "",
    runningTextCustom: "Selamat datang di Sistem ERP Jual Emas Untung.", runningTextSpeed: 20,
    rekeningToko: [{ bank: "BCA", no: "1234567890", an: "Toko Emas Untung" }, { bank: "DANA", no: "08123456789", an: "Toko Emas Untung" }],
    socials: [{ id: "s1", platform: "whatsapp", label: "WhatsApp", url: "6285295502517" }, { id: "s3", platform: "facebook", label: "Facebook Page", url: "/share/1875fdi2Ki/" }]
};

// ==========================================
// 3. KONFIGURASI FIREBASE & LOGGER
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDAYmqaoks21eMSVBqfcvLuf-3zsN7grZw",
    authDomain: "erp-emas-untung.firebaseapp.com",
    projectId: "erp-emas-untung",
    storageBucket: "erp-emas-untung.firebasestorage.app",
    messagingSenderId: "677945155635",
    appId: "1:677945155635:web:d84ce4a42eec0624d60346"
};

let db = null;
let auth = null;
let isFirebaseActive = false;
let isManualLocalMode = localStorage.getItem('erp_manual_local_mode') === 'true';

const AppLogger = {
    logError: async function(error, context) {
        console.warn(`[AppLogger - ${context}]`, error);
        if (isFirebaseActive && !isManualLocalMode && navigator.onLine) {
            try {
                await db.collection('system_logs').add({
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    error_message: error.message || error.toString(),
                    context: context,
                    user_id: sessionUser ? sessionUser.UID : 'GUEST',
                    user_role: sessionUser ? sessionUser.Role : 'UNKNOWN'
                });
            } catch (err) {
                console.error("Gagal mengirim log ke cloud", err);
            }
        }
    }
};

const DBService = {
    init: async function() {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            auth = firebase.auth();
            
            if (!isManualLocalMode) {
                await db.enablePersistence({ synchronizeTabs: true });
                isFirebaseActive = true;
                this.setupRealtimeListeners();
            } else {
                isFirebaseActive = false;
            }
        } catch (err) {
            AppLogger.logError(err, "DBService.init");
            isFirebaseActive = false;
        }

        window.addEventListener('online', () => this.updateNetworkStatus());
        window.addEventListener('offline', () => this.updateNetworkStatus());
        this.updateNetworkStatus();
    },
    
    setupRealtimeListeners: function() {
        try {
            db.collection('erp_data').doc('appConfig').onSnapshot(doc => {
                if (doc.exists) { 
                    appConfig = doc.data(); 
                    UI.updateStoreStatus(); 
                    UI.updateRunningText(); 

                    const banner = document.getElementById('global-maintenance-banner');
                    if(banner) {
                        banner.style.display = appConfig.isMaintenance ? 'block' : 'none';
                        if(appConfig.isMaintenance) {
                            document.body.prepend(banner); 
                            banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-2 fa-fade"></i> MAAF, SISTEM SEDANG DALAM PERBAIKAN / PEMELIHARAAN. Fitur transaksi dan pendaftaran baru ditutup sementara.';
                            banner.style.zIndex = '999999';
                        }
                    }
                }
            });

            const batasWaktu = new Date();
            batasWaktu.setDate(batasWaktu.getDate() - 60);
            const batasWaktuStr = batasWaktu.toISOString();

            db.collection('appointments').where('Timestamp', '>=', batasWaktuStr).onSnapshot(snapshot => {
                let tempApts = [];
                snapshot.forEach(doc => tempApts.push(doc.data()));
                tempApts.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
                dbAppointments = tempApts;
                if(sessionUser) {
                    if(sessionUser.Role === 'Admin') { UI.renderAdminLaporanView(); UI.renderAdminFinanceView(); }
                    else { UI.renderDashboardView(); }
                }
            }, err => AppLogger.logError(err, "onSnapshot appointments"));

            db.collection('finance').onSnapshot(snapshot => {
                let tempFin = [];
                snapshot.forEach(doc => tempFin.push(doc.data()));
                dbFinance = tempFin;
                if(sessionUser && sessionUser.Role === 'Admin') UI.renderAdminFinanceView();
            }, err => AppLogger.logError(err, "onSnapshot finance"));

            db.collection('users').orderBy('Timestamp', 'desc').limit(50).onSnapshot(snapshot => {
                let tempUsers = [];
                snapshot.forEach(doc => tempUsers.push(doc.data()));
                dbUsers = tempUsers;
            }, err => AppLogger.logError(err, "onSnapshot users"));

            db.collection('gold_settings').onSnapshot(snapshot => {
                let tempGold = [];
                snapshot.forEach(doc => tempGold.push(doc.data()));
                tempGold.sort((a, b) => (a.Urutan !== undefined ? a.Urutan : 9999) - (b.Urutan !== undefined ? b.Urutan : 9999));
                dbGoldSettings = tempGold;
                if(sessionUser && sessionUser.Role === 'Admin') UI.renderGoldSettingsView();
            }, err => AppLogger.logError(err, "onSnapshot gold_settings"));
        } catch(err) {
            AppLogger.logError(err, "DBService.setupRealtimeListeners");
        }
    },

    updateNetworkStatus: function() {
        const indicator = document.getElementById('network-indicator');
        const btnNet = document.getElementById('btn-network-status');
        const warningBanner = document.getElementById('admin-local-warning');
        
        // Bersihkan seluruh warna garis tombol sebelumnya
        if(btnNet) {
            btnNet.classList.remove('border-danger', 'border-success', 'border-warning');
        }

        if (isManualLocalMode) {
            if(indicator) indicator.className = 'fa-solid fa-server net-manual fa-fade';
            if(btnNet) btnNet.classList.add('border-danger');
            if(warningBanner && sessionUser && sessionUser.Role === 'Admin') warningBanner.style.display = 'block';
        } else if (navigator.onLine && isFirebaseActive) {
            // PERBAIKAN: Gunakan awan panah ke atas untuk Online
            if(indicator) indicator.className = 'fa-solid fa-cloud-arrow-up net-online';
            if(btnNet) btnNet.classList.add('border-success');
            if(warningBanner) warningBanner.style.display = 'none';
            this.toastNetwork("Online: Tersinkronisasi dengan Cloud", "success");
        } else {
            // PERBAIKAN: Gunakan awan tersilang untuk Offline agar beda dengan Online
            if(indicator) indicator.className = 'fa-solid fa-cloud-xmark net-offline';
            if(btnNet) btnNet.classList.add('border-warning');
            if(warningBanner) warningBanner.style.display = 'none';
            this.toastNetwork("Offline: Menyimpan ke lokal", "warning");
        }
    },

    toastNetwork: function(msg, icon) {
        if(!window.lastNetState || window.lastNetState !== icon) {
            Swal.mixin({toast:true, position:'bottom-end', showConfirmButton:false, timer:3000}).fire({icon:icon, title:msg});
            window.lastNetState = icon;
        }
    }
};

// ==========================================
// 4. HELPER / FUNGSI UTILITAS GLOBAL
// ==========================================
function generateID(prefix) { return prefix + "-" + Date.now().toString().slice(-5) + Math.floor(Math.random()*100); }
function viewImage(b64) { Swal.fire({ title: 'Lampiran Foto', imageUrl: b64, imageWidth: 300, padding: '1em' }); }

function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
        reader.onerror = error => {
            AppLogger.logError(error, "compressImage");
            reject(error);
        };
    });
}

function getNotaStyle(){ return `<style>@page{margin:0;size:58mm auto}body{width:48mm;margin:0 auto;padding:2mm 0;font-family:'Courier New',monospace;font-size:11px;color:#000;line-height:1.2}.text-center{text-align:center}.dashed-line{border-top:1px dashed #000;margin:5px 0}table{width:100%;font-size:11px;border-collapse:collapse}td{padding:1px 0}</style>`; }
function getNotaHeader(ts){ return `<div class="text-center" style="${ts} margin-bottom: 2px;">${appConfig.notaName}</div><div class="text-center">${appConfig.notaAddress}</div><div class="text-center">WA: ${appConfig.notaPhone}</div><div class="dashed-line"></div>`; }
function getNotaFooter(){ return `<div class="dashed-line"></div><div class="text-center" style="margin-top:5px;">Terima Kasih</div><div class="text-center" style="font-size:9px;">Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</div><script>window.print();setTimeout(function(){window.close();},1000);<\/script>`; }