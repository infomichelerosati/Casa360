// js/dashboard.js

async function initDashboard() {
    console.log("Inizializzazione Modulo Dashboard...");

    // Aggiorna la data
    const dateEl = document.getElementById('dash-date');
    if (dateEl) {
        const today = new Date();
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        dateEl.textContent = today.toLocaleDateString('it-IT', options);
    }

    // Carica dati
    fetchUrgentSpesa();
    fetchNextEvent();
    fetchDailyMeds();
    fetchTodayShifts();
    fetchAppInstalls();

    // Al primo caricamento, prova a scaricare il meteo basandosi sull'ultima posizione (se salvata in localStorage) o fallback Roma.
    // Il permesso geolocalizzazione verrà chiesto la prima volta che si esegue la funzione meteo vera e propria.
    fetchWeather();

    // Inizializza GridStack per il layout della Dashboard Drag & Drop
    setTimeout(() => {
        initGridStack();
    }, 100);
}

// ==========================================
// GRIDSTACK.JS (DRAG & DROP DASHBOARD)
// ==========================================
let dashGrid = null;
window.isGridEditing = false;

async function initGridStack() {
    // Configurazione base della griglia
    dashGrid = GridStack.init({
        cellHeight: 80,
        margin: 10,
        disableOneColumnMode: true, // Fix: consente il ridimensionamento orizzontale anche su schermi mobili
        float: false,
        animate: true,
        staticGrid: true, // Di default la griglia è bloccata per consentire lo scorrimento Touch su mobile!
        acceptWidgets: true // Permette di ricevere widget dal dock
    }, '#dashboard-grid');

    // Inizializza la Dock (Pannello moduli nascosti)
    window.dockGrid = GridStack.init({
        cellHeight: 80,
        margin: 10,
        column: 4, // Dock ha sempre 4 colonne fisse
        disableOneColumnMode: true,
        float: true,
        animate: true,
        staticGrid: true,
        acceptWidgets: function (el) { return true; } // Accetta tutto
    }, '#dashboard-dock');

    const editBtn = document.getElementById('btn-edit-dashboard');
    const dockContainer = document.getElementById('dashboard-dock-wrapper');

    if (editBtn) {
        editBtn.addEventListener('click', async () => {
            window.isGridEditing = !window.isGridEditing;

            if (window.isGridEditing) {
                // Entra in modalità EDIT
                dashGrid.setStatic(false);
                if (window.dockGrid) window.dockGrid.setStatic(false);
                dockContainer.classList.remove('hidden');

                editBtn.innerHTML = '<i class="fa-solid fa-check text-xl"></i>';
                editBtn.classList.replace('text-darkblue-icon', 'text-green-500');
                document.querySelectorAll('.grid-stack-item-content > .clay-card').forEach(c => c.classList.add('animate-pulse', 'border-2', 'border-darkblue-accent/50'));
            } else {
                // Salva ed esce da modalità EDIT
                dashGrid.setStatic(true);
                if (window.dockGrid) window.dockGrid.setStatic(true);
                dockContainer.classList.add('hidden');

                editBtn.innerHTML = '<i class="fa-solid fa-gear text-xl"></i>';
                editBtn.classList.replace('text-green-500', 'text-darkblue-icon');
                document.querySelectorAll('.grid-stack-item-content > .clay-card').forEach(c => c.classList.remove('animate-pulse', 'border-2', 'border-darkblue-accent/50'));

                // Salva layout su Subapase
                await saveGridLayout();
            }
        });
    }

    // Carica layout salvato da DB
    await loadGridLayout();
}

