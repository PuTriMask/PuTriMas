const API = {
    // --- FUNGSI PAGINASI & FILTER RIWAYAT PELANGGAN ---
    filterUserHist: function() {
        userHistPaging.startDate = document.getElementById('hist-start-date').value;
        userHistPaging.endDate = document.getElementById('hist-end-date').value;
        userHistPaging.page = 1; 
        UI.renderDashboardView();
    },
    resetUserHistFilter: function() {
        document.getElementById('hist-start-date').value = '';
        document.getElementById('hist-end-date').value = '';
        userHistPaging.startDate = '';
        userHistPaging.endDate = '';
        userHistPaging.page = 1;
        UI.renderDashboardView();
    },
    changeUserHistPage: function(direction) {
        if (direction === 'PREV') userHistPaging.page--;
        else if (direction === 'NEXT') userHistPaging.page++;
        UI.renderDashboardView();
    },

    // --- TAMBAHAN BARU: LOGIKA FILTER & PAGINASI JURNAL KEUANGAN ADMIN ---
    filterAdminFinanceLog: function() {
        adminFinancePaging.startDate = document.getElementById('fin-start-date').value;
        adminFinancePaging.endDate = document.getElementById('fin-end-date').value;
        adminFinancePaging.type = document.getElementById('fin-filter-type').value;
        adminFinancePaging.category = document.getElementById('fin-filter-category').value;
        adminFinancePaging.kadar = document.getElementById('fin-filter-kadar').value;
        adminFinancePaging.page = 1;
        UI.renderAdminFinanceView();
    },
    resetAdminFinanceLogFilter: function() {
        document.getElementById('fin-start-date').value = '';
        document.getElementById('fin-end-date').value = '';
        document.getElementById('fin-filter-type').value = 'ALL';
        document.getElementById('fin-filter-category').value = 'ALL';
        document.getElementById('fin-filter-kadar').value = 'ALL';
        adminFinancePaging = { page: 1, limit: 10, startDate: '', endDate: '', type: 'ALL', category: 'ALL', kadar: 'ALL' };
        UI.renderAdminFinanceView();
    },
    changeAdminFinancePage: function(direction) {
        if (direction === 'PREV') adminFinancePaging.page--;
        else if (direction === 'NEXT') adminFinancePaging.page++;
        UI.renderAdminFinanceView();
    },

    // --- FUNGSI PAGINASI & FILTER PARAMETER EMAS ---
    filterGoldSettings: function() {
        goldPaging.search = document.getElementById('gold-search').value.toLowerCase();
        goldPaging.sortBy = document.getElementById('gold-sort').value;
        goldPaging.page = 1; // Reset ke halaman 1 saat mencari
        UI.renderGoldSettingsView();
    },
    changeGoldPage: function(direction) {
        if (direction === 'PREV') goldPaging.page--;
        else if (direction === 'NEXT') goldPaging.page++;
        UI.renderGoldSettingsView();
    },

    // --- KUMPULAN FUNGSI PAGINASI & MEMORI CEKLIS ---
    changeAptPage: function(direction) {
        if (direction === 'PREV') aptPaging.page--;
        else if (direction === 'NEXT') aptPaging.page++;
        UI.renderAdminLaporanView(); 
    },

    toggleAptCheck: function(uid, isChecked) {
        if (isChecked) {
            if (!selectedTransaksi.includes(uid)) selectedTransaksi.push(uid);
        } else {
            selectedTransaksi = selectedTransaksi.filter(id => id !== uid);
        }
    },
    
    clearAptCheck: function() {
    selectedTransaksi = []; // Kosongkan keranjang memori
    
    // KODE PERBAIKAN: Cek apakah user adalah Admin atau Pelanggan
    if (sessionUser && sessionUser.Role === 'Admin') {
        UI.renderAdminLaporanView();
    } else {
        UI.renderDashboardView();
    }
    
    UI.toast("Pilihan berhasil dibersihkan", "info");
},

    toggleLocalMode: async function(isChecked) {
        isManualLocalMode = isChecked;
        localStorage.setItem('erp_admin_forced_local', isChecked);
        
        await AppStorage.save();
        DBService.updateNetworkStatus();
        if(!isChecked) {
            UI.toast("Sinkronisasi Cloud Diaktifkan. Memuat ulang...", "info");
            setTimeout(() => location.reload(), 1500);
        } else {
            UI.toast("Mode Lokal Aktif. Data tidak dikirim ke Cloud.", "warning");
        }
    },

    // --- FUNGSI PAGINASI AKUN ---
    debounceSearchUsers: function() {
        clearTimeout(userSearchTimeout);
        userSearchTimeout = setTimeout(() => { this.fetchUsersPaging('FIRST'); }, 600); 
    },

    fetchUsersPaging: async function(direction = 'FIRST') {
        try {
            if (!isFirebaseActive || isManualLocalMode) return UI.toast("Pencarian butuh koneksi Online", "warning");

            UI.showLoading(true, "Mengambil Data...");
            const searchVal = document.getElementById('user-search-input').value.trim();
            const roleFilter = document.getElementById('user-filter-role').value;

            let query = db.collection('users').orderBy('Username');

            if (roleFilter !== 'ALL') query = query.where('Role', '==', roleFilter);
            if (searchVal) {
                query = query.where('Username', '>=', searchVal).where('Username', '<=', searchVal + '\uf8ff');
            }

            if (direction === 'FIRST') {
                userPaging.page = 1; query = query.limit(userPaging.limit);
            } else if (direction === 'NEXT' && userPaging.lastDoc) {
                userPaging.page++; query = query.startAfter(userPaging.lastDoc).limit(userPaging.limit);
            } else if (direction === 'PREV' && userPaging.firstDoc) {
                userPaging.page = Math.max(1, userPaging.page - 1); query = query.endBefore(userPaging.firstDoc).limitToLast(userPaging.limit);
            }

            const snapshot = await query.get();
            UI.showLoading(false);

            const tb = document.getElementById('table-admin-users-list'); tb.innerHTML = '';
            if (snapshot.empty) {
                tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Data akun tidak ditemukan.</td></tr>';
                document.getElementById('btn-user-next').disabled = true; return;
            }

            userPaging.firstDoc = snapshot.docs[0]; userPaging.lastDoc = snapshot.docs[snapshot.docs.length - 1];

            snapshot.forEach(doc => {
                const u = doc.data();
                const aptCount = dbAppointments.filter(a => a.Username === u.Username).length;
                const bStatus = u.Status === 'AKTIF' ? 'bg-success' : 'bg-danger';
                const bRole = u.Role === 'Admin' ? 'badge-admin' : (u.Role === 'Agen' ? 'badge-agen' : 'badge-pelanggan');

                let btnDelete = u.Role === 'Admin' ? `<button class="btn btn-outline-secondary" disabled><i class="fa-solid fa-lock"></i></button>` : `<button class="btn btn-outline-danger" onclick="API.deleteUser('${u.UID}')"><i class="fa-solid fa-trash"></i></button>`;

                tb.innerHTML += `<tr><td><b>${u.Username}</b></td><td>${u.Nama_Lengkap}</td><td>${u.No_HP}</td><td><span class="badge ${bRole}">${u.Role}</span></td><td><span class="badge ${bStatus}" onclick="API.toggleUserStatus('${u.UID}')" style="cursor:pointer;">${u.Status}</span></td><td><div class="btn-group btn-group-sm"><button class="btn btn-outline-info" onclick="API.showUserModal('${u.UID}')"><i class="fa-solid fa-pen"></i></button><button class="btn btn-outline-success" onclick="UI.viewUserReport('${u.Username}')"><i class="fa-solid fa-chart-pie"></i> ${aptCount}</button>${btnDelete}</div></td></tr>`;
            });

            document.getElementById('user-page-info').innerText = `Hal ${userPaging.page}`;
            document.getElementById('btn-user-prev').disabled = (userPaging.page === 1);
            document.getElementById('btn-user-next').disabled = (snapshot.docs.length < userPaging.limit);
        } catch (err) { UI.showLoading(false); AppLogger.logError(err, "Paging Error"); }
    },

    // --- LOGIKA PAGINASI TESTIMONI CLOUD ---
    fetchTestimoniPaging: async function(direction = 'FIRST') {
        try {
            if (!isFirebaseActive || isManualLocalMode) return UI.toast("Paging butuh koneksi Online", "warning");
            UI.showLoading(true, "Mengambil Testimoni Cloud...");

            let query = db.collection('testimonials').orderBy('Timestamp', 'desc');

            if (direction === 'FIRST') {
                testiPaging.page = 1; 
                query = query.limit(testiPaging.limit);
            } else if (direction === 'NEXT' && testiPaging.lastDoc) {
                testiPaging.page++; 
                query = query.startAfter(testiPaging.lastDoc).limit(testiPaging.limit);
            } else if (direction === 'PREV' && testiPaging.firstDoc) {
                testiPaging.page = Math.max(1, testiPaging.page - 1); 
                query = query.endBefore(testiPaging.firstDoc).limitToLast(testiPaging.limit);
            }

            const snapshot = await query.get();
            UI.showLoading(false);

            const tb = document.getElementById('table-admin-testimoni-paging'); 
            if(!tb) return;
            tb.innerHTML = '';

            if (snapshot.empty) {
                tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Tidak ada ulasan ditemukan di Cloud.</td></tr>';
                document.getElementById('btn-testi-next').disabled = true; 
                return;
            }

            testiPaging.firstDoc = snapshot.docs[0]; 
            testiPaging.lastDoc = snapshot.docs[snapshot.docs.length - 1];

            snapshot.forEach(doc => {
                const t = doc.data();
                let stars = '';
                for(let i=0; i<t.Star; i++) stars += '<i class="fa-solid fa-star text-warning" style="font-size:0.75rem;"></i>';

                let badgeStatus = t.Status === 'TAMPIL' 
                    ? '<span class="badge bg-success"><i class="fa-solid fa-eye"></i> Tampil</span>' 
                    : '<span class="badge bg-secondary"><i class="fa-solid fa-eye-slash"></i> Sembunyi</span>';

                tb.innerHTML += `<tr>
                    <td><input type="checkbox" class="form-check-input testi-paging-check" value="${doc.id}"></td>
                    <td><b>${t.Username || 'Anonim'}</b><br><small class="text-muted">${t.Timestamp ? t.Timestamp.substring(0,10) : ''}</small></td>
                    <td><div class="small text-wrap" style="max-width:250px;">"${t.Text || ''}"</div><div class="mt-1">${stars}</div></td>
                    <td>${badgeStatus}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-warning" onclick="API.toggleTestimoniPagingStatus('${doc.id}')" title="Ubah Visibilitas">
                                <i class="fa-solid ${t.Status==='TAMPIL'?'fa-box-archive':'fa-eye'}"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="API.deleteTestimoniPaging('${doc.id}')" title="Hapus Permanen">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            });

            document.getElementById('testi-page-info').innerText = `Hal ${testiPaging.page}`;
            document.getElementById('btn-testi-prev').disabled = (testiPaging.page === 1);
            document.getElementById('btn-testi-next').disabled = (snapshot.docs.length < testiPaging.limit);
        } catch (err) { 
            UI.showLoading(false); 
            AppLogger.logError(err, "Testimoni Paging Error"); 
        }
    },

    toggleTestimoniPagingStatus: async function(uid) {
        try {
            if (!isFirebaseActive || isManualLocalMode) return UI.toast("Butuh koneksi Online", "warning");
            UI.showLoading(true, "Memproses Perubahan...");

            const docRef = db.collection('testimonials').doc(uid);
            const doc = await docRef.get();
            if(doc.exists) {
                let currentStatus = doc.data().Status;
                let nextStatus = currentStatus === 'TAMPIL' ? 'SEMBUNYI' : 'TAMPIL';
                await docRef.update({ Status: nextStatus });
                UI.showLoading(false);
                UI.toast("Status Berhasil Diperbarui", "success");
                this.fetchTestimoniPaging('FIRST'); 
                UI.updateLandingPage();
            }
        } catch(err) { UI.showLoading(false); AppLogger.logError(err, "toggleTestimoniPagingStatus"); }
    },

    deleteTestimoniPaging: function(uid) {
        Swal.fire({
            title: 'Hapus Ulasan?',
            text: 'Data ulasan ini akan dihapus permanen dari Server Cloud.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Hapus!'
        }).then(async (r) => {
            if (r.isConfirmed) {
                try {
                    UI.showLoading(true, "Menghapus dari Server...");
                    if (isFirebaseActive && !isManualLocalMode) {
                        await db.collection('testimonials').doc(uid).delete();
                    }
                    
                    // ===== TANDA PERBAIKAN =====
                    dbTestimonials = dbTestimonials.filter(t => t.UID !== uid && t.id !== uid);
                    await AppStorage.save();
                    // ===========================

                    UI.showLoading(false);
                    UI.toast("Ulasan Berhasil Dihapus", "success");
                    this.fetchTestimoniPaging('FIRST'); 
                    UI.updateLandingPage();
                } catch(err) { UI.showLoading(false); AppLogger.logError(err, "deleteTestimoniPaging"); }
            }
        });
    },

    deleteTestimoniPagingMassal: function() {
        const checkedBoxes = document.querySelectorAll('#setTestiCol input.testi-paging-check:checked');
        if (checkedBoxes.length === 0) return UI.toast("Pilih ulasan yang ingin dihapus!", "warning");

        Swal.fire({
            title: `Hapus ${checkedBoxes.length} Ulasan Terpilih?`,
            text: "Seluruh ulasan yang dicentang akan dihapus selamanya dari Cloud.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Hapus Semua!'
        }).then(async (r) => {
            if (r.isConfirmed) {
                try {
                    UI.showLoading(true, "Menghapus Massal di Server Cloud..."); 
                    const uidsToDelete = Array.from(checkedBoxes).map(cb => cb.value);

                    if (isFirebaseActive && !isManualLocalMode) {
                        const batch = db.batch();
                        uidsToDelete.forEach(uid => {
                            batch.delete(db.collection('testimonials').doc(uid));
                        });
                        await batch.commit();
                    }
                    dbTestimonials = dbTestimonials.filter(t => !uidsToDelete.includes(t.UID) && !uidsToDelete.includes(t.id));
                    await AppStorage.save();
                    UI.showLoading(false);
                    UI.toast("Ulasan Terpilih Berhasil Dihapus", "success");
                    this.fetchTestimoniPaging('FIRST'); 
                    UI.updateLandingPage();
                } catch (err) {
                    UI.showLoading(false);
                    AppLogger.logError(err, "deleteTestimoniPagingMassal");
                }
            }
        });
    },

    saveAppConfig: async function(isToggleOnly = false) {
        try {
            appConfig.storeOpen = document.getElementById('cfg-store-status').checked;
            appConfig.isMaintenance = document.getElementById('cfg-local-mode').checked;
            if(!isToggleOnly) {
                appConfig.showGraph = document.getElementById('cfg-show-graph').checked; 
                appConfig.allowBuy = document.getElementById('cfg-allow-buy').checked; 
                appConfig.limitTrxEmas = parseInt(document.getElementById('cfg-limit-emas').value) || 5; 
                appConfig.limitTrxJasa = parseInt(document.getElementById('cfg-limit-jasa').value) || 5; 
                appConfig.notaName = document.getElementById('cfg-nota-name').value || "TOKO EMAS"; 
                appConfig.notaAddress = document.getElementById('cfg-nota-address').value; 
                appConfig.notaPhone = document.getElementById('cfg-nota-phone').value; 
                appConfig.notaStyle = document.getElementById('cfg-nota-style').value; 
                appConfig.storeTagline = document.getElementById('cfg-tagline').value; 
                appConfig.promoText = document.getElementById('cfg-promo-text').value; 
                appConfig.mapEmbedUrl = document.getElementById('cfg-map-url').value; 
                appConfig.mapClickUrl = document.getElementById('cfg-map-click-url').value; 
                appConfig.storeCloseReason = document.getElementById('cfg-store-reason').value; 
                appConfig.storeOpenTime = document.getElementById('cfg-store-open-time').value; 
                appConfig.qrisUrl = document.getElementById('cfg-qris-url').value;
                appConfig.runningTextCustom = document.getElementById('cfg-running-text').value || "";
                appConfig.runningTextSpeed = parseInt(document.getElementById('cfg-running-speed').value) || 20;
                
                const socRows = document.querySelectorAll('.social-item-row'); 
                appConfig.socials = [];
                socRows.forEach((r, idx) => { appConfig.socials.push({ id: "s" + Date.now() + idx, platform: r.querySelector('.soc-plat').value, label: r.querySelector('.soc-label').value || "Tautan", url: r.querySelector('.soc-url').value }); });
            }
            // Proteksi agar sistem tidak error jika elemen tidak ditemukan di layar admin
            if(document.getElementById('splash-store-name')) document.getElementById('splash-store-name').innerText = appConfig.notaName;
            if(document.getElementById('splash-tagline')) document.getElementById('splash-tagline').innerText = appConfig.storeTagline;
            
            await AppStorage.save();
            
            // PRIORITAS UTAMA: Tampilkan Banner Pemeliharaan secara instan
            UI.updateStoreStatus(); 
            UI.updateRunningText(); 
            
            // Bungkus pembaruan halaman lain ke dalam isolasi try-catch
            try { UI.updateContactLinks(); } catch(e){} 
            try { UI.updateLandingPage(); } catch(e){} 
            
            UI.toast("Pengaturan berhasil disimpan", "success");
        } catch (err) {
            AppLogger.logError(err, "API.saveAppConfig");
        }
    },

    clearSystemCache: async function() {
        const conf = await Swal.fire({ title: 'Bersihkan Cache Sistem?', text: 'Ini akan menghapus cache memori sementara aplikasi untuk meringankan sistem. Data penting Anda tidak akan hilang.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Bersihkan!' });
        if(conf.isConfirmed) {
            try {
                if('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
                localStorage.clear(); sessionStorage.clear();
                Swal.fire('Berhasil', 'Cache berhasil dibersihkan! Aplikasi akan dimuat ulang.', 'success').then(() => { window.location.reload(true); });
            } catch (err) {
                AppLogger.logError(err, "API.clearSystemCache");
            }
        }
    },

    addTimeSlot: async function() { 
        try {
            const val = document.getElementById('cfg-new-timeslot').value.trim(); if(!val) return; if(!appConfig.timeSlots) appConfig.timeSlots = []; 
            if(appConfig.timeSlots.includes(val)) return UI.toast("Sesi waktu sudah ada", "error"); 
            appConfig.timeSlots.push(val); document.getElementById('cfg-new-timeslot').value = ''; UI.renderTimeSlotsSetting(); UI.toast("Sesi ditambahkan"); await API.saveAppConfig(true); 
        } catch (err) { AppLogger.logError(err, "API.addTimeSlot"); }
    },

    removeTimeSlot: async function(idx) { appConfig.timeSlots.splice(idx, 1); UI.renderTimeSlotsSetting(); await API.saveAppConfig(true); },

    addRekeningToko: async function() { 
        try {
            let bank = document.getElementById('cfg-bank-name').value; let no = document.getElementById('cfg-bank-acc').value; let an = document.getElementById('cfg-bank-an').value; 
            if(!bank || !no) return UI.toast("Isi Bank dan No Rekening!", "error"); 
            appConfig.rekeningToko.push({ bank, no, an }); document.getElementById('cfg-bank-name').value = ''; document.getElementById('cfg-bank-acc').value = ''; document.getElementById('cfg-bank-an').value = ''; 
            await AppStorage.save();
            UI.renderAdminSettingsView(); UI.toast("Rekening ditambahkan"); 
        } catch (err) { AppLogger.logError(err, "API.addRekeningToko"); }
    },

    removeRekeningToko: async function(idx) { appConfig.rekeningToko.splice(idx, 1); await AppStorage.save(); UI.renderAdminSettingsView(); },

    submitServiceSetting: async function(e) { 
        e.preventDefault(); 
        try {
            const n = document.getElementById('svc-nama').value; const h = parseInt(document.getElementById('svc-harga').value); 
            if(!n || isNaN(h)) return; dbServices.push({ UID: "S"+Date.now(), Nama: n, Harga: h }); await AppStorage.save(); UI.toast("Jasa Ditambahkan", "success"); e.target.reset(); UI.renderServicesSettingsView(); 
        } catch (err) { AppLogger.logError(err, "API.submitServiceSetting"); }
    },

    deleteService: async function(uid) { 
        try {
            UI.showLoading(true, "Menghapus...");
            if (isFirebaseActive && !isManualLocalMode) {
                await db.collection('services').doc(uid).delete();
            }
            dbServices = dbServices.filter(s => s.UID !== uid); 
            await AppStorage.save(); 
            UI.showLoading(false);
            UI.toast("Jasa Dihapus Permanen", "success"); 
            UI.renderServicesSettingsView(); 
        } catch (err) {
            UI.showLoading(false); AppLogger.logError(err, "API.deleteService"); UI.toast("Gagal hapus", "error");
        }
    },

    addSocial: async function() { appConfig.socials.push({ id: "s"+Date.now(), platform: "other", label: "Media Baru", url: "" }); await AppStorage.save(); UI.renderSocialSettings(); },
    
    removeSocial: async function(idx) { appConfig.socials.splice(idx, 1); await AppStorage.save(); UI.renderSocialSettings(); },
    
    toggleTestimoni: async function(uid) { try { const t = dbTestimonials.find(x => x.UID === uid); if(t) { t.Status = t.Status === 'TAMPIL' ? 'SEMBUNYI' : 'TAMPIL'; await AppStorage.save(); UI.renderTestimoniSettings(); UI.updateLandingPage(); UI.toast("Status testimoni berhasil diubah", "success"); } } catch (err) { AppLogger.logError(err, "API.toggleTestimoni"); } },
    
    deleteTestimoni: function(uid) {
        Swal.fire({
            title: 'Hapus Testimoni?',
            text: 'Ulasan ini akan dihapus secara permanen dari sistem.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Hapus!'
        }).then(async (r) => {
            if (r.isConfirmed) {
                try {
                    UI.showLoading(true, "Menghapus ulasan..."); 
                    
                    if (isFirebaseActive && !isManualLocalMode) {
                        await db.collection('testimonials').doc(uid).delete();
                    }

                    dbTestimonials = dbTestimonials.filter(t => t.UID !== uid);
                    await AppStorage.save();
                    
                    UI.renderTestimoniSettings();
                    UI.updateLandingPage();
                    
                    UI.toast("Testimoni berhasil dihapus", "success");
                } catch (err) {
                    AppLogger.logError(err, "API.deleteTestimoni");
                    UI.toast("Gagal menghapus testimoni", "error");
                }
            }
        });
    },

    deleteTestimoniMassal: function() {
        const checkedBoxes = document.querySelectorAll('#setTestiCol input[type="checkbox"]:checked');
        if (checkedBoxes.length === 0) {
            return UI.toast("Pilih minimal satu testimoni untuk dihapus!", "warning");
        }

        Swal.fire({
            title: `Hapus ${checkedBoxes.length} Testimoni?`,
            text: "Semua ulasan yang Anda centang akan dihapus permanen.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Hapus Semua!'
        }).then(async (r) => {
            if (r.isConfirmed) {
                try {
                    UI.showLoading(true, "Menghapus massal..."); 

                    const uidsToDelete = Array.from(checkedBoxes).map(cb => cb.value);
                    
                    if (isFirebaseActive && !isManualLocalMode) {
                        const batch = db.batch();
                        uidsToDelete.forEach(uid => {
                            batch.delete(db.collection('testimonials').doc(uid));
                        });
                        await batch.commit();
                    }
                    
                    dbTestimonials = dbTestimonials.filter(t => !uidsToDelete.includes(t.UID));
                    await AppStorage.save();
                    
                    UI.renderTestimoniSettings();
                    UI.updateLandingPage();
                    
                    UI.toast("Testimoni terpilih berhasil dihapus", "success");
                } catch (err) {
                    AppLogger.logError(err, "API.deleteTestimoniMassal");
                    UI.toast("Gagal menghapus testimoni massal", "error");
                }
            }
        });
    },

    printNota: function(uid) { 
        try {
            const apt = dbAppointments.find(a => a.UID === uid); if(!apt) return; 
            let ts = appConfig.notaStyle === 'SANGAT_BESAR' ? "font-size: 22px; font-weight: 900;" : (appConfig.notaStyle === 'BESAR' ? "font-size: 18px; font-weight: bold;" : "font-size: 14px; font-weight: bold;"); 
            let brHtml = ''; 
            apt.Items.forEach(i => { brHtml += `<tr><td colspan="2">${i.Type==='JASA'?i.Nama:i.Kategori+' '+i.Kadar+' '+i.Varian}</td></tr><tr><td>${i.Qty}x${i.Type==='JASA'?'-':i.Gram+'g'}</td><td style="text-align:right;">${UI.formatRp(i.Subtotal)}</td></tr>`; }); 
            
            let fnRow = ''; 
            let customNote = apt.Kustom_Harga ? `<tr><td colspan="2" style="font-size:10px; font-style:italic;">* Total disesuaikan (Deal Harga)</td></tr>` : '';
            
            if(apt.Total_Hak_Konsumen > 0 && apt.Total_Tagihan_Jasa > 0 && apt.MetodePotong === 'LANGSUNG') { 
                brHtml += `<tr><td colspan="2"><div class="dashed-line"></div></td></tr><tr><td><b>Hak Jual Emas</b></td><td style="text-align:right; font-size:11px;">${UI.formatRp(apt.Total_Hak_Konsumen)}</td></tr><tr><td><b>Tagihan Jasa</b></td><td style="text-align:right; font-size:11px;">-${UI.formatRp(apt.Total_Tagihan_Jasa)}</td></tr>`; 
                fnRow = `${customNote}<tr><td><b>SISA ${apt.Net_Total >= 0 ? 'DITERIMA' : 'DIBAYAR'} (Net)</b></td><td style="text-align:right; font-size:12px;"><b>${UI.formatRp(Math.abs(apt.Net_Total))}</b></td></tr>`; 
            } else { 
                fnRow = `${customNote}<tr><td><b>TOTAL ${apt.Net_Total >= 0 ? 'DITERIMA' : 'TAGIHAN'}</b></td><td style="text-align:right; font-size:12px;"><b>${UI.formatRp(Math.abs(apt.Net_Total))}</b></td></tr>`; 
            } 
            const pWin = window.open('', '_blank', 'width=350,height=600'); pWin.document.write(`<html><head><title>Print Struk</title>${getNotaStyle()}</head><body>${getNotaHeader(ts)}<div>Tanggal: ${apt.Tanggal} ${apt.Waktu}</div><div>Trx: ${apt.UID}</div><div>Plg: ${apt.Username}</div><div class="dashed-line"></div><table>${brHtml}</table><div class="dashed-line"></div><table>${fnRow}</table>${getNotaFooter()}</body></html>`); pWin.document.close(); 
        } catch (err) { AppLogger.logError(err, "API.printNota"); }
    },

    printRekapNota: function(uidsArray) { 
        try {
            const apts = dbAppointments.filter(a => uidsArray.includes(a.UID) && a.Status_Janji === 'SELESAI'); if(apts.length === 0) return; 
            let ts = appConfig.notaStyle === 'SANGAT_BESAR' ? "font-size: 22px; font-weight: 900;" : (appConfig.notaStyle === 'BESAR' ? "font-size: 18px; font-weight: bold;" : "font-size: 14px; font-weight: bold;"); 
            let itHtml = ''; let gTotal = 0; let userName = apts[0].Username; 
            apts.forEach(apt => { 
                itHtml += `<tr><td colspan="2" style="border-bottom: 1px dashed #ccc; padding-top: 5px;"><b>Trx: ${apt.UID} (${apt.Tanggal})</b></td></tr>`; 
                apt.Items.forEach(i => { itHtml += `<tr><td colspan="2">${i.Type==='JASA'?i.Nama:i.Kategori+' '+i.Kadar+' '+i.Varian}</td></tr><tr><td>${i.Qty}x${i.Type==='JASA'?'-':i.Gram+'g'}</td><td style="text-align:right;">${UI.formatRp(i.Subtotal)}</td></tr>`; }); 
                
                if(apt.MetodePotong === 'LANGSUNG' && apt.Total_Hak_Konsumen > 0 && apt.Total_Tagihan_Jasa > 0) { 
                    itHtml += `<tr><td><i>Sisa Net Trx ${apt.Kustom_Harga?'(Deal)':''}</i></td><td style="text-align:right;"><i>${apt.Net_Total>=0?'+':'-'}${UI.formatRp(Math.abs(apt.Net_Total))}</i></td></tr>`; 
                } else if(apt.Kustom_Harga) {
                    itHtml += `<tr><td><i>Total Deal</i></td><td style="text-align:right;"><i>${apt.Net_Total>=0?'+':'-'}${UI.formatRp(Math.abs(apt.Net_Total))}</i></td></tr>`;
                }
                gTotal += apt.Net_Total; 
            }); 
            const pWin = window.open('', '_blank', 'width=350,height=600'); pWin.document.write(`<html><head><title>Print Struk Rekap</title>${getNotaStyle()}</head><body>${getNotaHeader(ts)}<div class="text-center"><b>STRUK REKAPITULASI</b></div><div>Plg: ${userName}</div><div class="dashed-line"></div><table>${itHtml}</table><div class="dashed-line"></div><table><tr><td><b>GRAND TOTAL (${gTotal>=0?'HAK ANDA':'TAGIHAN'})</b></td><td style="text-align:right; font-size:12px;"><b>${UI.formatRp(Math.abs(gTotal))}</b></td></tr></table>${getNotaFooter()}</body></html>`); pWin.document.close(); 
        } catch (err) { AppLogger.logError(err, "API.printRekapNota"); }
    },

    shareNotaWA: function(uid) { 
        const apt = dbAppointments.find(a => a.UID === uid); if(!apt) return; const uData = dbUsers.find(x => x.Username === apt.Username); 
        let waNumber = uData ? uData.No_HP.replace(/\D/g,'') : ''; if(waNumber.startsWith('0')) waNumber = '62' + waNumber.substring(1); 
        let txt = `*${appConfig.notaName}*\n${appConfig.notaAddress}\n\nHalo *${apt.Username}*,\nBerikut detail transaksi Anda:\nTanggal: ${apt.Tanggal}\nID Trx: ${apt.UID}\nJenis: ${apt.Jenis_Transaksi}\nMetode: ${apt.MetodePembayaran}\n\n*Rincian Item:*\n`; 
        apt.Items.forEach(i => { txt += `- ${i.Type==='JASA'?i.Nama:i.Kategori+' '+i.Kadar+' '+i.Varian} (${i.Qty}x): ${UI.formatRp(i.Subtotal)}\n`; }); txt += `\n*Rincian Pembayaran:*\n`; 
        
        let customNoteText = apt.Kustom_Harga ? `\n_* Total disesuaikan (Deal Harga Kesepakatan)_\n` : '';

        if (apt.Total_Hak_Konsumen > 0 && apt.Total_Tagihan_Jasa > 0 && apt.MetodePotong === 'LANGSUNG') { 
            txt += `Hak Anda (Jual Emas): ${UI.formatRp(apt.Total_Hak_Konsumen)}\nTagihan Jasa: -${UI.formatRp(apt.Total_Tagihan_Jasa)}\n`; 
            txt += `_Sistem: Dipotong Langsung (Net-off)_\n${customNoteText}\n*SISA ${apt.Net_Total >= 0 ? 'DITERIMA' : 'DIBAYAR'}: ${UI.formatRp(Math.abs(apt.Net_Total))}*\n`; 
        } else { 
            txt += `${customNoteText}\n*TOTAL ${apt.Net_Total >= 0 ? 'DITERIMA' : 'TAGIHAN'}: ${UI.formatRp(Math.abs(apt.Net_Total))}*\n`; 
        } 
        if(apt.RekeningKonsumen) { txt += `\nRek Tujuan Pencairan: ${apt.RekeningKonsumen}\n`; } txt += `\nTerima Kasih!`; 
        if (waNumber) window.open(`https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(txt)}`, '_blank'); else window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`, '_blank'); 
    },

    shareRekapWA: function(uidsArray) { 
        const apts = dbAppointments.filter(a => uidsArray.includes(a.UID) && a.Status_Janji === 'SELESAI'); if(apts.length === 0) return; const username = apts[0].Username; const uData = dbUsers.find(x => x.Username === username); 
        let waNumber = uData ? uData.No_HP.replace(/\D/g,'') : ''; if(waNumber.startsWith('0')) waNumber = '62' + waNumber.substring(1); 
        let txt = `*${appConfig.notaName}*\n${appConfig.notaAddress}\n\nHalo *${username}*,\nBerikut adalah *REKAPITULASI* transaksi Anda yang telah selesai:\n\n`; let grandTotal = 0; 
        apts.forEach(apt => { 
            txt += `*Trx: ${apt.UID} (${apt.Tanggal})*\n`; 
            apt.Items.forEach(i => { txt += `- ${i.Type==='JASA'?i.Nama:i.Kategori+' '+i.Kadar+' '+i.Varian} (${i.Qty}x): ${UI.formatRp(i.Subtotal)}\n`; }); 
            
            let kotorApt = Math.abs(apt.Net_Total); 
            if (apt.Is_Agen && apt.Komisi_Agen > 0) kotorApt += apt.Komisi_Agen; 
            txt += `_Subtotal Kotor: ${UI.formatRp(kotorApt)}_\n`; 
            if (apt.Is_Agen && apt.Komisi_Agen > 0) txt += `_Potongan Agen: -${UI.formatRp(apt.Komisi_Agen)}_\n`; 
            txt += `_Subtotal Net ${apt.Kustom_Harga?'(Deal)':''}: ${UI.formatRp(Math.abs(apt.Net_Total))} (${apt.Net_Total>=0?'Terima':'Bayar'})_\n\n`; 
            grandTotal += apt.Net_Total; 
        }); 
        txt += `*GRAND TOTAL KESELURUHAN (${grandTotal>=0?'HAK ANDA':'TAGIHAN ANDA'}): ${UI.formatRp(Math.abs(grandTotal))}*\n\nTerima Kasih!`; 
        if (waNumber) window.open(`https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(txt)}`, '_blank'); else window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`, '_blank'); 
    },

    sendWA: function(uid) { 
        const apt = dbAppointments.find(a => a.UID === uid); const uData = dbUsers.find(x => x.Username === apt.Username); 
        let waNumber = uData ? uData.No_HP.replace(/\D/g,'') : ''; if(waNumber.startsWith('0')) waNumber = '62' + waNumber.substring(1); 
        let txt = `Halo ${apt.Username},\n\nInformasi Update Transaksi *${apt.UID}*\nStatus Saat Ini: *${apt.Status_Janji.replace(/_/g, ' ')}*\n`; if(apt.Net_Total > 0) txt += `Total Uang Diterima Pelanggan: ${UI.formatRp(apt.Net_Total)}`; else txt += `Total Tagihan Pelanggan: ${UI.formatRp(Math.abs(apt.Net_Total))}`; txt += `\n\nTerima kasih.`; 
        if (waNumber) window.open(`https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(txt)}`, '_blank'); else window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`, '_blank'); 
    },

    getCurrentBalance: function() { 
        let bal = 0; 
        dbFinance.forEach(f => { if(f.Jenis_Kas === "PENDAPATAN") bal += f.Nominal; else bal -= f.Nominal; }); 
        return bal; 
    },

    startCheckoutWizard: async function() {
        try {
            if(appConfig.isMaintenance) {
                return Swal.fire("MAAF, SEDANG PERBAIKAN", "Sistem saat ini sedang dalam proses pemeliharaan data. Anda tidak dapat membuat transaksi baru saat ini demi keamanan data Anda. Mohon kembali lagi nanti.", "warning");
            }

            if(!navigator.onLine) {
                return Swal.fire("Koneksi Terputus", "Sistem sedang Offline dan data tidak dapat tersimpan ke server. Harap pastikan koneksi internet Anda aktif kembali sebelum melanjutkan.", "error");
            }

            if(currentCart.length === 0) return Swal.fire("Kosong", "Tambahkan barang/jasa ke keranjang terlebih dahulu.", "warning");
            const dt = document.getElementById('apt-date').value; 
            const now = new Date();
            const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            if(!dt || dt < todayStr) {
                if(!editAptId) return Swal.fire("Tanggal Tidak Valid", "Silakan pilih tanggal hari ini atau ke depannya.", "error");
            }

            const aptType = document.getElementById('apt-type').value; 
            const aptTime = document.getElementById('apt-time').value; 
            const isAgen = document.getElementById('apt-is-agen').checked;
            
            let itemsEmas = currentCart.filter(i => i.Type === 'EMAS' || i.Type === 'SILVER'); 
            let itemsJasa = currentCart.filter(i => i.Type === 'JASA');
            
            const trxSesiEmasCount = dbAppointments.filter(a => a.Tanggal === dt && a.Waktu === aptTime && a.Jenis_Transaksi.includes('EMAS') && a.Status_Janji !== 'BATAL').length;
            const trxSesiJasaCount = dbAppointments.filter(a => a.Tanggal === dt && a.Waktu === aptTime && a.Jenis_Transaksi.includes('JASA') && a.Status_Janji !== 'BATAL').length;

            if(!editAptId) {
                if(itemsEmas.length > 0 && trxSesiEmasCount >= appConfig.limitTrxEmas) { return Swal.fire("Sesi Waktu Penuh", `Mohon maaf, sesi waktu [${aptTime}] untuk Jual/Beli Emas sudah penuh (Max: ${appConfig.limitTrxEmas}). Silakan ganti jam/sesi waktu lain di keranjang Anda.`, "error"); }
                if(itemsJasa.length > 0 && trxSesiJasaCount >= appConfig.limitTrxJasa) { return Swal.fire("Sesi Waktu Penuh", `Mohon maaf, sesi waktu [${aptTime}] untuk layanan Jasa (Patri/Sepuh) sudah penuh (Max: ${appConfig.limitTrxJasa}). Silakan ganti jam/sesi waktu lain.`, "error"); }
            }

            let defMetodeEmas = 'TUNAI', defRekKonsumen = '', defRekToko = '', defMetodeJasa = 'TUNAI', defWaktuJasa = 'AKHIR';
            if(editAptId) {
                const apt = dbAppointments.find(a => a.UID === editAptId);
                if(apt) {
                    if(apt.Jenis_Transaksi.includes('EMAS') || apt.Jenis_Transaksi === 'GABUNGAN') {
                        defMetodeEmas = apt.MetodePembayaran && apt.MetodePembayaran.includes('TF') ? 'TF' : 'TUNAI';
                        defRekKonsumen = apt.RekeningKonsumen || ''; defRekToko = apt.RekeningTokoPilihan || '';
                    }
                    if(apt.Jenis_Transaksi === 'JASA' || apt.Jenis_Transaksi === 'GABUNGAN') {
                        defMetodeJasa = apt.MetodePembayaran && apt.MetodePembayaran.includes('TF') ? 'TF' : 'TUNAI';
                        defWaktuJasa = apt.WaktuBayarJasa || 'AKHIR'; defRekToko = apt.RekeningTokoPilihan || '';
                    }
                }
            }

            let checkoutData = { metodeEmas: '', rekKonsumen: '', rekTokoEmas: '', metodeJasa: '', waktuJasa: '', rekTokoJasa: '', modeKombinasi: 'PISAH_PISAH' };
            let rekTokoOpts = '';
            if(appConfig.rekeningToko && appConfig.rekeningToko.length > 0){
                appConfig.rekeningToko.forEach(r => { rekTokoOpts += `<option value="${r.bank} - ${r.no} a.n ${r.an}" ${defRekToko.includes(r.no)?'selected':''}>${r.bank} - ${r.no}</option>`; });
            } else { rekTokoOpts = '<option value="">Belum ada rekening toko</option>'; }

            if(itemsEmas.length > 0) {
                let titleEmas = aptType === 'BELI' ? 'Pembayaran Beli Emas' : 'Pencairan Jual Emas';
                const { value: step1 } = await Swal.fire({
                    title: 'Langkah 1: ' + titleEmas,
                    html: `
                        <div class="text-start">
                            <label class="form-label small text-muted">Metode ${aptType === 'BELI' ? 'Pembayaran (Pelanggan ke Toko)' : 'Pencairan (Toko ke Pelanggan)'}</label>
                            <select id="swal-metode-emas" class="swal2-select w-100 m-0 mb-3" onchange="document.getElementById('swal-rek-box-emas').style.display = this.value === 'TF' ? 'block' : 'none'">
                                <option value="TUNAI" ${defMetodeEmas==='TUNAI'?'selected':''}>Tunai Cash</option>
                                <option value="TF" ${defMetodeEmas==='TF'?'selected':''}>Transfer / E-Wallet</option>
                            </select>
                            <div id="swal-rek-box-emas" style="display:${defMetodeEmas==='TF'?'block':'none'};">
                                ${aptType === 'BELI' ?
                                    `<label class="form-label small text-muted">Pilih Rekening Tujuan (Toko)</label><select id="swal-rek-toko-emas" class="swal2-select w-100 m-0">${rekTokoOpts}</select><br><small class="text-info mt-1 d-block">Atau scan QRIS Toko (Tampil setelah checkout di Dashboard).</small>` :
                                    `<label class="form-label small text-muted">Nomor Rekening Anda (Penerima)</label><input type="text" id="swal-rek-konsumen" class="swal2-input w-100 m-0" placeholder="Cth: BCA 12345 a.n Budi" value="${defRekKonsumen}">`
                                }
                            </div>
                        </div>
                    `,
                    confirmButtonText: 'Lanjut',
                    showCancelButton: true,
                    preConfirm: () => {
                        const metode = document.getElementById('swal-metode-emas').value;
                        const rekKonsumen = document.getElementById('swal-rek-konsumen') ? document.getElementById('swal-rek-konsumen').value : '';
                        const rekTokoEmas = document.getElementById('swal-rek-toko-emas') ? document.getElementById('swal-rek-toko-emas').value : '';
                        if(metode === 'TF') {
                            if(aptType === 'JUAL' && !rekKonsumen) return Swal.showValidationMessage('Masukkan Nomor Rekening Anda!');
                            if(aptType === 'BELI' && !rekTokoEmas) return Swal.showValidationMessage('Pilih Rekening Toko!');
                        }
                        return { metode, rekKonsumen, rekTokoEmas };
                    }
                });
                if(!step1) return;
                checkoutData.metodeEmas = step1.metode; checkoutData.rekKonsumen = step1.rekKonsumen; checkoutData.rekTokoEmas = step1.rekTokoEmas;
            }

            if(itemsJasa.length > 0) {
                const { value: step2 } = await Swal.fire({
                    title: 'Langkah ' + (itemsEmas.length > 0 ? '2' : '1') + ': Pembayaran Jasa',
                    html: `
                        <div class="text-start">
                            <label class="form-label small text-muted">Metode Pembayaran Tagihan Jasa</label>
                            <select id="swal-metode-jasa" class="swal2-select w-100 m-0 mb-3" onchange="
                                const v = this.value;
                                document.getElementById('swal-waktu-jasa-box').style.display = v === 'TUNAI' ? 'block' : 'none';
                                document.getElementById('swal-rek-toko-jasa-box').style.display = v === 'TF' ? 'block' : 'none';
                            ">
                                <option value="TUNAI" ${defMetodeJasa==='TUNAI'?'selected':''}>Tunai Cash</option>
                                <option value="TF" ${defMetodeJasa==='TF'?'selected':''}>Transfer / E-Wallet</option>
                            </select>
                            <div id="swal-waktu-jasa-box" style="display:${defMetodeJasa==='TUNAI'?'block':'none'};">
                                <label class="form-label small text-warning">Waktu Pembayaran Tunai</label>
                                <select id="swal-waktu-jasa" class="swal2-select w-100 m-0">
                                    <option value="AWAL" ${defWaktuJasa==='AWAL'?'selected':''}>Bayar di Awal (Deposit)</option>
                                    <option value="AKHIR" ${defWaktuJasa==='AKHIR'?'selected':''}>Bayar di Akhir (Selesai)</option>
                                </select>
                            </div>
                            <div id="swal-rek-toko-jasa-box" style="display:${defMetodeJasa==='TF'?'block':'none'};">
                                <label class="form-label small text-muted">Pilih Rekening Tujuan (Toko)</label>
                                <select id="swal-rek-toko-jasa" class="swal2-select w-100 m-0">${rekTokoOpts}</select>
                                <small class="text-info mt-1 d-block">Atau scan QRIS Toko (Tampil setelah checkout di Dashboard).</small>
                            </div>
                        </div>
                    `,
                    confirmButtonText: 'Lanjut',
                    showCancelButton: true,
                    preConfirm: () => {
                        const metode = document.getElementById('swal-metode-jasa').value;
                        const waktu = document.getElementById('swal-waktu-jasa').value;
                        const rekToko = document.getElementById('swal-rek-toko-jasa') ? document.getElementById('swal-rek-toko-jasa').value : '';
                        if(metode === 'TF' && !rekToko) return Swal.showValidationMessage('Pilih Rekening Toko!');
                        return { metode, waktu, rekToko };
                    }
                });
                if(!step2) return;
                checkoutData.metodeJasa = step2.metode; checkoutData.waktuJasa = step2.metode === 'TUNAI' ? step2.waktu : ''; checkoutData.rekTokoJasa = step2.rekToko;
            }

            if(itemsEmas.length > 0 && itemsJasa.length > 0 && aptType === 'JUAL') {
                const { value: step3 } = await Swal.fire({
                    title: 'Langkah 3: Opsi Kombinasi',
                    html: `
                        <div class="bg-dark p-3 rounded border border-warning text-start mb-3">
                            <label class="form-label small text-warning fw-bold mb-2">Potong Tagihan Langsung?</label>
                            <p class="small text-muted mb-2">Apakah tagihan jasa dipotong otomatis dari uang pencairan emas Anda?</p>
                            <select id="swal-potong" class="swal2-select w-100 m-0">
                                <option value="LANGSUNG">Ya, Potong Langsung (Otomatis 1 Struk)</option>
                                <option value="PISAH">Tidak, Transaksi Dibayar Terpisah</option>
                            </select>
                        </div>
                        <div class="bg-dark p-3 rounded border border-info text-start">
                            <label class="form-label small text-info fw-bold mb-2">Format Rekap/Struk (WA & Cetak)</label>
                            <p class="small text-muted mb-2">Jika pembayaran tidak dipotong langsung, apakah struk ingin digabung atau dipisah 2 nota?</p>
                            <select id="swal-struk" class="swal2-select w-100 m-0">
                                <option value="GABUNG">Jadikan 1 Struk / Nota Campuran</option>
                                <option value="PISAH">Pisahkan Jadi 2 Struk / Nota Berbeda</option>
                            </select>
                        </div>
                    `,
                    confirmButtonText: 'Konfirmasi Final',
                    showCancelButton: true,
                    preConfirm: () => {
                        const p = document.getElementById('swal-potong').value;
                        const s = document.getElementById('swal-struk').value;
                        if(p === 'LANGSUNG') return 'LANGSUNG_GABUNG';
                        if(p === 'PISAH' && s === 'GABUNG') return 'PISAH_GABUNG';
                        return 'PISAH_PISAH';
                    }
                });
                if(!step3) return;
                checkoutData.modeKombinasi = step3;
            } else if(itemsEmas.length > 0 && itemsJasa.length > 0 && aptType === 'BELI') {
                const { value: s3Beli } = await Swal.fire({
                    title: 'Langkah 3: Format Struk',
                    html: `
                        <div class="bg-dark p-3 rounded border border-info text-start">
                            <label class="form-label small text-info fw-bold mb-2">Format Rekap/Struk (WA & Cetak)</label>
                            <p class="small text-muted mb-2">Apakah laporan beli emas & jasa ingin digabung atau dipisah 2 nota?</p>
                            <select id="swal-struk" class="swal2-select w-100 m-0">
                                <option value="GABUNG">Jadikan 1 Struk / Nota Campuran</option>
                                <option value="PISAH">Pisahkan Jadi 2 Struk / Nota Berbeda</option>
                            </select>
                        </div>
                    `,
                    confirmButtonText: 'Konfirmasi Final',
                    showCancelButton: true,
                    preConfirm: () => document.getElementById('swal-struk').value === 'GABUNG' ? 'PISAH_GABUNG' : 'PISAH_PISAH'
                });
                if(!s3Beli) return;
                checkoutData.modeKombinasi = s3Beli;
            } else {
                checkoutData.modeKombinasi = 'PISAH_PISAH'; 
            }

            this.executeSubmitAppointment(dt, aptTime, aptType, isAgen, itemsEmas, itemsJasa, checkoutData);
        } catch (err) { AppLogger.logError(err, "API.startCheckoutWizard"); }
    },

    executeSubmitAppointment: async function(dt, aptTime, aptType, isAgen, itemsEmas, itemsJasa, checkoutData) {
        try {
            let totalEmas = itemsEmas.length > 0 ? itemsEmas.reduce((s, i) => s + i.Subtotal, 0) : 0; 
            let totalJasa = itemsJasa.length > 0 ? itemsJasa.reduce((s, i) => s + i.Subtotal, 0) : 0;
            
            let nominalAdminBayar = 0; 
            if(checkoutData.modeKombinasi === "LANGSUNG_GABUNG" && (totalEmas - totalJasa) > 0) nominalAdminBayar = totalEmas - totalJasa; 
            else if (aptType === "JUAL" && itemsEmas.length > 0) nominalAdminBayar = totalEmas;
            
            if(nominalAdminBayar > this.getCurrentBalance()) { return Swal.fire("Transaksi Invalid", "Limit transaksi melebihi batas modal operasional Toko saat ini.", "error"); }

            UI.showLoading(true, "Memproses Transaksi Anda...");
            const baseData = { Tanggal: dt, Waktu: aptTime, Lokasi_Transaksi: document.getElementById('apt-location').value, Alamat_Jemput: document.getElementById('apt-address').value + (document.getElementById('apt-patokan').value ? ` (Patokan: ${document.getElementById('apt-patokan').value})` : ''), Lat: document.getElementById('apt-lat').value, Lng: document.getElementById('apt-lng').value, Is_Agen: isAgen, Komisi_Agen: 0 };

            if(editAptId) {
                let idx = dbAppointments.findIndex(a => a.UID === editAptId);
                if(idx !== -1) {
                    dbAppointments[idx].Items = JSON.parse(JSON.stringify(currentCart)); 
                    Object.assign(dbAppointments[idx], baseData);
                    
                    if(itemsEmas.length > 0 && itemsJasa.length > 0 && (checkoutData.modeKombinasi === "LANGSUNG_GABUNG" || checkoutData.modeKombinasi === "PISAH_GABUNG")) {
                        let cMethod = checkoutData.metodeEmas === checkoutData.metodeJasa ? checkoutData.metodeEmas : `${checkoutData.metodeEmas} (Emas) / ${checkoutData.metodeJasa} (Jasa)`;
                        dbAppointments[idx].Jenis_Transaksi = "GABUNGAN"; dbAppointments[idx].Total_Hak_Konsumen = totalEmas; dbAppointments[idx].Total_Tagihan_Jasa = totalJasa; 
                        dbAppointments[idx].Net_Total = checkoutData.modeKombinasi === "LANGSUNG_GABUNG" ? (totalEmas - totalJasa) : (aptType==="BELI" ? -totalEmas - totalJasa : totalEmas - totalJasa);
                        dbAppointments[idx].MetodePembayaran = cMethod; dbAppointments[idx].MetodePotong = checkoutData.modeKombinasi === "LANGSUNG_GABUNG" ? "LANGSUNG" : "PISAH";
                        dbAppointments[idx].RekeningKonsumen = checkoutData.rekKonsumen; dbAppointments[idx].RekeningTokoPilihan = checkoutData.rekTokoEmas || checkoutData.rekTokoJasa;
                        dbAppointments[idx].Status_Janji = "MENUNGGU_TAKSIRAN";
                        dbAppointments[idx].Kustom_Harga = false;
                    } else { 
                        if(itemsEmas.length > 0) { 
                            dbAppointments[idx].Jenis_Transaksi = aptType === "BELI" ? "BELI_EMAS" : "JUAL_EMAS"; dbAppointments[idx].Total_Hak_Konsumen = totalEmas; dbAppointments[idx].Total_Tagihan_Jasa = 0; dbAppointments[idx].Net_Total = aptType==="BELI" ? -totalEmas : totalEmas; 
                            dbAppointments[idx].MetodePembayaran = checkoutData.metodeEmas; dbAppointments[idx].RekeningKonsumen = checkoutData.rekKonsumen; dbAppointments[idx].RekeningTokoPilihan = checkoutData.rekTokoEmas; dbAppointments[idx].MetodePotong = "PISAH";
                            dbAppointments[idx].Status_Janji = "MENUNGGU_TAKSIRAN";
                            dbAppointments[idx].Kustom_Harga = false;
                        } else if(itemsJasa.length > 0) { 
                            dbAppointments[idx].Jenis_Transaksi = "JASA"; dbAppointments[idx].Total_Hak_Konsumen = 0; dbAppointments[idx].Total_Tagihan_Jasa = totalJasa; dbAppointments[idx].Net_Total = -totalJasa; 
                            dbAppointments[idx].MetodePembayaran = checkoutData.metodeJasa; dbAppointments[idx].RekeningTokoPilihan = checkoutData.rekTokoJasa; dbAppointments[idx].WaktuBayarJasa = checkoutData.waktuJasa; dbAppointments[idx].MetodePotong = "PISAH";
                            let initStatus = checkoutData.metodeJasa === 'TUNAI' ? (checkoutData.waktuJasa === 'AWAL' ? "MENUNGGU_PEMBAYARAN_AWAL" : "MENUNGGU_PERSETUJUAN_ADMIN") : "MENUNGGU_PEMBAYARAN"; 
                            dbAppointments[idx].Status_Janji = initStatus;
                            dbAppointments[idx].Kustom_Harga = false;
                        } 
                    }
                    UI.toast("Transaksi Berhasil Diperbarui", "success");
                }
                editAptId = null;
            } else {
                if (itemsEmas.length > 0 && itemsJasa.length > 0 && (checkoutData.modeKombinasi === "LANGSUNG_GABUNG" || checkoutData.modeKombinasi === "PISAH_GABUNG")) {
                    let netTotal = checkoutData.modeKombinasi === "LANGSUNG_GABUNG" ? (totalEmas - totalJasa) : (aptType==="BELI" ? -totalEmas - totalJasa : totalEmas - totalJasa);
                    let combinedMethod = checkoutData.metodeEmas === checkoutData.metodeJasa ? checkoutData.metodeEmas : `${checkoutData.metodeEmas} (E) / ${checkoutData.metodeJasa} (J)`;
                    dbAppointments.push({ 
                        UID: generateID("TRX"), Timestamp: new Date().toISOString(), Username: sessionUser.Username, Jenis_Transaksi: "GABUNGAN", Status_Janji: "MENUNGGU_TAKSIRAN", Items: currentCart, 
                        Total_Hak_Konsumen: totalEmas, Total_Tagihan_Jasa: totalJasa, Net_Total: netTotal, Kustom_Harga: false, 
                        MetodePembayaran: combinedMethod, RekeningKonsumen: checkoutData.rekKonsumen, RekeningTokoPilihan: checkoutData.rekTokoEmas || checkoutData.rekTokoJasa, WaktuBayarJasa: checkoutData.waktuJasa,
                        MetodePotong: checkoutData.modeKombinasi === "LANGSUNG_GABUNG" ? "LANGSUNG" : "PISAH", ...baseData 
                    });
                } else {
                    if(itemsEmas.length > 0) { 
                        dbAppointments.push({ 
                            UID: generateID("TRX-E"), Timestamp: new Date().toISOString(), Username: sessionUser.Username, Jenis_Transaksi: aptType === "BELI" ? "BELI_EMAS" : "JUAL_EMAS", Status_Janji: "MENUNGGU_TAKSIRAN", Items: itemsEmas, 
                            Total_Hak_Konsumen: totalEmas, Total_Tagihan_Jasa: 0, Net_Total: aptType==="BELI" ? -totalEmas : totalEmas, Kustom_Harga: false, 
                            MetodePembayaran: checkoutData.metodeEmas, RekeningKonsumen: checkoutData.rekKonsumen, RekeningTokoPilihan: checkoutData.rekTokoEmas, MetodePotong: "PISAH", ...baseData 
                        }); 
                    }
                    if(itemsJasa.length > 0) { 
                        let initStatus = checkoutData.metodeJasa === 'TUNAI' ? (checkoutData.waktuJasa === 'AWAL' ? "MENUNGGU_PEMBAYARAN_AWAL" : "MENUNGGU_PERSETUJUAN_ADMIN") : "MENUNGGU_PEMBAYARAN"; 
                        dbAppointments.push({ 
                            UID: generateID("TRX-J"), Timestamp: new Date(Date.now() + 1000).toISOString(), Username: sessionUser.Username, Jenis_Transaksi: "JASA", Status_Janji: initStatus, Items: itemsJasa, 
                            Total_Hak_Konsumen: 0, Total_Tagihan_Jasa: totalJasa, Net_Total: -totalJasa, Kustom_Harga: false, 
                            MetodePembayaran: checkoutData.metodeJasa, RekeningKonsumen: "", RekeningTokoPilihan: checkoutData.rekTokoJasa, WaktuBayarJasa: checkoutData.waktuJasa, MetodePotong: "PISAH", ...baseData 
                        }); 
                    }
                }
                Swal.fire("Berhasil", "Transaksi dikirim ke Admin!", "success");
            }
            
            // Simpan data transaksi secara terarah sesuai indeks aktual untuk memotong beban loading cloud
            if (editAptId) {
                const targetUpdated = dbAppointments.find(a => a.UID === editAptId);
                await AppStorage.save('appointments', targetUpdated);
            } else {
                const targetNew = dbAppointments[dbAppointments.length - 1];
                await AppStorage.save('appointments', targetNew);
            }
            
            UI.showLoading(false);
            UI.resetCart(); UI.navigateTo('dashboard'); UI.updateRunningText();
        } catch(err) {
            UI.showLoading(false);
            AppLogger.logError(err, "API.executeSubmitAppointment");
            Swal.fire("Gagal", "Terjadi kesalahan saat memproses transaksi.", "error");
        }
    },
    
    processAction: async function(uid, action) {
        try {
            const apt = dbAppointments.find(a => a.UID === uid); if(!apt) return;
            
            if (action === "SIMPAN_TAKSIRAN") { 
                const { value: price } = await Swal.fire({ title: 'Ubah Taksiran Harga', input: 'number', inputValue: Math.abs(apt.Net_Total), showCancelButton: true }); 
                if(price) { apt.Net_Total = apt.Net_Total >= 0 ? parseInt(price) : -parseInt(price); apt.Kustom_Harga = true; UI.toast("Taksiran disimpan sementara"); UI.renderAdminLaporanView(); } 
            }
            else if (action === "KIRIM_TAKSIRAN") { 
                const conf = await Swal.fire({ title: 'Kirim Harga?', text: "Harga akan dikunci dan dikirim ke pelanggan", icon: 'question', showCancelButton: true }); 
                if(conf.isConfirmed) { apt.Status_Janji = "MENUNGGU_KONF_KONSUMEN"; UI.toast("Taksiran dikirim!"); UI.renderAdminLaporanView(); } 
            }
            else if (action === "VERIFIKASI_TF") { 
                const conf = await Swal.fire({ title: 'Verifikasi TF?', text: "Pastikan dana sudah masuk", icon: 'question', showCancelButton: true });
                if(conf.isConfirmed) { 
                    if (apt.Jenis_Transaksi.includes('JASA') || apt.Jenis_Transaksi === 'GABUNGAN') { apt.Status_Janji = "PROSES_JASA"; } 
                    else { apt.Status_Janji = "MENUNGGU_SERAH_TERIMA"; }
                    UI.toast("Terverifikasi", "success"); UI.renderAdminLaporanView(); 
                } 
            }
            else if (action === "KONFIRM_TERIMA_UANG" || action === "SETUJUI_PESANAN") { 
                const { value: est } = await Swal.fire({ 
                    title: 'Setujui & Beri Estimasi Selesai', 
                    input: 'text', 
                    inputValue: apt.EstimasiSelesai || '', 
                    inputPlaceholder: 'Cth: Besok Jam 12 (Wajib)', 
                    showCancelButton: true,
                    inputValidator: (value) => { if (!value) return 'Estimasi waktu selesai wajib diisi!'; } 
                }); 
                if(est) { apt.EstimasiSelesai = est; apt.Status_Janji = "PROSES_JASA"; UI.toast("Pesanan diproses", "success"); UI.renderAdminLaporanView(); } 
            }
            else if (action === "SET_ESTIMASI_SELESAI") { 
                        const { value: est } = await Swal.fire({ title: 'Update Estimasi Selesai', input: 'text', inputValue: apt.EstimasiSelesai || '', showCancelButton: true }); 
                        if(est !== undefined) { apt.EstimasiSelesai = est; UI.toast("Diupdate", "success"); UI.renderAdminLaporanView(); } 
                    }
                    else if (action === "SET_PESAN_NOTE") { 
                        const { value: note } = await Swal.fire({ title: 'Tambah Pesan / Note', text: 'Pesan ini akan menggantikan estimasi waktu dan dapat dilihat oleh pelanggan.', input: 'text', inputValue: apt.Feedback || '', inputPlaceholder: 'Cth: Barang bisa diambil jam 4 sore...', showCancelButton: true }); 
                        if(note !== undefined) { apt.Feedback = note; UI.toast("Pesan disimpan", "success"); UI.renderAdminLaporanView(); } 
                    }
            else if (action === "BARANG_SIAP") { 
                const conf = await Swal.fire({ title: 'Barang Siap?', icon: 'question', showCancelButton: true });
                if(conf.isConfirmed) { apt.Status_Janji = "MENUNGGU_KONF_PENERIMAAN";apt.WaktuTungguKonf = Date.now(); UI.toast("Barang Siap. Menunggu Konfirmasi Pelanggan"); UI.renderAdminLaporanView(); } 
            }
            else if (action === "SET_KOMISI_AGEN") { 
                const { value: komisi } = await Swal.fire({ title: 'Input Komisi Agen', input: 'number', inputValue: apt.Komisi_Agen || 0, showCancelButton: true }); 
                if(komisi !== undefined) { apt.Komisi_Agen = parseInt(komisi) || 0; UI.toast("Komisi diset", "success"); UI.renderAdminLaporanView(); } 
            }
            else if (action === "SELESAI_ADMIN") { 
                const conf = await Swal.fire({ title: 'Kirim ke Pelanggan?', text: 'Proses akan dilanjutkan ke tahap konfirmasi penerimaan oleh pelanggan.', icon: 'warning', showCancelButton: true });
                if(conf.isConfirmed) {
                    if (apt.Jenis_Transaksi.includes("EMAS") || apt.Jenis_Transaksi === "GABUNGAN") { 
                        if(apt.MetodePembayaran && apt.MetodePembayaran.includes("TF")) { 
                            const { value: file } = await Swal.fire({ 
                                title: 'Upload Bukti TF', 
                                text: 'Wajib upload bukti transfer untuk melanjutkan!',
                                input: 'file', 
                                showCancelButton: true,
                                inputValidator: (value) => { if (!value) return 'Anda wajib mengunggah bukti transfer!' }
                            }); 
                            if(file) apt.BuktiBayarAdmin = await compressImage(file); 
                            else return; 
                        } 
                    } 
                    apt.Status_Janji = "MENUNGGU_KONF_PENERIMAAN";
                    apt.WaktuTungguKonf = Date.now();
                    UI.toast("Dikirim ke pelanggan", "success");
                    UI.renderAdminLaporanView();
                }
            }
            else if (action === "DEAL") { 
                const conf = await Swal.fire({ title: 'Deal Transaksi?', icon: 'success', showCancelButton: true });
                if(conf.isConfirmed) { apt.Status_Janji = (apt.MetodePembayaran && apt.MetodePembayaran.includes("TF")) ? "MENUNGGU_TF_ADMIN" : "MENUNGGU_SERAH_TERIMA"; UI.toast("DEAL!", "success"); UI.renderDashboardView(); } 
            }
            else if (action === "BATAL") { 
                const confBatal = await Swal.fire({ title: 'Batalkan Transaksi?', text: 'Apakah Anda yakin ingin membatalkan transaksi ini?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Batalkan', cancelButtonText: 'Kembali' });
                if(!confBatal.isConfirmed) return;
                const { value: text } = await Swal.fire({ title: 'Alasan Batal', input: 'text', inputPlaceholder: 'Masukkan alasan pembatalan...' }); 
                apt.Feedback = text || "Dibatalkan pengguna"; apt.Status_Janji = "BATAL"; UI.toast("Dibatalkan", "info"); 
                if (sessionUser && sessionUser.Role === 'Admin') { UI.renderAdminLaporanView(); } else { UI.renderDashboardView(); } 
            }
            else if (action === "UPLOAD_TF_KONSUMEN") { 
                let rekStr = apt.RekeningTokoPilihan || "Rekening Pilihan"; 
                let qrisHtml = appConfig.qrisUrl ? `<div class="mt-3 mb-2 text-center"><img src="${appConfig.qrisUrl}" style="max-width: 100%; height: auto; max-height: 250px; border-radius: 8px; border: 2px solid #d4af37;" alt="QRIS"><br><small class="text-info mt-1 d-block">Scan QRIS di atas untuk pembayaran cepat</small></div>` : '';
                
                const { value: file } = await Swal.fire({ 
                    title: 'Upload Bukti Transfer', 
                    html: `<div class="text-start mb-2 small text-muted">Transfer Tagihan <b class="text-danger">${UI.formatRp(Math.abs(apt.Net_Total))}</b> ke:<br><b class="text-white">${rekStr}</b></div>${qrisHtml}`, 
                    input: 'file', 
                    showCancelButton: true,
                    inputValidator: (value) => { if (!value) return 'Anda wajib mengunggah bukti transfer untuk melanjutkan!'; }
                }); 
                if(file) { apt.BuktiBayarCustomer = await compressImage(file); apt.Status_Janji = "VERIFIKASI_PEMBAYARAN"; UI.toast("Bukti terkirim", "success"); UI.renderDashboardView(); } 
            }
            else if (action === "SELESAI_KONSUMEN") { 
                const conf = await Swal.fire({ title: 'Konfirmasi Penerimaan', text: 'Pastikan uang/barang sudah Anda terima dengan baik.', icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Saya Mengonfirmasi' });
                if(conf.isConfirmed) { await this.finalizeTransaction(apt); UI.showAddTestimoni(); }
                
                // KODE PERBAIKAN: Stop di sini agar tidak terjadi proses Save 2x yang bikin berat!
                return; 
            }
            
            // KODE PERBAIKAN: Berikan layar loading untuk semua proses persetujuan (seperti Barang Siap, dsb)
            UI.showLoading(true, "Memproses Data...");
            await AppStorage.save('appointments', apt); // Kirim dokumen transaksi ini saja secara spesifik
            UI.showLoading(false);
            
            UI.updateRunningText();
        } catch(err) { 
            UI.showLoading(false);
            AppLogger.logError(err, "API.processAction"); 
        }
    },
    
    finalizeTransaction: async function(apt, isAuto = false) {
        try {
            // KODE BARU: Memunculkan layar loading
            if (!isAuto) UI.showLoading(true, "Menyelesaikan Transaksi..."); 
            apt.Status_Janji = "SELESAI"; 
            
            let modalEmas = 0;
            apt.Items.forEach(c => { 
                if(c.Type !== 'JASA') { 
                    const gold = dbGoldSettings.find(g => g.Kadar === c.Kadar && g.Varian === c.Varian); 
                    if(gold) modalEmas += (gold.Harga_Mal * c.Gram); 
                }
            });
            
            let changeInCash = -apt.Net_Total;
            let changeInAsset = (apt.Jenis_Transaksi === "BELI_EMAS") ? -modalEmas : (apt.Jenis_Transaksi === "JASA" ? 0 : modalEmas);
            let totalLaba = changeInCash + changeInAsset;

            let nominalMasukLog = Math.abs(apt.Net_Total);
            if (apt.Is_Agen && apt.Komisi_Agen > 0) { 
                if (apt.Net_Total < 0) nominalMasukLog = Math.max(0, nominalMasukLog - apt.Komisi_Agen); 
                else nominalMasukLog += apt.Komisi_Agen; 
            }
            
            const newJournalLog = { 
                UID: "F"+Date.now(), Tanggal: new Date().toISOString().split('T')[0], 
                Jenis_Kas: apt.Net_Total > 0 ? "PENGELUARAN" : "PENDAPATAN", 
                Kategori: apt.Jenis_Transaksi, 
                Keterangan: `TRX: ${apt.UID}${apt.Is_Agen ? ` (Agen: Potong Rp ${apt.Komisi_Agen})` : ''}`, 
                Nominal: nominalMasukLog, 
                Laba_Tercatat: totalLaba - (apt.Komisi_Agen || 0) 
            };
            dbFinance.push(newJournalLog);
            
            // Simpan dokumen status transaksi beserta log pembukuan barunya secara paralel
            await AppStorage.save('appointments', apt);
            await AppStorage.save('finance', newJournalLog);
            
            if (sessionUser && sessionUser.Role === "Admin") {
                UI.renderAdminLaporanView(); 
                UI.renderAdminFinanceView();
                UI.renderAdminUsersView();
            } else if (sessionUser) {
                UI.renderDashboardView(); 
            }
            if (!isAuto) {
                UI.showLoading(false); // KODE BARU: Menutup layar loading
                UI.toast("Transaksi Selesai!", "success"); 
            }
            UI.updateRunningText();
        } catch (err) { 
            if (!isAuto) UI.showLoading(false); 
            AppLogger.logError(err, "API.finalizeTransaction"); 
        }
    },

    autoCompleteTransactions: async function() {
        try {
            const LIMIT_WAKTU = 1 * 60 * 1000; 
            let adaYangBerubah = false;

            for (let apt of dbAppointments) {
                if (apt.Status_Janji === 'MENUNGGU_KONF_PENERIMAAN' || apt.Status_Janji === 'SIAP_DIAMBIL') {
                    if (!apt.WaktuTungguKonf) {
                        apt.WaktuTungguKonf = Date.now();
                    } else {
                        const waktuBerlalu = Date.now() - apt.WaktuTungguKonf;
                        if (waktuBerlalu >= LIMIT_WAKTU) {
                            await this.finalizeTransaction(apt, true); 
                            adaYangBerubah = true;
                        }
                    }
                }
            }

            if (adaYangBerubah && sessionUser) {
                await AppStorage.save();
                if (sessionUser.Role === "Admin") {
                    UI.renderAdminLaporanView();
                    UI.renderAdminFinanceView();
                } else {
                    UI.renderDashboardView();
                }
            }
        } catch (err) { AppLogger.logError(err, "API.autoCompleteTransactions"); }
    },

    updateGlobalMultiplier: function(bahan) { 
        const newMult = parseFloat(document.getElementById(bahan==='SILVER'?'input-global-mult-silver':'input-global-mult').value); if(isNaN(newMult) || newMult <= 0) return UI.toast("Invalid!", "error"); 
        UI.showLoading(true, "Kalkulasi..."); 
        setTimeout(async () => { 
            try {
                if(bahan==='SILVER') GLOBAL_MULTIPLIER_SILVER = newMult; else GLOBAL_MULTIPLIER = newMult; 
                dbGoldSettings.forEach(g => { 
                    let bBahan = g.Bahan || 'EMAS'; 
                    if(bBahan === bahan) { 
                        let currMult = bBahan === 'SILVER' ? GLOBAL_MULTIPLIER_SILVER : GLOBAL_MULTIPLIER; 
                        g.Harga_Mal = Math.round(g.Faktor_Varian * currMult); 
                        if(g.Tipe_Margin === "PERSEN") { 
                            g.Harga_Jual = Math.round(g.Harga_Mal + (g.Harga_Mal * (g.Nilai_Margin/100))); 
                            g.Harga_Beli = Math.round(g.Harga_Mal - (g.Harga_Mal * (g.Nilai_Margin/100))); 
                        } else { 
                            g.Harga_Jual = g.Harga_Mal + g.Nilai_Margin; 
                            g.Harga_Beli = g.Harga_Mal - g.Nilai_Margin; 
                        } 
                    } 
                }); 
                await AppStorage.save(); UI.showLoading(false); UI.toast(`Harga ${bahan} diperbarui`, "success"); UI.renderGoldSettingsView(); UI.updateRunningText();
            } catch(err) { UI.showLoading(false); AppLogger.logError(err, "API.updateGlobalMultiplier"); }
        }, 800); 
    },
    
    submitGoldSetting: function(e) { 
        e.preventDefault(); UI.showLoading(true); 
        setTimeout(async () => { 
            try {
                UI.showLoading(false); 
                const bahan = document.getElementById('gold-bahan').value; const kadar = document.getElementById('gold-kadar').value.toUpperCase(); const varian = document.getElementById('gold-varian').value; const faktor = parseFloat(document.getElementById('gold-faktor').value); const mType = document.getElementById('gold-margin-type').value; const mVal = parseFloat(document.getElementById('gold-margin-value').value); 
                let currMult = bahan === 'SILVER' ? GLOBAL_MULTIPLIER_SILVER : GLOBAL_MULTIPLIER; const mal = Math.round(faktor * currMult); let hj = mal, hb = mal; 
                if(mType === "PERSEN") { hj = Math.round(mal + (mal * (mVal/100))); hb = Math.round(mal - (mal * (mVal/100))); } else { hj = mal + mVal; hb = mal - mVal; } 
                if(editGoldId) { 
                    const target = dbGoldSettings.find(g => g.UID === editGoldId); 
                    if(target) Object.assign(target, { Bahan: bahan, Kadar: kadar, Varian: varian, Faktor_Varian: faktor, Tipe_Margin: mType, Nilai_Margin: mVal, Harga_Mal: mal, Harga_Jual: hj, Harga_Beli: hb }); 
                    UI.toast("Kadar Diperbarui", "success"); UI.cancelEditGold(); 
                } else { 
                    dbGoldSettings.push({ UID: "G"+Date.now(), Bahan: bahan, Kadar: kadar, Varian: varian, Faktor_Varian: faktor, Tipe_Margin: mType, Nilai_Margin: mVal, Harga_Mal: mal, Harga_Jual: hj, Harga_Beli: hb }); 
                    UI.toast("Kadar Tersimpan", "success"); document.getElementById('form-manage-emas').reset(); 
                } 
                await AppStorage.save(); UI.previewHPP(); UI.renderGoldSettingsView(); UI.updateRunningText(); 
            } catch (err) { UI.showLoading(false); AppLogger.logError(err, "API.submitGoldSetting"); }
        }, 500); 
    },
    
    deleteGold: function(uid) { 
        Swal.fire({ title: 'Hapus Permanen?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus' }).then(async (r) => { 
            if (r.isConfirmed) { 
                try {
                    UI.showLoading(true, "Menghapus...");
                    if (isFirebaseActive && !isManualLocalMode) {
                        await db.collection('gold_settings').doc(uid).delete();
                    }
                    dbGoldSettings = dbGoldSettings.filter(g=>g.UID!==uid); 
                    await AppStorage.save(); 
                    UI.showLoading(false);
                    UI.renderGoldSettingsView(); 
                    UI.updateRunningText(); 
                    UI.toast("Dihapus permanen", "success"); 
                } catch (err) {
                    UI.showLoading(false); AppLogger.logError(err, "API.deleteGold"); UI.toast("Gagal hapus", "error");
                }
            } 
        }); 
    },
    
    reorderGoldDragDrop: async function(absoluteOld, absoluteNew) { 
        try {
            UI.showLoading(true, "Menyimpan Urutan Baru...");
            
            // 1. Gunakan indeks absolut (berdasarkan total array global, bukan cuma halaman)
            const movedItem = dbGoldSettings.splice(absoluteOld, 1)[0];
            dbGoldSettings.splice(absoluteNew, 0, movedItem);
            
            // 2. Perbarui nilai 'Urutan' untuk semua item agar rapi
            dbGoldSettings.forEach((g, i) => g.Urutan = i);

            // 3. Simpan ke Storage & Firebase
            await AppStorage.save(); 
            
            UI.showLoading(false);
            UI.toast("Urutan berhasil diperbarui", "success"); 
            UI.renderGoldSettingsView(); 
            UI.updateRunningText(); 
        } catch (err) {
            UI.showLoading(false);
            AppLogger.logError(err, "API.reorderGoldDragDrop");
            UI.toast("Gagal menyimpan urutan baru", "error");
            UI.renderGoldSettingsView(); // Kembalikan tampilan jika gagal
        }
    },
    
    saveTemplate: async function() { const k = document.getElementById('gold-kadar').value.toUpperCase(); const v = document.getElementById('gold-varian').value; const f = parseFloat(document.getElementById('gold-faktor').value); if(!k || !v || isNaN(f)) return UI.toast("Isi form dahulu", "warning"); dbTemplates.push({ UID: "T"+Date.now(), Kadar: k, Varian: v, Faktor: f }); await AppStorage.save(); UI.renderTemplates(); UI.toast("Template disimpan", "success"); },
    deleteTemplate: async function() { 
        const s = document.getElementById('template-select').value; if(!s) return; 
        if (isFirebaseActive && !isManualLocalMode) await db.collection('templates').doc(s).delete();
        dbTemplates = dbTemplates.filter(t => t.UID !== s); await AppStorage.save(); UI.renderTemplates(); UI.toast("Dihapus", "success"); 
    },
    
    manageModal: function() { const cBal = this.getCurrentBalance(); Swal.fire({ title: 'Manajemen Kas', html: `<div class="mb-3 text-start bg-dark p-2 rounded"><label class="small text-muted">Saldo Kas Fisik:</label><h4 class="text-warning m-0">${UI.formatRp(cBal)}</h4></div><select id="modal-action" class="swal2-select w-100 m-0 mb-3"><option value="TAMBAH">Tambah Modal (Debit)</option><option value="KURANG">Tarik (Kredit)</option></select><input id="modal-nom" type="number" class="swal2-input w-100 m-0 mb-3" placeholder="Nominal IDR"><input id="modal-ket" type="text" class="swal2-input w-100 m-0" placeholder="Keterangan">`, showCancelButton: true, confirmButtonText: 'Simpan', preConfirm: () => { const a = document.getElementById('modal-action').value; const n = parseInt(document.getElementById('modal-nom').value); const k = document.getElementById('modal-ket').value; if(!n || !k) return Swal.showValidationMessage('Isi lengkap!'); if(a === 'KURANG' && n > cBal) return Swal.showValidationMessage('Saldo kurang!'); return { a, n, k }; } }).then(async res => { if(res.isConfirmed) { const { a, n, k } = res.value; const newModalLog = { UID: "F"+Date.now(), Tanggal: new Date().toISOString().split('T')[0], Jenis_Kas: a === 'TAMBAH' ? "PENDAPATAN" : "PENGELUARAN", Kategori: a === 'TAMBAH' ? "MODAL MASUK" : "KOREKSI MODAL", Keterangan: k, Nominal: n, Laba_Tercatat: 0 };
            dbFinance.push(newModalLog); 
            
            // TANDA PERBAIKAN: Kirim parameter objek spesifik ke Firestore
            await AppStorage.save('finance', newModalLog); 
            
            UI.toast("Tersimpan!", "success"); 
            UI.renderAdminFinanceView(); } }); },
    
    showUserModal: function(uid = null) { 
        let u = uid ? dbUsers.find(x => x.UID === uid) : null; 
        Swal.fire({ 
            title: u ? 'Edit Profil' : 'Tambah Akun', 
            html: `<input id="mu-nama" type="text" class="swal2-input w-100 m-0 mb-2" placeholder="Nama Lengkap" value="${u ? u.Nama_Lengkap : ''}">
                   <input id="mu-user" type="text" class="swal2-input w-100 m-0 mb-2" placeholder="Username" value="${u ? u.Username : ''}" ${u?'readonly':''}>
                   <input id="mu-hp" type="text" class="swal2-input w-100 m-0 mb-2" placeholder="No HP" value="${u ? u.No_HP : ''}">
                   <input id="mu-pass" type="password" class="swal2-input w-100 m-0 mb-2" placeholder="${u ? 'Kosongkan jika tak diubah' : 'Password'}">
                   <select id="mu-role" class="swal2-select w-100 m-0">
                       <option value="Pelanggan" ${u && u.Role === 'Pelanggan' ? 'selected' : ''}>Pelanggan</option>
                       <option value="Agen" ${u && u.Role === 'Agen' ? 'selected' : ''}>Agen</option>
                       <option value="Admin" ${u && u.Role === 'Admin' ? 'selected' : ''}>Admin</option>
                   </select>`, 
            showCancelButton: true, 
            preConfirm: () => { return { n: document.getElementById('mu-nama').value, hp: document.getElementById('mu-hp').value, u: document.getElementById('mu-user').value, p: document.getElementById('mu-pass').value, r: document.getElementById('mu-role').value } } 
        }).then(async res => { 
            if(res.isConfirmed) { 
                try {
                    let d = res.value; 
                    if(!d.n || !d.u || (!u && !d.p)) return Swal.fire('Gagal', 'Lengkapi data', 'error'); 
                    
                    if(u) { 
                        u.Nama_Lengkap = d.n; 
                        u.No_HP = d.hp; 
                        u.Role = d.r; 
                        if(d.p) u.Password = d.p; 
                        UI.toast("Diperbarui!", "success"); 
                    } else { 
                        let newUid = "U"+Date.now();
                        dbUsers.push({ UID: newUid, Username: d.u, Password: d.p, Nama_Lengkap: d.n, No_HP: d.hp, Role: d.r, Status: "AKTIF", Timestamp: new Date().toISOString() }); 
                        UI.toast("Berhasil ditambahkan!", "success"); 
                    } 
                    await AppStorage.save();
                    UI.renderAdminUsersView(); 
                } catch(err) { AppLogger.logError(err, "API.showUserModal"); }
            } 
        }); 
    },
    
    toggleUserStatus: async function(uid) { try { const u=dbUsers.find(x=>x.UID===uid); u.Status = u.Status==="AKTIF"?"NONAKTIF":"AKTIF"; await AppStorage.save(); UI.renderAdminUsersView(); } catch(err){ AppLogger.logError(err, "API.toggleUserStatus"); } },

    deleteUser: async function(uid) {
        if (sessionUser && sessionUser.UID === uid) {
            return Swal.fire("Akses Ditolak", "Anda tidak dapat menghapus akun Anda sendiri.", "error");
        }

        Swal.fire({
            title: 'Hapus Akun Ini?',
            text: "Profil akun ini akan dihapus permanen dari Cloud.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    UI.showLoading(true, "Menghapus akun...");
                    
                    if (isFirebaseActive && navigator.onLine && !isManualLocalMode) {
                        await db.collection('users').doc(uid).delete();
                    }

                    if (typeof dbUsers !== 'undefined') {
                        dbUsers = dbUsers.filter(u => u.UID !== uid);
                    }
                    
                    await AppStorage.save();
                    UI.showLoading(false);
                    Swal.fire('Terhapus!', 'Akun telah berhasil dihapus.', 'success');

                    if (typeof UI.searchUsers === 'function') {
                        UI.searchUsers('FIRST'); 
                    } else if (typeof UI.renderAdminUsersView === 'function') {
                        UI.renderAdminUsersView();
                    }

                } catch (err) {
                    UI.showLoading(false);
                    AppLogger.logError(err, "API.deleteUser");
                    Swal.fire('Gagal', 'Gagal menghapus akun: ' + err.message, 'error');
                }
            }
        });
    },
    
    addOpsCost: async function(n, k) { 
        try { 
            const nom = parseInt(n); 
            if(isNaN(nom) || nom <= 0 || !k) return UI.toast("Invalid", "error"); 
            
            const newOpsLog = { UID: "F"+Date.now(), Tanggal: new Date().toISOString().split('T')[0], Jenis_Kas: "BIAYA_OPS", Kategori: "OPERASIONAL", Keterangan: k, Nominal: nom, Laba_Tercatat: 0 };
            dbFinance.push(newOpsLog); 
            
            // TANDA PERBAIKAN: Kirim parameter objek spesifik operasional ke Cloud
            await AppStorage.save('finance', newOpsLog); 
            
            UI.toast("Biaya dicatat!", "success"); 
            UI.renderAdminFinanceView(); 
        } catch(err){ AppLogger.logError(err, "API.addOpsCost"); } 
    },
    
    exportFinancePDF: function() {
        try {
            const filter = document.getElementById('finance-filter').value; const today = new Date().toISOString().split('T')[0]; const currMonth = today.substring(0,7);
            let data = dbFinance; if(filter === 'TODAY') data = dbFinance.filter(f => f.Tanggal === today); else if(filter === 'MONTH') data = dbFinance.filter(f => f.Tanggal.startsWith(currMonth));
            const doc = new jsPDF(); doc.text("Laporan Keuangan Terpadu", 14, 15); doc.setFontSize(10); doc.text(`Periode Filter: ${filter}`, 14, 22);
            let body = []; let dInBruto = 0, dInNet = 0, dOut = 0, bOps = 0, lKotor = 0, komisiAgen = 0, totalModalAwal = 0;
            dbFinance.forEach(f => { if(f.Kategori === "MODAL AWAL" || f.Kategori === "MODAL MASUK") totalModalAwal += f.Nominal; if(f.Kategori === "KOREKSI MODAL") totalModalAwal -= f.Nominal; });
            data.forEach(f => { let itemKomisi = 0; if(f.Keterangan && f.Keterangan.includes('Agen: Potong')) { const match = f.Keterangan.match(/Agen: Potong Rp ([\d.]+)/); if (match) itemKomisi = parseInt(match[1].replace(/\./g, '')); komisiAgen += itemKomisi; } let debit = f.Jenis_Kas === "PENDAPATAN" ? f.Nominal : 0; let kredit = (f.Jenis_Kas === "PENGELUARAN" || f.Jenis_Kas === "BIAYA_OPS") ? f.Nominal : 0; if(f.Jenis_Kas === "PENDAPATAN") { dInNet += f.Nominal; dInBruto += (f.Nominal + itemKomisi); } else if(f.Jenis_Kas === "PENGELUARAN") dOut += f.Nominal; else if(f.Jenis_Kas === "BIAYA_OPS") bOps += f.Nominal; lKotor += f.Laba_Tercatat; let ketFull = f.Keterangan; if (f.Laba_Tercatat && f.Laba_Tercatat !== 0) ketFull += `\n(Laba: Rp ${f.Laba_Tercatat.toLocaleString('id-ID')})`; body.push([f.Tanggal, f.Kategori, ketFull, UI.formatRp(debit), UI.formatRp(kredit)]); });
            let labaBersih = lKotor - bOps; let saldoKasAktual = this.getCurrentBalance();
            doc.setFontSize(9); doc.text(`Pendapatan Kotor (Bruto): ${UI.formatRp(dInBruto)}`, 14, 30); doc.text(`Potongan Komisi Agen: -${UI.formatRp(komisiAgen)}`, 14, 35); doc.text(`Pendapatan Akhir (Netto): ${UI.formatRp(dInNet)}`, 14, 40); doc.text(`Pengeluaran (Kas Keluar): ${UI.formatRp(dOut)}`, 100, 30); doc.text(`Biaya Operasional: ${UI.formatRp(bOps)}`, 100, 35); doc.text(`Sisa Modal (Kas Aktual): ${UI.formatRp(saldoKasAktual)}`, 100, 40);
            doc.autoTable({ startY: 48, head: [['Tanggal', 'Kategori', 'Keterangan Transaksi', 'Debit (Masuk)', 'Kredit (Keluar/Ops)']], body: body }); doc.save(`Laporan_Keuangan_${filter}.pdf`);
        } catch(err) { AppLogger.logError(err, "API.exportFinancePDF"); }
    },
    
    exportAdvancedRecap: function(dateStart, dateEnd, selectedUser, transType) {
        try {
            let data = dbAppointments.filter(a => a.Status_Janji === 'SELESAI');
            if(dateStart) data = data.filter(a => a.Tanggal >= dateStart); if(dateEnd) data = data.filter(a => a.Tanggal <= dateEnd); if(selectedUser !== 'ALL') data = data.filter(a => a.Username === selectedUser);
            if(transType !== 'ALL') { if(transType === 'EMAS') data = data.filter(a => a.Jenis_Transaksi.includes('EMAS') || a.Jenis_Transaksi === 'GABUNGAN'); else if(transType === 'PERAK') data = data.filter(a => a.Items.some(i => i.Type === 'SILVER')); else if(transType === 'JASA') data = data.filter(a => a.Jenis_Transaksi.includes('JASA') || a.Jenis_Transaksi === 'GABUNGAN'); }
            if(data.length === 0) return Swal.fire("Kosong", "Tidak ada data yang sesuai filter.", "info");
            const doc = new jsPDF(); doc.setFontSize(14); doc.text("Rekapitulasi Transaksi", 14, 15); doc.setFontSize(9); doc.text(`Periode: ${dateStart || 'Awal'} s/d ${dateEnd || 'Akhir'}`, 14, 22); doc.text(`Akun: ${selectedUser === 'ALL' ? 'Semua Akun' : selectedUser}`, 14, 27); doc.text(`Jenis Transaksi: ${transType}`, 14, 32);
            let body = []; let totalNet = 0; let totalKomisi = 0; data.forEach(a => { let itemsStr = a.Items.map(i => `${i.Qty}x ${i.Type==='JASA'?i.Nama:i.Kategori+' '+i.Kadar}`).join(', '); let komisiStr = a.Komisi_Agen ? UI.formatRp(a.Komisi_Agen) : '-'; body.push([ a.Tanggal, a.UID.substring(a.UID.length-6), a.Username, a.Jenis_Transaksi, itemsStr, komisiStr, a.Net_Total >= 0 ? `+${UI.formatRp(a.Net_Total)}` : `-${UI.formatRp(Math.abs(a.Net_Total))}` ]); totalNet += a.Net_Total; totalKomisi += (a.Komisi_Agen || 0); });
            doc.autoTable({ startY: 38, head: [['Tanggal', 'ID', 'Pelanggan', 'Jenis', 'Item', 'Komisi Agen', 'Net Total']], body: body, styles: { fontSize: 8 } }); doc.text(`Total Komisi Agen Dibayarkan: ${UI.formatRp(totalKomisi)}`, 14, doc.lastAutoTable.finalY + 10); doc.save(`Rekapitulasi_Data_${new Date().getTime()}.pdf`);
        } catch(err) { AppLogger.logError(err, "API.exportAdvancedRecap"); }
    },
    
    shareFinanceWA: function() {
        try {
            const filter = document.getElementById('finance-filter').value; const today = new Date().toISOString().split('T')[0]; const currMonth = today.substring(0,7);
            let data = dbFinance; if(filter === 'TODAY') data = dbFinance.filter(f => f.Tanggal === today); else if(filter === 'MONTH') data = dbFinance.filter(f => f.Tanggal.startsWith(currMonth));
            let dInBruto = 0, dInNet = 0, dOut = 0, bOps = 0, lKotor = 0, komisiAgen = 0; data.forEach(f => { let itemKomisi = 0; if(f.Keterangan && f.Keterangan.includes('Agen: Potong')) { const match = f.Keterangan.match(/Agen: Potong Rp ([\d.]+)/); if (match) itemKomisi = parseInt(match[1].replace(/\./g, '')); komisiAgen += itemKomisi; } if(f.Jenis_Kas === "PENDAPATAN") { dInNet += f.Nominal; dInBruto += (f.Nominal + itemKomisi); } else if(f.Jenis_Kas === "PENGELUARAN") dOut += f.Nominal; else if(f.Jenis_Kas === "BIAYA_OPS") bOps += f.Nominal; lKotor += f.Laba_Tercatat; });
            let txt = `*LAPORAN KEUANGAN (${filter})*\n\n`; txt += `Pendapatan Kotor (Bruto): ${UI.formatRp(dInBruto)}\n`; txt += `Potongan Komisi Agen: -${UI.formatRp(komisiAgen)}\n`; txt += `Pendapatan Akhir (Netto): ${UI.formatRp(dInNet)}\n\n`; txt += `Pengeluaran (Kas Keluar): ${UI.formatRp(dOut)}\n`; txt += `Biaya Operasional: ${UI.formatRp(bOps)}\n`; txt += `Laba Bersih Usaha: ${UI.formatRp(lKotor - bOps)}\n\n`; txt += `Saldo Kas Aktual: ${UI.formatRp(this.getCurrentBalance())}\n`; window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(txt), '_blank');
        } catch(err) { AppLogger.logError(err, "API.shareFinanceWA"); }
    },
    
    exportBackup: function() {
        try {
            const restoreMode = document.getElementById('export-mode').value; let dataToExport = { appConfig, GLOBAL_MULTIPLIER, GLOBAL_MULTIPLIER_SILVER };
            if (restoreMode === 'ALL' || restoreMode === 'TRANSAKSI') { dataToExport.dbAppointments = dbAppointments; dataToExport.dbFinance = dbFinance; dataToExport.dbTestimonials = dbTestimonials; }
            if (restoreMode === 'ALL' || restoreMode === 'HARGA') { dataToExport.dbGoldSettings = dbGoldSettings; dataToExport.dbServices = dbServices; dataToExport.dbTemplates = dbTemplates; }
            if (restoreMode === 'ALL') { dataToExport.dbUsers = dbUsers; }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2)); const dlAnchorElem = document.createElement('a'); dlAnchorElem.setAttribute("href", dataStr); dlAnchorElem.setAttribute("download", "Backup_ERP_Emas_" + new Date().toISOString().split('T')[0] + ".json"); dlAnchorElem.click(); UI.toast("Backup berhasil diunduh", "success");
        } catch(err) { AppLogger.logError(err, "API.exportBackup"); }
    },
    
    importBackup: function() {
        const fileIn = document.getElementById('file-restore'); if(!fileIn.files.length) return Swal.fire('Error', 'Pilih file backup .json dulu!', 'warning');
        const restoreMode = document.getElementById('restore-mode').value; const file = fileIn.files[0]; const reader = new FileReader();
        reader.onload = async (e) => { 
            try { 
                const data = JSON.parse(e.target.result); 
                if (restoreMode === 'ALL' || restoreMode === 'TRANSAKSI') { if(data.dbAppointments) dbAppointments = data.dbAppointments; if(data.dbFinance) dbFinance = data.dbFinance; if(data.dbTestimonials) dbTestimonials = data.dbTestimonials; } 
                if (restoreMode === 'ALL' || restoreMode === 'HARGA') { if(data.dbGoldSettings) dbGoldSettings = data.dbGoldSettings; if(data.dbServices) dbServices = data.dbServices; if(data.dbTemplates) dbTemplates = data.dbTemplates; if(data.GLOBAL_MULTIPLIER) GLOBAL_MULTIPLIER = data.GLOBAL_MULTIPLIER; if(data.GLOBAL_MULTIPLIER_SILVER) GLOBAL_MULTIPLIER_SILVER = data.GLOBAL_MULTIPLIER_SILVER; } 
                if (restoreMode === 'ALL') { if(data.dbUsers) dbUsers = data.dbUsers; if(data.appConfig) appConfig = Object.assign(appConfig, data.appConfig); } 
                await AppStorage.save(); 
                Swal.fire('Berhasil', 'Data yang dipilih telah dipulihkan. Halaman akan dimuat ulang.', 'success').then(() => { location.reload(); }); 
            } catch(err) { 
                AppLogger.logError(err, "API.importBackup");
                Swal.fire('Gagal', 'Format file backup tidak valid atau rusak!', 'error'); 
            } 
        }; 
        reader.readAsText(file);
    },
    
    clearData: function() {
        const mode = document.getElementById('clear-mode').value;
        let warningText = mode === 'TRANSAKSI'
            ? 'Semua data riwayat transaksi dan kas keuangan akan dihapus secara permanen. Lanjutkan?'
            : 'PERINGATAN KERAS! Seluruh data (Transaksi, Harga, Jasa, Testimoni, dll) akan dihapus permanen (Reset Pabrik). Lanjutkan?';

        Swal.fire({
            title: 'Konfirmasi Eksekusi',
            text: warningText,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Hapus Data!',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    UI.showLoading(true, "Mengeksekusi penghapusan...");

                    const deleteFromFirebase = async (collectionName, localArray) => {
                        if (isFirebaseActive && !isManualLocalMode) {
                            for (let i = 0; i < localArray.length; i += 400) {
                                const chunk = localArray.slice(i, i + 400);
                                const batch = db.batch();
                                chunk.forEach(item => {
                                    if (item.UID) batch.delete(db.collection(collectionName).doc(item.UID));
                                });
                                await batch.commit();
                            }
                        }
                    };

                    if (mode === 'TRANSAKSI') {
                        await deleteFromFirebase('appointments', dbAppointments);
                        await deleteFromFirebase('finance', dbFinance);
                        dbAppointments = [];
                        dbFinance = [];
                    } else if (mode === 'ALL') {
                        await deleteFromFirebase('appointments', dbAppointments);
                        await deleteFromFirebase('finance', dbFinance);
                        await deleteFromFirebase('gold_settings', dbGoldSettings);
                        await deleteFromFirebase('services', dbServices);
                        await deleteFromFirebase('templates', dbTemplates);
                        await deleteFromFirebase('testimonials', dbTestimonials);

                        dbAppointments = [];
                        dbFinance = [];
                        dbGoldSettings = [];
                        dbServices = [];
                        dbTemplates = [];
                        dbTestimonials = [];
                    }

                    await AppStorage.save();
                    UI.showLoading(false);

                    Swal.fire('Terhapus!', 'Eksekusi penghapusan data berhasil.', 'success')
                        .then(() => {
                            window.location.reload(); 
                        });

                } catch (err) {
                    UI.showLoading(false);
                    AppLogger.logError(err, "API.clearData");
                    Swal.fire('Error', 'Gagal mengeksekusi penghapusan: ' + err.message, 'error');
                }
            }
        });
    },

    // --- FUNGSI BARU: PERPINDAHAN POSISI LINTAS HALAMAN TANPA SERET ---
    moveGoldPositionManual: async function(uid, currentPos) {
        const totalData = dbGoldSettings.length;
        
        const { value: targetPosInput } = await Swal.fire({
            title: 'Pindah Posisi Master Harga',
            html: `Posisi Sekarang: <b>Nomor Urut ${currentPos}</b><br><small class="text-muted">Masukkan nomor urut baru yang Anda tuju (1 sampai ${totalData})</small>`,
            input: 'number',
            inputValue: currentPos,
            inputAttributes: { min: 1, max: totalData, step: 1 },
            showCancelButton: true,
            confirmButtonText: 'Pindahkan Sekarang',
            confirmButtonColor: '#3b82f6',
            inputValidator: (value) => {
                if (!value || isNaN(value) || value < 1 || value > totalData) {
                    return `Nomor urut harus di antara 1 sampai ${totalData}!`;
                }
            }
        });

        if (targetPosInput) {
            const oldAbsoluteIndex = currentPos - 1;
            const newAbsoluteIndex = parseInt(targetPosInput) - 1;

            if (oldAbsoluteIndex === newAbsoluteIndex) return; // Tidak ada perubahan

            // Panggil kembali fungsi reorder internal dengan parameter index absolut
            await this.reorderGoldDragDrop(oldAbsoluteIndex, newAbsoluteIndex);
            
            // Hitung otomatis di halaman mana posisi baru berada agar UI langsung fokus ke halaman tersebut
            const targetPage = Math.ceil(parseInt(targetPosInput) / goldPaging.limit);
            goldPaging.page = targetPage;
            
            UI.renderGoldSettingsView();
            UI.toast(`Berhasil dipindahkan ke nomor urut ${targetPosInput}`, "success");
        }
    }
}; // --- AKHIR DARI OBJEK API ---

// ==========================================
// INISIALISASI LIFECYCLE & INTERVAL SCRIPT
// ==========================================

setInterval(() => {
    const now = new Date(); 
    const dateOpts = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }; 
    const timeOpts = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const clockEl = document.getElementById('live-clock');
    if(clockEl) clockEl.innerText = now.toLocaleDateString('id-ID', dateOpts) + ' | ' + now.toLocaleTimeString('id-ID', timeOpts);
}, 1000);

document.addEventListener('DOMContentLoaded', () => { 
    Auth.init(); 

    setTimeout(() => {
        API.autoCompleteTransactions();
    }, 3000);

    setInterval(() => {
        API.autoCompleteTransactions();
    }, 60000);
});