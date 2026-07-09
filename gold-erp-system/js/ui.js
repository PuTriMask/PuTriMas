const UI = {
    isLightMode: false, mapInstance: null, mapMarker: null,
    
    showNetworkDetails: function() {
        let statusHtml = '';
        if (isManualLocalMode) {
            statusHtml = `<div class="text-danger fw-bold mb-2"><i class="fa-solid fa-server fa-2x mb-2"></i><br>MODE LOKAL MANUAL AKTIF</div>
                          <p class="small text-muted">Aplikasi sengaja diputus dari Cloud. Semua data hanya tersimpan di perangkat ini.</p>`;
        } else if (navigator.onLine && isFirebaseActive) {
            statusHtml = `<div class="text-success fw-bold mb-2"><i class="fa-solid fa-cloud-check fa-2x mb-2"></i><br>ONLINE & TERSINKRONISASI</div>
                          <p class="small text-muted">Aplikasi terhubung ke Cloud. Semua data Anda aman tersimpan di server.</p>`;
        } else {
            statusHtml = `<div class="text-warning fw-bold mb-2"><i class="fa-solid fa-cloud-arrow-up fa-2x mb-2" style="animation: netPulse 1.5s infinite;"></i><br>OFFLINE (MENYIMPAN LOKAL)</div>
                          <p class="small text-muted">Koneksi internet terputus. Anda tetap bisa menginput data. Sistem akan otomatis mengirim data ke Cloud saat internet kembali stabil.</p>`;
        }
        Swal.fire({
            title: 'Status Sinkronisasi',
            html: statusHtml,
            confirmButtonColor: '#d4af37',
            background: 'var(--bg-card)',
            color: 'var(--text-light)'
        });
    },

    checkAgenRole: function(checkbox) {
        if (sessionUser && sessionUser.Role === 'Pelanggan') {
            checkbox.checked = false;
            Swal.fire('Akses Ditolak', 'Anda bukan Agen. Silakan hubungi ADM untuk mendaftar sebagai Agen.', 'error');
        }
    },
    
    updateRunningText: function() {
        let customText = appConfig.runningTextCustom || "Selamat datang di Sistem ERP Jual Emas Untung.";
        
        let priceListStr = "";
        if(dbGoldSettings.length > 0) {
            priceListStr = dbGoldSettings.map(g => `${g.Kadar} ${g.Varian} (Beli: ${this.formatRp(g.Harga_Beli)} | Jual: ${this.formatRp(g.Harga_Jual)})`).join(' 🔹 ');
        } else {
            priceListStr = `HARGA EMAS DUNIA: Rp ${GLOBAL_MULTIPLIER}/mal 🔹 HARGA PERAK: Rp ${GLOBAL_MULTIPLIER_SILVER}/mal`;
        }
        
        let priceText = ` | 🌟 DAFTAR HARGA UPDATE: 🔹 ${priceListStr} |`;
        let trxText = " INFO TRANSAKSI: ";
        let recentApt = dbAppointments.slice(-5).reverse();
        if(recentApt.length > 0) {
            recentApt.forEach(a => {
                let shortItem = a.Items[0] ? (a.Items[0].Type === 'JASA' ? a.Items[0].Nama : `${a.Items[0].Gram}g ${a.Items[0].Kategori}`) : 'Item';
                trxText += ` 🔹 ${a.Username} (${shortItem}) - ${a.Status_Janji.replace(/_/g, ' ')}`;
                if(a.Status_Janji === 'SELESAI') trxText += ` (${this.formatRp(Math.abs(a.Net_Total))})`;
            });
        } else {
            trxText += " Belum ada transaksi masuk hari ini.";
        }
        const contentEl = document.getElementById('running-text-content');
        if(contentEl) {
            contentEl.innerText = customText + priceText + trxText;
            contentEl.style.animationDuration = (appConfig.runningTextSpeed || 20) + 's';
        }
    },
    
    showOpsModal: function() { 
        Swal.fire({ 
            title: 'Biaya Operasional', 
            html: `<input id="ops-nom" type="number" class="swal2-input w-100 m-0 mb-3" placeholder="Nominal Biaya (Rp)"><input id="ops-ket" type="text" class="swal2-input w-100 m-0" placeholder="Keterangan (Cth: Listrik, Gaji)">`, 
            showCancelButton: true, 
            confirmButtonText: 'Simpan Biaya', 
            preConfirm: () => { 
                return { n: document.getElementById('ops-nom').value, k: document.getElementById('ops-ket').value }; 
            } 
        }).then(res => { 
            if(res.isConfirmed) API.addOpsCost(res.value.n, res.value.k); 
        }); 
    },
    
    verifyBackupAccess: function() { 
        Swal.fire({ 
            title: 'Verifikasi Keamanan', 
            input: 'password', 
            inputLabel: 'Masukkan Password Admin', 
            inputPlaceholder: 'Password', 
            showCancelButton: true 
        }).then((result) => { 
            if (result.isConfirmed && result.value === sessionUser.Password) { 
                Swal.fire({ 
                    title: 'Manajemen Data & Backup', 
                    html: `<div class="mb-3 text-start"><label class="form-label small text-muted">Mode Pencadangan / Ekspor</label><select id="export-mode" class="swal2-select w-100 m-0 mb-2"><option value="ALL">Semua Data (Full Backup)</option><option value="TRANSAKSI">Hanya Data Transaksi & Keuangan</option><option value="HARGA">Hanya Data Harga, Jasa, & Template</option></select><button class="btn btn-outline-success w-100" onclick="API.exportBackup()"><i class="fa-solid fa-download"></i> Unduh File Backup</button></div><hr class="border-secondary my-4"><div class="mb-3 text-start"><label class="form-label small text-muted text-warning"><i class="fa-solid fa-upload"></i> Restore / Pulihkan Data</label><input type="file" id="file-restore" class="form-control form-control-sm mb-2 text-white bg-dark" accept=".json"><select id="restore-mode" class="swal2-select w-100 m-0 mb-2"><option value="ALL">Timpa Semua Data (Full Restore)</option><option value="TRANSAKSI">Timpa Data Transaksi Saja</option><option value="HARGA">Timpa Data Harga/Jasa Saja</option></select><button class="btn btn-outline-warning w-100" onclick="API.importBackup()"><i class="fa-solid fa-clock-rotate-left"></i> Jalankan Pemulihan</button></div><hr class="border-secondary my-4"><div class="text-start"><label class="form-label small text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Zona Bahaya (Reset / Hapus)</label><select id="clear-mode" class="swal2-select w-100 m-0 mb-2 border-danger"><option value="TRANSAKSI">Kosongkan Riwayat Transaksi Saja</option><option value="ALL">Reset Pabrik (Hapus Semuanya)</option></select><button class="btn btn-danger w-100" onclick="API.clearData()"><i class="fa-solid fa-trash-can"></i> Eksekusi Penghapusan</button></div>`, 
                    showConfirmButton: false, 
                    showCancelButton: true, 
                    cancelButtonText: 'Tutup Menu Keamanan', 
                    width: '500px' 
                }); 
            } else if(result.isConfirmed) { 
                Swal.fire('Akses Ditolak', 'Password salah.', 'error'); 
            } 
        }); 
    },
    
    showAdvancedRecapModal: function() { 
        let userOpts = '<option value="ALL">Semua Akun</option>'; 
        dbUsers.filter(u => u.Role !== 'Admin').forEach(u => { 
            userOpts += `<option value="${u.Username}">${u.Username} - ${u.Nama_Lengkap}</option>`; 
        }); 
        Swal.fire({ 
            title: 'Tarik Rekap Lanjutan (PDF)', 
            html: `<div class="text-start"><label class="small text-muted mb-1">Rentang Tanggal (Mulai)</label><input type="date" id="rekap-start" class="swal2-input w-100 m-0 mb-2"><label class="small text-muted mb-1">Rentang Tanggal (Akhir)</label><input type="date" id="rekap-end" class="swal2-input w-100 m-0 mb-3"><label class="small text-muted mb-1">Filter Akun Spesifik</label><select id="rekap-user" class="swal2-select w-100 m-0 mb-3">${userOpts}</select><label class="small text-muted mb-1">Filter Jenis Item (Opsional)</label><select id="rekap-type" class="swal2-select w-100 m-0 mb-3"><option value="ALL">Semua Jenis Transaksi</option><option value="EMAS">Khusus Jual/Beli Emas</option><option value="PERAK">Khusus Silver / Perak</option><option value="JASA">Khusus Layanan Jasa (Sepuh/Patri)</option></select></div>`, 
            showCancelButton: true, 
            confirmButtonText: '<i class="fa-solid fa-file-pdf"></i> Generate PDF', 
            confirmButtonColor: '#10b981', 
            preConfirm: () => { 
                return { start: document.getElementById('rekap-start').value, end: document.getElementById('rekap-end').value, user: document.getElementById('rekap-user').value, type: document.getElementById('rekap-type').value }; 
            } 
        }).then(res => { 
            if(res.isConfirmed) API.exportAdvancedRecap(res.value.start, res.value.end, res.value.user, res.value.type); 
        }); 
    },
    
    viewUserReport: function(username) { 
        const u = dbUsers.find(x => x.Username === username); if(!u) return; 
        const apts = dbAppointments.filter(a => a.Username === username && a.Status_Janji === 'SELESAI'); 
        let totalBeli = 0; let totalJual = 0; let itemList = {}; 
        apts.forEach(a => { 
            if (a.Net_Total < 0) totalBeli += Math.abs(a.Net_Total); else totalJual += a.Net_Total; 
            a.Items.forEach(i => { 
                let key = i.Type === 'JASA' ? `Jasa ${i.Nama}` : `${i.Kategori} ${i.Kadar} ${i.Varian}`; 
                if(!itemList[key]) itemList[key] = { qty: 0, gram: 0 }; 
                itemList[key].qty += i.Qty; 
                if(i.Type !== 'JASA') itemList[key].gram += i.Gram; 
            }); 
        }); 
        let itemsHtml = Object.keys(itemList).map(k => `<li>${k}: <b>${itemList[k].qty}x</b> ${itemList[k].gram>0?`(${itemList[k].gram.toFixed(2)}g)`:''}</li>`).join(''); 
        if(!itemsHtml) itemsHtml = "<li class='text-muted'>Belum ada histori selesai.</li>"; 
        Swal.fire({ 
            title: `Histori Akun: ${username}`, 
            html: `<div class="text-start" style="font-size: 0.9rem;"><div class="mb-2"><span class="text-muted">Total Beli/Jasa (Debit Kas):</span><br><b class="text-success fs-5">${this.formatRp(totalBeli)}</b></div><div class="mb-3"><span class="text-muted">Total Buyback (Kredit Kas):</span><br><b class="text-danger fs-5">${this.formatRp(totalJual)}</b></div><div class="p-2 border border-secondary rounded"><b class="text-warning">Rekap Keseluruhan Item:</b><ul class="mt-2 mb-0 ps-3">${itemsHtml}</ul></div></div>`, 
            confirmButtonColor: '#d4af37' 
        }); 
    },
    
    previewHPP: function() { 
        const bahan = document.getElementById('gold-bahan').value; 
        const f = parseFloat(document.getElementById('gold-faktor').value); 
        let currMult = bahan === 'SILVER' ? GLOBAL_MULTIPLIER_SILVER : GLOBAL_MULTIPLIER; 
        document.getElementById('preview-global').innerText = currMult; 
        if(!isNaN(f)) { 
            document.getElementById('preview-faktor').innerText = f; 
            document.getElementById('preview-hpp').innerText = this.formatRp(Math.round(f * currMult)); 
        } else { 
            document.getElementById('preview-faktor').innerText = 0; 
            document.getElementById('preview-hpp').innerText = "Rp 0"; 
        } 
    },
    
    copyGoldSetting: function(uid) { 
        const tar = dbGoldSettings.find(g => g.UID === uid); if(!tar) return; 
        document.getElementById('gold-bahan').value = tar.Bahan || 'EMAS'; 
        document.getElementById('gold-kadar').value = tar.Kadar; 
        document.getElementById('gold-varian').value = tar.Varian + " (Copy)"; 
        document.getElementById('gold-faktor').value = tar.Faktor_Varian; 
        document.getElementById('gold-margin-type').value = tar.Tipe_Margin; 
        document.getElementById('gold-margin-value').value = tar.Nilai_Margin; 
        this.previewHPP(); this.toast("Data disalin ke form"); 
        window.scrollTo({top: 0, behavior: 'smooth'}); 
    },
    
    editGoldSetting: function(uid) { 
        const tar = dbGoldSettings.find(g => g.UID === uid); if(!tar) return; 
        document.getElementById('gold-bahan').value = tar.Bahan || 'EMAS'; 
        document.getElementById('gold-kadar').value = tar.Kadar; 
        document.getElementById('gold-varian').value = tar.Varian; 
        document.getElementById('gold-faktor').value = tar.Faktor_Varian; 
        document.getElementById('gold-margin-type').value = tar.Tipe_Margin; 
        document.getElementById('gold-margin-value').value = tar.Nilai_Margin; 
        editGoldId = uid; 
        document.getElementById('btn-submit-gold').innerText = "Update Parameter"; 
        document.getElementById('btn-cancel-edit-gold').classList.remove('d-none'); 
        this.previewHPP(); this.toast("Mode Edit Aktif", "info"); 
        window.scrollTo({top: 0, behavior: 'smooth'}); 
    },
    
    cancelEditGold: function() { 
        editGoldId = null; 
        document.getElementById('form-manage-emas').reset(); 
        document.getElementById('btn-submit-gold').innerText = "Simpan Parameter Kadar"; 
        document.getElementById('btn-cancel-edit-gold').classList.add('d-none'); 
        this.previewHPP(); 
    },
    
    renderTemplates: function() { 
        const sel = document.getElementById('template-select'); 
        sel.innerHTML = '<option value="">-- Buat Baru (Kosong) --</option>'; 
        dbTemplates.forEach(t => { 
            sel.innerHTML += `<option value="${t.UID}">${t.Kadar} - ${t.Varian} (F: ${t.Faktor})</option>`; 
        }); 
    },
    
    applyTemplate: function() { 
        const sid = document.getElementById('template-select').value; 
        if(!sid) { document.getElementById('form-manage-emas').reset(); this.previewHPP(); return; } 
        const t = dbTemplates.find(x => x.UID === sid); 
        if(t) { 
            document.getElementById('gold-kadar').value = t.Kadar; 
            document.getElementById('gold-varian').value = t.Varian; 
            document.getElementById('gold-faktor').value = t.Faktor; 
            this.previewHPP(); this.toast("Template diterapkan"); 
        } 
    },
editAppointment: function(uid) { 
        const apt = dbAppointments.find(a => a.UID === uid); if(!apt) return; 
        editAptId = uid; 
        currentCart = JSON.parse(JSON.stringify(apt.Items)); 
        document.getElementById('apt-date').value = apt.Tanggal; 
        document.getElementById('apt-type').value = apt.Jenis_Transaksi.includes('BELI') ? 'BELI' : 'JUAL'; 
        document.getElementById('apt-location').value = apt.Lokasi_Transaksi || 'TOKO'; 
        document.getElementById('apt-is-agen').checked = apt.Is_Agen || false; 
        if(apt.Lokasi_Transaksi === 'JEMPUT') { 
            document.getElementById('apt-lat').value = apt.Lat || ''; 
            document.getElementById('apt-lng').value = apt.Lng || ''; 
            document.getElementById('apt-address').value = apt.Alamat_Jemput || ''; 
        } 
        this.toggleAddressBox(); this.populateKadarDropdown(); 
        setTimeout(() => { const timeSel = document.getElementById('apt-time'); if(timeSel) timeSel.value = apt.Waktu; }, 100); 
        document.getElementById('title-form-apt').innerHTML = `<i class="fa-solid fa-pen text-warning me-2"></i>Edit Keranjang Transaksi ${uid}`; 
        document.getElementById('btn-submit-apt').innerHTML = `<i class="fa-solid fa-wand-magic-sparkles me-1"></i> Simpan Pembaruan (Checkout)`; 
        this.navigateTo('appointment'); this.renderCart(); this.toast("Mode edit transaksi aktif", "info"); 
    },
    
    editItemPrice: async function(uid, itemIdx) { 
        const apt = dbAppointments.find(a => a.UID === uid); if(!apt) return; 
        const item = apt.Items[itemIdx]; 
        const { value: newPrice } = await Swal.fire({ title: `Edit Harga Item`, html: `Item: <b>${item.Type==='JASA'?item.Nama:item.Kategori+' '+item.Kadar}</b><br><small class="text-muted">Isi dengan nilai total baru untuk item ini.</small>`, input: 'number', inputValue: item.Subtotal, showCancelButton: true }); 
        if(newPrice) { 
            item.Subtotal = parseInt(newPrice); 
            let tEmas = 0, tJasa = 0; apt.Items.forEach(i => { if(i.Type === 'JASA') tJasa += i.Subtotal; else tEmas += i.Subtotal; }); 
            if (apt.Jenis_Transaksi === "GABUNGAN" && apt.MetodePotong === "LANGSUNG") { apt.Total_Hak_Konsumen = tEmas; apt.Total_Tagihan_Jasa = tJasa; apt.Net_Total = tEmas - tJasa; } 
            else if (apt.Jenis_Transaksi.includes("EMAS")) { apt.Total_Hak_Konsumen = tEmas; apt.Net_Total = apt.Jenis_Transaksi.includes("BELI") ? -tEmas : tEmas; } 
            else if (apt.Jenis_Transaksi === "JASA") { apt.Total_Tagihan_Jasa = tJasa; apt.Net_Total = -tJasa; } 
            apt.Kustom_Harga = true; 
            await AppStorage.save(); 
            this.toast("Harga diperbarui", "success"); 
            this.renderAdminLaporanView(); 
        } 
    },
    
    editMarkupApt: async function(uid) { 
        const apt = dbAppointments.find(a => a.UID === uid); if(!apt) return; let currentVal = Math.abs(apt.Net_Total); 
        const { value: actionData } = await Swal.fire({ title: 'Edit Grand Total (Manual)', html: `<div class="text-start mb-3"><label class="small text-muted mb-1">Arah Transaksi Kas</label><select id="markup-dir" class="swal2-select w-100 m-0"><option value="POSITIF" ${apt.Net_Total >= 0 ? 'selected' : ''}>Toko Keluar Uang (Hak Pelanggan)</option><option value="NEGATIF" ${apt.Net_Total < 0 ? 'selected' : ''}>Toko Terima Uang (Tagihan Pelanggan)</option></select></div><div class="text-start"><label class="small text-muted mb-1">Grand Total Final (Rp)</label><input type="number" id="markup-val" class="swal2-input w-100 m-0" value="${currentVal}"></div>`, showCancelButton: true, confirmButtonText: 'Simpan', preConfirm: () => { const d = document.getElementById('markup-dir').value; const v = parseInt(document.getElementById('markup-val').value); if(isNaN(v) || v < 0) return Swal.showValidationMessage('Nominal tidak valid'); return { d, v }; } }); 
        if(actionData) { 
            apt.Net_Total = actionData.d === 'POSITIF' ? actionData.v : -actionData.v; 
            if(actionData.d === 'POSITIF') { apt.Total_Hak_Konsumen = actionData.v; apt.Total_Tagihan_Jasa = 0; } 
            else { apt.Total_Hak_Konsumen = 0; apt.Total_Tagihan_Jasa = actionData.v; } 
            apt.Kustom_Harga = true; 
            await AppStorage.save(); 
            this.toast("Grand Total diubah", "success"); 
            this.renderAdminLaporanView(); 
        } 
    },
    
    updateStoreStatus: function() { 
        const badge = document.getElementById('store-status-badge'); 
        const board = document.getElementById('store-closed-board'); 
        const maintBanner = document.getElementById('global-maintenance-banner'); 
        
        if (badge && board) {
            if(appConfig.storeOpen) { 
                badge.style.display = 'flex'; board.style.display = 'none'; 
            } else { 
                badge.style.display = 'none'; board.style.display = 'flex'; 
                if(document.getElementById('close-reason-text')) document.getElementById('close-reason-text').innerText = appConfig.storeCloseReason || "Sedang istirahat"; 
                if(document.getElementById('open-time-text')) document.getElementById('open-time-text').innerText = "Buka kembali: " + (appConfig.storeOpenTime || "Menunggu konfirmasi"); 
            } 
            if(sessionUser) { badge.style.display = 'none'; board.style.display = 'none'; } 
        }

        // Tampilkan Banner Global dan paksa ke posisi teratas (Meniru referensi yang berhasil)
        if (maintBanner) {
            maintBanner.style.display = appConfig.isMaintenance ? 'block' : 'none';
            
            if(appConfig.isMaintenance) {
                // Pindahkan paksa banner ke layer paling atas (body) agar tidak tertutup elemen lain
                document.body.prepend(maintBanner); 
                maintBanner.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-2 fa-fade"></i> MAAF, SISTEM SEDANG DALAM PERBAIKAN / PEMELIHARAAN. Fitur transaksi dan pendaftaran baru ditutup sementara.';
                maintBanner.style.zIndex = '999999';
            }
        }
    }, 
    
    updateLandingPage: function() { 
        // TANDA PERBAIKAN: Seluruh elemen diuji keberadaannya sebelum diisi data
        if(document.getElementById('landing-promo-text')) document.getElementById('landing-promo-text').innerHTML = appConfig.promoText; 
        const mapCont = document.getElementById('landing-map-container'); 
        if(mapCont && appConfig.mapEmbedUrl) { 
            let iframeSrc = appConfig.mapEmbedUrl; 
            if(!iframeSrc.includes('<iframe')) iframeSrc = `<iframe src="${appConfig.mapEmbedUrl}" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`; 
            let clickUrl = appConfig.mapClickUrl || appConfig.mapEmbedUrl; 
            mapCont.innerHTML = `${iframeSrc}<div class="position-absolute w-100 h-100 top-0 start-0 d-flex justify-content-center align-items-center" style="background: rgba(0,0,0,0.25); cursor:pointer; z-index: 10;" onclick="window.open('${clickUrl}', '_blank')"><button class="btn btn-gold rounded-pill shadow-lg px-4 fw-bold"><i class="fa-solid fa-map-location-dot me-2"></i>Buka di Aplikasi Maps</button></div>`; 
        } 
        
        const tCont = document.getElementById('landing-testimonials'); 
        if (tCont) {
            tCont.innerHTML = ''; 
            const tampilList = dbTestimonials.filter(t => t.Status === 'TAMPIL'); 
            const renderCard = (t) => { let stars = ''; for(let i=0; i<t.Star; i++) stars += '<i class="fa-solid fa-star text-warning"></i>'; return `<div class="p-3 bg-dark rounded border border-secondary w-100 mb-3"><div class="d-flex justify-content-between mb-2"><h6 class="text-white mb-0">${t.Username}</h6><div>${stars}</div></div><p class="small text-muted mb-0 fst-italic">"${t.Text}"</p></div>`; }; 
            if (tampilList.length <= 5) { 
                tampilList.forEach(t => { tCont.innerHTML += renderCard(t); }); 
                if(tampilList.length === 0) tCont.innerHTML = '<div class="text-muted small">Belum ada testimoni.</div>'; 
            } else { 
                let carouselHtml = `<div id="testiCarousel" class="carousel slide" data-bs-ride="carousel" data-bs-interval="3000"><div class="carousel-inner">`; 
                const chunkSize = 2; 
                for (let i = 0; i < tampilList.length; i += chunkSize) { 
                    const chunk = tampilList.slice(i, i + chunkSize); 
                    const activeClass = i === 0 ? 'active' : ''; 
                    carouselHtml += `<div class="carousel-item ${activeClass}"><div class="d-flex flex-column">`; 
                    chunk.forEach(t => { carouselHtml += renderCard(t); }); 
                    carouselHtml += `</div></div>`; 
                } 
                carouselHtml += `</div><button class="carousel-control-prev" type="button" data-bs-target="#testiCarousel" data-bs-slide="prev" style="width: 5%; justify-content: flex-start; left: -15px;"><span class="carousel-control-prev-icon" aria-hidden="true"></span></button><button class="carousel-control-next" type="button" data-bs-target="#testiCarousel" data-bs-slide="next" style="width: 5%; justify-content: flex-end; right: -15px;"><span class="carousel-control-next-icon" aria-hidden="true"></span></button></div>`; 
                tCont.innerHTML = carouselHtml; 
            }
        }
        
        if(document.getElementById('landing-card-emas-title')) document.getElementById('landing-card-emas-title').innerText = appConfig.allowBuy ? "Jual / Beli Emas" : "Jual Emas"; 
    },
    
    promptAdminLogin: function() {
        const offcanvasEl = document.getElementById('landingMenu');
        const bOff = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if(bOff) bOff.hide();

        setTimeout(() => {
            Swal.fire({
                title: 'Akses Admin Khusus',
                html: `
                    <div class="position-relative mt-3">
                        <input type="text" id="admin-user-input" class="form-control form-control-custom w-100 mb-3" placeholder="Masukkan Username Admin" style="color: var(--text-light) !important;">
                        <div class="position-relative">
                            <input type="password" id="admin-pass-input" class="form-control form-control-custom w-100" placeholder="Masukkan Password Admin" style="padding-right: 40px; color: var(--text-light) !important;">
                            <i class="fa-solid fa-eye position-absolute" style="right: 15px; top: 15px; cursor: pointer; color: var(--gold-primary);" onclick="const inp = document.getElementById('admin-pass-input'); if(inp.type === 'password'){inp.type='text'; this.classList.replace('fa-eye', 'fa-eye-slash');}else{inp.type='password'; this.classList.replace('fa-eye-slash', 'fa-eye');}"></i>
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-shield-halved me-1"></i> Verifikasi Otoritas',
                confirmButtonColor: '#dc3545',
                didOpen: () => { document.getElementById('admin-user-input').focus(); },
                preConfirm: () => {
                    const user = document.getElementById('admin-user-input').value;
                    const pass = document.getElementById('admin-pass-input').value;
                    if (!user || !pass) return Swal.showValidationMessage('Username dan Password wajib diisi!');
                    return { user, pass };
                }
            }).then(async res => {
                if(res.isConfirmed) {
                    UI.showLoading(true, "Memverifikasi Otoritas Admin...");
                    const { user, pass } = res.value;
                    const email = user + "@erp.local";

                    try {
                        let targetAdmin = null;

                        if (isFirebaseActive && navigator.onLine && !isManualLocalMode) {
                            const userCredential = await auth.signInWithEmailAndPassword(email, pass);
                            const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
                            
                            if (!userDoc.exists) throw new Error("Profil admin tidak ditemukan di Cloud.");
                            targetAdmin = userDoc.data();
                            
                            localStorage.setItem('erp_offline_admin', JSON.stringify({ u: user, p: pass, data: targetAdmin }));
                        } else {
                            const offlineCache = JSON.parse(localStorage.getItem('erp_offline_admin'));
                            
                            if (offlineCache && offlineCache.u === user && offlineCache.p === pass) {
                                targetAdmin = offlineCache.data;
                            } else {
                                targetAdmin = dbUsers.find(u => u.Username === user && u.Password === pass);
                                if (!targetAdmin) throw new Error("Kredensial salah atau data Admin tidak ada di memori perangkat.");
                            }
                        }

                        if (!targetAdmin || targetAdmin.Role !== 'Admin') {
                            if (isFirebaseActive && navigator.onLine) await auth.signOut();
                            throw new Error("Akses Ditolak! Akun bukan level Admin.");
                        }
                        if (targetAdmin.Status !== "AKTIF") {
                            if (isFirebaseActive && navigator.onLine) await auth.signOut();
                            throw new Error("Akun Admin sedang dibekukan!");
                        }

                        sessionUser = targetAdmin;
                        localStorage.setItem('erp_sessionUser', JSON.stringify(sessionUser));

                        UI.showLoading(false);
                        UI.toast("Otoritas Diverifikasi", "success");
                        this.launchMainApp();

                    } catch (err) {
                        UI.showLoading(false);
                        
                        if (isManualLocalMode) {
                            Swal.fire({
                                title: 'Akses Offline Gagal',
                                text: 'Gagal memverifikasi Admin karena Mode Lokal aktif. Apakah Anda ingin memaksa sistem terhubung kembali ke Cloud (Online)?',
                                icon: 'error',
                                showCancelButton: true,
                                confirmButtonText: '<i class="fa-solid fa-cloud"></i> Ya, Paksa Online',
                                confirmButtonColor: '#10b981',
                                cancelButtonText: 'Batal'
                            }).then((r) => {
                                if (r.isConfirmed) {
                                    isManualLocalMode = false;
                                    localStorage.setItem('erp_manual_local_mode', 'false');
                                    localStorage.setItem('erp_admin_forced_local', 'false');
                                    location.reload(); 
                                }
                            });
                        } else {
                            Swal.fire('Akses Ditolak', err.message || 'Gagal login. Periksa kembali username/password.', 'error');
                        }
                    }
                }
            });
        }, 350);
    },
    
    showKonsumenLoginOpts: function() { 
        Swal.fire({ 
            title: 'Akses Akun', 
            html: '<p class="text-muted small">Pilih metode masuk untuk membuat transaksi</p>', 
            icon: 'question', 
            showDenyButton: true, 
            showCancelButton: true, 
            confirmButtonText: '<i class="fa-solid fa-right-to-bracket"></i> Punya Akun (Masuk)', 
            denyButtonText: '<i class="fa-solid fa-user-plus"></i> Belum Punya Akun', 
            cancelButtonText: 'Akses Cepat (Demo)', 
            confirmButtonColor: '#d4af37', 
            denyButtonColor: '#0dcaf0' 
        }).then(res => { 
            if(res.isConfirmed) { 
                this.switchAuth(false); this.showManualLogin(); 
            } else if(res.isDenied) { 
                this.switchAuth(true); this.showManualLogin(); 
            } else if(res.dismiss === Swal.DismissReason.cancel) { 
                Swal.fire({ 
                    title: 'Pilih Demo Akses', 
                    showCancelButton: true, 
                    confirmButtonText: 'Demo Pelanggan', 
                    cancelButtonText: 'Demo Agen' 
                }).then(r => { 
                    if (r.isConfirmed) Auth.fastLogin('pelanggan'); 
                    else if (r.dismiss === Swal.DismissReason.cancel) Auth.fastLogin('agen'); 
                }); 
            } 
        }); 
    },
    
    switchAuth: function(regMode) { 
        document.getElementById('login-box').classList.toggle('d-none', regMode); 
        document.getElementById('register-box').classList.toggle('d-none', !regMode); 
    },
    
    showManualLogin: function() { 
        document.getElementById('landing-content').style.display = 'none'; 
        document.getElementById('login-form-wrapper').style.display = 'block'; 
        setTimeout(() => { 
            document.getElementById('login-form-wrapper').style.opacity = '1'; 
            document.getElementById('login-form-wrapper').style.pointerEvents = 'auto'; 
        }, 50); 
        const bOff = bootstrap.Offcanvas.getInstance(document.getElementById('landingMenu')); 
        if(bOff) bOff.hide(); 
    },
    
    hideManualLogin: function() { 
        document.getElementById('login-form-wrapper').style.opacity = '0'; 
        document.getElementById('login-form-wrapper').style.pointerEvents = 'none'; 
        setTimeout(() => { 
            document.getElementById('login-form-wrapper').style.display = 'none'; 
            document.getElementById('landing-content').style.display = 'block'; 
        }, 500); 
    },
    
    directToTransaction: function(type) { 
        if(!sessionUser) { 
            Swal.fire({title: 'Perlu Akses', text: 'Silakan masuk/daftar sebagai pelanggan terlebih dahulu untuk membuat pesanan jasa atau jual beli emas.', icon: 'info', confirmButtonText: 'Oke, Lanjut Masuk'}).then(() => this.showKonsumenLoginOpts()); 
            return; 
        } 
        this.navigateTo('appointment'); 
        setTimeout(() => { 
            if(type === 'EMAS') { 
                document.getElementById('item-type-select').value = 'EMAS'; 
            } else { 
                document.getElementById('item-type-select').value = 'JASA'; 
                const jasaSelect = document.getElementById('item-jasa-select'); 
                for(let i=0; i<jasaSelect.options.length; i++) { 
                    if(jasaSelect.options[i].text.toLowerCase().includes(type.toLowerCase())) { 
                        jasaSelect.selectedIndex = i; break; 
                    } 
                } 
            } 
            this.toggleItemFields(); 
            document.getElementById('view-appointment').scrollIntoView({behavior: 'smooth'}); 
        }, 100); 
    },
    
    toggleTopWidget: function() { 
        const content = document.getElementById('top-widget-content'); 
        const icon = document.getElementById('top-widget-toggle-icon'); 
        content.classList.toggle('d-none'); content.classList.toggle('d-flex'); 
        if (content.classList.contains('d-none')) { 
            icon.classList.replace('fa-chevron-right', 'fa-chevron-left'); 
        } else { 
            icon.classList.replace('fa-chevron-left', 'fa-chevron-right'); 
        } 
    },
    
    showCalcModal: function() { 
        this.populateCalculator(); 
        new bootstrap.Modal(document.getElementById('globalCalcModal')).show(); 
    },
    
    populateCalculator: function() { 
        const typeSelectMod = document.getElementById('modal-calc-type'); 
        const currVal = typeSelectMod ? typeSelectMod.value : 'JUAL'; 
        let optHtml = ''; 
        if(appConfig.allowBuy) { optHtml += `<option value="BELI">Beli Emas dari Toko</option>`; } 
        optHtml += `<option value="JUAL">Jual Emas / Pakai Jasa</option>`; 
        if(typeSelectMod) typeSelectMod.innerHTML = optHtml; 
        
        if(appConfig.allowBuy && currVal === 'BELI') { 
            if(typeSelectMod) typeSelectMod.value = 'BELI'; 
        } else { 
            if(typeSelectMod) typeSelectMod.value = 'JUAL'; 
        } 
        
        let selHtml = '<option value="">-- Pilih Emas / Layanan Jasa --</option><optgroup label="Bahan Emas/Silver">'; 
        dbGoldSettings.forEach(g => { selHtml += `<option value="G_${g.UID}">Kadar ${g.Kadar} - ${g.Varian}</option>`; }); 
        selHtml += '</optgroup><optgroup label="Layanan Jasa Toko">'; 
        dbServices.forEach(s => { selHtml += `<option value="S_${s.UID}">${s.Nama}</option>`; }); 
        selHtml += '</optgroup>'; 
        
        if(document.getElementById('modal-calc-item')) document.getElementById('modal-calc-item').innerHTML = selHtml; 
        if(document.getElementById('modal-calc-item')) this.calculateModalEstimate(); 
    },
    
    calculateModalEstimate: function() { 
        const type = document.getElementById('modal-calc-type').value; 
        const uidRaw = document.getElementById('modal-calc-item').value; 
        const weight = parseFloat(document.getElementById('modal-calc-weight').value) || 0; 
        const resLabel = document.getElementById('modal-calc-result'); 
        if(!uidRaw || weight <= 0) { resLabel.innerText = "Rp 0"; return; } 
        const prefix = uidRaw.substring(0,2); 
        const uid = uidRaw.substring(2); 
        
        if(prefix === 'G_') { 
            const target = dbGoldSettings.find(g => g.UID === uid); 
            if(target) { 
                const pricePerGram = type === 'BELI' ? target.Harga_Jual : target.Harga_Beli; 
                resLabel.innerText = this.formatRp(Math.round(pricePerGram * weight)); 
            } 
        } else if(prefix === 'S_') { 
            const target = dbServices.find(s => s.UID === uid); 
            if(target) { resLabel.innerText = this.formatRp(target.Harga * weight); } 
        } 
    },
    
    updateContactLinks: function() { 
        const getUrl = (soc) => { 
            if(soc.platform === 'whatsapp') return `https://api.whatsapp.com/send?phone=${soc.url.replace(/\D/g,'')}`; 
            if(soc.platform === 'instagram') return `https://instagram.com/${soc.url.replace('@','')}`; 
            if(soc.platform === 'facebook') return `https://facebook.com/${soc.url}`; 
            return soc.url; 
        }; 
        const getIcon = (p) => { 
            if(p==='whatsapp') return 'fa-brands fa-whatsapp text-success'; 
            if(p==='instagram') return 'fa-brands fa-instagram text-danger'; 
            if(p==='facebook') return 'fa-brands fa-facebook text-primary'; 
            return 'fa-solid fa-link text-info'; 
        }; 
        let htmlLogin = ''; let htmlDash = '';
        
        // PERBAIKAN: Tambahkan (appConfig.socials || []) agar tidak crash jika data kosong
        (appConfig.socials || []).forEach(s => {
            const url = getUrl(s); const iconClass = getIcon(s.platform);
            htmlLogin += `<a href="${url}" target="_blank" class="text-decoration-none" style="transition: transform 0.3s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" title="${s.label}"><i class="${iconClass} fa-2x mx-2"></i></a>`;
            htmlDash += `<a href="${url}" target="_blank" class="btn btn-outline-secondary rounded-pill px-3 py-2"><i class="${iconClass} me-1"></i> ${s.label}</a>`;
        });
        
        document.getElementById('login-socials').innerHTML = htmlLogin;
        const dashSocEl = document.getElementById('dash-socials'); 
        if(dashSocEl) dashSocEl.innerHTML = htmlDash; 
    },
    
    toggleTheme: function() { 
        this.isLightMode = !this.isLightMode; 
        document.body.classList.toggle('light-mode', this.isLightMode); 
        const icon = document.getElementById('theme-icon'); 
        if (this.isLightMode) { icon.classList.replace('fa-sun', 'fa-moon'); } 
        else { icon.classList.replace('fa-moon', 'fa-sun'); } 
        
        // Warna Kontras Tinggi untuk Grafik
        const textColor = this.isLightMode ? '#333333' : '#ffffff';
        const gridColor = this.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

        // Update struktur warna grafik secara dinamis
        if(window.uChart) {
            window.uChart.options.plugins.legend.labels.color = textColor;
            window.uChart.options.scales.x.ticks.color = textColor;
            window.uChart.options.scales.y.ticks.color = textColor;
            window.uChart.options.scales.x.grid.color = gridColor;
            window.uChart.options.scales.y.grid.color = gridColor;
            window.uChart.update();
        }
        if(window.fChart1) {
            window.fChart1.options.plugins.legend.labels.color = textColor;
            window.fChart1.options.scales.x.ticks.color = textColor;
            window.fChart1.options.scales.y.ticks.color = textColor;
            window.fChart1.options.scales.x.grid.color = gridColor;
            window.fChart1.options.scales.y.grid.color = gridColor;
            window.fChart1.update();
        }
        if(window.fChart2) {
            window.fChart2.options.plugins.legend.labels.color = textColor;
            window.fChart2.update();
        }
        if(window.uChartTrend) {
            window.uChartTrend.options.scales.x.ticks.color = textColor;
            window.uChartTrend.options.scales.y.ticks.color = textColor;
            window.uChartTrend.options.scales.x.grid.color = gridColor;
            window.uChartTrend.options.scales.y.grid.color = gridColor;
            window.uChartTrend.update();
        }
        if(window.uChartTop) {
            window.uChartTop.options.scales.x.ticks.color = textColor;
            window.uChartTop.options.scales.y.ticks.color = textColor;
            window.uChartTop.options.scales.x.grid.color = gridColor;
            window.uChartTop.options.scales.y.grid.color = gridColor;
            window.uChartTop.update();
        }
        if(window.uChartTypes) {
            window.uChartTypes.options.plugins.legend.labels.color = textColor;
            window.uChartTypes.update();
        }
    },
    
    toast: function(m, i="success") { 
        Swal.mixin({toast:true, position:'top-end', showConfirmButton:false, timer:3000}).fire({icon:i, title:m}); 
    },
    
    showLoading: function(s, t="Memuat...") { 
        if(s) Swal.fire({title:t, allowOutsideClick:false, didOpen:()=>Swal.showLoading()}); 
        else Swal.close(); 
    },
    
    formatRp: function(n) { 
        return "Rp " + Number(n).toLocaleString('id-ID'); 
    },
toggleAddressBox: function() { 
        const isJemput = document.getElementById('apt-location').value === 'JEMPUT'; 
        document.getElementById('box-address').classList.toggle('d-none', !isJemput); 
        if(isJemput) { 
            setTimeout(() => { this.initMapLeaflet(); }, 300); 
        } 
    },
    
    initMapLeaflet: function() { 
        const container = document.getElementById('map-container'); 
        if(!container) return; 
        if(this.mapInstance) { 
            this.mapInstance.remove(); 
            this.mapInstance = null; 
        } 
        const defaultPos = [-6.8784828, 108.7221757]; 
        this.mapInstance = L.map('map-container').setView(defaultPos, 13); 
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.mapInstance); 
        this.mapMarker = L.marker(defaultPos, {draggable: true}).addTo(this.mapInstance); 
        
        this.mapMarker.on('dragend', (e) => { 
            const latlng = this.mapMarker.getLatLng(); 
            this.updateMapInputs(latlng); 
        }); 
        
        this.mapInstance.on('click', (e) => { 
            this.mapMarker.setLatLng(e.latlng); 
            this.updateMapInputs(e.latlng); 
        }); 
        
        setTimeout(() => { this.mapInstance.invalidateSize(); }, 300); 
    },
    
    updateMapInputs: function(latlng) { 
        document.getElementById('apt-lat').value = latlng.lat; 
        document.getElementById('apt-lng').value = latlng.lng; 
        document.getElementById('apt-address').value = `Latitude: ${latlng.lat}\nLongitude: ${latlng.lng}\nAlamat: Mencari alamat...`; 
        
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`)
            .then(res => res.json())
            .then(data => { 
                document.getElementById('apt-address').value = `Latitude: ${latlng.lat}\nLongitude: ${latlng.lng}\nAlamat: ${data.display_name || 'Tidak diketahui'}`; 
            })
            .catch(() => { 
                document.getElementById('apt-address').value = `Latitude: ${latlng.lat}\nLongitude: ${latlng.lng}\nAlamat: Gagal memuat alamat otomatis.`; 
            }); 
    },
    
    getGPSLocation: function() { 
        const btn = document.getElementById('btn-gps'); 
        const prevText = btn.innerHTML; 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> MELACAK...'; 
        btn.disabled = true; 
        
        if (!navigator.geolocation) { 
            Swal.fire("GPS Tidak Didukung", "Browser Anda tidak mendukung fitur lokasi.", "error"); 
            btn.innerHTML = prevText; btn.disabled = false; return; 
        } 
        
        navigator.geolocation.getCurrentPosition((pos) => { 
            const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude); 
            if(this.mapInstance) { 
                this.mapInstance.setView(latlng, 17); 
                this.mapMarker.setLatLng(latlng); 
            } 
            this.updateMapInputs(latlng); 
            btn.innerHTML = prevText; btn.disabled = false; 
            this.toast("Lokasi Akurat Ditemukan", "success"); 
        }, (err) => { 
            btn.innerHTML = prevText; btn.disabled = false; 
            if(err.code === 1) { 
                Swal.fire("Akses Lokasi Ditolak", "Mohon berikan izin lokasi pada browser Anda.", "warning"); 
            } else if(err.code === 3) { 
                this.toast("Pencarian lokasi timeout.", "error"); 
            } else { 
                this.toast("Gagal melacak. Pastikan GPS aktif.", "error"); 
            } 
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); 
    },
    
    toggleItemFields: function() { 
        const type = document.getElementById('item-type-select').value; 
        const emasFields = document.querySelectorAll('.item-emas-field'); 
        const jasaFields = document.querySelectorAll('.item-jasa-field'); 
        
        if (type === 'EMAS' || type === 'SILVER') { 
            emasFields.forEach(f => f.classList.remove('d-none')); 
            jasaFields.forEach(f => f.classList.add('d-none')); 
            this.populateKadarDropdown(); 
        } else { 
            emasFields.forEach(f => f.classList.add('d-none')); 
            jasaFields.forEach(f => f.classList.remove('d-none'));
            this.populateJasaDropdown(); 
        } 
    },
    
    populateJasaDropdown: function() { 
        const sel = document.getElementById('item-jasa-select'); 
        sel.innerHTML = ''; 
        dbServices.forEach(s => { 
            sel.innerHTML += `<option value="${s.UID}">${s.Nama} - ${this.formatRp(s.Harga)}</option>`; 
        }); 
    },
    
    populateTimeSlotsDropdown: function() { 
        const sel = document.getElementById('apt-time'); if(!sel) return; 
        sel.innerHTML = ''; 
        if(appConfig.timeSlots && appConfig.timeSlots.length > 0) { 
            appConfig.timeSlots.forEach(t => { 
                sel.innerHTML += `<option value="${t}">${t}</option>`; 
            }); 
        } else { 
            sel.innerHTML = `<option value="12:00">Slot Tidak Tersedia</option>`; 
        } 
    },
    
    addToCart: async function() { 
        const typeItem = document.getElementById('item-type-select').value; 
        const qty = parseInt(document.getElementById('item-qty').value) || 1; 
        const typeTrans = document.getElementById('apt-type').value; 
        let b64 = null; 
        const fIn = document.getElementById('item-photo'); 
        
        if(fIn.files.length > 0) b64 = await compressImage(fIn.files[0]); 
        
        if(typeItem === 'EMAS' || typeItem === 'SILVER') { 
            const cat = document.getElementById('item-category').value; 
            const kadar = document.getElementById('item-kadar').value; 
            const varian = document.getElementById('item-varian').value; 
            const wPerItem = parseFloat(document.getElementById('item-weight').value) || 0; 
            const wTotal = wPerItem * qty; 
            
            if(wPerItem <= 0 || !kadar || !varian) return this.toast("Lengkapi rincian barang!", "error"); 
            const tar = dbGoldSettings.find(g => g.Kadar === kadar && g.Varian === varian && (g.Bahan || 'EMAS') === typeItem); 
            if(!tar) return this.toast("Harga master barang tidak ditemukan", "error"); 
            
            const pricePerGram = typeTrans === "BELI" ? tar.Harga_Jual : tar.Harga_Beli; 
            const subtotal = Math.round(wTotal * pricePerGram); 
            currentCart.push({ Type: typeItem, Kategori: cat, Kadar: kadar, Varian: varian, Qty: qty, Gram: wTotal, Subtotal: subtotal, Foto: b64 }); 
        } else { 
            const jid = document.getElementById('item-jasa-select').value; 
            const s = dbServices.find(x => x.UID === jid); 
            if(!s) return this.toast("Pilih layanan jasa!", "error"); 
            
            const price = s.Harga * qty; 
            currentCart.push({ Type: 'JASA', Nama: s.Nama, Qty: qty, Subtotal: price, Foto: b64 }); 
        } 
        
        this.toast("Masuk ke keranjang", "success"); 
        document.getElementById('item-qty').value = 1; 
        document.getElementById('item-photo').value = ""; 
        this.renderCart(); 
    },
    
    renderCart: function() { 
        const tb = document.getElementById('table-cart-items'); 
        tb.innerHTML = ""; 
        let tEmas = 0; let tJasa = 0; 
        
        if(currentCart.length === 0) {
            tb.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4"><i class="fa-solid fa-basket-shopping fa-2x mb-2 text-secondary"></i><br>Belum ada barang di keranjang.</td></tr>`; 
        } else {
            currentCart.forEach((i, idx) => { 
                if(i.Type === 'JASA') { 
                    tJasa += i.Subtotal; 
                    tb.innerHTML += `<tr><td><span class="badge bg-info text-dark me-1">JASA</span> ${i.Nama} ${i.Foto?`<i class="fa-solid fa-image text-info ms-1" onclick="viewImage('${i.Foto}')" style="cursor:pointer;"></i>`:''}</td><td>-</td><td>${i.Qty}</td><td>-</td><td class="text-danger">-${this.formatRp(i.Subtotal)}</td><td class="text-center"><button class="btn btn-sm btn-danger" onclick="UI.removeFromCart(${idx})"><i class="fa-solid fa-trash"></i></button></td></tr>`; 
                } else { 
                    tEmas += i.Subtotal; 
                    let badgeBg = i.Type === 'SILVER' ? 'bg-secondary' : 'bg-success'; 
                    tb.innerHTML += `<tr><td><span class="badge ${badgeBg}">${i.Type}</span> ${i.Kategori} ${i.Foto?`<i class="fa-solid fa-image text-info ms-1" onclick="viewImage('${i.Foto}')" style="cursor:pointer;"></i>`:''}</td><td>${i.Kadar} - ${i.Varian}</td><td>${i.Qty}</td><td>${i.Gram}g</td><td class="text-success">+${this.formatRp(i.Subtotal)}</td><td class="text-center"><button class="btn btn-sm btn-danger" onclick="UI.removeFromCart(${idx})"><i class="fa-solid fa-trash"></i></button></td></tr>`; 
                } 
            }); 
        }
        document.getElementById('label-total-emas').innerText = this.formatRp(tEmas); 
        document.getElementById('label-total-jasa').innerText = this.formatRp(tJasa); 
    },
    
    launchMainApp: function() { 
        document.getElementById('auth-wrapper').style.display = 'none'; 
        document.getElementById('btn-hamburger').style.display = 'none'; 
        document.getElementById('app-content').style.display = 'block'; 
        
        let roleBadge = sessionUser.Role === 'Admin' ? 'badge-admin' : (sessionUser.Role === 'Agen' ? 'badge-agen' : 'badge-pelanggan');
        let badgeEl = document.getElementById('user-profile-badge');
        badgeEl.className = `badge mt-2 text-wrap ${roleBadge}`;
        badgeEl.innerText = `${sessionUser.Nama_Lengkap} (${sessionUser.Role})`; 
        
        document.getElementById('store-status-badge').style.display = 'none'; 
        document.getElementById('store-closed-board').style.display = 'none'; 
        
        this.updateStoreStatus(); // Panggil fungsi ini agar banner maintenance diperiksa saat login
        
        // Indikator Floating Banner Demo Otomatis
        if (sessionUser.Username.startsWith('demo_')) {
            if (!document.getElementById('demo-floating-banner')) {
                document.body.insertAdjacentHTML('beforeend', `
                    <div id="demo-floating-banner" style="position: fixed; bottom: 80px; right: 20px; z-index: 999999; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #000; padding: 12px 24px; border-radius: 50px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border: 2px solid #fff; animation: netPulse 2s infinite; font-size: 0.85rem;">
                        <i class="fa-solid fa-flask-vial me-2"></i> MODE SIMULASI (LOKAL)
                    </div>
                `);
            }
        } else {
            const existingBanner = document.getElementById('demo-floating-banner');
            if (existingBanner) existingBanner.remove();
        }
        
        this.renderSidebar(); 
        this.navigateTo(sessionUser.Role === 'Admin' ? 'admin-laporan' : 'dashboard'); 
    },
    
    renderSidebar: function() {
        const nav = document.getElementById('sidebar-nav');
        const mobNav = document.getElementById('mobile-navigation');
        let links = sessionUser.Role === 'Admin' ? 
            [{ id: 'admin-laporan', icon: 'fa-clipboard-list', text: 'Antrean & Transaksi' }, { id: 'admin-finance', icon: 'fa-vault', text: 'Laporan Keuangan' }, { id: 'admin-emas', icon: 'fa-calculator', text: 'Harga Emas & Jasa' }, { id: 'admin-users', icon: 'fa-users-gear', text: 'Data Akun' }, { id: 'admin-settings', icon: 'fa-cogs', text: 'Konfigurasi Web' }] : 
            [{ id: 'dashboard', icon: 'fa-chart-pie', text: 'Dashboard Saya' }, { id: 'appointment', icon: 'fa-cart-plus', text: 'Buat Transaksi' }];
        
        let navHtml = ''; let mobHtml = '';
        links.forEach(l => { 
            navHtml += `<a href="#" class="nav-link-custom" id="nav-${l.id}" onclick="UI.navigateTo('${l.id}')"><i class="fa-solid ${l.icon}"></i> ${l.text}</a>`; 
            mobHtml += `<a href="#" class="bottom-nav-item" id="mob-nav-${l.id}" onclick="UI.navigateTo('${l.id}')"><i class="fa-solid ${l.icon}"></i><span>${l.text.split(' ')[0]}</span></a>`; 
        });
        
        navHtml += `<a href="#" class="nav-link-custom text-danger mt-4" onclick="Auth.handleLogout()"><i class="fa-solid fa-right-from-bracket"></i> Keluar Sistem</a>`;
        mobHtml += `<a href="#" class="bottom-nav-item text-danger" onclick="Auth.handleLogout()"><i class="fa-solid fa-right-from-bracket"></i><span>Keluar</span></a>`;
        
        nav.innerHTML = navHtml; mobNav.innerHTML = mobHtml;
    },
    
    navigateTo: function(vId) {
        document.querySelectorAll('.app-view').forEach(el => el.classList.add('d-none'));
        document.querySelectorAll('.nav-link-custom, .bottom-nav-item').forEach(el => el.classList.remove('active'));
        
        const v = document.getElementById('view-' + vId); if(v) v.classList.remove('d-none');
        const n = document.getElementById('nav-' + vId); if(n) n.classList.add('active');
        const m = document.getElementById('mob-nav-' + vId); if(m) m.classList.add('active');
        
        if(vId === 'dashboard') this.renderDashboardView(); 
        else if(vId === 'appointment') this.renderAppointmentView(); 
        else if(vId === 'admin-laporan') this.renderAdminLaporanView(); 
        else if(vId === 'admin-finance') this.renderAdminFinanceView(); 
        else if(vId === 'admin-emas') this.renderGoldSettingsView(); 
        else if(vId === 'admin-users') this.renderAdminUsersView(); 
        else if(vId === 'admin-settings') this.renderAdminSettingsView();
        
        window.scrollTo({top: 0, behavior: 'smooth'});
    },
renderDashboardView: function() {
        const uApt = dbAppointments.filter(a => a.Username === sessionUser.Username && a.Status_Janji !== 'SELESAI' && a.Status_Janji !== 'BATAL');
    let uHist = dbAppointments.filter(a => a.Username === sessionUser.Username && (a.Status_Janji === 'SELESAI' || a.Status_Janji === 'BATAL'));
    // --- TAMBAHAN BARU: FILTER TANGGAL RIWAYAT ---
    if (userHistPaging.startDate) {
        uHist = uHist.filter(a => a.Tanggal >= userHistPaging.startDate);
    }
    if (userHistPaging.endDate) {
        uHist = uHist.filter(a => a.Tanggal <= userHistPaging.endDate);
    }

    // --- TAMBAHAN BARU: LOGIKA PAGINASI 10 DATA ---
    const totalItems = uHist.length;
    const totalPages = Math.ceil(totalItems / userHistPaging.limit) || 1;
    if (userHistPaging.page > totalPages) userHistPaging.page = totalPages;
    if (userHistPaging.page < 1) userHistPaging.page = 1;

    const startIndex = (userHistPaging.page - 1) * userHistPaging.limit;
    const endIndex = startIndex + userHistPaging.limit;
    const paginatedHist = uHist.slice(startIndex, endIndex);

    // Update Label & Tombol Paginasi di HTML
    const infoEl = document.getElementById('hist-page-info');
    const btnPrev = document.getElementById('btn-hist-prev');
    const btnNext = document.getElementById('btn-hist-next');
    
    if (infoEl) infoEl.innerText = `Hal ${userHistPaging.page} dari ${totalPages}`;
    if (btnPrev) btnPrev.disabled = userHistPaging.page <= 1;
    if (btnNext) btnNext.disabled = userHistPaging.page >= totalPages;
    // --- AKHIR TAMBAHAN BARU ---    

        const tbApt = document.getElementById('table-user-appointments'); tbApt.innerHTML = '';
        if(uApt.length === 0) tbApt.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Belum ada transaksi berjalan</td></tr>';
        else uApt.forEach(a => {
            let itemsStr = a.Items.map(i => `${i.Qty}x ${i.Type==='JASA'?i.Nama:i.Kategori}`).join(', ');
            let btn = '';
            
            const initialStatuses = ['MENUNGGU_TAKSIRAN', 'MENUNGGU_PERSETUJUAN_ADMIN', 'MENUNGGU_PEMBAYARAN', 'MENUNGGU_PEMBAYARAN_AWAL'];
            
            if(initialStatuses.includes(a.Status_Janji)) {
                btn += `<button class="btn btn-sm btn-outline-warning me-1 mb-1" onclick="UI.editAppointment('${a.UID}')"><i class="fa-solid fa-pen-to-square"></i> Edit Trx</button>
                        <button class="btn btn-sm btn-danger me-1 mb-1" onclick="API.processAction('${a.UID}', 'BATAL')">Batal</button>`;
            }
            
            if(a.Status_Janji === 'MENUNGGU_KONF_KONSUMEN') {
                btn += `<button class="btn btn-sm btn-success me-1 mb-1" onclick="API.processAction('${a.UID}', 'DEAL')">Deal Harga</button>
                        <button class="btn btn-sm btn-danger mb-1" onclick="API.processAction('${a.UID}', 'BATAL')">Tolak/Batal</button>`;
            }
            else if(a.Status_Janji === 'VERIFIKASI_PEMBAYARAN') btn += `<span class="badge bg-info">Cek Pembayaran</span>`;
            else if(a.Status_Janji === 'MENUNGGU_TF_ADMIN') btn += `<span class="badge bg-warning text-dark mb-1">Menunggu Dana Masuk</span>`;
            
            if(a.Status_Janji === 'MENUNGGU_KONF_PENERIMAAN' || a.Status_Janji === 'SIAP_DIAMBIL') {
                let txtBtn = a.Net_Total > 0 ? "Konfirmasi Terima Uang" : "Konfirmasi Terima Barang";
                btn += `<button class="btn btn-sm btn-primary mb-1 w-100 fw-bold" onclick="API.processAction('${a.UID}', 'SELESAI_KONSUMEN')"><i class="fa-solid fa-check-circle"></i> ${txtBtn}</button>`;
            }

            if(a.Status_Janji === 'MENUNGGU_PEMBAYARAN' || a.Status_Janji === 'MENUNGGU_PEMBAYARAN_AWAL') {
                if (a.MetodePembayaran && a.MetodePembayaran.includes('TF')) {
                    btn += `<button class="btn btn-sm btn-info me-1 mb-1" onclick="API.processAction('${a.UID}', 'UPLOAD_TF_KONSUMEN')"><i class="fa-solid fa-upload"></i> Upload TF</button>`;
                } else {
                    btn += `<span class="badge bg-warning text-dark mb-1"><i class="fa-solid fa-clock"></i> Menunggu Konfirmasi Toko</span>`;
                }
            }
            
            if(appConfig.qrisUrl && a.MetodePembayaran && a.MetodePembayaran.includes('TF') && a.Net_Total < 0 && (a.Status_Janji === 'MENUNGGU_PEMBAYARAN' || a.Status_Janji === 'MENUNGGU_PEMBAYARAN_AWAL' || a.Status_Janji === 'MENUNGGU_KONF_KONSUMEN' || a.Status_Janji === 'MENUNGGU_TF_ADMIN')) {
                btn += `<button class="btn btn-sm btn-outline-info mb-1" onclick="Swal.fire({title:'QRIS Toko', imageUrl:'${appConfig.qrisUrl}', imageWidth: 300, confirmButtonColor:'#d4af37'})"><i class="fa-solid fa-qrcode"></i> Scan QRIS</button>`;
            }
            
            // --- KODE BARU: Mengganti otomatis Estimasi menjadi Note
                    let infoTambahanPelanggan = '';
                    if (a.Status_Janji === 'MENUNGGU_KONF_PENERIMAAN' || a.Status_Janji === 'SIAP_DIAMBIL' || a.Status_Janji === 'SELESAI' || a.Status_Janji === 'BATAL') {
                        if (a.Feedback) infoTambahanPelanggan = `<br><small class="text-warning d-block mt-1 fst-italic"><i class="fa-solid fa-message"></i> Note: ${a.Feedback}</small>`;
                    } else {
                        if (a.EstimasiSelesai) infoTambahanPelanggan = `<br><small class="text-info d-block mt-1"><i class="fa-solid fa-clock"></i> Est. Selesai:<br><b>${a.EstimasiSelesai}</b></small>`;
                    }

                    tbApt.innerHTML += `<tr><td>${a.Tanggal} ${a.Waktu}<br><small class="text-warning">${a.UID}</small></td><td>${a.Jenis_Transaksi.replace(/_/g,' ')}<br><small class="text-muted">${itemsStr}</small></td><td><span class="badge bg-secondary" style="white-space:normal;">${a.Status_Janji.replace(/_/g,' ')}</span>${infoTambahanPelanggan}</td><td class="text-end fw-bold ${a.Net_Total>=0?'text-success':'text-danger'}">${a.Net_Total>=0?'+':''}${this.formatRp(a.Net_Total)}</td><td>${btn}</td></tr>`;
        });

        const tbHist = document.getElementById('table-user-history'); tbHist.innerHTML = '';
    
    if(paginatedHist.length === 0) {
        tbHist.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Belum ada riwayat / Tidak ada data di tanggal ini</td></tr>';
    } else {
        paginatedHist.forEach(a => {
            let itemsStr = a.Items.map(i => `${i.Qty}x ${i.Type==='JASA'?i.Nama:i.Kategori}`).join(', ');
            let isChecked = selectedTransaksi.includes(a.UID) ? 'checked' : '';
            tbHist.innerHTML += `<tr><td><input type="checkbox" class="form-check-input rekap-check" value="${a.UID}" ${isChecked} onchange="API.toggleAptCheck('${a.UID}', this.checked)"></td><td>${a.Tanggal}<br><small class="text-warning">${a.UID}</small></td><td>${a.Jenis_Transaksi.replace(/_/g,' ')}<br><small class="text-muted">${itemsStr}</small></td><td><span class="badge ${a.Status_Janji==='SELESAI'?'bg-success':'bg-danger'}">${a.Status_Janji}</span></td><td class="text-end fw-bold ${a.Net_Total>=0?'text-success':'text-danger'}">${a.Net_Total>=0?'+':''}${this.formatRp(a.Net_Total)}</td></tr>`;
        });
    }

        if(!appConfig.showGraph) { document.getElementById('container-graph-wrapper').classList.add('d-none'); return; }
        document.getElementById('container-graph-wrapper').classList.remove('d-none');
        const ctx = document.getElementById('userChart').getContext('2d');
        if(window.uChart) window.uChart.destroy();
        let labels = []; let dataEmas = []; let dataSilver = [];
        for(let i=6; i>=0; i--) { 
            const d = new Date(); d.setDate(d.getDate() - i); 
            labels.push(d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})); 
            dataEmas.push(GLOBAL_MULTIPLIER - (Math.random()*10 - 5)); 
            dataSilver.push(GLOBAL_MULTIPLIER_SILVER - (Math.random()*50 - 25)); 
        }
        window.uChart = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Emas/Mal', data: dataEmas, borderColor: '#d4af37', backgroundColor: 'rgba(212, 175, 55, 0.1)', tension: 0.4, fill: true }, { label: 'Perak/Mal', data: dataSilver, borderColor: '#94a3b8', backgroundColor: 'rgba(148, 163, 184, 0.1)', tension: 0.4, fill: true }] }, options: { responsive: true, plugins: { legend: { position: 'top', labels:{color: UI.isLightMode ? '#333333' : '#ffffff'} } }, scales: { y: { ticks:{color: UI.isLightMode ? '#333333' : '#ffffff'}, grid:{color: UI.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} }, x: { ticks:{color: UI.isLightMode ? '#333333' : '#ffffff'}, grid:{color: UI.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} } } } });
    },
    
    renderAppointmentView: function() {
        const dtInput = document.getElementById('apt-date');
        
        const now = new Date();
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');                
        dtInput.min = todayStr;
        
        if(!editAptId || !dtInput.value) {
            dtInput.value = todayStr;
        }

        const typeSelect = document.getElementById('apt-type'); 
        typeSelect.innerHTML = appConfig.allowBuy ? '<option value="JUAL">Saya Ingin Jual Emas</option><option value="BELI">Saya Ingin Beli Emas</option>' : '<option value="JUAL">Saya Ingin Jual Emas</option>';
        
        this.populateTimeSlotsDropdown(); 
        this.toggleAddressBox(); 
        this.toggleItemFields(); 
        this.renderCart();
    },

    renderAdminLaporanView: function() {
        const tb = document.getElementById('table-admin-appointments'); 
        if(!tb) return;
        tb.innerHTML = '';
        
        const filterWaktu = document.getElementById('filter-antrean-waktu').value;
        const filterStatus = document.getElementById('filter-antrean-status').value;
        
        let filteredData = dbAppointments;
        const todayStr = new Date().toISOString().split('T')[0];
        const currMonthStr = todayStr.substring(0, 7);
        const currYearStr = todayStr.substring(0, 4);

        if(filterWaktu === 'TODAY') filteredData = filteredData.filter(a => a.Tanggal === todayStr);
        else if(filterWaktu === 'MONTH') filteredData = filteredData.filter(a => a.Tanggal.startsWith(currMonthStr));
        else if(filterWaktu === 'YEAR') filteredData = filteredData.filter(a => a.Tanggal.startsWith(currYearStr));
        else if(filterWaktu === 'CUSTOM') {
            const s = document.getElementById('filter-start-date').value;
            const e = document.getElementById('filter-end-date').value;
            filteredData = filteredData.filter(a => {
                let pass = true;
                const trxDate = new Date(a.Tanggal + 'T12:00:00').getTime(); 
                if (s && trxDate < new Date(s + 'T00:00:00').getTime()) pass = false;
                if (e && trxDate > new Date(e + 'T23:59:59').getTime()) pass = false;
                return pass;
            });
        }

        if(filterStatus !== 'ALL') {
            if(filterStatus === 'PROSES') filteredData = filteredData.filter(a => a.Status_Janji !== 'SELESAI' && a.Status_Janji !== 'BATAL');
            else filteredData = filteredData.filter(a => a.Status_Janji === filterStatus);
        }

        const totalItems = filteredData.length;
        const totalPages = Math.ceil(totalItems / aptPaging.limit) || 1;

        if (aptPaging.page > totalPages) aptPaging.page = totalPages;
        if (aptPaging.page < 1) aptPaging.page = 1;

        const startIndex = (aptPaging.page - 1) * aptPaging.limit;
        const endIndex = startIndex + aptPaging.limit;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        const infoEl = document.getElementById('apt-page-info');
        const btnPrev = document.getElementById('btn-apt-prev');
        const btnNext = document.getElementById('btn-apt-next');
        
        if (infoEl) infoEl.innerText = `Hal ${aptPaging.page} dari ${totalPages}`;
        if (btnPrev) btnPrev.disabled = aptPaging.page <= 1;
        if (btnNext) btnNext.disabled = aptPaging.page >= totalPages;

        if (selectedTransaksi.length > 0 && infoEl) {
            infoEl.innerHTML += ` | <span class="text-warning"><i class="fa-solid fa-check-square"></i> ${selectedTransaksi.length} Dipilih</span>`;
        }

        if(paginatedData.length === 0) {
            tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data antrean/transaksi ditemukan.</td></tr>';
        } else {
            paginatedData.forEach(a => {
                const uData = dbUsers.find(x => x.Username === a.Username) || {};
                let contactStr = uData.No_HP ? `<br><a href="https://api.whatsapp.com/send?phone=${uData.No_HP.startsWith('0')?'62'+uData.No_HP.substring(1):uData.No_HP}" target="_blank" class="text-success text-decoration-none"><i class="fa-brands fa-whatsapp"></i> ${uData.No_HP}</a>` : '';
                
                let itemsStr = a.Items.map((i) => `<div>- ${i.Type==='JASA'?i.Nama:i.Kategori+' '+i.Kadar+' '+i.Varian} (${i.Qty}x) ${i.Foto?`<i class="fa-solid fa-image text-info ms-1" onclick="viewImage('${i.Foto}')" style="cursor:pointer;"></i>`:''}</div>`).join('');
                
                let locStr = a.Lokasi_Transaksi === 'JEMPUT' ? `<br><span class="badge bg-warning text-dark mt-1"><i class="fa-solid fa-truck"></i> Layanan Jemput</span>` : '<br><span class="badge bg-secondary mt-1"><i class="fa-solid fa-store"></i> Datang Di Toko</span>';
                
                let kasStr = '';
                if (a.Jenis_Transaksi === "GABUNGAN") kasStr = `<small class="text-muted d-block">Hak: ${this.formatRp(a.Total_Hak_Konsumen)}</small><small class="text-muted d-block">Tagihan: ${this.formatRp(a.Total_Tagihan_Jasa)}</small><b class="${a.Net_Total>=0?'text-success':'text-danger'}">${a.Net_Total>=0?'Terima':'Bayar'}: ${this.formatRp(Math.abs(a.Net_Total))}</b>`;
                else if (a.Jenis_Transaksi.includes("EMAS")) kasStr = `<b class="${a.Net_Total>=0?'text-success':'text-danger'}">${a.Net_Total>=0?'Terima':'Bayar'}: ${this.formatRp(Math.abs(a.Net_Total))}</b>`;
                else if (a.Jenis_Transaksi === "JASA") kasStr = `<b class="text-danger">Tagihan: ${this.formatRp(Math.abs(a.Net_Total))}</b>`;
                
                let payStr = `<br><small class="text-info">${a.MetodePembayaran || 'TUNAI'}</small>`;
                if(a.Is_Agen) payStr += `<br><small class="text-warning"><i class="fa-solid fa-handshake"></i> Agen (Komisi: ${a.Komisi_Agen?this.formatRp(a.Komisi_Agen):'Belum Diset'})</small>`;

                let btn = '';
                if(a.Status_Janji === 'MENUNGGU_TAKSIRAN') btn = `<button class="btn btn-sm btn-gold mb-1 w-100 fw-bold" onclick="API.processAction('${a.UID}', 'SIMPAN_TAKSIRAN')"><i class="fa-solid fa-calculator"></i> Taksir/Deal</button><button class="btn btn-sm btn-success mb-1 w-100 fw-bold" onclick="API.processAction('${a.UID}', 'KIRIM_TAKSIRAN')"><i class="fa-solid fa-paper-plane"></i> Kirim</button><button class="btn btn-sm btn-danger w-100" onclick="API.processAction('${a.UID}', 'BATAL')">Batal</button>`;
                else if(a.Status_Janji === 'MENUNGGU_PERSETUJUAN_ADMIN') btn = `<button class="btn btn-sm btn-success mb-1 w-100 fw-bold" onclick="API.processAction('${a.UID}', 'SETUJUI_PESANAN')"><i class="fa-solid fa-check"></i> Setujui</button><button class="btn btn-sm btn-danger w-100" onclick="API.processAction('${a.UID}', 'BATAL')">Batal</button>`;
                else if(a.Status_Janji === 'MENUNGGU_PEMBAYARAN_AWAL') btn = !a.MetodePembayaran.includes('TF') ? `<button class="btn btn-sm btn-success mb-1 w-100 fw-bold" onclick="API.processAction('${a.UID}', 'KONFIRM_TERIMA_UANG')"><i class="fa-solid fa-money-bill"></i> Terima Uang</button>` : `<span class="badge bg-warning text-dark w-100 py-2 mb-1">Menunggu TF Plg</span>`;
                else if (a.Status_Janji === 'MENUNGGU_KONF_KONSUMEN') btn = `<span class="badge bg-warning text-dark w-100 py-2 mb-1">Menunggu Keputusan</span>`;
                else if(a.Status_Janji === 'VERIFIKASI_PEMBAYARAN') btn = `${a.BuktiBayarCustomer ? `<button class="btn btn-sm btn-outline-info mb-1 w-100" onclick="viewImage('${a.BuktiBayarCustomer}')"><i class="fa-solid fa-image"></i> Cek Bukti TF</button>` : ''}<button class="btn btn-sm btn-success mb-1 w-100 fw-bold" onclick="API.processAction('${a.UID}', 'VERIFIKASI_TF')"><i class="fa-solid fa-check-double"></i> Verifikasi TF</button>`;
                else if(a.Status_Janji === 'MENUNGGU_TF_ADMIN') btn = `<button class="btn btn-sm btn-primary mb-1 w-100 fw-bold" onclick="API.processAction('${a.UID}', 'SELESAI_ADMIN')"><i class="fa-solid fa-upload"></i> Upload TF</button>`;
                else if(a.Status_Janji === 'MENUNGGU_SERAH_TERIMA') btn = `<button class="btn btn-sm btn-primary mb-1 w-100 fw-bold" onclick="API.processAction('${a.UID}', 'SELESAI_ADMIN')"><i class="fa-solid fa-hand-holding-dollar"></i> Serahkan</button>`;
                else if(a.Status_Janji === 'PROSES_JASA') btn = `<button class="btn btn-sm btn-success mb-1 w-100 fw-bold" onclick="API.processAction('${a.UID}', 'BARANG_SIAP')"><i class="fa-solid fa-box-open"></i> Selesai/Siap</button>`;
                else if(a.Status_Janji === 'MENUNGGU_PEMBAYARAN') btn = `<span class="badge bg-info w-100 py-2 mb-1">Menunggu TF Akhir</span>`;
                else if(a.Status_Janji === 'MENUNGGU_KONF_PENERIMAAN' || a.Status_Janji === 'SIAP_DIAMBIL') btn = `<span class="badge bg-primary w-100 py-2 mb-1">Konfirmasi Plg</span>`;
                else if (a.Status_Janji === 'SELESAI') btn = `<span class="badge bg-success w-100 py-2 mb-2"><i class="fa-solid fa-check"></i> Selesai</span><button class="btn btn-sm btn-outline-info mb-1 w-100" onclick="API.printNota('${a.UID}')"><i class="fa-solid fa-print"></i> Struk</button>`;
                else if (a.Status_Janji === 'BATAL') btn = `<span class="badge bg-danger w-100 py-2"><i class="fa-solid fa-xmark"></i> Dibatalkan</span>`;
                
                // --- KODE BARU: Memunculkan Info Estimasi/Pesan di Tabel Admin ---
                        let adminInfoTambahan = '';
                        if (a.Status_Janji === 'MENUNGGU_KONF_PENERIMAAN' || a.Status_Janji === 'SIAP_DIAMBIL' || a.Status_Janji === 'SELESAI' || a.Status_Janji === 'BATAL') {
                            if (a.Feedback) adminInfoTambahan = `<br><small class="text-warning d-block mt-1"><i class="fa-solid fa-message"></i> Note: ${a.Feedback}</small>`;
                        } else {
                            if (a.EstimasiSelesai) adminInfoTambahan = `<br><small class="text-info d-block mt-1"><i class="fa-solid fa-clock"></i> Est: ${a.EstimasiSelesai}</small>`;
                        }

                        let extraOpts = '';
                        if(a.Status_Janji !== 'SELESAI' && a.Status_Janji !== 'BATAL') {
                            extraOpts = `<hr class="border-secondary my-2"><div class="dropdown"><button class="btn btn-sm btn-outline-secondary w-100 dropdown-toggle" type="button" data-bs-toggle="dropdown">Opsi Lain</button><ul class="dropdown-menu dropdown-menu-dark shadow"><li><a class="dropdown-item" href="#" onclick="UI.editMarkupApt('${a.UID}')"><i class="fa-solid fa-pen-to-square text-info"></i> Edit Grand Total</a></li><li><a class="dropdown-item" href="#" onclick="API.sendWA('${a.UID}')"><i class="fa-brands fa-whatsapp text-success"></i> Chat Status</a></li>`;
                            
                            // --- KODE BARU: Menu Edit Estimasi -> Berubah Jadi Tambah Note jika sudah Selesai/Siap
                            if (a.Jenis_Transaksi.includes('JASA') || a.Jenis_Transaksi === 'GABUNGAN') {
                                if (a.Status_Janji === 'MENUNGGU_KONF_PENERIMAAN' || a.Status_Janji === 'SIAP_DIAMBIL') {
                                    extraOpts += `<li><a class="dropdown-item" href="#" onclick="API.processAction('${a.UID}', 'SET_PESAN_NOTE')"><i class="fa-solid fa-message text-warning"></i> Tambah / Edit Note</a></li>`;
                                } else if (a.EstimasiSelesai || a.Status_Janji === 'PROSES_JASA') {
                                    extraOpts += `<li><a class="dropdown-item" href="#" onclick="API.processAction('${a.UID}', 'SET_ESTIMASI_SELESAI')"><i class="fa-solid fa-clock text-warning"></i> Edit Estimasi Waktu</a></li>`;
                                }
                            }
                            extraOpts += `</ul></div>`;
                        }
                        
                        // BARU: Logika Checkbox berdasarkan Keranjang Memori
                        let isChecked = selectedTransaksi.includes(a.UID) ? 'checked' : '';
                        let checkboxHtml = a.Status_Janji === 'SELESAI' ? `<input type="checkbox" class="form-check-input mt-1" value="${a.UID}" ${isChecked} onchange="API.toggleAptCheck('${a.UID}', this.checked)">` : '';

                        tb.innerHTML += `<tr>
                            <td><div class="d-flex align-items-start gap-2">${checkboxHtml}<div><b>${a.Username}</b>${contactStr}${locStr}</div></div></td>
                            <td>${a.Tanggal}<br>${a.Waktu}<br><small class="text-warning">${a.UID}</small></td>
                            <td><span class="badge bg-info text-dark mb-1">${a.Jenis_Transaksi.replace(/_/g,' ')}</span><br><small class="text-muted d-block">${itemsStr}</small></td>
                            <td>${kasStr}${payStr}</td>
                            <td><span class="badge bg-secondary mb-1" style="white-space:normal;">${a.Status_Janji.replace(/_/g,' ')}</span>${adminInfoTambahan}</td>
                            <td>${btn}${extraOpts}</td>
                        </tr>`;
            });
        }
    },