async function saveGridLayout() {
    if (!dashGrid || !window.supabase) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Estrai il layout corrente usando grid.save()
        // NOTA: Per usare un identificatore persistente usiamo gli attributi gs-id
        let layoutNodes = dashGrid.save();
        let dockNodes = window.dockGrid ? window.dockGrid.save() : [];

        // Pulisce l'oggetto eliminando il contenuto html e tenendo solo id, state (hidden) e geometrie
        const layoutData = layoutNodes.map(node => ({
            id: node.id,
            x: node.x,
            y: node.y,
            w: node.w,
            h: node.h,
            hidden: false
        }));

        dockNodes.forEach(node => {
            layoutData.push({
                id: node.id,
                x: node.x || 0,
                y: node.y || 0,
                w: node.w,
                h: node.h,
                hidden: true
            });
        });

        const { error } = await supabase
            .from('family_members')
            .update({ dashboard_layout: layoutData })
            .eq('id', user.id);

        if (error) throw error;

        console.log("Layout dashboard GridStack salvato con successo!", layoutData);
        if (window.showToast) window.showToast('Layout Salvato', 'La tua dashboard è stata salvata.', 'fa-check', 'text-green-500');
    } catch (e) {
        console.error("Errore salvataggio layout dashboard:", e);
    }
}

async function loadGridLayout() {
    if (!dashGrid || !window.supabase) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch user preferences dalla colonna jsonb aggiunta (dashboard_layout)
        const { data, error } = await supabase
            .from('family_members')
            .select('dashboard_layout')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Errore fetch layout, uso predefinito.", error);
            return;
        }

        if (data && data.dashboard_layout && Array.isArray(data.dashboard_layout) && data.dashboard_layout.length > 0) {
            dashGrid.batchUpdate();
            if (window.dockGrid) window.dockGrid.batchUpdate();

            const pCardsList = Array.from(document.querySelectorAll('.grid-stack-item'));

            data.dashboard_layout.forEach(savedNode => {
                // Troviamo l'elemento dovunque sia (nella main o nel dock)
                const el = pCardsList.find(c => c.getAttribute('gs-id') === savedNode.id);
                if (el) {
                    if (savedNode.hidden) {
                        // Spostiamo nel dock se necessario
                        if (el.parentElement.parentElement.id !== 'dashboard-dock' && window.dockGrid) {
                            dashGrid.removeWidget(el, false); // false = non eliminare dal DOM
                            window.dockGrid.addWidget(el, { w: savedNode.w, h: savedNode.h });
                        } else if (window.dockGrid) {
                            window.dockGrid.update(el, { w: savedNode.w, h: savedNode.h });
                        }
                    } else {
                        // Manteniamo o riportiamo sulla griglia principale
                        if (el.parentElement.parentElement.id === 'dashboard-dock' && window.dockGrid) {
                            window.dockGrid.removeWidget(el, false);
                            dashGrid.addWidget(el, { x: savedNode.x, y: savedNode.y, w: savedNode.w, h: savedNode.h });
                        } else {
                            dashGrid.update(el, { x: savedNode.x, y: savedNode.y, w: savedNode.w, h: savedNode.h });
                        }
                    }
                }
            });

            dashGrid.commit();
            if (window.dockGrid) window.dockGrid.commit();
            console.log("Layout custom sincronizzato:", data.dashboard_layout);
        }

    } catch (e) {
        console.warn("Impossibile caricare layout", e);
    } finally {
        // Applica l'opacità al container per svelarlo fluidamente (Previene il FOUC - flash di contenuto non stilizzato)
        // Usiamo setTimeout per consentire al DOM di renderizzare la griglia fittizia prima del fade in
        setTimeout(() => {
            const gridEl = document.getElementById('dashboard-grid');
            if (gridEl) gridEl.classList.remove('opacity-0');
        }, 150);
    }
}

// ==========================================
// INSTALLAZIONI APP (PWA)
// ==========================================
async function fetchAppInstalls() {
    try {
        if (!window.supabase) return;
        const { count, error } = await supabase
            .from('app_installs')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log("Tracciamento installazioni (ignorato se la tabella non esiste):", error.message);
            return;
        }

        const badgeEl = document.getElementById('badge-installs');
        const valEl = document.getElementById('install-count-val');
        const lblEl = document.getElementById('lbl-installs');

        if (badgeEl && valEl && count !== null && count > 0) {
            valEl.textContent = count;
            badgeEl.classList.remove('hidden');
            badgeEl.classList.add('flex');
            if (lblEl) lblEl.style.display = 'block';
        }
    } catch (e) {
        console.error("Errore fetch conteggio app:", e);
    }
}

