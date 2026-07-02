const AppStorage = {
    save: async function() {
        try {
            // Backup to local storage for offline capabilities
            localStorage.setItem('erp_dbUsers', JSON.stringify(dbUsers));
            localStorage.setItem('erp_dbGoldSettings', JSON.stringify(dbGoldSettings));
            localStorage.setItem('erp_dbAppointments', JSON.stringify(dbAppointments));
            localStorage.setItem('erp_dbFinance', JSON.stringify(dbFinance));
            localStorage.setItem('erp_dbTemplates', JSON.stringify(dbTemplates));
            localStorage.setItem('erp_dbTestimonials', JSON.stringify(dbTestimonials));
            localStorage.setItem('erp_dbServices', JSON.stringify(dbServices));
            localStorage.setItem('erp_appConfig', JSON.stringify(appConfig));
            localStorage.setItem('erp_globals', JSON.stringify({GLOBAL_MULTIPLIER, GLOBAL_MULTIPLIER_SILVER}));
            localStorage.setItem('erp_manual_local_mode', isManualLocalMode);

            if (isFirebaseActive && !isManualLocalMode) {
                // Kumpulkan semua instruksi penulisan ke dalam satu antrean (Queue)
                const allWrites = [];
                
                allWrites.push({ col: 'erp_data', doc: 'appConfig', data: appConfig });
                allWrites.push({ col: 'erp_data', doc: 'globals', data: {GLOBAL_MULTIPLIER, GLOBAL_MULTIPLIER_SILVER} });
                
                dbAppointments.forEach(apt => allWrites.push({ col: 'appointments', doc: apt.UID, data: apt }));
                dbFinance.forEach(fin => allWrites.push({ col: 'finance', doc: fin.UID, data: fin }));
                dbGoldSettings.forEach(gold => allWrites.push({ col: 'gold_settings', doc: gold.UID, data: gold }));
                dbUsers.forEach(u => allWrites.push({ col: 'users', doc: u.UID, data: u }));
                dbServices.forEach(s => allWrites.push({ col: 'services', doc: s.UID, data: s }));
                dbTemplates.forEach(t => allWrites.push({ col: 'templates', doc: t.UID, data: t }));
                dbTestimonials.forEach(ts => allWrites.push({ col: 'testimonials', doc: ts.UID, data: ts }));

                // FIREBASE LIMIT: Maks 500 dokumen per pengiriman.
                // SOLUSI: Pecah antrean menjadi potongan (chunks) berisi 400 data agar tidak error.
                const chunkSize = 400;
                for (let i = 0; i < allWrites.length; i += chunkSize) {
                    const chunk = allWrites.slice(i, i + chunkSize);
                    const batch = db.batch(); 
                    
                    chunk.forEach(w => {
                        batch.set(db.collection(w.col).doc(w.doc), w.data, { merge: true });
                    });
                    
                    await batch.commit(); // Eksekusi pengiriman ke Cloud secara bertahap
                }
            }
        } catch (err) {
            AppLogger.logError(err, "AppStorage.save");
        }
    },
    
    load: async function() {
        try {
            // PERBAIKAN: Fungsi loadItem yang kebal terhadap cache "null" atau rusak
            const loadItem = (key, fallback) => { 
                try {
                    const item = localStorage.getItem(key); 
                    if (!item || item === "null" || item === "undefined") return fallback;
                    return JSON.parse(item) || fallback;
                } catch(e) { 
                    return fallback; 
                } 
            };
            
            // Offline fallback loading
            dbUsers = loadItem('erp_dbUsers', []);
            dbGoldSettings = loadItem('erp_dbGoldSettings', []);
            dbAppointments = loadItem('erp_dbAppointments', []);
            dbFinance = loadItem('erp_dbFinance', []);
            dbTemplates = loadItem('erp_dbTemplates', []);
            dbTestimonials = loadItem('erp_dbTestimonials', []);
            dbServices = loadItem('erp_dbServices', []);
            appConfig = loadItem('erp_appConfig', DEFAULT_CONFIG);
            const globals = loadItem('erp_globals', {GLOBAL_MULTIPLIER: 2326, GLOBAL_MULTIPLIER_SILVER: 15000});
            GLOBAL_MULTIPLIER = globals.GLOBAL_MULTIPLIER;
            GLOBAL_MULTIPLIER_SILVER = globals.GLOBAL_MULTIPLIER_SILVER;

            // Fetch static items if online (Realtime listeners handle the dynamic ones above)
            if (isFirebaseActive && navigator.onLine && !isManualLocalMode) {
                const rootRef = db.collection('erp_data');
                const configDoc = await rootRef.doc('appConfig').get();
                if (configDoc.exists) appConfig = configDoc.data();
                
                const globalDoc = await rootRef.doc('globals').get();
                if (globalDoc.exists) {
                    GLOBAL_MULTIPLIER = globalDoc.data().GLOBAL_MULTIPLIER;
                    GLOBAL_MULTIPLIER_SILVER = globalDoc.data().GLOBAL_MULTIPLIER_SILVER;
                }

                // One-time fetch for static collections
                const fetchCollection = async (colName) => {
                    let temp = [];
                    const snap = await db.collection(colName).get();
                    snap.forEach(d => temp.push(d.data()));
                    return temp;
                };

                dbServices = await fetchCollection('services');
                dbTemplates = await fetchCollection('templates');
                dbTestimonials = await fetchCollection('testimonials');
                
                this.save();
            }
        } catch (err) {
            AppLogger.logError(err, "AppStorage.load");
        }
    }
};