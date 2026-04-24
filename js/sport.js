// js/sport.js

let sportMemberSelector = null;
let sportCurrentMemberId = null;
let sportActivities = [];
let editingActivityId = null;

async function initSport() {
    console.log("Inizializzazione Modulo Sport...");
    
    // Setup listeners
    setupSportModals();
    
    // Caricamento membri
    await loadFamilyMembersForSport();
}

async function loadFamilyMembersForSport() {
    try {
        const { data: members, error } = await supabase.from('family_members').select('*');
        if (error) throw error;

        const selector = document.getElementById('sport-member-selector');
        selector.innerHTML = '';

        members.forEach(m => {
            const btn = document.createElement('button');
            btn.className = `flex flex-col items-center gap-2 min-w-[70px] transition-all duration-300 transform`;
            btn.innerHTML = `
                <div class="w-16 h-16 rounded-full border-2 border-transparent p-1 transition-all member-avatar-container">
                    <img src="${m.avatar_url || 'https://ui-avatars.com/api/?name=' + m.name}" 
                         class="w-full h-full rounded-full object-cover shadow-md pointer-events-none"
                         alt="${m.name}">
                </div>
                <span class="text-xs font-bold text-darkblue-heading opacity-60">${m.name}</span>
            `;
            btn.onclick = () => selectSportMember(m.id, btn);
            selector.appendChild(btn);
        });

    } catch (err) {
        console.error("Error loading family members for sport:", err);
    }
}

function selectSportMember(id, btnElement) {
    sportCurrentMemberId = id;
    
    // UI Update selector
    document.querySelectorAll('#sport-member-selector button').forEach(b => {
        b.querySelector('.member-avatar-container').classList.remove('border-darkblue-accent', 'scale-110');
        b.querySelector('span').classList.replace('opacity-100', 'opacity-60');
    });
    btnElement.querySelector('.member-avatar-container').classList.add('border-darkblue-accent', 'scale-110');
    btnElement.querySelector('span').classList.replace('opacity-60', 'opacity-100');

    // Mostra area contenuto
    document.getElementById('sport-empty-state').classList.add('hidden');
    document.getElementById('sport-content-area').classList.remove('hidden');

    loadSportData(id);
}

async function loadSportData(memberId) {
    try {
        const { data, error } = await supabase
            .from('sport_activities')
            .select('*')
            .eq('member_id', memberId)
            .order('activity_date', { ascending: false });

        if (error) throw error;
        sportActivities = data || [];
        
        renderSportStats();
        renderSportLists();
        
    } catch (err) {
        console.error("Error loading sport data:", err);
    }
}

function renderSportStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthData = sportActivities.filter(a => {
        const d = new Date(a.activity_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && a.is_completed;
    });

    let totalMinutes = 0;
    let totalCost = 0;
    const breakdown = {}; // { sportName: { mins: 0, cost: 0 } }

    monthData.forEach(a => {
        if (!breakdown[a.sport_name]) breakdown[a.sport_name] = { mins: 0, cost: 0 };
        
        if (a.start_time && a.end_time) {
            const start = new Date(`2000-01-01T${a.start_time}`);
            const end = new Date(`2000-01-01T${a.end_time}`);
            const diff = (end - start) / (1000 * 60);
            if (diff > 0) {
                totalMinutes += diff;
                breakdown[a.sport_name].mins += diff;
            }
        }
        const cost = parseFloat(a.cost) || 0;
        totalCost += cost;
        breakdown[a.sport_name].cost += cost;
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    document.getElementById('stat-sport-hours').textContent = `${hours}h ${mins}m`;
    document.getElementById('stat-sport-cost').textContent = `${totalCost.toFixed(2)}€`;

    // Render Breakdown
    const breakdownArea = document.getElementById('sport-breakdown-area');
    const breakdownList = document.getElementById('sport-breakdown-list');
    
    const sportsFound = Object.keys(breakdown);
    if (sportsFound.length > 1) {
        breakdownArea.classList.remove('hidden');
        breakdownList.innerHTML = '';
        sportsFound.sort((a, b) => breakdown[b].mins - breakdown[a].mins).forEach(s => {
            const bHours = Math.floor(breakdown[s].mins / 60);
            const bMins = breakdown[s].mins % 60;
            const html = `
                <div class="flex justify-between items-center bg-darkblue-base/30 p-2 rounded-xl border border-darkblue-base/50">
                    <span class="text-sm font-bold text-darkblue-heading">${s}</span>
                    <div class="text-right">
                        <span class="text-xs font-bold text-darkblue-accent block">${bHours}h ${bMins}m</span>
                        <span class="text-[10px] text-darkblue-icon">${breakdown[s].cost.toFixed(2)}€</span>
                    </div>
                </div>
            `;
            breakdownList.insertAdjacentHTML('beforeend', html);
        });
    } else {
        breakdownArea.classList.add('hidden');
    }

    // Update Datalist Suggestions
    const datalist = document.getElementById('sport-suggestions');
    const allSports = [...new Set(sportActivities.map(a => a.sport_name))];
    datalist.innerHTML = '';
    allSports.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        datalist.appendChild(opt);
    });
}

