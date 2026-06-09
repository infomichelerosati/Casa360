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
let sintoniaChartInstances = [];
let currentSintoniaRange = '7d';

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

async function initSintonia() {
    console.log("Inizializzazione Modulo Sintonia...");
    sintoniaCurrentInternalState = null;
    sintoniaCurrentRelationalStates = {};
    
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
                <i class="fa-solid ${state.icon} ${state.color} text-2xl"></i>
                <span class="text-[10px] font-bold text-darkblue-heading truncate w-full text-center">${state.label}</span>
            `;
            btn.onclick = () => selectInternalState(state.id);
            intContainer.appendChild(btn);
        });
    }

    // Render stati relazionali (membri famiglia)
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
                .neq('id', user.id); // Escludi se stesso

            if (error) throw error;

            relContainer.innerHTML = '';
            
            if (members && members.length > 0) {
                members.forEach(member => {
                    // Default a neutral
                    sintoniaCurrentRelationalStates[member.id] = 'neutral';
                    
                    const row = document.createElement('div');
                    row.className = 'clay-item bg-darkblue-base rounded-xl p-3 flex items-center justify-between gap-4';
                    
                    let optsHtml = '';
                    RELATIONAL_OPTIONS.forEach(opt => {
                        optsHtml += `
                            <button class="rel-opt-btn w-10 h-10 rounded-full flex items-center justify-center bg-darkblue-card text-darkblue-icon active:scale-90 transition-all border-2 border-transparent"
                                    data-member="${member.id}" data-opt="${opt.id}" onclick="selectRelationalState('${member.id}', '${opt.id}')">
                                <i class="fa-solid ${opt.icon}"></i>
                            </button>
                        `;
                    });
                    
                    row.innerHTML = `
                        <span class="font-bold text-darkblue-heading truncate flex-1">${member.name}</span>
                        <div class="flex items-center gap-2 shrink-0">
                            ${optsHtml}
                        </div>
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
    
    // Aggiorna UI per questa riga
    const buttons = document.querySelectorAll(`.rel-opt-btn[data-member="${memberId}"]`);
    buttons.forEach(btn => {
        const iconOpt = RELATIONAL_OPTIONS.find(o => o.id === btn.dataset.opt);
        if (btn.dataset.opt === optId) {
            // Selected
            btn.classList.remove('bg-darkblue-card', 'text-darkblue-icon', 'border-transparent');
            btn.classList.add('bg-darkblue-base', iconOpt.color, 'border-' + iconOpt.color.split('-')[1] + '-500'); // Hackino per il bordo
        } else {
            // Unselected
            btn.classList.add('bg-darkblue-card', 'text-darkblue-icon', 'border-transparent');
            btn.classList.remove('bg-darkblue-base', iconOpt.color, 'border-pink-500', 'border-yellow-400', 'border-gray-400');
        }
    });
}

async function loadExistingCheckin() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const familyId = await window.getUserFamilyId();
        const todayStr = new Date().toISOString().split('T')[0];
        
        const { data: logs, error } = await supabase
            .from('sintonia_logs')
            .select('*')
            .eq('family_id', familyId)
            .eq('member_id', user.id)
            .eq('log_date', todayStr);
            
        if (error && error.code !== '42P01') throw error;
        
        if (logs && logs.length > 0) {
            const log = logs[0];
            if (log.internal_state) selectInternalState(log.internal_state);
            
            if (log.relational_states) {
                for (const [memberId, optId] of Object.entries(log.relational_states)) {
                    // Check if member is still in DOM (might have been removed)
                    if (document.querySelector(`.rel-opt-btn[data-member="${memberId}"]`)) {
                         selectRelationalState(memberId, optId);
                    }
                }
            }
        } else {
            // Se non c'è log, imposta tutti i neutral visivamente
            for(const memberId in sintoniaCurrentRelationalStates) {
                selectRelationalState(memberId, 'neutral');
            }
        }
    } catch(err) {
        console.warn("Nessun checkin esistente o tabella mancante", err);
    }
}