// ==========================================
// FARMACI GIORNALIERI
// ==========================================
window.fetchDailyMeds = async function () {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const medsSection = document.getElementById('dash-meds-section');
        const medsList = document.getElementById('dash-meds-list');
        if (!medsSection || !medsList) return;

        // 1. Fetch Terapie assegnate all'utente loggato
        const { data: myMeds, error: medsErr } = await supabase
            .from('health_medications')
            .select('*')
            .eq('assigned_to', user.id);

        if (medsErr) throw medsErr;

        if (!myMeds || myMeds.length === 0) {
            medsSection.style.display = 'none';
            return;
        }

        // Mostra la sezione
        medsSection.style.display = 'flex';

        // 2. Fetch Log di assunzione di OGGI per l'utente loggato
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local format
        const { data: logs, error: logsErr } = await supabase
            .from('health_medication_logs')
            .select('medication_id')
            .eq('member_id', user.id)
            .eq('date_taken', todayStr);

        if (logsErr) throw logsErr;

        // Contiamo quante ne ha già prese per ogni med_id oggi
        const countTaken = {};
        if (logs) {
            logs.forEach(lg => {
                countTaken[lg.medication_id] = (countTaken[lg.medication_id] || 0) + 1;
            });
        }

        medsList.innerHTML = '';
        let generatedButtons = 0;

        myMeds.forEach(med => {
            // Estrapoliamo il numero di assunzioni (es. "2/giorno" => 2, "1 volta" => 1, default 1 se vuoto)
            let requiredDoses = 1;
            if (med.frequency) {
                const match = med.frequency.match(/(\d+)/);
                if (match) requiredDoses = parseInt(match[1]);
            }

            const takenSoFar = countTaken[med.id] || 0;
            const remainingToTake = requiredDoses - takenSoFar;

            // Se ne ha ancora da prendere, generiamo un bottone per ognuna mancante
            if (remainingToTake > 0) {
                for (let i = 0; i < remainingToTake; i++) {
                    generatedButtons++;
                    const btnId = `medbtn-${med.id}-${i}`;
                    const btn = document.createElement('div');
                    btn.id = btnId;
                    btn.className = 'clay-card bg-darkblue-card rounded-2xl p-4 flex justify-between items-center transition-all duration-500 transform opacity-100 translate-x-0';
                    btn.innerHTML = `
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 shadow-inner">
                                <i class="fa-solid fa-pills"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h4 class="font-bold text-darkblue-heading truncate">${med.name}</h4>
                                <p class="text-xs text-darkblue-icon truncate">${med.dosage || 'Dose standard'}</p>
                            </div>
                        </div>
                        <button class="log-pill-btn clay-btn-primary px-4 py-2 rounded-xl text-white font-bold text-sm flex gap-2 items-center active:scale-95 transition-transform" data-medid="${med.id}" data-btnid="${btnId}">
                            <i class="fa-solid fa-check pointer-events-none"></i> Presa
                        </button>
                    `;
                    medsList.appendChild(btn);
                }
            } else if (requiredDoses > 0 && takenSoFar >= requiredDoses) {
                // Ha preso tutto per oggi per questo farmaco, mostriamo un indicatore di completamento
                const el = document.createElement('div');
                el.className = 'clay-card bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex justify-between items-center opacity-70';
                el.innerHTML = `
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-check-double drop-shadow-sm"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-bold text-green-500 truncate line-through">${med.name}</h4>
                            <p class="text-[10px] text-green-500/80 uppercase tracking-widest font-bold">Completato per oggi</p>
                        </div>
                    </div>
                `;
                medsList.appendChild(el);
            }
        });

        // Event listener per segnare "presa"
        document.querySelectorAll('.log-pill-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget;
                const medId = button.dataset.medid;
                const domNodeId = button.dataset.btnid;
                await logMedicationTaken(medId, domNodeId);
            });
        });

    } catch (err) {
        console.error("Errore fetch terapie dashboard", err);
    }
}