function renderSportLists() {
    const upcomingList = document.getElementById('sport-upcoming-list');
    const historyList = document.getElementById('sport-history-list');
    
    upcomingList.innerHTML = '';
    historyList.innerHTML = '';

    const todayStr = new Date().toISOString().split('T')[0];

    const upcoming = sportActivities.filter(a => !a.is_completed && a.activity_date >= todayStr).reverse();
    const history = sportActivities.filter(a => a.is_completed || a.activity_date < todayStr);

    if (upcoming.length === 0) {
        upcomingList.innerHTML = '<div class="text-center py-8 text-darkblue-icon text-sm italic">Nessun allenamento pianificato.</div>';
    } else {
        upcoming.forEach(a => upcomingList.appendChild(createActivityCard(a, true)));
    }

    if (history.length === 0) {
        historyList.innerHTML = '<div class="text-center py-8 text-darkblue-icon text-sm italic">Nessuna attività registrata.</div>';
    } else {
        history.forEach(a => historyList.appendChild(createActivityCard(a, false)));
    }
}

function createActivityCard(activity, isUpcoming) {
    const div = document.createElement('div');
    div.className = `clay-card ${isUpcoming ? 'bg-darkblue-card border-l-4 border-orange-500' : 'bg-darkblue-base/50'} p-4 rounded-3xl flex items-center gap-4 active:scale-[0.98] transition-all`;
    
    const date = new Date(activity.activity_date);
    const day = date.getDate();
    const month = date.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
    
    const time = activity.start_time ? activity.start_time.substring(0, 5) : '--:--';
    const duration = calculateDuration(activity.start_time, activity.end_time);

    div.innerHTML = `
        <div class="flex flex-col items-center justify-center min-w-[50px] bg-darkblue-base rounded-2xl p-2 shadow-inner">
            <span class="text-lg font-bold text-darkblue-heading leading-none">${day}</span>
            <span class="text-[10px] font-bold text-darkblue-accent uppercase">${month}</span>
        </div>
        <div class="flex-1 overflow-hidden">
            <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-bold text-darkblue-heading truncate">${activity.sport_name}</span>
                ${activity.is_completed ? '<i class="fa-solid fa-circle-check text-green-500 text-xs"></i>' : ''}
            </div>
            <div class="flex items-center gap-3 text-[10px] text-darkblue-icon font-medium">
                <span><i class="fa-regular fa-clock mr-1"></i>${time} (${duration})</span>
                ${activity.location ? `<span class="truncate"><i class="fa-solid fa-location-dot mr-1"></i>${activity.location}</span>` : ''}
            </div>
        </div>
        <div class="text-right flex flex-col items-end gap-1">
            <span class="text-sm font-bold text-darkblue-heading">${activity.cost > 0 ? parseFloat(activity.cost).toFixed(2) + '€' : 'Gratis'}</span>
            <div class="flex gap-2">
                <button onclick="editSportActivity('${activity.id}')" class="text-darkblue-icon hover:text-darkblue-accent p-1"><i class="fa-solid fa-pen text-xs"></i></button>
                <button onclick="deleteSportActivity('${activity.id}')" class="text-darkblue-icon hover:text-red-400 p-1"><i class="fa-solid fa-trash-can text-xs"></i></button>
            </div>
        </div>
    `;

    return div;
}

