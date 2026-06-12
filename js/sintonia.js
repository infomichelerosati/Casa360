// js/sintonia.js

const INTERNAL_STATES = [
    { id: 'Energico', label: 'Energico', icon: 'fa-battery-full', color: 'text-green-500', value: 8 },
    { id: 'Allegro', label: 'Allegro', icon: 'fa-face-smile', color: 'text-yellow-500', value: 7 },
    { id: 'Calmo', label: 'Calmo', icon: 'fa-seedling', color: 'text-teal-500', value: 6 },
    { id: 'Indifferente', label: 'Indiff.', icon: 'fa-face-meh', color: 'text-gray-400', value: 5 },
    { id: 'Stanco', label: 'Stanco', icon: 'fa-battery-quarter', color: 'text-orange-500', value: 4 },
    { id: 'Sotto pressione', label: 'Pressato', icon: 'fa-weight-hanging', color: 'text-purple-500', value: 3 },
    { id: 'Triste', label: 'Triste', icon: 'fa-cloud-rain', color: 'text-blue-500', value: 2 },
    { id: 'Arrabbiato', label: 'Arrabbiato', icon: 'fa-fire', color: 'text-red-500', value: 1 }
];

const RELATIONAL_OPTIONS = [
    { id: 'heart', icon: 'fa-heart', color: 'text-pink-500', value: 3 },
    { id: 'neutral', icon: 'fa-circle text-[10px]', color: 'text-gray-400', value: 2 },
    { id: 'lightning', icon: 'fa-bolt', color: 'text-yellow-400', value: 1 }
];

let sintoniaCurrentInternalState = null;
let sintoniaCurrentRelationalStates = {}; // member_id -> 'heart'|'neutral'|'lightning'
let sintoniaCurrentNotes = { internal: '', relations: {} }; // { internal: "...", relations: { member_id: "..." } }
let sintoniaChartInstances = [];
let currentSintoniaRange = '7d';

function getCurrentTimeSlot() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'mattina';
    if (hour >= 12 && hour < 18) return 'pomeriggio';
    return 'sera'; // 18-06
}

function getSlotLabel(slot) {
    if (slot === 'mattina') return 'Mattina';
    if (slot === 'pomeriggio') return 'Pomeriggio';
    return 'Sera';
}

window.setSintoniaTimeRange = function(range) {
    currentSintoniaRange = range;
    document.querySelectorAll('.sintonia-filter-btn').forEach(btn => {
        if (btn.getAttribute('onclick').includes(range)) {
            btn.classList.add('bg-pink-500', 'text-white', 'shadow-sm');
            btn.classList.remove('text-darkblue-icon', 'hover:text-darkblue-heading');
        } else {
            btn.classList.remove('bg-pink-500', 'text-white', 'shadow-sm');
            btn.classList.add('text-darkblue-icon', 'hover:text-darkblue-heading');
        }
    });
    renderSintoniaChart();
};

// ==========================================
// MODALE GLOBALE
// ==========================================
window.checkAndShowGlobalSintonia = async function() {
    if (!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        const familyId = await window.getUserFamilyId();
        if (!familyId) return;

        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const currentSlot = getCurrentTimeSlot();

        // Controllo se ha saltato per oggi
        const skipDate = localStorage.getItem('sintonia_skip_date');
        if (skipDate === todayStr) {
            return; // Ha già cliccato "Fallo più tardi" oggi
        }

        // Controllo se esiste log per questa fascia oraria
        const { data: log, error } = await supabase
            .from('sintonia_logs')
            .select('id')
            .eq('family_id', familyId)
            .eq('member_id', user.id)
            .eq('log_date', todayStr)
            .eq('time_slot', currentSlot);

        if (error && error.code !== '42P01') throw error;

        if (!log || log.length === 0) {
            // Genera UI per il modale globale
            await generateSintoniaUIForGlobal(familyId, user.id);
            
            const modal = document.getElementById('modal-global-sintonia');
            const subtitle = document.getElementById('global-sintonia-subtitle');
            if (subtitle) subtitle.textContent = `Check-in della ${getSlotLabel(currentSlot)}`;
            
            if (modal) {
                modal.classList.remove('opacity-0', 'pointer-events-none');
                modal.querySelector('.clay-card').classList.remove('scale-95');
            }
        }

    } catch (err) {
        console.error("Errore check globale sintonia", err);
    }
};

