// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza l'applicazione SPA
    initApp();
});

function initApp() {
    // Setup Navigation Listeners
    setupNavigation();

    let isAppInitialized = false;
    let currentSessionId = null;

    // Ascolta i cambiamenti di stato di autenticazione
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth event:", event);
        if (event === 'SIGNED_IN') {
            // Force re-render if it's a new login or we weren't initialized
            if (!isAppInitialized || currentSessionId !== session?.user?.id) {
                isAppInitialized = true;
                currentSessionId = session?.user?.id;
                renderApp(session);
            }
        } else if (event === 'SIGNED_OUT') {
            isAppInitialized = false;
            currentSessionId = null;
            renderApp(null);
        }
    });

    // Controllo iniziale della sessione
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && !isAppInitialized) {
            isAppInitialized = true;
            currentSessionId = session?.user?.id;
            renderApp(session);
        } else if (!session && !isAppInitialized) {
            isAppInitialized = true;
            currentSessionId = null;
            renderApp(null);
        }
    });
}

async function renderApp(session) {
    const nav = document.querySelector('nav');

    if (!session) {
        // Nascondi nav e forza il modulo auth
        if (nav) nav.classList.add('hidden');
        loadModule('auth', true);
    } else {
        // LOGICA DI SELF-HEALING PER UTENTI GIA' REGISTRATI SU SUPABASE DA ALTRE APP
        // Verifica se l'utente ha un profilo in family_members
        try {
            const { error } = await supabase.from('family_members').select('id').eq('id', session.user.id).single();
            if (error && error.code === 'PGRST116') {
                console.log("Creazione automatica famiglia in corso per account pre-esistente...");

                const emailName = session.user.email.split('@')[0];
                const displayName = session.user.user_metadata?.display_name || emailName;

                // 1. Crea Family Group
                const newJoinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                const newFamilyId = crypto.randomUUID();
                const { error: familyError } = await supabase
                    .from('family_groups')
                    .insert([{ id: newFamilyId, name: `Famiglia di ${displayName}`, join_code: newJoinCode }]);

                if (familyError) throw familyError;

                // 2. Inserisce Profilo Amministratore
                const { error: memberError } = await supabase.from('family_members').insert([{
                    id: session.user.id,
                    family_id: newFamilyId,
                    name: displayName,
                    role: 'admin',
                    avatar_color: '#3b82f6'
                }]);

                if (memberError) throw memberError;
                console.log("Famiglia e profilo creati con successo.");
            }
        } catch (err) {
            console.error("Errore verifica profilo famiglia:", err);
        }

        // Inizializza Listeners Realtime per Notifiche
        initRealtimeSubscriptions();

        // Mostra nav e carica l'ultimo modulo visitato o la dashboard
        if (nav) nav.classList.remove('hidden');

        let lastModule = localStorage.getItem('family_os_last_module') || 'dashboard';

        // Ensure nav state reflects loaded module
        window.navigateApp(lastModule);

        // Carica le notifiche globali all'avvio
        setTimeout(() => {
            if (typeof window.updateNotificationBadges === 'function') {
                window.updateNotificationBadges();
            }
        }, 1000);
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const moduleName = item.dataset.module;
            window.navigateApp(moduleName);
        });
    });
}

// Global helper for navigating between modules programmically
window.navigateApp = function (moduleName) {
    const navItems = document.querySelectorAll('.nav-item');

    // Reset all tabs
    navItems.forEach(nav => {
        nav.classList.remove('text-darkblue-accent', 'clay-item', 'bg-darkblue-base', 'rounded-full');
        nav.classList.add('text-darkblue-icon');
    });

    // Save current module to localStorage to recover state on reload
    localStorage.setItem('family_os_last_module', moduleName);

    // Try finding the exact module in the navbar
    let targetNav = document.querySelector(`.nav-item[data-module="${moduleName}"]`);

    // If not found (secondary module), fall back to the "menu" (Altro) icon
    if (!targetNav && moduleName !== 'dashboard' && moduleName !== 'calendario' && moduleName !== 'spesa' && moduleName !== 'finanze') {
        targetNav = document.querySelector(`.nav-item[data-module="menu"]`);
    }

    if (targetNav) {
        targetNav.classList.remove('text-darkblue-icon');
        targetNav.classList.add('text-darkblue-accent', 'clay-item', 'bg-darkblue-base', 'rounded-full');
    }

    // Load actual content
    loadModule(moduleName);
};

