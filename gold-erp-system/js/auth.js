const Auth = {
    init: async function() { 
        await DBService.init();
        await AppStorage.load();
        
        // Cek cache session untuk offline mode
        const cachedUser = localStorage.getItem('erp_sessionUser');
        if(cachedUser) {
            sessionUser = JSON.parse(cachedUser);
        }

        // Listener status Auth Firebase
        if(isFirebaseActive) {
            auth.onAuthStateChanged(user => {
                if(user) {
                    const target = dbUsers.find(u => u.UID === user.uid);
                    if(target) {
                        sessionUser = target;
                        localStorage.setItem('erp_sessionUser', JSON.stringify(sessionUser));
                    }
                } else if (!isManualLocalMode && navigator.onLine) {
                    sessionUser = null;
                    localStorage.removeItem('erp_sessionUser');
                }
            });
        }
        
        if(!appConfig.timeSlots) appConfig.timeSlots = ["09:00 - 10:30 WIB", "10:30 - 12:00 WIB", "13:00 - 14:30 WIB"];
        
        // PERBAIKAN: Pastikan default array sosial media tersedia di sistem
        if(!appConfig.socials) appConfig.socials = [];
        
        document.getElementById('preloader').style.display = 'none'; 
        UI.renderTemplates(); 
        document.getElementById('splash-store-name').innerText = appConfig.notaName; 
        document.getElementById('splash-tagline').innerText = appConfig.storeTagline;
        UI.updateContactLinks(); 
        UI.updateLandingPage(); 
        UI.updateStoreStatus(); 
        UI.updateRunningText();
        document.getElementById('year-copy').innerText = new Date().getFullYear();
        
        document.getElementById('login-banner').classList.add('settled'); 
        document.getElementById('landing-content').style.display = 'block'; 
        document.getElementById('btn-hamburger').style.display = 'block';
        
        setTimeout(()=> { 
            document.getElementById('landing-content').style.opacity = '1'; 
            document.getElementById('landing-content').style.pointerEvents = 'auto'; 
            const icons = document.getElementById('banner-icons-el'); 
            const text = document.getElementById('banner-text-el'); 
            if(icons) icons.style.opacity = '1'; 
            if(text) text.style.opacity = '1'; 
            
            if(sessionUser) {
                UI.launchMainApp();
            }
        }, 50);
    },
    fastLogin: async function(roleType) { 
        UI.showLoading(true, "Membuat Sesi Sandbox Uji Coba..."); 
        try {
            // 1. PAKSA MASUK MODE LOKAL (Bypass Cloud)
            // Ini tameng utama agar database Firebase Anda tidak terkotori oleh user demo
            isManualLocalMode = true;
            localStorage.setItem('erp_manual_local_mode', 'true');
            if (typeof DBService !== 'undefined' && DBService.updateNetworkStatus) {
                DBService.updateNetworkStatus();
            }

            // 2. GENERATE ID UNIK ACAK
            // Agar setiap orang baru yang mencoba mendapatkan akun & dashboard yang fresh/kosong
            const randID = Math.floor(1000 + Math.random() * 9000); // Angka 4 digit acak
            const uniqueUsername = (roleType === 'agen' ? 'demo_agen_' : 'demo_pelanggan_') + randID;
            
            // 3. ISOLASI & BERSIHKAN SAMPAH DEMO LAMA
            // Menghapus data uji coba dari orang sebelumnya khusus di browser ini agar tidak menumpuk
            dbAppointments = dbAppointments.filter(a => !a.Username.startsWith('demo_'));
            dbFinance = dbFinance.filter(f => !f.Keterangan.includes('TRX: TRX-demo_') && !f.Keterangan.includes('TRX: demo_'));
            dbUsers = dbUsers.filter(u => !u.Username.startsWith('demo_'));
            
            // 4. DAFTARKAN USER GUEST BARU KE MEMORI LOKAL
            const newDemoUser = {
                UID: "DEMO_" + Date.now() + "_" + randID, 
                Username: uniqueUsername, 
                Password: "123", 
                Nama_Lengkap: (roleType === 'agen' ? 'Mitra Agen (Uji Coba)' : 'Pelanggan Baru (Uji Coba)'), 
                No_HP: "08123456789", 
                Role: roleType === 'agen' ? 'Agen' : 'Pelanggan', 
                Status: "AKTIF",
                Timestamp: new Date().toISOString()
            };
            dbUsers.push(newDemoUser);
            
            // 5. RESET KERANJANG BELANJA
            // Memastikan keranjang belanja dari penguji sebelumnya tidak terbawa
            currentCart = [];
            
            // 6. SIMPAN PARAMETER BERSIH KE STORAGE PERANGKAT
            localStorage.setItem('erp_dbUsers', JSON.stringify(dbUsers));
            localStorage.setItem('erp_dbAppointments', JSON.stringify(dbAppointments));
            localStorage.setItem('erp_dbFinance', JSON.stringify(dbFinance));

            // 7. AKTIFKAN SESSION LOGIN
            sessionUser = newDemoUser;
            localStorage.setItem('erp_sessionUser', JSON.stringify(sessionUser));

            setTimeout(() => { 
                UI.showLoading(false); 
                UI.toast("Sesi Demo Dimulai!", "success"); 
                UI.launchMainApp(); 
            }, 600); 
        } catch (err) {
            UI.showLoading(false);
            AppLogger.logError(err, "Auth.fastLogin");
            UI.toast("Gagal memuat sesi demo", "error");
        }
    },
    handleLogin: async function(e) { 
        e.preventDefault(); 
        UI.showLoading(true, "Otentikasi Keamanan..."); 
        const userIn = document.getElementById('login-username').value; 
        const passIn = document.getElementById('login-password').value; 
        const email = userIn + "@erp.local";

        try {
            if(isFirebaseActive && navigator.onLine && !isManualLocalMode) {
                // 100% Mengandalkan verifikasi Token Server Google
                const userCredential = await auth.signInWithEmailAndPassword(email, passIn);
                
                // Tarik data profil spesifik langsung dari Cloud
                const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
                if(!userDoc.exists) throw new Error("Profil akun tidak ditemukan.");
                
                const target = userDoc.data();
                if(target.Status !== "AKTIF") {
                    await auth.signOut();
                    throw new Error("Akun Anda dibekukan oleh Admin!");
                }
                sessionUser = target;
                localStorage.setItem('erp_sessionUser', JSON.stringify(sessionUser));
            } else {
                throw new Error("Login gagal: Sistem mewajibkan koneksi online untuk verifikasi keamanan (Anti-Hack)."); 
            }

            setTimeout(() => { 
                UI.showLoading(false); 
                UI.toast("Selamat Datang, " + sessionUser.Nama_Lengkap, "success"); 
                UI.launchMainApp(); 
            }, 500); 
        } catch (err) {
            UI.showLoading(false); AppLogger.logError(err, "Auth.handleLogin");
            UI.toast(err.message || "Gagal Login. Periksa Username/Password.", "error");
        }
    },
    handleRegister: async function(e) { 
        e.preventDefault(); 
        if(appConfig.isMaintenance) return Swal.fire("Sedang Perbaikan", "Maaf, sistem sedang dalam pemeliharaan. Pendaftaran akun baru ditutup sementara waktu.", "warning");
        
        UI.showLoading(true, "Mendaftarkan Akun..."); 
        const user = document.getElementById('reg-username').value; 
        const pass = document.getElementById('reg-password').value;
        const email = user + "@erp.local";
        
        try {
            let uid = "U"+Date.now();
            if(isFirebaseActive && navigator.onLine && !isManualLocalMode) {
                const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
                uid = userCredential.user.uid;
            } else {
                throw new Error("Pendaftaran wajib menggunakan koneksi internet/Cloud.");
            }

            // PERHATIAN: Field 'Password' DIHAPUS dari sini demi keamanan tingkat tinggi
            const newUserProfile = { 
                UID: uid, Username: user, Nama_Lengkap: document.getElementById('reg-nama').value, 
                No_HP: document.getElementById('reg-hp').value, Role: "Pelanggan", Status: "AKTIF", Timestamp: new Date().toISOString() 
            };
            await db.collection('users').doc(uid).set(newUserProfile);

            if(isFirebaseActive && navigator.onLine && !isManualLocalMode) {
                await auth.signOut(); // Paksa user login ulang untuk set sesi token
            }

            UI.showLoading(false);
            Swal.fire("Sukses", "Akun Terdaftar dengan Aman! Silakan Login manual.", "success"); 
            UI.switchAuth(false); 
        } catch (err) {
            UI.showLoading(false); AppLogger.logError(err, "Auth.handleRegister");
            Swal.fire("Gagal Daftar", err.message, "error");
        }
    },
    handleLogout: async function() { 
        try {
            if(isFirebaseActive && navigator.onLine) {
                await auth.signOut();
            }
        } catch (err) {
            AppLogger.logError(err, "Auth.handleLogout");
        }

        // --- PERBAIKAN: DETEKSI APAKAH YANG KELUAR ADALAH AKUN DEMO ---
        let wasDemoUser = sessionUser && sessionUser.Username && sessionUser.Username.startsWith('demo_');

        // Hapus banner demo secara paksa saat user keluar sistem
        const existingBanner = document.getElementById('demo-floating-banner');
        if (existingBanner) existingBanner.remove();

        sessionUser = null; currentCart = []; editAptId = null; 
        localStorage.removeItem('erp_sessionUser');

        // --- PERBAIKAN: RESET KONEKSI JIKA DARI DEMO ---
        if (wasDemoUser) {
            // BARIS BARU: Cek apakah Admin sebelumnya sudah mengunci ke mode lokal secara manual
            let isAdminForced = localStorage.getItem('erp_admin_forced_local') === 'true';

            // 1. Logika Baru: Hanya matikan mode lokal jika BUKAN Admin yang mengaturnya
            if (!isAdminForced) {
                isManualLocalMode = false;
                localStorage.setItem('erp_manual_local_mode', 'false');
            }
            
            // 2. Bersihkan total sampah data demo di memori browser
            localStorage.removeItem('erp_dbUsers');
            localStorage.removeItem('erp_dbAppointments');
            localStorage.removeItem('erp_dbFinance');

            // 3. Paksa halaman dimuat ulang (Refresh) agar Firebase otomatis menyambung
            window.location.reload();
            return; // Hentikan eksekusi kode di bawah agar refresh berjalan mulus
        }

        // --- KODE RESET UI UNTUK USER REGULER (Tidak di-refresh) ---
        document.getElementById('app-content').style.display = 'none'; 
        document.getElementById('auth-wrapper').style.display = 'flex'; 
        document.getElementById('btn-hamburger').style.display = 'block'; 
        document.getElementById('login-banner').classList.add('settled'); 
        document.getElementById('landing-content').style.display = 'block'; 
        document.getElementById('landing-content').style.opacity = '1'; 
        document.getElementById('landing-content').style.pointerEvents = 'auto'; 
        document.getElementById('login-form-wrapper').style.display = 'none'; 
        const icons = document.getElementById('banner-icons-el'); 
        const text = document.getElementById('banner-text-el'); 
        if(icons) icons.style.opacity = '1'; 
        if(text) text.style.opacity = '1'; 
        UI.updateStoreStatus(); UI.toast("Berhasil Keluar", "info"); 
    }
};