window.skipGlobalSintonia = function() {
    const todayStr = new Date().toLocaleDateString('en-CA');
    localStorage.setItem('sintonia_skip_date', todayStr);
    
    const modal = document.getElementById('modal-global-sintonia');
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.querySelector('.clay-card').classList.add('scale-95');
    }
};

window.saveGlobalSintonia = async function() {
    await saveSintoniaData(true);
};

// ==========================================
// INIZIALIZZAZIONE MODULO LOCALE
// ==========================================
async function initSintonia() {
    console.log("Inizializzazione Modulo Sintonia...");
    sintoniaCurrentInternalState = null;
    sintoniaCurrentRelationalStates = {};
    sintoniaCurrentNotes = { internal: '', relations: {} };
    
    await renderCheckinForm();
    await loadExistingCheckin();
    await renderSintoniaChart();
}

async function renderCheckinForm() {
    // Render stati interni
    const intContainer = document.getElementById('sintonia-internal-states');
    if (intContainer) {
        intContainer.innerHTML = '';
        INTERNAL_STATES.forEach(state => {
            const btn = document.createElement('button');
            btn.className = 'internal-state-btn clay-btn bg-darkblue-base border-2 border-transparent rounded-xl p-3 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all';
            btn.dataset.state = state.id;
            btn.innerHTML = `
                <i class="fa-solid ${state.icon} ${state.color} text-2xl pointer-events-none"></i>
                <span class="text-[10px] font-bold text-darkblue-heading truncate w-full text-center pointer-events-none">${state.label}</span>
            `;
            btn.onclick = () => { selectInternalState(state.id); };
            intContainer.appendChild(btn);
        });
    }

    // Input listener per la nota interna
    const intNote = document.getElementById('sintonia-internal-note');
    if (intNote) {
        intNote.value = '';
        intNote.oninput = (e) => { sintoniaCurrentNotes.internal = e.target.value; };
    }

    // Render stati relazionali
    const relContainer = document.getElementById('sintonia-relational-states');
    if (relContainer) {
        relContainer.innerHTML = '<div class="text-center text-darkblue-icon text-sm py-4"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
        
        try {
            const familyId = await window.getUserFamilyId();
            const { data: { user } } = await supabase.auth.getUser();
            
            const { data: members, error } = await supabase
                .from('family_members')
                .select('id, name')
                .eq('family_id', familyId)
                .neq('id', user.id); 

            if (error) throw error;

            relContainer.innerHTML = '';
            
            if (members && members.length > 0) {
                members.forEach(member => {
                    sintoniaCurrentRelationalStates[member.id] = 'neutral';
                    sintoniaCurrentNotes.relations[member.id] = '';
                    
                    const row = document.createElement('div');
                    row.className = 'clay-item bg-darkblue-base rounded-xl p-3 flex flex-col gap-3';
                    
                    let optsHtml = '';
                    RELATIONAL_OPTIONS.forEach(opt => {
                        optsHtml += `
                            <button class="rel-opt-btn w-10 h-10 rounded-full flex items-center justify-center bg-darkblue-card text-darkblue-icon active:scale-90 transition-all border-2 border-transparent"
                                    data-member="${member.id}" data-opt="${opt.id}" onclick="selectRelationalState('${member.id}', '${opt.id}')">
                                <i class="fa-solid ${opt.icon} pointer-events-none"></i>
                            </button>
                        `;
                    });
                    
                    row.innerHTML = `
                        <div class="flex items-center justify-between gap-4">
                            <span class="font-bold text-darkblue-heading truncate flex-1">${member.name}</span>
                            <div class="flex items-center gap-2 shrink-0">
                                ${optsHtml}
                            </div>
                        </div>
                        <textarea class="rel-note-input w-full bg-darkblue-card text-darkblue-heading rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-pink-500/50 resize-none h-12" 
                                  placeholder="Nota su ${member.name}..." data-member="${member.id}" oninput="updateRelNote('${member.id}', this.value)"></textarea>
                    `;
                    relContainer.appendChild(row);
                });
            } else {
                relContainer.innerHTML = '<div class="text-center text-darkblue-icon text-sm py-4">Nessun altro membro nella famiglia.</div>';
            }
        } catch (err) {
            console.error("Errore fetch membri per sintonia", err);
            relContainer.innerHTML = '<div class="text-center text-red-500 text-sm py-4">Errore caricamento membri.</div>';
        }
    }
}