renderAdminFinanceView: function() {
        const tb = document.getElementById('table-finance-log'); tb.innerHTML = '';
        const filter = document.getElementById('finance-filter').value;
        const today = new Date().toISOString().split('T')[0];
        const currMonth = today.substring(0,7);
        
        // 1. Ambil & Kalkulasi Ringkasan Keuangan Global Berdasarkan Filter Atas (Hari ini/Bulan ini)
        let summaryData = dbFinance;
        if(filter === 'TODAY') summaryData = dbFinance.filter(f => f.Tanggal === today);
        else if(filter === 'MONTH') summaryData = dbFinance.filter(f => f.Tanggal.startsWith(currMonth));
        
        let modalAwal = 0, dInNet = 0, dInBruto = 0, dOut = 0, bOps = 0, lKotor = 0, komisiAgen = 0;
        
        dbFinance.forEach(f => {
            if(f.Kategori === "MODAL AWAL" || f.Kategori === "MODAL MASUK") modalAwal += f.Nominal;
            if(f.Kategori === "KOREKSI MODAL") modalAwal -= f.Nominal;
        });

        summaryData.forEach(f => {
            let itemKomisi = 0;
            if(f.Keterangan && f.Keterangan.includes('Agen: Potong')) {
                const match = f.Keterangan.match(/Agen: Potong Rp ([\d.]+)/);
                if(match) itemKomisi = parseInt(match[1].replace(/\./g, ''));
                komisiAgen += itemKomisi;
            }
            if(f.Jenis_Kas === "PENDAPATAN") { dInNet += f.Nominal; dInBruto += (f.Nominal + itemKomisi); }
            else if(f.Jenis_Kas === "PENGELUARAN") dOut += f.Nominal;
            else if(f.Jenis_Kas === "BIAYA_OPS") bOps += f.Nominal;
            lKotor += f.Laba_Tercatat;
        });

        // --- KODE PERBAIKAN: TAMPILKAN HASIL KALKULASI KE KARTU ATAS & GRAFIK ---
        let labaBersih = lKotor - bOps;
        let cBal = API.getCurrentBalance();
        
        // Update Angka di Kartu
        document.getElementById('fin-modal-awal').innerText = this.formatRp(modalAwal);
        document.getElementById('fin-debit').innerText = this.formatRp(dInBruto);
        document.getElementById('fin-kredit').innerText = this.formatRp(dOut);
        document.getElementById('fin-saldo').innerText = this.formatRp(cBal);
        document.getElementById('fin-ops').innerText = this.formatRp(bOps);
        document.getElementById('fin-laba-rugi').innerText = this.formatRp(labaBersih);
        document.getElementById('fin-laba-rugi').className = `mt-1 mb-0 fw-bold ${labaBersih>=0?'text-info':'text-danger'}`;

        // Update Grafik Arus Kas & Komisi
        if(window.fChart1) window.fChart1.destroy(); 
        if(window.fChart2) window.fChart2.destroy();
        
        const ctx1 = document.getElementById('financeTrendChart').getContext('2d');
        const ctx2 = document.getElementById('financeDonutChart').getContext('2d');
        
        let finApts = dbAppointments.filter(a => a.Status_Janji === 'SELESAI');
        if(filter === 'TODAY') finApts = finApts.filter(a => a.Tanggal === today);
        else if(filter === 'MONTH') finApts = finApts.filter(a => a.Tanggal.startsWith(currMonth));

        let trendLabels = []; let inData = []; let outData = [];
        const sortedApts = finApts.sort((a,b) => new Date(a.Tanggal) - new Date(b.Tanggal));
        let groupedByDate = {};
        sortedApts.forEach(a => {
            if(!groupedByDate[a.Tanggal]) groupedByDate[a.Tanggal] = {in:0, out:0, laba:0};
            if(a.Net_Total < 0) groupedByDate[a.Tanggal].in += Math.abs(a.Net_Total);
            else groupedByDate[a.Tanggal].out += a.Net_Total;
        });
        for(let date in groupedByDate) {
            trendLabels.push(date.substring(5));
            inData.push(groupedByDate[date].in); outData.push(groupedByDate[date].out);
        }
        
        window.fChart1 = new Chart(ctx1, { type: 'bar', data: { labels: trendLabels, datasets: [{ label: 'Masuk (Debit)', data: inData, backgroundColor: '#10b981' }, { label: 'Keluar (Kredit)', data: outData, backgroundColor: '#ef4444' }] }, options: { responsive: true, plugins: { legend: { position: 'top', labels:{color: UI.isLightMode ? '#333333' : '#ffffff'} } }, scales: { y: { ticks:{color: UI.isLightMode ? '#333333' : '#ffffff'}, grid:{color: UI.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} }, x: { ticks:{color: UI.isLightMode ? '#333333' : '#ffffff'}, grid:{color: UI.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} } } } });
window.fChart2 = new Chart(ctx2, { type: 'doughnut', data: { labels: ['Modal Awal', 'Pemasukan', 'Pengeluaran', 'Laba Bersih'], datasets: [{ data: [modalAwal, dInBruto, dOut, labaBersih>0?labaBersih:0], backgroundColor: ['#3b82f6', '#10b981', '#ef4444', '#0dcaf0'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels:{color: UI.isLightMode ? '#333333' : '#ffffff', font:{size:10}} } } } });
        
        // Update Progres Transaksi
        let trProg = document.getElementById('transaction-progress-container');
        let countProses = dbAppointments.filter(a => a.Status_Janji !== 'SELESAI' && a.Status_Janji !== 'BATAL').length;
        let countSelesai = dbAppointments.filter(a => a.Status_Janji === 'SELESAI').length;
        let countBatal = dbAppointments.filter(a => a.Status_Janji === 'BATAL').length;
        let totalStat = countProses + countSelesai + countBatal || 1;
        if(trProg) trProg.innerHTML = `<div class="mb-2 d-flex justify-content-between"><small class="text-info">Dalam Proses (${countProses})</small><small class="text-success">Selesai (${countSelesai})</small><small class="text-danger">Batal (${countBatal})</small></div><div class="progress" style="height: 10px; background-color: var(--bg-input);"><div class="progress-bar bg-info" style="width: ${(countProses/totalStat)*100}%"></div><div class="progress-bar bg-success" style="width: ${(countSelesai/totalStat)*100}%"></div><div class="progress-bar bg-danger" style="width: ${(countBatal/totalStat)*100}%"></div></div>`;
        // --- AKHIR KODE PERBAIKAN ---

        // 2. Populasi Dropdown Pilihan Kadar Emas Secara Dinamis dari Master Seting
        const kadarSelect = document.getElementById('fin-filter-kadar');
        if (kadarSelect && kadarSelect.options.length <= 1) {
            const masterKadar = [...new Set(dbGoldSettings.map(g => g.Kadar))];
            masterKadar.forEach(k => {
                kadarSelect.innerHTML += `<option value="${k}">Kadar ${k}</option>`;
            });
        }

        // 3. Jalankan Penyaringan Berlapis Untuk Buku Jurnal Terperinci (Bawah)
        let filteredLog = dbFinance;

        // A. Filter Tanggal Jurnal
        if (adminFinancePaging.startDate) filteredLog = filteredLog.filter(f => f.Tanggal >= adminFinancePaging.startDate);
        if (adminFinancePaging.endDate) filteredLog = filteredLog.filter(f => f.Tanggal <= adminFinancePaging.endDate);
        
        // B. Filter Arus Kas (Debit/Kredit/Ops)
        if (adminFinancePaging.type !== 'ALL') filteredLog = filteredLog.filter(f => f.Jenis_Kas === adminFinancePaging.type);

        // C. Filter Kategori & Relasi ke Item Master
        if (adminFinancePaging.category !== 'ALL' || adminFinancePaging.kadar !== 'ALL') {
            filteredLog = filteredLog.filter(f => {
                let matchCat = true;
                let matchKadar = true;

                // Ekstrak ID Transaksi dari teks Keterangan jika ada (Contoh: "TRX: TRX-E-12345")
                let trxId = '';
                if (f.Keterangan && f.Keterangan.includes('TRX:')) {
                    const matchTrx = f.Keterangan.match(/TRX:\s*([^\s()]+)/);
                    if (matchTrx) trxId = matchTrx[1];
                }

                // Cari data transaksi asli untuk dianalisis item di dalamnya
                const rawApt = dbAppointments.find(a => a.UID === trxId);

                if (adminFinancePaging.category !== 'ALL') {
                    if (adminFinancePaging.category === 'OPERASIONAL') matchCat = (f.Kategori === 'OPERASIONAL');
                    else if (rawApt) {
                        if (adminFinancePaging.category === 'JASA') matchCat = rawApt.Jenis_Transaksi.includes('JASA') || rawApt.Jenis_Transaksi === 'GABUNGAN';
                        else if (adminFinancePaging.category === 'JUAL_EMAS') matchCat = rawApt.Jenis_Transaksi === 'JUAL_EMAS';
                        else if (adminFinancePaging.category === 'BELI_EMAS') matchCat = rawApt.Jenis_Transaksi === 'BELI_EMAS';
                        else if (adminFinancePaging.category === 'EMAS') matchCat = rawApt.Items.some(i => i.Type === 'EMAS');
                        else if (adminFinancePaging.category === 'SILVER') matchCat = rawApt.Items.some(i => i.Type === 'SILVER');
                    } else {
                        matchCat = f.Kategori.includes(adminFinancePaging.category) || f.Keterangan.includes(adminFinancePaging.category);
                    }
                }

                if (adminFinancePaging.kadar !== 'ALL') {
                    if (rawApt) {
                        matchKadar = rawApt.Items.some(i => i.Kadar === adminFinancePaging.kadar);
                    } else {
                        matchKadar = f.Keterangan.includes(adminFinancePaging.kadar);
                    }
                }

                return matchCat && matchKadar;
            });
        }

        // 4. Hitung Pembagian Potongan Kontrol Paginasi (Limit 10)
        const totalLogItems = filteredLog.length;
        const totalLogPages = Math.ceil(totalLogItems / adminFinancePaging.limit) || 1;
        if (adminFinancePaging.page > totalLogPages) adminFinancePaging.page = totalLogPages;
        if (adminFinancePaging.page < 1) adminFinancePaging.page = 1;

        const startLogIndex = (adminFinancePaging.page - 1) * adminFinancePaging.limit;
        const endLogIndex = startLogIndex + adminFinancePaging.limit;
        const paginatedLog = filteredLog.slice(startLogIndex, endLogIndex);

        // Update Indikator UI Halaman
        const logInfoEl = document.getElementById('fin-log-page-info');
        const btnLogPrev = document.getElementById('btn-fin-log-prev');
        const btnLogNext = document.getElementById('btn-fin-log-next');
        
        if (logInfoEl) logInfoEl.innerText = `Hal ${adminFinancePaging.page} dari ${totalLogPages} (${totalLogItems} Jurnal)`;
        if (btnLogPrev) btnLogPrev.disabled = adminFinancePaging.page <= 1;
        if (btnLogNext) btnLogNext.disabled = adminFinancePaging.page >= totalLogPages;

        // 5. Render Data yang Sudah Disaring ke Dalam Tabel Jurnal Keuangan
        paginatedLog.forEach(f => {
            let itemKomisi = 0;
            if(f.Keterangan && f.Keterangan.includes('Agen: Potong')) {
                const match = f.Keterangan.match(/Agen: Potong Rp ([\d.]+)/);
                if(match) itemKomisi = parseInt(match[1].replace(/\./g, ''));
            }
            
            let debStr = f.Jenis_Kas === "PENDAPATAN" ? `<span class="text-success">+${this.formatRp(f.Nominal)}</span>` : '-';
            let kreStr = f.Jenis_Kas !== "PENDAPATAN" ? `<span class="text-danger">-${this.formatRp(f.Nominal)}</span>` : '-';
            let ketExtra = f.Laba_Tercatat ? `<br><small class="text-info">Laba: ${this.formatRp(f.Laba_Tercatat)}</small>` : '';
            tb.innerHTML += `<tr><td>${f.Tanggal}</td><td><b>${f.Kategori}</b><br><small class="text-muted">${f.Keterangan}</small>${ketExtra}</td><td class="text-end">${debStr}</td><td class="text-end">${kreStr}</td></tr>`;
        });
        
        if(paginatedLog.length === 0) tb.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Jurnal Keuangan tidak ditemukan / Filter kosong.</td></tr>';
        
    },
    
    renderGoldSettingsView: function() {
        const tb = document.getElementById('table-admin-gold-settings'); tb.innerHTML = '';
        document.getElementById('input-global-mult').value = GLOBAL_MULTIPLIER;
        document.getElementById('input-global-mult-silver').value = GLOBAL_MULTIPLIER_SILVER;
        
        // 1. FILTER PENCARIAN (SEARCH)
        let filteredGold = dbGoldSettings;
        if (goldPaging.search) {
            filteredGold = filteredGold.filter(g => 
                (g.Bahan || 'EMAS').toLowerCase().includes(goldPaging.search) ||
                g.Kadar.toLowerCase().includes(goldPaging.search) ||
                g.Varian.toLowerCase().includes(goldPaging.search)
            );
        }

        // 2. PENGURUTAN KATEGORI (SORTING)
        if (goldPaging.sortBy === 'BAHAN_ASC') filteredGold = [...filteredGold].sort((a,b) => (a.Bahan || 'EMAS').localeCompare(b.Bahan || 'EMAS'));
        else if (goldPaging.sortBy === 'KADAR_ASC') filteredGold = [...filteredGold].sort((a,b) => a.Kadar.localeCompare(b.Kadar));
        else if (goldPaging.sortBy === 'VARIAN_ASC') filteredGold = [...filteredGold].sort((a,b) => a.Varian.localeCompare(b.Varian));

        // 3. PAGINASI (LIMIT 10)
        const totalItems = filteredGold.length;
        const totalPages = Math.ceil(totalItems / goldPaging.limit) || 1;
        if (goldPaging.page > totalPages) goldPaging.page = totalPages;
        if (goldPaging.page < 1) goldPaging.page = 1;

        const startIndex = (goldPaging.page - 1) * goldPaging.limit;
        const endIndex = startIndex + goldPaging.limit;
        const paginatedGold = filteredGold.slice(startIndex, endIndex);

        // Update Indikator HTML Paginasi
        const infoEl = document.getElementById('gold-page-info');
        const btnPrev = document.getElementById('btn-gold-prev');
        const btnNext = document.getElementById('btn-gold-next');
        
        if (infoEl) infoEl.innerText = `Hal ${goldPaging.page} dari ${totalPages}`;
        if (document.getElementById('gold-total-info')) document.getElementById('gold-total-info').innerText = `Total: ${totalItems} Data Parameter`;
        if (btnPrev) btnPrev.disabled = goldPaging.page <= 1;
        if (btnNext) btnNext.disabled = goldPaging.page >= totalPages;

        // Cek Apakah Drag And Drop Diizinkan
        // Dilarang jika mode pencarian / sortir selain urutan aktif agar data tidak rusak
        const allowDrag = (goldPaging.search === '' && goldPaging.sortBy === 'URUTAN');

        if(paginatedGold.length === 0) {
            tb.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Data parameter tidak ditemukan.</td></tr>';
        } else {
            paginatedGold.forEach((g, i) => {
                let hMal = this.formatRp(g.Harga_Mal); let hJual = this.formatRp(g.Harga_Jual); let hBeli = this.formatRp(g.Harga_Beli);
                let mStr = g.Tipe_Margin === 'PERSEN' ? `${g.Nilai_Margin}%` : this.formatRp(g.Nilai_Margin);
                let bb = g.Bahan || 'EMAS'; let badgeBg = bb === 'SILVER' ? 'bg-secondary' : 'bg-warning text-dark';
                
                let dragClass = allowDrag ? 'drag-handle btn-outline-light' : 'disabled text-secondary border-secondary';
                let dragAttr = allowDrag ? 'title="Tahan dan Geser untuk memindahkan urutan"' : 'title="Fitur Geser (Drag) dilarang saat mode Pencarian/Sortir aktif"';

                // Hitung nomor urut absolut untuk ditampilkan ke pengguna (misal baris 1 di Hal 2 adalah nomor 11)
                let nomorUrutAbsolut = startIndex + i + 1;

                tb.innerHTML += `<tr>
                    <td><span class="badge ${badgeBg}">${bb}</span></td>
                    <td><small class="text-muted d-block">#${nomorUrutAbsolut}</small><b>${g.Kadar}</b><br><small class="text-muted">${g.Varian}</small></td>
                    <td>${g.Faktor_Varian}</td><td>${hMal}</td><td>${mStr}</td>
                    <td class="text-success">${hJual}</td><td class="text-danger">${hBeli}</td>
                    <td class="text-center">
                        <div class="d-flex flex-column gap-2 align-items-center">
                            <div class="btn-group btn-group-sm">
                                <button class="btn ${dragClass}" ${dragAttr}><i class="fa-solid fa-arrows-up-down-left-right"></i></button>
                                <button class="btn btn-outline-light" onclick="API.moveGoldPositionManual('${g.UID}', ${nomorUrutAbsolut})" title="Pindah ke Halaman / Urutan Lain"><i class="fa-solid fa-hashtag"></i></button>
                            </div>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-info" onclick="UI.copyGoldSetting('${g.UID}')" title="Salin"><i class="fa-solid fa-copy"></i></button>
                                <button class="btn btn-outline-warning" onclick="UI.editGoldSetting('${g.UID}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-outline-danger" onclick="API.deleteGold('${g.UID}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    </td>
                </tr>`;
            });
        }
        
        this.renderServicesSettingsView();

        // --- AKTIFKAN FITUR DRAG AND DROP ABSOLUT ---
        const tbody = document.getElementById('table-admin-gold-settings');
        if(window.goldSortable) window.goldSortable.destroy(); 
        
        if (allowDrag) {
            window.goldSortable = new Sortable(tbody, {
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: function (evt) {
                    if(evt.oldIndex !== evt.newIndex) {
                        // Kalkulasi index absolut dari halaman (Misal Hal 2, baris 1 = Index 10 di array)
                        const absoluteOldIndex = startIndex + evt.oldIndex;
                        const absoluteNewIndex = startIndex + evt.newIndex;
                        API.reorderGoldDragDrop(absoluteOldIndex, absoluteNewIndex);
                    }
                }
            });
        }
    },
    
    renderServicesSettingsView: function() {
        const tb = document.getElementById('table-admin-services-settings'); tb.innerHTML = '';
        if(dbServices.length === 0) tb.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Belum ada layanan jasa</td></tr>';
        else dbServices.forEach(s => {
            tb.innerHTML += `<tr><td><b>${s.Nama}</b></td><td>${this.formatRp(s.Harga)}</td><td class="text-center"><button class="btn btn-sm btn-danger" onclick="API.deleteService('${s.UID}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
    },
    
    renderAdminSettingsView: function() {
        document.getElementById('cfg-store-status').checked = appConfig.storeOpen;
        document.getElementById('cfg-show-graph').checked = appConfig.showGraph;
        document.getElementById('cfg-allow-buy').checked = appConfig.allowBuy;
        document.getElementById('cfg-limit-emas').value = appConfig.limitTrxEmas;
        document.getElementById('cfg-limit-jasa').value = appConfig.limitTrxJasa;
        document.getElementById('cfg-nota-name').value = appConfig.notaName;
        document.getElementById('cfg-nota-address').value = appConfig.notaAddress;
        document.getElementById('cfg-nota-phone').value = appConfig.notaPhone;
        document.getElementById('cfg-nota-style').value = appConfig.notaStyle;
        document.getElementById('cfg-tagline').value = appConfig.storeTagline;
        document.getElementById('cfg-promo-text').value = appConfig.promoText;
        document.getElementById('cfg-map-url').value = appConfig.mapEmbedUrl;
        document.getElementById('cfg-map-click-url').value = appConfig.mapClickUrl;
        document.getElementById('cfg-store-reason').value = appConfig.storeCloseReason;
        document.getElementById('cfg-store-open-time').value = appConfig.storeOpenTime;
        document.getElementById('cfg-qris-url').value = appConfig.qrisUrl || '';
        document.getElementById('cfg-running-text').value = appConfig.runningTextCustom || '';
        document.getElementById('cfg-running-speed').value = appConfig.runningTextSpeed || 20;
        document.getElementById('cfg-local-mode').checked = appConfig.isMaintenance || false; 
        document.getElementById('cfg-disconnect-db').checked = isManualLocalMode;
        
        this.renderTimeSlotsSetting();
        this.renderSocialSettings();
        this.renderTestimoniSettings();
        
        const rCont = document.getElementById('list-rekening-toko'); rCont.innerHTML = '';
        if(appConfig.rekeningToko && appConfig.rekeningToko.length > 0) {
            appConfig.rekeningToko.forEach((r, idx) => {
                rCont.innerHTML += `<div class="d-flex justify-content-between align-items-center p-2 bg-dark border border-secondary rounded"><div class="small"><b>${r.bank}</b> - ${r.no}<br><span class="text-muted">A.N: ${r.an}</span></div><button class="btn btn-sm btn-outline-danger" onclick="API.removeRekeningToko(${idx})"><i class="fa-solid fa-trash"></i></button></div>`;
            });
        } else { rCont.innerHTML = '<div class="text-muted small">Belum ada rekening toko.</div>'; }
    },
    
    renderSocialSettings: function() {
        const list = document.getElementById('social-settings-list'); list.innerHTML = '';
        appConfig.socials.forEach((s, idx) => {
            list.innerHTML += `<div class="social-item-row bg-dark p-2 rounded mb-2 border border-secondary"><div class="row g-2 align-items-center"><div class="col-3"><select class="form-control form-control-custom form-control-sm soc-plat"><option value="whatsapp" ${s.platform==='whatsapp'?'selected':''}>WA</option><option value="instagram" ${s.platform==='instagram'?'selected':''}>IG</option><option value="facebook" ${s.platform==='facebook'?'selected':''}>FB</option><option value="other" ${s.platform==='other'?'selected':''}>Lainnya</option></select></div><div class="col-4"><input type="text" class="form-control form-control-custom form-control-sm soc-label" value="${s.label}" placeholder="Label"></div><div class="col-4"><input type="text" class="form-control form-control-custom form-control-sm soc-url" value="${s.url}" placeholder="URL/No"></div><div class="col-1 text-end"><button class="btn btn-sm btn-danger" onclick="API.removeSocial(${idx})"><i class="fa-solid fa-xmark"></i></button></div></div></div>`;
        });
    },
    
    renderTestimoniSettings: function() {
        const container = document.getElementById('setTestiCol');
        if(!container) return;

        container.innerHTML = `
            <div class="mb-3 text-end">
                <button class="btn btn-sm btn-outline-danger" onclick="API.deleteTestimoniPagingMassal()">
                    <i class="fa-solid fa-trash-can"></i> Hapus yang Dicentang
                </button>
            </div>

            <div class="table-responsive border border-secondary rounded" style="background: rgba(0,0,0,0.1); max-height: 350px; overflow-y:auto;">
                <table class="table table-dark table-hover align-middle small mb-0">
                    <thead style="position: sticky; top: 0; background-color: var(--bg-card); z-index: 1;">
                        <tr>
                            <th style="width: 40px;"><i class="fa-solid fa-check-double"></i></th>
                            <th>User</th>
                            <th>Ulasan & Rating</th>
                            <th>Status Visibilitas</th>
                            <th>Aksi Pamong</th>
                        </tr>
                    </thead>
                    <tbody id="table-admin-testimoni-paging">
                        <tr><td colspan="5" class="text-center text-muted py-4"><i class="fa-solid fa-spinner fa-spin me-2"></i>Menghubungkan ke Cloud Firestore...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="d-flex justify-content-between align-items-center mt-3 p-2 bg-dark rounded border border-secondary">
                <span class="small text-muted ms-2">Menampilkan <b class="text-white">5</b> ulasan per halaman</span>
                <div class="d-flex align-items-center gap-2">
                    <button id="btn-testi-prev" class="btn btn-sm btn-outline-info" onclick="API.fetchTestimoniPaging('PREV')" disabled>
                        <i class="fa-solid fa-chevron-left"></i> Sebelumnya
                    </button>
                    
                    <span id="testi-page-info" class="small fw-bold text-white px-3 py-1 bg-secondary rounded">Hal 1</span>
                    
                    <button id="btn-testi-next" class="btn btn-sm btn-outline-info" onclick="API.fetchTestimoniPaging('NEXT')" disabled>
                        Selanjutnya <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

        API.fetchTestimoniPaging('FIRST');
    },
    
    renderTimeSlotsSetting: function() {
        const list = document.getElementById('list-timeslots'); list.innerHTML = '';
        if(!appConfig.timeSlots || appConfig.timeSlots.length === 0) list.innerHTML = '<small class="text-muted">Belum ada sesi waktu.</small>';
        else appConfig.timeSlots.forEach((t, idx) => {
            list.innerHTML += `<span class="badge bg-secondary d-flex align-items-center gap-2 p-2 border border-secondary">${t} <i class="fa-solid fa-xmark text-danger" style="cursor:pointer;" onclick="API.removeTimeSlot(${idx})"></i></span>`;
        });
    },
    
    renderAdminUsersView: function() {
        API.fetchUsersPaging('FIRST');

        setTimeout(() => {
            if(window.uChartTrend) window.uChartTrend.destroy();
            if(window.uChartTop) window.uChartTop.destroy();
            if(window.uChartTypes) window.uChartTypes.destroy();
            
            const ctxTrend = document.getElementById('chartUserTrend').getContext('2d');
            const ctxTop = document.getElementById('chartTopUsers').getContext('2d');
            const ctxTypes = document.getElementById('chartItemTypes').getContext('2d');

            let mCount = 0; let yCount = 0;
            const todayStr = new Date().toISOString().split('T')[0];
            const currMonthStr = todayStr.substring(0, 7);
            const currYearStr = todayStr.substring(0, 4);

            let userAptCounts = {}; let typeCounts = { EMAS:0, SILVER:0, JASA:0 };
            dbAppointments.filter(a => a.Status_Janji === 'SELESAI').forEach(a => {
                if(a.Tanggal.startsWith(currMonthStr)) mCount++;
                if(a.Tanggal.startsWith(currYearStr)) yCount++;
                
                if(!userAptCounts[a.Username]) userAptCounts[a.Username] = 0;
                userAptCounts[a.Username]++;
                
                a.Items.forEach(i => {
                    if(i.Type === 'EMAS') typeCounts.EMAS++;
                    else if(i.Type === 'SILVER') typeCounts.SILVER++;
                    else if(i.Type === 'JASA') typeCounts.JASA++;
                });
            });

            window.uChartTrend = new Chart(ctxTrend, { type: 'bar', data: { labels: ['Bulan Ini', 'Tahun Ini'], datasets: [{ label: 'Jumlah Transaksi Selesai', data: [mCount, yCount], backgroundColor: ['#0dcaf0', '#3b82f6'] }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks:{color: UI.isLightMode ? '#333333' : '#ffffff'}, grid:{color: UI.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} }, x: { ticks:{color: UI.isLightMode ? '#333333' : '#ffffff'}, grid:{color: UI.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} } } } });

            let sortUsers = Object.keys(userAptCounts).map(k => ({user: k, count: userAptCounts[k]})).sort((a,b) => b.count - a.count).slice(0, 10);
            let topLabels = sortUsers.map(u => u.user); let topData = sortUsers.map(u => u.count);

           window.uChartTop = new Chart(ctxTop, { type: 'bar', data: { labels: topLabels, datasets: [{ label: 'Total Trx', data: topData, backgroundColor: '#d4af37' }] }, options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks:{color: UI.isLightMode ? '#333333' : '#ffffff'}, grid:{color: UI.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} }, y: { ticks:{color: UI.isLightMode ? '#333333' : '#ffffff'}, grid:{color: UI.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} } } } });

window.uChartTypes = new Chart(ctxTypes, { type: 'doughnut', data: { labels: ['Emas', 'Silver', 'Jasa'], datasets: [{ data: [typeCounts.EMAS, typeCounts.SILVER, typeCounts.JASA], backgroundColor: ['#f59e0b', '#94a3b8', '#10b981'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels:{color: UI.isLightMode ? '#333333' : '#ffffff'} } } } });
        }, 300);
    },
    
    processRekapTerpilih: function(tipe) {
        if(selectedTransaksi.length === 0) {
            return Swal.fire("Pilih Transaksi", "Ceklis minimal satu transaksi selesai untuk direkap.", "warning");
        }
        
        if(tipe === 'PRINT') {
            API.printRekapNota(selectedTransaksi); 
        } else if(tipe === 'WA') {
            API.shareRekapWA(selectedTransaksi);
        }
        
        Swal.fire({
            title: 'Berhasil',
            text: 'Apakah Anda ingin mengosongkan centang pilihan?',
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: 'Ya, Kosongkan',
            cancelButtonText: 'Biarkan Saja'
        }).then((r) => {
            if (r.isConfirmed) {
                API.clearAptCheck();
            }
        });
    },
    
    toggleCustomDateFilter: function() {
        const val = document.getElementById('filter-antrean-waktu').value;
        document.getElementById('filter-custom-range').classList.toggle('d-none', val !== 'CUSTOM');
        document.getElementById('filter-custom-range').classList.toggle('d-flex', val === 'CUSTOM');
        if(val !== 'CUSTOM') this.renderAdminLaporanView();
    },
    
    showFactorInfo: function(bahan) {
        Swal.fire({ title: 'Info Faktor Global', html: `<div class="text-start small">Nilai ini adalah acuan harga dasar (HPP Mal) dunia. Semua kadar ${bahan} dihitung berdasarkan faktor variannya masing-masing dikalikan dengan angka ini.<br><br><b>Rumus:</b> HPP = Faktor Varian × Faktor Global</div>`, icon: 'info' });
    },
    
    showAddTestimoni: function() {
        Swal.fire({ title: 'Bagikan Pengalaman Anda', html: `<div class="rating-stars mb-3" style="font-size:2rem; color:var(--gold-primary); cursor:pointer;">
            <i class="fa-regular fa-star" id="star1" onclick="UI.setStar(1)"></i>
            <i class="fa-regular fa-star" id="star2" onclick="UI.setStar(2)"></i>
            <i class="fa-regular fa-star" id="star3" onclick="UI.setStar(3)"></i>
            <i class="fa-regular fa-star" id="star4" onclick="UI.setStar(4)"></i>
            <i class="fa-regular fa-star" id="star5" onclick="UI.setStar(5)"></i>
            </div><textarea id="testi-text" class="swal2-textarea w-100 m-0" placeholder="Tuliskan kepuasan layanan kami..."></textarea>`, 
            showCancelButton: true, confirmButtonText: 'Kirim Testimoni',
            didOpen: () => { window.currStar = 5; UI.setStar(5); },
            preConfirm: () => { const text = document.getElementById('testi-text').value; if(!text) return Swal.showValidationMessage('Ulasan tidak boleh kosong!'); return { text, star: window.currStar }; }
        }).then(async res => {
            if(res.isConfirmed) {
                try {
                    const dirtyWords = ["bodoh", "jelek", "penipu", "parah", "sampah", "anjing"]; 
                    let sanitizedText = res.value.text;
                    dirtyWords.forEach(word => {
                        const regex = new RegExp(`\\b${word}\\b`, "gi");
                        sanitizedText = sanitizedText.replace(regex, "***");
                    });

                    const autoStatus = res.value.star < 3 ? 'SEMBUNYI' : 'TAMPIL';
                    
                    const newTestimoniData = { 
                        UID: "TS"+Date.now(), 
                        Username: sessionUser.Username, 
                        Text: sanitizedText, 
                        Star: res.value.star, 
                        Status: autoStatus,
                        Timestamp: new Date().toISOString()
                    };

                    dbTestimonials.push(newTestimoniData);

                    // ===== TANDA PERBAIKAN =====
                    // Kirim dokumen secara spesifik agar langsung diunggah ke koleksi 'testimonials'
                    await AppStorage.save('testimonials', newTestimoniData);
                    // ===========================

                    if(autoStatus === 'SEMBUNYI') {
                        UI.toast('Ulasan disimpan. Menunggu moderasi Admin.', 'info');
                    } else {
                        UI.toast('Terima Kasih atas ulasannya!', 'success');
                    }
                    UI.updateLandingPage();
                } catch(err) { AppLogger.logError(err, "UI.showAddTestimoni"); }
            }
        });
    },
    
    setStar: function(s) {
        window.currStar = s;
        for(let i=1; i<=5; i++) {
            const el = document.getElementById('star'+i);
            if(i <= s) { el.classList.remove('fa-regular'); el.classList.add('fa-solid'); }
            else { el.classList.remove('fa-solid'); el.classList.add('fa-regular'); }
        }
    },
    
    resetCart: function() {
        currentCart = [];
        editAptId = null;
        document.getElementById('apt-address').value = '';
        document.getElementById('apt-patokan').value = '';
        document.getElementById('item-qty').value = 1;
        document.getElementById('item-photo').value = "";
        document.getElementById('title-form-apt').innerHTML = `<i class="fa-solid fa-basket-shopping text-warning me-2"></i>Keranjang POS Kasir`;
        document.getElementById('btn-submit-apt').innerHTML = `<i class="fa-solid fa-wand-magic-sparkles me-1"></i> Mulai Proses Pembayaran`;
        this.renderCart();
    },
    
    removeFromCart: function(idx) {
        Swal.fire({
            title: 'Hapus Item?',
            text: "Item ini akan dihapus dari keranjang Anda.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                currentCart.splice(idx, 1);
                this.toast("Item berhasil dihapus", "info");
                this.renderCart();
            }
        });
    },
    
    populateKadarDropdown: function() {
        const type = document.getElementById('item-type-select').value;
        const sel = document.getElementById('item-kadar'); sel.innerHTML = '';
        const uniqueKadar = [...new Set(dbGoldSettings.filter(g => (g.Bahan || 'EMAS') === type).map(item => item.Kadar))];
        if(uniqueKadar.length === 0) sel.innerHTML = '<option value="">Belum ada data kadar</option>';
        else uniqueKadar.forEach(k => { sel.innerHTML += `<option value="${k}">${k}</option>`; });
        this.filterVarianByKadar();
    },
    
    filterVarianByKadar: function() {
        const type = document.getElementById('item-type-select').value;
        const kadar = document.getElementById('item-kadar').value;
        const sel = document.getElementById('item-varian'); sel.innerHTML = '';
        const filtered = dbGoldSettings.filter(g => g.Kadar === kadar && (g.Bahan || 'EMAS') === type);
        if(filtered.length === 0) sel.innerHTML = '<option value="">Pilih kadar dulu</option>';
        else filtered.forEach(g => { sel.innerHTML += `<option value="${g.Varian}">${g.Varian}</option>`; });
    }
};