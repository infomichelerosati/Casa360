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

        // Mostra nav e carica la dashboard
        if (nav) nav.classList.remove('hidden');
        loadModule('dashboard');
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