window.logMedicationTaken = async function (medId, domNodeId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Trova il family_id
        const { data: memData } = await supabase.from('family_members').select('family_id').eq('id', user.id).single();
        if (!memData) return;

        // Visual Feedback Immediato
        const domNode = document.getElementById(domNodeId);
        if (domNode) {
            const btnObj = domNode.querySelector('.log-pill-btn');
            if (btnObj) btnObj.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        }

        const exactTime = new Date().toLocaleTimeString('it-IT', { hour12: false });
        const exactDate = new Date().toLocaleDateString('en-CA');

        // 2. Inserisci Log
        const { error } = await supabase.from('health_medication_logs').insert([{
            family_id: memData.family_id,
            medication_id: medId,
            member_id: user.id,
            date_taken: exactDate,
            time_taken: exactTime
        }]);

        if (error) throw error;

        // 3. Fai "volare via" la card dalla UI e ricarica
        if (domNode) {
            domNode.classList.remove('opacity-100', 'translate-x-0');
            domNode.classList.add('opacity-0', 'translate-x-full');
            setTimeout(() => {
                fetchDailyMeds(); // Ricarica tutto l'array (mostrerà la versione 'verde completata' se era l'ultima)
            }, 500);
        }

    } catch (err) {
        console.error("Errore salvataggio assunzione pillola", err);
        alert("Errore di connessione.");
        const domNode = document.getElementById(domNodeId);
        if (domNode) {
            const btnObj = domNode.querySelector('.log-pill-btn');
            if (btnObj) btnObj.innerHTML = '<i class="fa-solid fa-check"></i> Presa';
        }
    }
}

// ==========================================
// METEO
// ==========================================

const WMO_CODES = {
    0: { desc: 'Sereno', icon: 'fa-sun', color: 'text-yellow-400 animate-[pulse_4s_ease-in-out_infinite]' },
    1: { desc: 'Prevalentemente sereno', icon: 'fa-sun', color: 'text-yellow-400 animate-[pulse_4s_ease-in-out_infinite]' },
    2: { desc: 'Parz. Nuvoloso', icon: 'fa-cloud-sun', color: 'text-gray-300 animate-[bounce_3s_ease-in-out_infinite]' },
    3: { desc: 'Nuvoloso', icon: 'fa-cloud', color: 'text-gray-400 animate-[bounce_3s_ease-in-out_infinite]' },
    45: { desc: 'Nebbia', icon: 'fa-smog', color: 'text-gray-300 animate-[pulse_3s_ease-in-out_infinite]' },
    48: { desc: 'Nebbia di brina', icon: 'fa-smog', color: 'text-gray-300 animate-[pulse_3s_ease-in-out_infinite]' },
    51: { desc: 'Pioviggine leg.', icon: 'fa-cloud-rain', color: 'text-blue-300 animate-[bounce_2s_ease-in-out_infinite]' },
    53: { desc: 'Pioviggine mod.', icon: 'fa-cloud-rain', color: 'text-blue-400 animate-[bounce_2s_ease-in-out_infinite]' },
    55: { desc: 'Pioviggine forte', icon: 'fa-cloud-showers-heavy', color: 'text-blue-500 animate-[bounce_1.5s_ease-in-out_infinite]' },
    61: { desc: 'Pioggia leggera', icon: 'fa-cloud-rain', color: 'text-blue-400 animate-[bounce_2s_ease-in-out_infinite]' },
    63: { desc: 'Pioggia moderata', icon: 'fa-cloud-showers-water', color: 'text-blue-500 animate-[bounce_1.5s_ease-in-out_infinite]' },
    65: { desc: 'Pioggia forte', icon: 'fa-cloud-showers-heavy', color: 'text-blue-600 animate-[bounce_1s_ease-in-out_infinite]' },
    71: { desc: 'Neve leggera', icon: 'fa-snowflake', color: 'text-blue-200 animate-[spin_6s_linear_infinite]' },
    73: { desc: 'Neve moderata', icon: 'fa-snowflake', color: 'text-blue-200 animate-[spin_4s_linear_infinite]' },
    75: { desc: 'Neve forte', icon: 'fa-snowflake', color: 'text-blue-300 animate-[spin_2s_linear_infinite]' },
    95: { desc: 'Temporale', icon: 'fa-cloud-bolt', color: 'text-purple-500 animate-[bounce_1s_ease-in-out_infinite]' },
};