function calculateDuration(start, end) {
    if (!start || !end) return '0h';
    const s = new Date(`2000-01-01T${start}`);
    const e = new Date(`2000-01-01T${end}`);
    const diff = (e - s) / (1000 * 60);
    if (diff <= 0) return '0h';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function setupSportModals() {
    const modal = document.getElementById('modal-sport-activity');
    const modalContent = document.getElementById('modal-content-sport-activity');
    const btnAdd = document.getElementById('btn-add-sport');
    const btnClose = document.getElementById('btn-close-sport-modal');
    const form = document.getElementById('form-sport-activity');

    // Listener per ricalcolo costo
    const rateInput = document.getElementById('sa-hourly-rate');
    const startInput = document.getElementById('sa-start');
    const endInput = document.getElementById('sa-end');
    const costInput = document.getElementById('sa-cost');

    const updateCost = () => {
        const rate = parseFloat(rateInput.value) || 0;
        const start = startInput.value;
        const end = endInput.value;
        if (rate > 0 && start && end) {
            const s = new Date(`2000-01-01T${start}`);
            const e = new Date(`2000-01-01T${end}`);
            const diffHours = (e - s) / (1000 * 60 * 60);
            if (diffHours > 0) {
                costInput.value = (rate * diffHours).toFixed(2);
            }
        }
    };

    rateInput.addEventListener('input', updateCost);
    startInput.addEventListener('input', updateCost);
    endInput.addEventListener('input', updateCost);

    btnAdd.addEventListener('click', () => {
        if (!sportCurrentMemberId) {
            alert("Seleziona prima un membro della famiglia.");
            return;
        }
        editingActivityId = null;
        form.reset();
        document.getElementById('sport-modal-title').textContent = "Nuovo Allenamento";
        document.getElementById('sa-date').valueAsDate = new Date();
        document.getElementById('sa-start').value = "10:00";
        document.getElementById('sa-end').value = "11:00";
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('translate-y-full');
    });

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modalContent.classList.add('translate-y-full');
    };

    btnClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    form.addEventListener('submit', handleSportSubmit);
}

async function handleSportSubmit(e) {
    e.preventDefault();
    const payload = {
        member_id: sportCurrentMemberId,
        sport_name: document.getElementById('sa-name').value,
        activity_date: document.getElementById('sa-date').value,
        start_time: document.getElementById('sa-start').value,
        end_time: document.getElementById('sa-end').value,
        location: document.getElementById('sa-location').value || null,
        hourly_rate: parseFloat(document.getElementById('sa-hourly-rate').value) || 0,
        cost: parseFloat(document.getElementById('sa-cost').value) || 0,
        intensity: parseInt(document.getElementById('sa-intensity').value),
        calories: parseInt(document.getElementById('sa-calories').value) || null,
        notes: document.getElementById('sa-notes').value || null,
        is_completed: document.getElementById('sa-completed').checked
    };

    try {
        const familyId = await window.getUserFamilyId();
        payload.family_id = familyId;

        if (editingActivityId) {
            await supabase.from('sport_activities').update(payload).eq('id', editingActivityId);
        } else {
            await supabase.from('sport_activities').insert([payload]);
            
            // Se è un allenamento futuro, aggiungiamo opzionalmente al calendario fisico?
            // Per ora lo facciamo via "Virtual Event" in calendario.js, è più pulito.
        }

        document.getElementById('btn-close-sport-modal').click();
        loadSportData(sportCurrentMemberId);
        
        // Refresh calendario se aperto
        if (typeof window.fetchEvents === 'function') window.fetchEvents();

    } catch (err) {
        console.error("Error saving sport activity:", err);
        alert("Errore durante il salvataggio.");
    }
}

window.editSportActivity = function(id) {
    const activity = sportActivities.find(a => a.id === id);
    if (!activity) return;

    editingActivityId = id;
    document.getElementById('sport-modal-title').textContent = "Modifica Attività";
    
    document.getElementById('sa-name').value = activity.sport_name;
    document.getElementById('sa-date').value = activity.activity_date;
    document.getElementById('sa-start').value = activity.start_time;
    document.getElementById('sa-end').value = activity.end_time;
    document.getElementById('sa-location').value = activity.location || '';
    document.getElementById('sa-hourly-rate').value = activity.hourly_rate || 0;
    document.getElementById('sa-cost').value = activity.cost || 0;
    document.getElementById('sa-intensity').value = activity.intensity || 5;
    document.getElementById('sa-calories').value = activity.calories || '';
    document.getElementById('sa-notes').value = activity.notes || '';
    document.getElementById('sa-completed').checked = activity.is_completed;

    const modal = document.getElementById('modal-sport-activity');
    const modalContent = document.getElementById('modal-content-sport-activity');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modalContent.classList.remove('translate-y-full');
}

window.deleteSportActivity = function(id) {
    window.showConfirmModal("Elimina Attività", "Vuoi cancellare questa sessione sportiva?", async () => {
        try {
            await supabase.from('sport_activities').delete().eq('id', id);
            loadSportData(sportCurrentMemberId);
            if (typeof window.fetchEvents === 'function') window.fetchEvents();
        } catch (err) {
            console.error("Error deleting sport activity:", err);
        }
    });
}