async function loadModule(moduleName, bypassNavCheck = false) {
    const mainContent = document.getElementById('main-content');

    try {
        // Mostra uno spinner di caricamento se la richiesta è lenta (opzionale)
        mainContent.innerHTML = '<div class="flex justify-center items-center h-full"><i class="fa-solid fa-circle-notch fa-spin text-darkblue-accent text-3xl"></i></div>';

        // Fetch del frammento HTML (con bypass cache per sviluppo locale)
        const response = await fetch(`modules/${moduleName}.html?t=${new Date().getTime()}`);

        if (!response.ok) {
            throw new Error(`Modulo ${moduleName} non trovato.`);
        }

        const html = await response.text();

        // Inietta l'HTML
        mainContent.innerHTML = html;

        // Esegui eventuale logica specifica del modulo
        initModuleLogic(moduleName);

    } catch (error) {
        console.error("Errore caricamento modulo:", error);
        mainContent.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center text-darkblue-icon gap-4">
                <i class="fa-solid fa-triangle-exclamation text-4xl"></i>
                <p>Errore durante il caricamento di "${moduleName}".<br>File non trovato o in lavorazione.</p>
            </div>
        `;
    }
}

function initModuleLogic(moduleName) {
    console.log(`Modulo ${moduleName} caricato con successo.`);

    // Switch per inizializzare script specifici del modulo
    switch (moduleName) {
        case 'spesa':
            if (typeof initSpesa === 'function') {
                initSpesa();
            } else {
                console.error("Funzione initSpesa non trovata. Controlla index.html");
            }
            break;
        case 'dashboard':
            if (typeof initDashboard === 'function') {
                initDashboard();
            }
            break;
        case 'calendario':
            if (typeof initCalendario === 'function') {
                initCalendario();
            }
            break;
        case 'finanze':
            if (typeof initFinanze === 'function') {
                initFinanze();
            }
            break;
        case 'veicoli':
            if (typeof initVeicoli === 'function') {
                initVeicoli();
            }
            break;
        case 'famiglia':
            if (typeof initFamiglia === 'function') {
                initFamiglia();
            }
            break;
        case 'menu':
            if (typeof initMenu === 'function') {
                initMenu();
            }
            break;
        case 'salute':
            if (typeof initSalute === 'function') initSalute();
            break;
        case 'sport':
            if (typeof initSport === 'function') initSport();
            break;
        case 'famiglia':
            if (typeof initFamiglia === 'function') {
                initFamiglia();
            }
            break;
        case 'animali':
            if (typeof initAnimali === 'function') {
                initAnimali();
            } else {
                console.error("Funzione initAnimali non trovata. Controlla index.html");
            }
            break;
        case 'bambini':
            if (window.BambiniModule) {
                window.BambiniModule.init();
            } else {
                console.error("Oggetto BambiniModule non trovato. Controlla index.html");
            }
            break;
        case 'lavoro':
            if (typeof initLavoro === 'function') {
                initLavoro();
            } else {
                console.error("Funzione initLavoro non trovata. Controlla index.html");
            }
            break;
        case 'documenti':
            if (typeof initDocumenti === 'function') {
                initDocumenti();
            } else {
                console.error("Funzione initDocumenti non trovata.");
            }
            break;
        case 'pasti':
            if (typeof initPasti === 'function') {
                initPasti();
            } else {
                console.error("Funzione initPasti non trovata.");
            }
            break;
        case 'auth':
            if (typeof initAuth === 'function') {
                initAuth();
            } else {
                console.error("Funzione initAuth non trovata. Controlla index.html");
            }
            break;
    }
}

// Funzione Helper Globale per Modali di Conferma
window.showConfirmModal = function (title, message, onConfirmCallback) {
    const modal = document.getElementById('modal-confirm');
    const content = modal.querySelector('.clay-card');
    document.getElementById('modal-confirm-title').textContent = title;
    document.getElementById('modal-confirm-msg').textContent = message;

    // Animazione entrata
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');

    const cancelBtn = document.getElementById('btn-confirm-cancel');
    const okBtn = document.getElementById('btn-confirm-ok');

    // Rimuovi vecchi listener clonando i nodi 
    const newCancel = cancelBtn.cloneNode(true);
    const newOk = okBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    okBtn.parentNode.replaceChild(newOk, okBtn);

    const close = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.add('scale-95');
    };

    newCancel.addEventListener('click', close);
    newOk.addEventListener('click', () => {
        close();
        if (onConfirmCallback) onConfirmCallback();
    });
};

// ==========================================
// GLOBAL NOTIFICATIONS LOGIC
// ==========================================

// Variabile globale per mantenere in memoria l'ultima lista di notifiche
window.globalNotifications = [];

window.updateNotificationBadges = async function () {
    if (!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        const familyId = await window.getUserFamilyId();
        if (!familyId) return;

        let notifications = [];
        const dismissedAlerts = JSON.parse(localStorage.getItem('family_os_dismissed_alerts') || '{}');
        const now = Date.now();

        const isDismissed = (id) => {
            if (dismissedAlerts[id] && (now - dismissedAlerts[id]) < 24 * 60 * 60 * 1000) return true;
            return false;
        };

        // 1. Spesa Urgente (da comprare)
        const { data: spesaUrgent, error: errSpesa } = await supabase
            .from('shopping_list')
            .select('*')
            .eq('family_id', familyId)
            .eq('is_urgent', true)
            .eq('is_bought', false);

        if (!errSpesa && spesaUrgent && spesaUrgent.length > 0) {
            spesaUrgent.forEach(item => {
                notifications.push({
                    type: 'spesa',
                    title: 'Spesa Urgente',
                    msg: item.item_name,
                    icon: 'fa-cart-shopping',
                    color: 'text-orange-500 bg-orange-500/10 border-orange-500/20'
                });
            });
        }

        // 2. Eventi Calendario Oggi
        const todayLocal = new Date().toLocaleDateString('en-CA');
        const endOfDay = todayLocal + "T23:59:59Z";
        const { data: eventiOggi, error: errEventi } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('family_id', familyId)
            .gte('start_time', todayLocal + "T00:00:00Z")
            .lte('start_time', endOfDay);

        if (!errEventi && eventiOggi && eventiOggi.length > 0) {
            eventiOggi.forEach(ev => {
                notifications.push({
                    type: 'calendario',
                    title: 'Evento Oggi',
                    msg: ev.title,
                    icon: 'fa-calendar-day',
                    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
                });
            });
        }

        // 3. Sport Oggi
        const { data: sportOggi, error: errSport } = await supabase
            .from('sport_activities')
            .select('*, family_members(name)')
            .eq('family_id', familyId)
            .eq('activity_date', todayLocal)
            .eq('is_completed', false);

        if (!errSport && sportOggi && sportOggi.length > 0) {
            sportOggi.forEach(s => {
                notifications.push({
                    type: 'sport',
                    title: 'Allenamento Oggi',
                    msg: `${s.sport_name} (${s.family_members?.name || 'Tu'})`,
                    icon: 'fa-volleyball',
                    color: 'text-orange-500 bg-orange-500/10 border-orange-500/20'
                });
            });
        }

        // 4. Scadenze Salute (Parametri Vitali)
        // Recuperiamo i profili con intervallo > 0 e l'ultimo log per ognuno
        const { data: hProfiles } = await supabase.from('health_profiles').select('member_id, vitals_reminder_interval, family_members(name)').gt('vitals_reminder_interval', 0);
        if (hProfiles) {
            for (const p of hProfiles) {
                const { data: lastLog } = await supabase.from('health_vitals_logs').select('recorded_at').eq('member_id', p.member_id).order('recorded_at', { ascending: false }).limit(1).single();
                
                let isDue = false;
                if (!lastLog) {
                    isDue = true;
                } else {
                    const lastDate = new Date(lastLog.recorded_at);
                    const diffDays = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
                    if (diffDays >= p.vitals_reminder_interval) isDue = true;
                }

                if (isDue) {
                    notifications.push({
                        type: 'salute',
                        title: 'Controllo Salute',
                        msg: `Misurazione parametri per ${p.family_members?.name}`,
                        icon: 'fa-heart-pulse',
                        color: 'text-red-500 bg-red-500/10 border-red-500/20'
                    });
                }
            }
        }

        // 5. Animali (Promemoria oggi)
        const { data: petRem } = await supabase.from('pet_reminders').select('*, family_pets(name)').eq('reminder_date', todayLocal).eq('is_done', false);
        if (petRem) {
            petRem.forEach(r => {
                notifications.push({
                    type: 'animali',
                    title: 'Promemoria Pet',
                    msg: `${r.title} (${r.family_pets?.name})`,
                    icon: 'fa-paw',
                    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                });
            });
        }


        // 6. Scadenze Documenti (entro oggi)
        const { data: docsRem } = await supabase.from('family_documents').select('*, family_members(name)').lte('expiry_date', todayLocal);
        if (docsRem) {
            docsRem.forEach(d => {
                notifications.push({
                    id: 'doc-' + d.id,
                    type: 'documenti',
                    title: 'Documento Scaduto/in Scadenza',
                    msg: `${d.title} (${d.family_members?.name})`,
                    icon: 'fa-folder-open',
                    color: 'text-red-500 bg-red-500/10 border-red-500/20'
                });
            });
        }

        // --- SUGGERIMENTI PROATTIVI (AI FAMILY INSIGHTS) ---

        // 7. Insight Finanze (Se non ci sono spese da 4 giorni)
        const fourDaysAgo = new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: lastExp } = await supabase.from('family_expenses').select('date').eq('family_id', familyId).order('date', { ascending: false }).limit(1).single();
        if ((!lastExp || lastExp.date < fourDaysAgo) && !isDismissed('insight-finanze')) {
            notifications.push({
                id: 'insight-finanze',
                type: 'finanze',
                title: '💡 Risparmio & Gestione',
                msg: 'Non vedo nuove spese registrate ultimamente. Hai qualche scontrino da inserire?',
                icon: 'fa-lightbulb',
                color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
                isSuggestion: true
            });
        }

        // 8. Insight Animali (Cibo/Lettiera - Se sono passati 15 giorni dall'ultimo acquisto)
        const fifteenDaysAgo = new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Nota: Qui andrebbe cercato nello storico delle spese o della lista spesa se mantenuto. 
        // Facciamo una query simbolica sulla shopping_list (supponendo che gli item "bought" restino per un po')
        const { data: lastPetSupply } = await supabase.from('shopping_list')
            .select('updated_at')
            .eq('family_id', familyId)
            .eq('is_bought', true)
            .ilike('item_name', '%cibo%')
            .order('updated_at', { ascending: false })
            .limit(1).single();
            
        if ((!lastPetSupply || lastPetSupply.updated_at < fifteenDaysAgo) && !isDismissed('insight-pet-food')) {
            // Verifica se hanno pet
            const { count: petCount } = await supabase.from('family_pets').select('*', { count: 'exact', head: true }).eq('family_id', familyId);
            if (petCount > 0) {
                notifications.push({
                    id: 'insight-pet-food',
                    type: 'spesa',
                    title: '💡 Scorte Animali',
                    msg: 'È passato un po\' di tempo dall\'ultimo acquisto di cibo. Te ne serve ancora?',
                    icon: 'fa-paw',
                    color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                    isSuggestion: true
                });
            }
        }

        // 9. Insight Sport/Meteo
        if (window.currentWeatherDesc && !isDismissed('insight-meteo')) {
            const isBadWeather = window.currentWeatherDesc.includes('Pioggia') || window.currentWeatherDesc.includes('Temporale') || window.currentWeatherDesc.includes('Neve');
            const isGoodWeather = window.currentWeatherDesc.includes('Sereno') || window.currentWeatherDesc.includes('sole');

            if (isGoodWeather) {
                const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const { data: lastSport } = await supabase.from('sport_activities').select('activity_date').eq('family_id', familyId).order('activity_date', { ascending: false }).limit(1).single();
                if (!lastSport || lastSport.activity_date < twoDaysAgo) {
                    notifications.push({
                        id: 'insight-meteo',
                        type: 'sport',
                        title: '💡 Benessere & Sole',
                        msg: 'C\'è un bel sole oggi! Ti va di registrare un allenamento all\'aperto?',
                        icon: 'fa-sun',
                        color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
                        isSuggestion: true
                    });
                }
            } else if (isBadWeather) {
                // Suggerimento Pasti o Archivio se piove
                const rand = Math.random();
                if (rand > 0.5) {
                    notifications.push({
                        id: 'insight-meteo',
                        type: 'pasti',
                        title: '💡 Comfort Food',
                        msg: 'Fuori piove... il tempo perfetto per spadellare! Cerchiamo una ricetta?',
                        icon: 'fa-utensils',
                        color: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
                        isSuggestion: true
                    });
                } else {
                    notifications.push({
                        id: 'insight-meteo',
                        type: 'documenti',
                        title: '💡 Organizzazione',
                        msg: 'Giornata uggiosa? L\'ideale per mettere ordine nell\'Archivio Documenti!',
                        icon: 'fa-folder-open',
                        color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
                        isSuggestion: true
                    });
                }
            }
        }

        // 10. Insight Bambini (Se ci sono bambini e piove)
        if (window.currentWeatherDesc && (window.currentWeatherDesc.includes('Pioggia') || window.currentWeatherDesc.includes('Temporale')) && !isDismissed('insight-bambini')) {
            const { count: childCount } = await supabase.from('family_members').select('*', { count: 'exact', head: true }).eq('family_id', familyId).eq('role', 'child');
            if (childCount > 0) {
                notifications.push({
                    id: 'insight-bambini',
                    type: 'bambini',
                    title: '💡 Giochi in Casa',
                    msg: 'Fuori non si esce... tempo di qualità in casa! Controlla il diario dei piccoli.',
                    icon: 'fa-shapes',
                    color: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
                    isSuggestion: true
                });
            }
        }

        // 11. Insight Veicoli (Controllo ogni 30 giorni di inattività modulo)
        if (!isDismissed('insight-veicoli')) {
             // Semplificato: se non ci sono scadenze urgenti e sono passati 30gg...
             // Per brevità facciamo un check randomico o basato su ultimo login se avessimo il dato.
             // Usiamo un check di "presenza veicoli"
             const { count: vehCount } = await supabase.from('family_vehicles').select('*', { count: 'exact', head: true }).eq('family_id', familyId);
             if (vehCount > 0 && Math.random() > 0.95) { // Molto raro per non tediare
                notifications.push({
                    id: 'insight-veicoli',
                    type: 'veicoli',
                    title: '💡 Manutenzione',
                    msg: 'Hai controllato i livelli e le scadenze dei veicoli ultimamente?',
                    icon: 'fa-car',
                    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
                    isSuggestion: true
                });
             }
        }

        window.globalNotifications = notifications.filter(n => !isDismissed(n.id || n.title));

        // AGGIORNAMENTO UI:
        const spesaBadge = document.getElementById('nav-badge-spesa');
        if (spesaBadge) {
            // Conta quante notifiche di tipo "spesa" esistono
            const constSpesa = notifications.filter(n => n.type === 'spesa').length;
            if (constSpesa > 0) {
                spesaBadge.classList.remove('hidden');
            } else {
                spesaBadge.classList.add('hidden');
            }
        }

        const bellBadge = document.getElementById('dash-badge-bell');
        const bellNum = document.getElementById('dash-badge-bell-num');
        
        if (bellBadge && bellNum) {
            const count = notifications.length;
            if (count > 0) {
                bellNum.textContent = count;
                bellBadge.classList.remove('hidden');
                
                // Determina il colore e l'importanza
                const hasCritical = notifications.some(n => ['spesa', 'documenti', 'salute'].includes(n.type));
                const hasSportsOrPets = notifications.some(n => ['sport', 'animali'].includes(n.type));
                
                // Rimuovi classi precedenti
                bellBadge.classList.remove('bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'animate-pulse');
                
                if (hasCritical) {
                    bellBadge.classList.add('bg-red-500', 'animate-pulse');
                } else if (hasSportsOrPets) {
                    bellBadge.classList.add('bg-orange-500');
                } else if (notifications.some(n => n.isSuggestion)) {
                    bellBadge.classList.add('bg-yellow-500');
                } else {
                    bellBadge.classList.add('bg-blue-500');
                }
            } else {
                bellBadge.classList.add('hidden');
            }
        }

        // Se il modale notifiche è aperto, ri-renderizza
        const modal = document.getElementById('modal-notifications');
        if (modal && !modal.classList.contains('opacity-0')) {
            window.renderNotificationsList();
        }

    } catch (err) {
        console.error("Errore updateNotificationBadges", err);
    }
};

window.renderNotificationsList = function () {
    const listContainer = document.getElementById('notifications-list');
    if (!listContainer) return;

    if (window.globalNotifications.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-darkblue-icon text-sm py-10">Tutto tranquillo! Nessuna notifica.</div>';
        return;
    }

    listContainer.innerHTML = '';
    window.globalNotifications.forEach(notif => {
        const id = notif.id || notif.title;
        const html = `
            <div class="relative group">
                <div class="clay-card border ${notif.color.split(' ')[2]} rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                     onclick="closeNotificationsPanel(); setTimeout(() => navigateApp('${notif.type}'), 200)">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-inner ${notif.color.replace(/border-[\w-\/]+/, '')}">
                        <i class="fa-solid ${notif.icon}"></i>
                    </div>
                    <div class="flex-1 pr-6">
                         <p class="text-[10px] font-bold uppercase tracking-widest text-darkblue-icon">${notif.title}</p>
                         <p class="text-white font-medium break-words text-sm leading-tight">${notif.msg}</p>
                    </div>
                </div>
                <button onclick="event.stopPropagation(); window.dismissNotification('${id}')" 
                        class="absolute top-3 right-3 w-7 h-7 rounded-full bg-darkblue-base/50 text-darkblue-icon flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
                    <i class="fa-solid fa-xmark text-xs"></i>
                </button>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', html);
    });
};