window.fetchWeather = async function () {
    const iconEl = document.getElementById('weather-icon');
    const tempEl = document.getElementById('weather-temp');
    const descEl = document.getElementById('weather-desc');
    const cityEl = document.getElementById('weather-city');

    if (!iconEl || !tempEl || !descEl) return;

    tempEl.textContent = '...';
    descEl.textContent = 'Rilevamento...';
    if (cityEl) cityEl.textContent = '';

    // Funzione interna per chiamare l'API Open-Meteo
    const loadMeteo = async (lat, lon, cityNameLabel) => {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const data = await res.json();

            if (data && data.current_weather) {
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;

                const wInfo = WMO_CODES[code] || { desc: 'Sconosciuto', icon: 'fa-cloud', color: 'text-gray-400' };

                tempEl.textContent = `${temp}°`;
                descEl.textContent = wInfo.desc;
                iconEl.className = `fa-solid ${wInfo.icon} text-4xl ${wInfo.color} mb-2 drop-shadow-md`;

                if (cityEl && cityNameLabel) {
                    cityEl.textContent = cityNameLabel;
                }
            }
        } catch (e) {
            console.error("Errore ricarica meteo", e);
            tempEl.textContent = 'Er';
            descEl.textContent = 'Offline';
        }
    };

    // Controllo se l'utente ha forzato manualmente la città da "Impostazioni Famiglia"
    const isManual = localStorage.getItem('family_os_city_manual') === 'true';

    if (isManual) {
        // Usa direttamente le coordinate salvate nel localStorage dalla ricerca
        const savedLat = localStorage.getItem('family_os_lat') || 41.9028;
        const savedLon = localStorage.getItem('family_os_lon') || 12.4964;
        const savedName = localStorage.getItem('family_os_city_name') || 'Impostata';

        // Carica meteo per la città forzata
        loadMeteo(savedLat, savedLon, savedName);
    } else {
        // Chiediamo la posizione al browser (Automatico)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    // Salviamo le ultime coordinate funzionanti
                    localStorage.setItem('family_os_lat', lat);
                    localStorage.setItem('family_os_lon', lon);
                    loadMeteo(lat, lon, 'Posizione Attuale');
                },
                (err) => {
                    console.warn("Geolocalizzazione negata o fallita, uso coordinate salvate o Roma.");
                    const savedLat = localStorage.getItem('family_os_lat') || 41.9028;
                    const savedLon = localStorage.getItem('family_os_lon') || 12.4964;
                    loadMeteo(savedLat, savedLon, 'Roma (Predefinita)');
                },
                { timeout: 5000 }
            );
        } else {
            loadMeteo(41.9028, 12.4964, 'Roma (Predefinita)');
        }
    }
}

const DASH_COLOR_MAP = {
    'Generico': 'text-gray-400 bg-gray-400/20',
    'Visita Medica': 'text-red-400 bg-red-500/20',
    'Lavoro': 'text-blue-400 bg-blue-500/20',
    'Scuola': 'text-orange-400 bg-orange-500/20',
    'Scadenza Veicolo': 'text-red-500 bg-red-50/20 border border-red-500', // Rosso auto
    'Scadenza Pet': 'text-amber-500 bg-amber-500/20',
    'Scadenza Documento': 'text-orange-500 bg-orange-500/20'
};

const DASH_ICON_MAP = {
    'Generico': 'fa-solid fa-calendar-check',
    'Visita Medica': 'fa-solid fa-stethoscope',
    'Lavoro': 'fa-solid fa-briefcase',
    'Scuola': 'fa-solid fa-graduation-cap',
    'Scadenza Veicolo': 'fa-solid fa-car-burst',
    'Scadenza Pet': 'fa-solid fa-paw',
    'Scadenza Documento': 'fa-solid fa-folder-open'
};

function getDashLocalDayStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function fetchNextEvent() {
    const eventWidget = document.getElementById('dash-next-event');
    if (!eventWidget) return;

    // Prendiamo l'inizio e la fine di oggi
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = today.toISOString();

    today.setHours(23, 59, 59, 999);
    const endDate = today.toISOString();

    try {
        const [eventsRes, vehRes, petsRes, docsRes] = await Promise.all([
            supabase.from('calendar_events')
                .select('*')
                .gte('start_time', startDate)
                .lte('start_time', endDate)
                .order('start_time', { ascending: true }),
            supabase.from('family_vehicles').select('*'),
            supabase.from('pet_reminders').select('*, family_pets(name)'),
            supabase.from('family_documents')
                .select('id, title, category, expiry_date, family_members(name)')
                .eq('expiry_date', getDashLocalDayStr(today))
        ]);

        if (eventsRes.error) throw eventsRes.error;
        if (vehRes.error) throw vehRes.error;
        if (petsRes.error) throw petsRes.error;
        if (docsRes.error) throw docsRes.error;

        let data = eventsRes.data;

        // Aggiungi Scadenze Veicoli come eventi odierni
        const localTodayStr = getDashLocalDayStr(today);
        vehRes.data.forEach(veh => {
            const addExp = (dateStr, typeName) => {
                if (dateStr === localTodayStr) {
                    data.push({
                        id: 'v-' + veh.id + '-' + typeName,
                        title: `${veh.name}`,
                        event_type: 'Scadenza Veicolo',
                        start_time: localTodayStr + "T08:00:00Z", // fisso al mattino
                        is_virtual: true,
                        virtual_desc: typeName // "Assicurazione", "Bollo"...
                    });
                }
            };
            addExp(veh.insurance_expiry, 'Assicurazione');
            addExp(veh.tax_expiry, 'Bollo');
            addExp(veh.inspection_expiry, 'Revisione');
            if (veh.is_gpl && veh.gpl_expiry) addExp(veh.gpl_expiry, 'GPL');
        });

        // Aggiungi Scadenze Animali di oggi
        petsRes.data.forEach(rem => {
            if (rem.due_date === localTodayStr && !rem.is_completed) {
                const petName = rem.family_pets ? rem.family_pets.name : 'Pet';
                const timeStr = rem.due_time || '08:00:00';

                data.push({
                    id: 'p-' + rem.id,
                    title: `${petName}`,
                    event_type: 'Scadenza Pet',
                    start_time: `${localTodayStr}T${timeStr}Z`,
                    is_virtual: true,
                    virtual_desc: rem.reminder_type, // "Vaccino", "Visita"...
                    is_pet: true
                });
            }
        });

        // Aggiungi Scadenze Documenti di oggi
        docsRes.data.forEach(doc => {
            if (doc.expiry_date === localTodayStr) {
                const owner = doc.family_members ? doc.family_members.name : '';
                const ownerText = owner ? ` (${owner})` : '';
                data.push({
                    id: 'd-' + doc.id,
                    title: `${doc.title}${ownerText}`,
                    event_type: 'Scadenza Documento',
                    start_time: `${localTodayStr}T08:00:00Z`,
                    is_virtual: true,
                    virtual_desc: doc.category,
                    is_doc: true
                });
            }
        });

        // Riordina per orario decrescente (dal mattino alla sera)
        data.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        // Filtriamo quelli già passati rispetto all'ora attuale
        const now = new Date();
        const futureEvents = data.filter(ev => {
            // Se è un evento virtuale intera giornata (veicolo), lo teniamo valido tutto il giorno (is_virtual = true, is_pet = false o undefined)
            if (ev.is_virtual && !ev.is_pet) return true;
            // Altrimenti, filtriamo per orario (reali o pet con orario)
            return new Date(ev.start_time) >= now;
        });

        // Prendiamo fino a 3 appuntamenti futuri (o quelli di oggi se passati)
        let nextEvents = futureEvents.slice(0, 3);

        // Se non ce ne sono nel futuro ma ce n'erano oggi, prendiamo gli ultimi passati per riempire
        if (nextEvents.length === 0 && data.length > 0) {
            nextEvents = data.slice(-3).reverse(); // Prendiamo gli ultimi 3 passati 
        }

        if (nextEvents.length > 0) {
            eventWidget.innerHTML = '';

            // Container for the list
            const listContainer = document.createElement('div');
            listContainer.className = 'flex flex-col gap-2 h-full justify-center w-full';

            nextEvents.forEach((evt, index) => {
                const timeStr = (evt.is_virtual && !evt.is_pet) ? "Oggi" : new Date(evt.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                const subtitle = evt.is_virtual ? evt.virtual_desc : evt.event_type;

                const colorClasses = DASH_COLOR_MAP[evt.event_type] || DASH_COLOR_MAP['Generico'];
                const iconClass = DASH_ICON_MAP[evt.event_type] || DASH_ICON_MAP['Generico'];

                // Truncate logic for smaller view
                const isFirst = index === 0;

                const html = `
                    <div class="flex items-center gap-3 w-full group">
                        <div class="w-8 h-8 rounded-full ${colorClasses} flex items-center justify-center shadow-inner shrink-0 ${isFirst ? 'scale-110' : 'opacity-80 scale-90'} transition-transform">
                            <i class="${iconClass} text-xs"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="leading-none font-bold text-darkblue-heading truncate ${isFirst ? 'text-base' : 'text-sm opacity-90'}" title="${evt.title}">${evt.title}</h3>
                            <p class="text-[10px] text-darkblue-accent font-bold mt-0.5 truncate">${timeStr} <span class="text-darkblue-icon opacity-60 ml-1">${subtitle}</span></p>
                        </div>
                    </div>
                `;
                listContainer.insertAdjacentHTML('beforeend', html);
            });

            eventWidget.appendChild(listContainer);

            eventWidget.onclick = () => {
                const firstEvt = nextEvents[0];
                if (firstEvt.is_virtual) {
                    if (firstEvt.is_pet) {
                        const animBtn = document.querySelector('.nav-item[data-module="animali"]');
                        if (animBtn) animBtn.click();
                    } else if (firstEvt.is_doc) {
                        const docBtn = document.querySelector('.nav-item[data-module="documenti"]');
                        if (docBtn) docBtn.click();
                    } else {
                        const veicoliBtn = document.querySelector('.nav-item[data-module="veicoli"]');
                        if (veicoliBtn) veicoliBtn.click();
                    }
                } else {
                    const calBtn = document.querySelector('.nav-item[data-module="calendario"]');
                    if (calBtn) calBtn.click();
                }
            };
            eventWidget.classList.add('cursor-pointer', 'transition-transform', 'active:scale-[0.98]');

        } else {
            eventWidget.innerHTML = `
                <div class="w-10 h-10 rounded-full text-gray-400 bg-gray-400/20 flex items-center justify-center mb-2 shadow-inner">
                    <i class="fa-solid fa-calendar-check"></i>
                </div>
                <div>
                    <h3 class="text-lg leading-tight font-bold text-darkblue-heading">Nessun Evento</h3>
                    <p class="text-xs text-darkblue-accent font-bold mt-1">Oggi non ci sono eventi in programma.</p>
                </div>
            `;
        }

    } catch (err) {
        console.error("Errore next event:", err);
        eventWidget.innerHTML = `
            <div class="w-10 h-10 rounded-full text-red-400 bg-red-400/20 flex items-center justify-center mb-2 shadow-inner">
                <i class="fa-solid fa-exclamation-triangle"></i>
            </div>
            <div>
                <h3 class="text-lg leading-tight font-bold text-red-400">Errore</h3>
                <p class="text-xs text-red-400 font-bold mt-1">Impossibile caricare eventi.</p>
            </div>
        `;
    }
}

async function fetchUrgentSpesa() {
    const listContainer = document.getElementById('dash-urgenti-list');
    if (!listContainer) return;

    try {
        const { data, error } = await supabase
            .from('shopping_list')
            .select('*')
            .eq('is_urgent', true)
            .eq('is_bought', false)
            .order('created_at', { ascending: false })
            .limit(3);

        if (error) throw error;

        if (data.length === 0) {
            listContainer.innerHTML = `
                <div class="clay-item p-4 rounded-clay bg-darkblue-card text-center text-darkblue-icon text-sm">
                    Nessuna spesa urgente registrata.
                </div>
            `;
            return;
        }

        renderUrgentSpesa(data, listContainer);

    } catch (err) {
        console.error("Errore fetch spese urgenti:", err);
        listContainer.innerHTML = `
            <div class="clay-item p-4 rounded-clay bg-darkblue-card text-center text-red-400 text-sm">
                Impossibile caricare le urgenze.
            </div>
        `;
    }
}

function renderUrgentSpesa(items, container) {
    container.innerHTML = '';

    items.forEach(item => {
        const html = `
            <label class="clay-item flex items-center gap-4 p-4 rounded-clay bg-darkblue-card cursor-pointer group hover:brightness-110 transition-all">
                <div class="relative flex items-center justify-center w-6 h-6">
                    <input type="checkbox" onchange="toggleDashSpesaStatus('${item.id}', this.checked)" class="clay-checkbox peer appearance-none w-6 h-6 rounded-full bg-darkblue-base cursor-pointer transition-all checked:bg-darkblue-accent flex-shrink-0">
                    <i class="fa-solid fa-check absolute text-white text-xs opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"></i>
                </div>
                <span class="font-medium flex-1 text-darkblue-text group-hover:text-darkblue-heading transition-colors">${item.item_name}</span>
                <span class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
            </label>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// Funzione globale che aggiorna lo stato dalla dashboard
window.toggleDashSpesaStatus = async function (id, isBought) {
    try {
        const { error } = await supabase
            .from('shopping_list')
            .update({ is_bought: isBought })
            .eq('id', id);
        if (error) throw error;

        // Ricarica per farle sparire dalla dashboard (essendo urgenti e non comprate)
        setTimeout(() => {
            fetchUrgentSpesa();
        }, 300); // Piccolo timeout per godersi l'animazione della checkbox
    } catch (err) {
        console.error("Update error:", err);
        alert("Errore durante l'aggiornamento. Riprova.");
        fetchUrgentSpesa();
    }
};

// ==========================================
// TURNI DI LAVORO (Oggi)
// ==========================================
window.fetchTodayShifts = async function () {
    const widget = document.getElementById('dash-shifts-widget');
    const container = document.getElementById('dash-shifts-list');
    if (!widget || !container) return;

    try {
        const familyId = await window.getUserFamilyId();
        const todayStr = getDashLocalDayStr(new Date());

        const { data, error } = await supabase
            .from('work_shifts')
            .select('*, family_members(name)')
            .eq('family_id', familyId)
            .eq('shift_date', todayStr);

        if (error) throw error;

        if (!data || data.length === 0) {
            widget.classList.add('hidden');
            return;
        }

        // Ci sono turni, mostriamo il widget
        widget.classList.remove('hidden');
        container.innerHTML = '';

        const SHIFT_MAP = {
            'Lavoro': { icon: 'fa-solid fa-briefcase', color: 'text-blue-500 bg-blue-500/10' },
            'Riposo': { icon: 'fa-solid fa-couch', color: 'text-green-500 bg-green-500/10' },
            'Ferie': { icon: 'fa-solid fa-umbrella-beach', color: 'text-yellow-500 bg-yellow-500/10' },
            'Malattia': { icon: 'fa-solid fa-thermometer', color: 'text-red-500 bg-red-500/10' },
            'Permesso': { icon: 'fa-solid fa-clock', color: 'text-purple-500 bg-purple-500/10' },
            'Reperibilità': { icon: 'fa-solid fa-pager', color: 'text-orange-500 bg-orange-500/10' },
            'Altro': { icon: 'fa-solid fa-pencil', color: 'text-gray-500 bg-gray-500/10' }
        };

        data.forEach(shift => {
            const memberName = shift.family_members ? shift.family_members.name : 'Sconosciuto';
            const typeInfo = SHIFT_MAP[shift.shift_type] || SHIFT_MAP['Altro'];
            let timeText = shift.shift_type;
            if (shift.start_time && shift.end_time && shift.shift_type === 'Lavoro') {
                timeText = `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}`;
            }

            const dotColor = typeInfo.color.split(' ')[0].replace('text-', 'bg-');
            const html = `
                <div class="flex items-center justify-between gap-2 border-b border-darkblue-base pb-1.5 mb-1.5 last:border-0 last:mb-0 last:pb-0 w-full shrink-0">
                    <div class="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                        <div class="w-2 h-2 rounded-full ${dotColor} shrink-0"></div>
                        <span class="text-xs font-bold text-darkblue-heading truncate block w-full">${memberName}</span>
                    </div>
                    <span class="text-[10px] text-darkblue-icon whitespace-nowrap font-medium shrink-0 bg-darkblue-base px-1.5 py-0.5 rounded">${timeText}</span>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (err) {
        console.error("Errore fetch turni oggi:", err);
    }
};