window.saveSintoniaCheckin = async function() {
    if (!sintoniaCurrentInternalState) {
        window.showToast("Seleziona prima il tuo stato interno!", "error");
        return;
    }
    
    const btn = document.getElementById('btn-save-sintonia');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvataggio...';
    btn.disabled = true;
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const familyId = await window.getUserFamilyId();
        const todayStr = new Date().toISOString().split('T')[0];
        
        const { error } = await supabase
            .from('sintonia_logs')
            .upsert({
                family_id: familyId,
                member_id: user.id,
                log_date: todayStr,
                internal_state: sintoniaCurrentInternalState,
                relational_states: sintoniaCurrentRelationalStates
            }, {
                onConflict: 'family_id, member_id, log_date'
            });
            
        if (error) throw error;
        
        window.showToast("Check-in salvato con successo!", "success");
        await renderSintoniaChart(); // Aggiorna grafico
        
    } catch(err) {
        console.error("Errore salvataggio sintonia", err);
        window.showToast("Errore nel salvataggio.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function renderSintoniaChart() {
    const container = document.getElementById('sintonia-charts-container');
    if (!container) return;
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const familyId = await window.getUserFamilyId();
        
        // Fetch altri membri per i nomi e per sapere quanti grafici fare
        const { data: members, error: memErr } = await supabase
            .from('family_members')
            .select('id, name')
            .eq('family_id', familyId)
            .neq('id', user.id);
        
        if (memErr) throw memErr;

        const now = new Date();
        let startDateStr = null;
        let daysToGenerate = 0;
        let query = supabase.from('sintonia_logs').select('*').eq('family_id', familyId).eq('member_id', user.id);

        if (currentSintoniaRange === '7d') {
            const d = new Date(now); d.setDate(d.getDate() - 6);
            startDateStr = d.toISOString().split('T')[0];
            query = query.gte('log_date', startDateStr);
            daysToGenerate = 7;
        } else if (currentSintoniaRange === '30d') {
            const d = new Date(now); d.setDate(d.getDate() - 29);
            startDateStr = d.toISOString().split('T')[0];
            query = query.gte('log_date', startDateStr);
            daysToGenerate = 30;
        } else if (currentSintoniaRange === '1y') {
            const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
            startDateStr = d.toISOString().split('T')[0];
            query = query.gte('log_date', startDateStr);
            daysToGenerate = 365;
        }

        const { data: logs, error } = await query.order('log_date', { ascending: true });
        if (error && error.code !== '42P01') throw error;
        
        const labels = [];
        const personalTrend = [];
        const relationalTrends = {}; // member.id -> []
        if (members) {
            members.forEach(m => relationalTrends[m.id] = []);
        }
        
        const datesMap = {};
        
        if (currentSintoniaRange === 'all') {
            if (logs && logs.length > 0) {
                const firstDate = new Date(logs[0].log_date);
                const diffTime = Math.abs(now - firstDate);
                daysToGenerate = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
                for (let i = 0; i < daysToGenerate; i++) {
                    const d = new Date(firstDate);
                    d.setDate(d.getDate() + i);
                    const dStr = d.toISOString().split('T')[0];
                    datesMap[dStr] = { personal: null, relations: {} };
                    labels.push(d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' }));
                }
            } else {
                labels.push('Nessun dato');
            }
        } else {
            const startD = new Date(startDateStr);
            for (let i = 0; i < daysToGenerate; i++) {
                const d = new Date(startD);
                d.setDate(d.getDate() + i);
                const dStr = d.toISOString().split('T')[0];
                datesMap[dStr] = { personal: null, relations: {} };
                
                if (currentSintoniaRange === '1y') {
                    labels.push(d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }));
                } else {
                    labels.push(d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }));
                }
            }
        }
        
        if (logs) {
            logs.forEach(log => {
                if (datesMap[log.log_date]) {
                    const intOpt = INTERNAL_STATES.find(s => s.id === log.internal_state);
                    if (intOpt) datesMap[log.log_date].personal = intOpt.value;
                    
                    if (log.relational_states) {
                        for (const memberId in log.relational_states) {
                            const valStr = log.relational_states[memberId];
                            const relOpt = RELATIONAL_OPTIONS.find(o => o.id === valStr);
                            if (relOpt) {
                                datesMap[log.log_date].relations[memberId] = relOpt.value;
                            }
                        }
                    }
                }
            });
        }
        
        Object.keys(datesMap).sort().forEach(d => {
            personalTrend.push(datesMap[d].personal);
            if (members) {
                members.forEach(m => {
                    relationalTrends[m.id].push(datesMap[d].relations[m.id] || null);
                });
            }
        });
        
        // Distruggi vecchi grafici
        sintoniaChartInstances.forEach(chart => chart.destroy());
        sintoniaChartInstances = [];
        container.innerHTML = '';
        
        Chart.defaults.color = '#8a9ab4';
        Chart.defaults.font.family = 'Inter, sans-serif';

        // Helper per creare un grafico
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
                        backgroundColor: isDash ? 'transparent' : color + '1a', // 10% opacity
                        borderWidth: isDash ? 2 : 3,
                        borderDash: isDash ? [5, 5] : [],
                        tension: 0.4,
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
                        x: { grid: { display: false, drawBorder: false }, ticks: { autoSkip: true, maxTicksLimit: 10 } }
                    }
                }
            });
            sintoniaChartInstances.push(chart);
        };

        // 1. Grafico Umore
        createChart('chart-umore', 'Umore Personale', '#3b82f6', personalTrend, 8, false);

        // 2. Grafici per ogni familiare
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