async function generateSintoniaUIForGlobal(familyId, userId) {
    const container = document.getElementById('global-sintonia-content');
    if (!container) return;
    
    sintoniaCurrentInternalState = null;
    sintoniaCurrentRelationalStates = {};
    sintoniaCurrentNotes = { internal: '', relations: {} };

    let html = `
        <div>
            <h4 class="text-xs font-bold text-darkblue-heading mb-2 uppercase tracking-wider">Il tuo stato</h4>
            <div class="grid grid-cols-4 gap-2 mb-3">
    `;
    
    INTERNAL_STATES.forEach(state => {
        html += `
            <button class="global-internal-state-btn clay-btn bg-darkblue-base border-2 border-transparent rounded-xl p-2 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                    data-state="${state.id}" onclick="selectGlobalInternalState('${state.id}')">
                <i class="fa-solid ${state.icon} ${state.color} text-xl pointer-events-none"></i>
                <span class="text-[9px] font-bold text-darkblue-heading truncate w-full text-center pointer-events-none">${state.label}</span>
            </button>
        `;
    });

    html += `
            </div>
            <textarea id="global-sintonia-internal-note" class="w-full bg-darkblue-base text-darkblue-heading rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-pink-500/50 resize-none h-16" 
                      placeholder="Aggiungi una nota sul tuo umore..." oninput="updateGlobalInternalNote(this.value)"></textarea>
        </div>
    `;

    try {
        const { data: members } = await supabase.from('family_members').select('id, name').eq('family_id', familyId).neq('id', userId);
        
        if (members && members.length > 0) {
            html += `
                <div>
                    <h4 class="text-xs font-bold text-darkblue-heading mb-2 uppercase tracking-wider">Con gli altri</h4>
                    <div class="flex flex-col gap-3">
            `;
            members.forEach(member => {
                sintoniaCurrentRelationalStates[member.id] = 'neutral';
                sintoniaCurrentNotes.relations[member.id] = '';
                
                let optsHtml = '';
                RELATIONAL_OPTIONS.forEach(opt => {
                    optsHtml += `
                        <button class="global-rel-opt-btn w-8 h-8 rounded-full flex items-center justify-center bg-darkblue-card text-darkblue-icon active:scale-90 transition-all border-2 border-transparent"
                                data-member="${member.id}" data-opt="${opt.id}" onclick="selectGlobalRelationalState('${member.id}', '${opt.id}')">
                            <i class="fa-solid ${opt.icon} text-sm pointer-events-none"></i>
                        </button>
                    `;
                });
                
                html += `
                    <div class="clay-item bg-darkblue-base rounded-xl p-2 flex flex-col gap-2">
                        <div class="flex items-center justify-between gap-2 px-1">
                            <span class="font-bold text-darkblue-heading text-sm truncate flex-1">${member.name}</span>
                            <div class="flex items-center gap-1 shrink-0">
                                ${optsHtml}
                            </div>
                        </div>
                        <textarea class="w-full bg-darkblue-card text-darkblue-heading rounded-lg p-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-pink-500/50 resize-none h-10" 
                                  placeholder="Nota su ${member.name}..." oninput="updateGlobalRelNote('${member.id}', this.value)"></textarea>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
    } catch(err) {
        console.error(err);
    }

    container.innerHTML = html;
    
    // Set default neutral
    for (const memberId in sintoniaCurrentRelationalStates) {
        selectGlobalRelationalState(memberId, 'neutral');
    }
}

// Helpers selezione locale
function selectInternalState(stateId) {
    sintoniaCurrentInternalState = stateId;
    document.querySelectorAll('.internal-state-btn').forEach(btn => {
        if (btn.dataset.state === stateId) {
            btn.classList.add('border-pink-500', 'bg-pink-500/10');
            btn.classList.remove('border-transparent');
        } else {
            btn.classList.remove('border-pink-500', 'bg-pink-500/10');
            btn.classList.add('border-transparent');
        }
    });
}
function selectRelationalState(memberId, optId) {
    sintoniaCurrentRelationalStates[memberId] = optId;
    const buttons = document.querySelectorAll(`.rel-opt-btn[data-member="${memberId}"]`);
    buttons.forEach(btn => {
        const iconOpt = RELATIONAL_OPTIONS.find(o => o.id === btn.dataset.opt);
        if (btn.dataset.opt === optId) {
            btn.classList.remove('bg-darkblue-card', 'text-darkblue-icon', 'border-transparent');
            btn.classList.add('bg-darkblue-base', iconOpt.color, 'border-' + iconOpt.color.split('-')[1] + '-500');
        } else {
            btn.classList.add('bg-darkblue-card', 'text-darkblue-icon', 'border-transparent');
            btn.classList.remove('bg-darkblue-base', iconOpt.color, 'border-pink-500', 'border-yellow-400', 'border-gray-400');
        }
    });
}
window.updateRelNote = function(memberId, val) {
    sintoniaCurrentNotes.relations[memberId] = val;
};

// Helpers selezione globale
window.selectGlobalInternalState = function(stateId) {
    sintoniaCurrentInternalState = stateId;
    document.querySelectorAll('.global-internal-state-btn').forEach(btn => {
        if (btn.dataset.state === stateId) {
            btn.classList.add('border-pink-500', 'bg-pink-500/10');
            btn.classList.remove('border-transparent');
        } else {
            btn.classList.remove('border-pink-500', 'bg-pink-500/10');
            btn.classList.add('border-transparent');
        }
    });
};
window.selectGlobalRelationalState = function(memberId, optId) {
    sintoniaCurrentRelationalStates[memberId] = optId;
    const buttons = document.querySelectorAll(`.global-rel-opt-btn[data-member="${memberId}"]`);
    buttons.forEach(btn => {
        const iconOpt = RELATIONAL_OPTIONS.find(o => o.id === btn.dataset.opt);
        if (btn.dataset.opt === optId) {
            btn.classList.remove('bg-darkblue-card', 'text-darkblue-icon', 'border-transparent');
            btn.classList.add('bg-darkblue-base', iconOpt.color, 'border-' + iconOpt.color.split('-')[1] + '-500');
        } else {
            btn.classList.add('bg-darkblue-card', 'text-darkblue-icon', 'border-transparent');
            btn.classList.remove('bg-darkblue-base', iconOpt.color, 'border-pink-500', 'border-yellow-400', 'border-gray-400');
        }
    });
};
window.updateGlobalInternalNote = function(val) {
    sintoniaCurrentNotes.internal = val;
};
window.updateGlobalRelNote = function(memberId, val) {
    sintoniaCurrentNotes.relations[memberId] = val;
};

async function loadExistingCheckin() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const familyId = await window.getUserFamilyId();
        const todayStr = new Date().toLocaleDateString('en-CA');
        const currentSlot = getCurrentTimeSlot();
        
        const { data: logs, error } = await supabase
            .from('sintonia_logs')
            .select('*')
            .eq('family_id', familyId)
            .eq('member_id', user.id)
            .eq('log_date', todayStr)
            .eq('time_slot', currentSlot);
            
        if (error && error.code !== '42P01') throw error;
        
        if (logs && logs.length > 0) {
            const log = logs[0];
            if (log.internal_state) selectInternalState(log.internal_state);
            
            if (log.notes && log.notes.internal) {
                const intNote = document.getElementById('sintonia-internal-note');
                if (intNote) { intNote.value = log.notes.internal; sintoniaCurrentNotes.internal = log.notes.internal; }
            }
            
            if (log.relational_states) {
                for (const [memberId, optId] of Object.entries(log.relational_states)) {
                    if (document.querySelector(`.rel-opt-btn[data-member="${memberId}"]`)) {
                         selectRelationalState(memberId, optId);
                    }
                }
            }
            if (log.notes && log.notes.relations) {
                for (const [memberId, noteTxt] of Object.entries(log.notes.relations)) {
                    const txtArea = document.querySelector(`.rel-note-input[data-member="${memberId}"]`);
                    if (txtArea) { txtArea.value = noteTxt; sintoniaCurrentNotes.relations[memberId] = noteTxt; }
                }
            }
        } else {
            for(const memberId in sintoniaCurrentRelationalStates) {
                selectRelationalState(memberId, 'neutral');
            }
        }
    } catch(err) {
        console.warn("Nessun checkin esistente o tabella mancante", err);
    }
}

window.saveSintoniaCheckin = async function() {
    await saveSintoniaData(false);
}

async function saveSintoniaData(isGlobal) {
    if (!sintoniaCurrentInternalState) {
        window.showToast("Seleziona prima il tuo stato interno!", "error");
        return;
    }
    
    let btn;
    let originalText;
    if (isGlobal) {
        btn = document.getElementById('btn-global-sintonia-save');
    } else {
        btn = document.getElementById('btn-save-sintonia');
    }

    if (btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>...';
        btn.disabled = true;
    }
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const familyId = await window.getUserFamilyId();
        const todayStr = new Date().toLocaleDateString('en-CA');
        const currentSlot = getCurrentTimeSlot();
        
        // Upsert per sicurezza sulla stessa fascia oraria
        const { error } = await supabase
            .from('sintonia_logs')
            .upsert({
                family_id: familyId,
                member_id: user.id,
                log_date: todayStr,
                time_slot: currentSlot,
                internal_state: sintoniaCurrentInternalState,
                relational_states: sintoniaCurrentRelationalStates,
                notes: sintoniaCurrentNotes
            }, { onConflict: 'family_id, member_id, log_date, time_slot' });
            
        if (error) throw error;
        
        window.showToast("Check-in salvato con successo!", "success");
        
        if (isGlobal) {
            const modal = document.getElementById('modal-global-sintonia');
            if (modal) {
                modal.classList.add('opacity-0', 'pointer-events-none');
                modal.querySelector('.clay-card').classList.add('scale-95');
            }
        }
        
        // Se siamo sulla pagina, ricarica
        if (document.getElementById('sintonia-charts-container')) {
            await renderSintoniaChart();
        }
        
    } catch(err) {
        console.error("Errore salvataggio sintonia", err);
        window.showToast("Errore nel salvataggio.", "error");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

async function renderSintoniaChart() {
    const container = document.getElementById('sintonia-charts-container');
    if (!container) return;
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const familyId = await window.getUserFamilyId();
        
        const { data: members, error: memErr } = await supabase
            .from('family_members')
            .select('id, name')
            .eq('family_id', familyId)
            .neq('id', user.id);
        
        if (memErr) throw memErr;

        const now = new Date();
        let startDateStr = null;
        let query = supabase.from('sintonia_logs').select('*').eq('family_id', familyId).eq('member_id', user.id);

        if (currentSintoniaRange === '7d') {
            const d = new Date(now); d.setDate(d.getDate() - 6);
            startDateStr = d.toLocaleDateString('en-CA');
            query = query.gte('log_date', startDateStr);
        } else if (currentSintoniaRange === '30d') {
            const d = new Date(now); d.setDate(d.getDate() - 29);
            startDateStr = d.toLocaleDateString('en-CA');
            query = query.gte('log_date', startDateStr);
        } else if (currentSintoniaRange === '1y') {
            const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
            startDateStr = d.toLocaleDateString('en-CA');
            query = query.gte('log_date', startDateStr);
        }

        // Recuperiamo i log
        const { data: logs, error } = await query.order('log_date', { ascending: true });
        if (error && error.code !== '42P01') throw error;
        
        // Render Diario
        renderSintoniaDiary(logs, members);

        const labels = [];
        const personalTrend = [];
        const relationalTrends = {};
        if (members) members.forEach(m => relationalTrends[m.id] = []);
        
        if (logs) {
            // Ordiniamo anche per slot orario: mattina, pomeriggio, sera
            const slotOrder = { 'mattina': 1, 'pomeriggio': 2, 'sera': 3 };
            logs.sort((a, b) => {
                if (a.log_date !== b.log_date) return a.log_date.localeCompare(b.log_date);
                return slotOrder[a.time_slot] - slotOrder[b.time_slot];
            });

            logs.forEach(log => {
                const d = new Date(log.log_date);
                const dayLabel = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
                const slotL = getSlotLabel(log.time_slot).substring(0, 3); // Mat, Pom, Ser
                labels.push(`${dayLabel} ${slotL}`);

                const intOpt = INTERNAL_STATES.find(s => s.id === log.internal_state);
                personalTrend.push(intOpt ? intOpt.value : null);

                if (members) {
                    members.forEach(m => {
                        const valStr = log.relational_states ? log.relational_states[m.id] : null;
                        const relOpt = RELATIONAL_OPTIONS.find(o => o.id === valStr);
                        relationalTrends[m.id].push(relOpt ? relOpt.value : null);
                    });
                }
            });
        }
        
        sintoniaChartInstances.forEach(chart => chart.destroy());
        sintoniaChartInstances = [];
        container.innerHTML = '';
        
        if (labels.length === 0) {
            container.innerHTML = '<div class="text-center text-darkblue-icon text-sm py-4">Nessun dato per il periodo selezionato.</div>';
            return;
        }

        Chart.defaults.color = '#8a9ab4';
        Chart.defaults.font.family = 'Inter, sans-serif';

        const createChart = (id, title, color, dataArr, maxVal, isDash = false) => {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `
                <h3 class="text-sm font-bold text-darkblue-heading mb-2 flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full" style="background-color: ${color}"></div>
                    ${title}
                </h3>
                <div class="w-full h-48 relative">
                    <canvas id="${id}"></canvas>
                </div>
            `;
            container.appendChild(wrapper);
            
            const canvas = document.getElementById(id);
            const chart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: title,
                        data: dataArr,
                        borderColor: color,
                        backgroundColor: isDash ? 'transparent' : color + '1a',
                        borderWidth: isDash ? 2 : 3,
                        borderDash: isDash ? [5, 5] : [],
                        tension: 0.2, // Minore tensione per mostrare bene i punti
                        fill: !isDash,
                        pointBackgroundColor: '#1a2235',
                        pointBorderColor: color,
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        spanGaps: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1a2235', titleColor: '#e2e8f0', bodyColor: '#8a9ab4',
                            borderColor: '#334155', borderWidth: 1, padding: 10, displayColors: false
                        }
                    },
                    scales: {
                        y: { min: 1, max: maxVal, ticks: { stepSize: 1 }, grid: { color: '#334155', drawBorder: false } },
                        x: { grid: { display: false, drawBorder: false }, ticks: { autoSkip: true, maxTicksLimit: 12 } }
                    }
                }
            });
            sintoniaChartInstances.push(chart);
        };

        createChart('chart-umore', 'Umore Personale', '#3b82f6', personalTrend, 8, false);

        if (members) {
            members.forEach(m => {
                createChart('chart-rel-' + m.id, 'Relazione con ' + m.name, '#ec4899', relationalTrends[m.id], 3, true);
            });
        }
        
    } catch(err) {
        console.error("Errore grafici sintonia", err);
        container.innerHTML = '<div class="text-red-500 text-sm">Errore caricamento grafici.</div>';
    }
}

function renderSintoniaDiary(logs, members) {
    const container = document.getElementById('sintonia-diary-container');
    if (!container) return;

    if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="text-center text-darkblue-icon text-sm py-4">Nessun diario in questo periodo.</div>';
        return;
    }

    // Filtra log che hanno almeno una nota (interna o relazionale)
    const diaryLogs = logs.filter(log => {
        if (log.notes && log.notes.internal && log.notes.internal.trim() !== '') return true;
        if (log.notes && log.notes.relations) {
            return Object.values(log.notes.relations).some(n => n && n.trim() !== '');
        }
        return false;
    });

    if (diaryLogs.length === 0) {
        container.innerHTML = '<div class="text-center text-darkblue-icon text-sm py-4">Nessuna nota aggiunta in questo periodo.</div>';
        return;
    }

    // Sort discendente per il diario visivo
    diaryLogs.sort((a, b) => {
        const slotOrder = { 'mattina': 1, 'pomeriggio': 2, 'sera': 3 };
        if (a.log_date !== b.log_date) return b.log_date.localeCompare(a.log_date);
        return slotOrder[b.time_slot] - slotOrder[a.time_slot];
    });

    let html = '';
    diaryLogs.forEach(log => {
        const d = new Date(log.log_date);
        const dayLabel = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
        const intOpt = INTERNAL_STATES.find(s => s.id === log.internal_state);
        
        let notesHtml = '';
        if (log.notes.internal && log.notes.internal.trim() !== '') {
            notesHtml += `
                <div class="mb-2">
                    <span class="text-xs font-bold text-darkblue-heading block mb-1">Mio stato: ${intOpt ? intOpt.label : ''}</span>
                    <p class="text-sm text-darkblue-text italic">"${log.notes.internal}"</p>
                </div>
            `;
        }

        if (log.notes.relations && members) {
            members.forEach(m => {
                const rNote = log.notes.relations[m.id];
                if (rNote && rNote.trim() !== '') {
                    const valStr = log.relational_states[m.id];
                    const relOpt = RELATIONAL_OPTIONS.find(o => o.id === valStr);
                    const iconHtml = relOpt ? `<i class="fa-solid ${relOpt.icon} ${relOpt.color} text-[10px] ml-1"></i>` : '';
                    notesHtml += `
                        <div class="mb-2 mt-2 border-t border-darkblue-base/50 pt-2">
                            <span class="text-xs font-bold text-darkblue-heading block mb-1">Con ${m.name} ${iconHtml}</span>
                            <p class="text-sm text-darkblue-text italic">"${rNote}"</p>
                        </div>
                    `;
                }
            });
        }

        html += `
            <div class="clay-item bg-darkblue-base rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-bold text-pink-500 uppercase tracking-wider">${getSlotLabel(log.time_slot)}</span>
                    <span class="text-xs text-darkblue-icon">${dayLabel}</span>
                </div>
                ${notesHtml}
            </div>
        `;
    });

    container.innerHTML = html;
}

window.exportSintoniaPDF = function() {
    const element = document.getElementById('sintonia-export-area');
    if (!element) return;
    
    // Mostriamo un toast per far capire che sta lavorando
    window.showToast("Generazione PDF in corso...", "success");

    const opt = {
        margin:       10,
        filename:     `Diario_Sintonia_${new Date().toLocaleDateString('it-IT')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#1a2235' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        window.showToast("PDF Scaricato!", "success");
    }).catch(err => {
        console.error(err);
        window.showToast("Errore durante l'esportazione", "error");
    });
};
