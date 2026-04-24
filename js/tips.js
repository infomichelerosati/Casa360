// js/tips.js

const FAMILY_TIPS = [
    // --- MATTINA (Pianificazione) ---
    {
        id: 'tip-morning-1',
        time: 'morning',
        title: 'Buongiorno!',
        msg: 'Prenditi 2 minuti per controllare il Calendario. Una giornata pianificata è una giornata senza stress!',
        icon: 'fa-sun',
        module: 'calendario',
        color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    },
    {
        id: 'tip-morning-2',
        time: 'morning',
        title: '💡 Colazione e Conti',
        msg: 'Hai inserito le spese di ieri sera? Farlo subito ti aiuta a non perdere di vista il budget familiare.',
        icon: 'fa-wallet',
        module: 'finanze',
        color: 'text-violet-400 bg-violet-400/10 border-violet-400/20'
    },
    {
        id: 'tip-morning-3',
        time: 'morning',
        title: '🥗 Cosa si mangia?',
        msg: 'Controlla il Menu Settimanale. Sapere cosa cucinare stasera ti farà risparmiare tempo prezioso oggi pomeriggio.',
        icon: 'fa-utensils',
        module: 'pasti',
        color: 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    },

    // --- POMERIGGIO (Tutorial & Tech) ---
    {
        id: 'tip-afternoon-1',
        time: 'afternoon',
        title: '🚀 Trucco Pro',
        msg: 'Puoi personalizzare la Dashboard! Clicca sull\'ingranaggio in alto e trascina i widget come preferisci.',
        icon: 'fa-wand-magic-sparkles',
        module: 'dashboard',
        color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
    },
    {
        id: 'tip-afternoon-2',
        time: 'afternoon',
        title: '📂 Archivio Cloud',
        msg: 'Hai una foto della Tessera Sanitaria? Caricala nell\'Archivio, potrebbe servirti quando meno te lo aspetti.',
        icon: 'fa-folder-open',
        module: 'documenti',
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    },
    {
        id: 'tip-afternoon-3',
        time: 'afternoon',
        title: '🐾 Amici a 4 zampe',
        msg: 'Hai controllato i promemoria per i tuoi pet? Un piccolo promemoria oggi evita una visita dal veterinario domani!',
        icon: 'fa-paw',
        module: 'animali',
        color: 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    },
    {
        id: 'tip-afternoon-4',
        time: 'afternoon',
        title: '📲 App Installa',
        msg: 'Sapevi che puoi aggiungere Family OS alla home del tuo telefono? Funzionerà proprio come un\'app nativa!',
        icon: 'fa-mobile-screen-button',
        module: 'dashboard',
        color: 'text-green-400 bg-green-400/10 border-green-400/20'
    },

    // --- SERA (Riflessione & Sport) ---
    {
        id: 'tip-evening-1',
        time: 'evening',
        title: '🌙 Relax e Salute',
        msg: 'Com\'è andata la giornata? Registra i tuoi parametri vitali prima di dormire per monitorare il tuo benessere.',
        icon: 'fa-heart-pulse',
        module: 'salute',
        color: 'text-red-400 bg-red-400/10 border-red-400/20'
    },
    {
        id: 'tip-evening-2',
        time: 'evening',
        title: '🎾 Sport e Costi',
        msg: 'Hai segnato l\'allenamento di oggi? Controllare quanto spendi per lo sport aiuta a ottimizzare le spese della famiglia.',
        icon: 'fa-volleyball',
        module: 'sport',
        color: 'text-orange-500 bg-orange-500/10 border-orange-500/20'
    },
    {
        id: 'tip-evening-3',
        time: 'evening',
        title: '📑 Report Medico',
        msg: 'Devi andare dal medico domani? Genera il report PDF della salute, avrai tutta la tua storia medica in un solo foglio.',
        icon: 'fa-file-pdf',
        module: 'salute',
        color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20'
    },
    {
        id: 'tip-evening-4',
        time: 'evening',
        title: '🚗 Check Veicoli',
        msg: 'Hai controllato i chilometri dell\'auto ultimamente? Aggiornarli ti aiuta a non dimenticare il prossimo tagliando.',
        icon: 'fa-car',
        module: 'veicoli',
        color: 'text-slate-400 bg-slate-400/10 border-slate-400/20'
    },

    // --- GENERICI / CURIOSITÀ ---
    {
        id: 'tip-gen-1',
        time: 'any',
        title: '💡 Curiosità',
        msg: 'Le famiglie che usano una lista della spesa condivisa riducono gli sprechi alimentari del 30%. Continua così!',
        icon: 'fa-lightbulb',
        module: 'spesa',
        color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
    },
    {
        id: 'tip-gen-2',
        time: 'any',
        title: '🤝 Invita Membri',
        msg: 'Family OS è più potente se usato insieme! Invita i membri della tua famiglia dalle impostazioni.',
        icon: 'fa-users',
        module: 'famiglia',
        color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    },
    {
        id: 'tip-gen-3',
        time: 'any',
        title: '📱 Modalità Offline',
        msg: 'Anche senza internet, puoi consultare la lista della spesa al supermercato. L\'app salva tutto in locale!',
        icon: 'fa-wifi',
        module: 'spesa',
        color: 'text-blue-300 bg-blue-300/10 border-blue-300/20'
    },
    {
        id: 'tip-gen-4',
        time: 'any',
        title: '🎯 Obiettivo Risparmio',
        msg: 'Vedere dove finiscono i soldi è il primo passo per risparmiare. Usa i grafici in Finanze per analizzare le tue uscite.',
        icon: 'fa-chart-pie',
        module: 'finanze',
        color: 'text-rose-400 bg-rose-400/10 border-rose-400/20'
    },
    {
        id: 'tip-gen-5',
        time: 'any',
        title: '🧸 Diario dei Ricordi',
        msg: 'I traguardi dei bambini passano in un lampo. Segnali nel modulo Bambini per avere un diario digitale per sempre.',
        icon: 'fa-star',
        module: 'bambini',
        color: 'text-pink-400 bg-pink-400/10 border-pink-400/20'
    },
    {
        id: 'tip-gen-6',
        time: 'any',
        title: '🔧 Setup Meteo',
        msg: 'Vuoi il meteo della tua città esatta? Puoi cambiarla nelle impostazioni del modulo Famiglia.',
        icon: 'fa-location-dot',
        module: 'famiglia',
        color: 'text-sky-400 bg-sky-400/10 border-sky-400/20'
    }
];

window.getSmartTip = function() {
    const now = new Date();
    const hour = now.getHours();
    let timeCategory = 'any';

    if (hour >= 6 && hour < 12) timeCategory = 'morning';
    else if (hour >= 12 && hour < 18) timeCategory = 'afternoon';
    else if (hour >= 18 || hour < 6) timeCategory = 'evening';

    // Filtra per categoria di orario o 'any'
    let availableTips = FAMILY_TIPS.filter(t => t.time === timeCategory || t.time === 'any');
    
    // Logica per cambiare consiglio ogni 4 ore circa, o basata sul giorno
    // Usiamo il giorno dell'anno + l'ora diviso 4 come seed per la rotazione
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const slot = Math.floor(hour / 4);
    const seed = dayOfYear + slot;
    
    const tipIndex = seed % availableTips.length;
    return availableTips[tipIndex];
};
