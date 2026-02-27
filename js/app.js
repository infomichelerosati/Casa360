// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza l'applicazione SPA
    initApp();
});

function initApp() {
    // Setup Navigation Listeners
    setupNavigation();

    // Ascolta i cambiamenti di stato di autenticazione
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth event:", event);
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            renderApp(session);
        }
    });

    // Controllo iniziale della sessione
    supabase.auth.getSession().then(({ data: { session } }) => {
        renderApp(session);
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
            if (typeof initSalute === 'function') {
                initSalute();
            }
            break;
        case 'animali':
            if (typeof initAnimali === 'function') {
                initAnimali();
            } else {
                console.error("Funzione initAnimali non trovata. Controlla index.html");
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

        window.globalNotifications = notifications;

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
        if (bellBadge) {
            // Se c'è ALMENO UNA notifica di qualsiasi tipo, "suona" la campanella
            if (notifications.length > 0) {
                bellBadge.classList.remove('hidden');
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
        const html = `
            <div class="clay-card border ${notif.color.split(' ')[2]} rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                 onclick="closeNotificationsPanel(); setTimeout(() => navigateApp('${notif.type}'), 200)">
                <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-inner ${notif.color.replace(/border-[\w-\/]+/, '')}">
                    <i class="fa-solid ${notif.icon}"></i>
                </div>
                <div>
                     <p class="text-[10px] font-bold uppercase tracking-widest text-darkblue-icon">${notif.title}</p>
                     <p class="text-white font-medium break-words">${notif.msg}</p>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', html);
    });
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