window.dismissNotification = function(id) {
    const dismissedAlerts = JSON.parse(localStorage.getItem('family_os_dismissed_alerts') || '{}');
    dismissedAlerts[id] = Date.now();
    localStorage.setItem('family_os_dismissed_alerts', JSON.stringify(dismissedAlerts));
    
    // Refresh UI
    window.updateNotificationBadges();
};

window.openNotificationsPanel = function () {
    const modal = document.getElementById('modal-notifications');
    if (!modal) return;
    const sheet = modal.querySelector('.bg-darkblue-bg');
    if (modal && sheet) {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        // Timeout per far terminare il fade-in del bg
        setTimeout(() => {
            sheet.classList.remove('translate-y-full');
        }, 50);

        // Renderizza contenuto
        if (typeof window.renderNotificationsList === 'function') {
            window.renderNotificationsList();
        }
    }
};

window.closeNotificationsPanel = function () {
    const modal = document.getElementById('modal-notifications');
    if (!modal) return;
    const sheet = modal.querySelector('.bg-darkblue-bg');
    if (modal && sheet) {
        sheet.classList.add('translate-y-full');
        // Aspetta animazione
        setTimeout(() => {
            modal.classList.add('opacity-0', 'pointer-events-none');
        }, 300);
    }
};

// Modifica window.navigateApp per lanciare la verifica delle notifiche ad ogni cambio modulo
const originalNavigateApp = window.navigateApp;
window.navigateApp = function (moduleName) {
    originalNavigateApp(moduleName);
    window.updateNotificationBadges();
};

