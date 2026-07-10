const AppStorage = {
    save: async function(collectionName = null, dataItem = null) {
        try {
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
                if (collectionName && dataItem) {
                    const docId = dataItem.UID || dataItem.id;
                    if (docId) {
                        await db.collection(collectionName).doc(docId).set(dataItem, { merge: true });
                    }
                } else {
                    // Selalu perbarui basis konfigurasi inti
                    await db.collection('erp_data').doc('appConfig').set(appConfig, { merge: true });
                    await db.collection('erp_data').doc('globals').set({GLOBAL_MULTIPLIER, GLOBAL_MULTIPLIER_SILVER}, { merge: true });
                    
                    // OTOMATIS BERSIHKAN DESINKRONISASI: Upload basis master harga & jasa karena ukurannya kecil
                    dbGoldSettings.forEach(gold => db.collection('gold_settings').doc(gold.UID).set(gold, { merge: true }));
                    dbServices.forEach(s => db.collection('services').doc(s.UID).set(s, { merge: true }));
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