// ==========================================
// SUPABASE REALTIME SUBSCRIPTIONS E TOASTS
// ==========================================

let realtimeChannel = null;

async function initRealtimeSubscriptions() {
    if (!window.supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        const familyId = await window.getUserFamilyId();
        if (!familyId) return;

        // Se c'è già un canale, disiscriviti per evitare duplicati
        if (realtimeChannel) {
            await supabase.removeChannel(realtimeChannel);
        }

        // Crea un canale per ascoltare i cambiamenti sulla famiglia corrente
        realtimeChannel = supabase.channel('family_updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'shopping_list',
                    filter: `family_id=eq.${familyId}`
                },
                (payload) => {
                    const item = payload.new;
                    // Se l'abbiamo creato noi stessi, ignoralo (opzionale, semplificato: mostra a tutti)
                    if (item.added_by !== user.id) {
                        showToast(`🛒 Nuova spesa: ${item.item_name}`, 'Qualcuno ha aggiunto un articolo alla lista.', 'fa-cart-shopping', 'text-orange-500');
                        window.updateNotificationBadges();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'calendar_events',
                    filter: `family_id=eq.${familyId}`
                },
                (payload) => {
                    const ev = payload.new;
                    if (ev.created_by !== user.id) {
                        showToast(`📅 Nuovo Evento: ${ev.title}`, 'Controlla il calendario per i dettagli.', 'fa-calendar-day', 'text-blue-500');
                        window.updateNotificationBadges();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sport_activities',
                    filter: `family_id=eq.${familyId}`
                },
                (payload) => {
                    // Refresh Dashboard Sport Widget
                    if (typeof window.fetchNextSport === 'function') window.fetchNextSport();
                    
                    if (payload.eventType === 'INSERT') {
                        const s = payload.new;
                        // Notifica solo se non è l'utente corrente
                        // (Ma per sport potrebbe essere utile a tutti vedere il nuovo allenamento pianificato)
                        showToast(`🏀 Sport: ${s.sport_name}`, `Allenamento inserito per il ${s.activity_date}`, 'fa-volleyball', 'text-orange-500');
                    }
                }
            )
            .subscribe((status) => {
                console.log("Stato Sottoscrizione Realtime:", status);
            });

    } catch (err) {
        console.error("Errore attivazione realtime:", err);
    }
}

// Funzione globale per mostrare una notifica "Toast" a comparsa dal basso/alto
window.showToast = function (title, message, iconClass, colorClass) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="clay-card bg-darkblue-card rounded-[2rem] p-4 flex items-center gap-4 shadow-2xl transform -translate-y-full opacity-0 pointer-events-auto transition-all duration-500 w-full max-w-sm mb-2 border border-darkblue-base/50">
            <div class="w-10 h-10 rounded-full bg-darkblue-base flex items-center justify-center shrink-0 shadow-inner ${colorClass}">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-xs font-bold text-darkblue-heading truncate">${title}</h4>
                <p class="text-[10px] text-darkblue-icon truncate">${message}</p>
            </div>
            <button onclick="document.getElementById('${toastId}').remove()" class="text-darkblue-icon active:scale-95 transition-transform">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;

    container.insertAdjacentHTML('afterbegin', toastHtml);
    const toastEl = document.getElementById(toastId);

    // Entrata
    setTimeout(() => {
        toastEl.classList.remove('-translate-y-full', 'opacity-0');
    }, 50);

    // Uscita automatica dopo 4 secondi
    setTimeout(() => {
        if (toastEl) {
            toastEl.classList.add('-translate-y-full', 'opacity-0');
            setTimeout(() => toastEl.remove(), 500);
        }
    }, 4000);
};
