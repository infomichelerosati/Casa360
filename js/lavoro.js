// js/lavoro.js

let currentWeekStart = new Date();
let familyMembersMapLavoro = {}; // id -> member
let familyMembersListLavoro = []; // array for ordered columns
let currentShifts = [];
let recentTimePresets = JSON.parse(localStorage.getItem('family_os_shift_presets') || '[]');

// Map dei colori e icone
const SHIFT_TYPES = {
    'Lavoro': { icon: 'fa-solid fa-briefcase', color: 'text-blue-500 bg-blue-500/10' },
    'Riposo': { icon: 'fa-solid fa-couch', color: 'text-green-500 bg-green-500/10' },
    'Ferie': { icon: 'fa-solid fa-umbrella-beach', color: 'text-yellow-500 bg-yellow-500/10' },
    'Malattia': { icon: 'fa-solid fa-thermometer', color: 'text-red-500 bg-red-500/10' },
    'Permesso': { icon: 'fa-solid fa-clock', color: 'text-purple-500 bg-purple-500/10' },
    'Reperibilità': { icon: 'fa-solid fa-pager', color: 'text-orange-500 bg-orange-500/10' },
    'Altro': { icon: 'fa-solid fa-pencil', color: 'text-gray-500 bg-gray-500/10' }
};

// Funzione helper per ottenere il Lunedì della settimana data
function getMonday(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

// Funzione helper per formattare YYYY-MM-DD locale (no GMT bug)
function getLocalDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function initLavoro() {
    console.log("Inizializzazione modulo Lavoro...");
    currentWeekStart = getMonday(new Date());

    // Event listeners
    const btnAdd = document.getElementById('btn-add-shift');
    if (btnAdd) btnAdd.onclick = openShiftForm;

    const btnClose = document.getElementById('btn-close-shift-form');
    if (btnClose) btnClose.onclick = closeShiftForm;

    const btnPrev = document.getElementById('btn-prev-week');
    if (btnPrev) btnPrev.onclick = () => changeWeek(-1);

    const btnNext = document.getElementById('btn-next-week');
    if (btnNext) btnNext.onclick = () => changeWeek(1);

    const formShift = document.getElementById('form-shift');
    if (formShift) formShift.onsubmit = handleSaveShift;

    const btnCloseDetails = document.getElementById('btn-close-shift-details');
    if (btnCloseDetails) btnCloseDetails.onclick = closeShiftDetails;

    // Listener per mostrare/nascondere blocco orario in base al tipo
    const typeSelect = document.getElementById('shift-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const timeBox = document.getElementById('shift-time-container');
            if (['Lavoro', 'Permesso', 'Reperibilità'].includes(val)) {
                timeBox.classList.remove('hidden');
            } else {
                timeBox.classList.add('hidden');
            }
        });
    }

    await loadFamilyMembersForLavoro();
    updateWeekLabel();
    await loadShiftsForWeek();
}

async function loadFamilyMembersForLavoro() {
    try {
        const familyId = await window.getUserFamilyId();
        const { data, error } = await supabase
            .from('family_members')
            .select('id, name, avatar_color')
            .eq('family_id', familyId)
            .order('created_at', { ascending: true }); // Mantiene sempre lo stesso ordine visivo

        if (error) throw error;

        familyMembersListLavoro = data || [];
        familyMembersMapLavoro = {};

        const memberSelect = document.getElementById('shift-member');
        if (memberSelect) memberSelect.innerHTML = '';

        // Header Grid UI
        const headerGrid = document.getElementById('shifts-members-header');
        if (headerGrid) {
            headerGrid.innerHTML = `<div class="w-12 shrink-0"></div> <!-- Spacer -->`;
        }

        familyMembersListLavoro.forEach(m => {
            familyMembersMapLavoro[m.id] = m;

            // Popola Select
            if (memberSelect) {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                memberSelect.appendChild(opt);
            }

            // Popola Header
            if (headerGrid) {
                headerGrid.innerHTML += `
                    <div class="flex-1 text-center font-bold text-darkblue-heading text-xs uppercase bg-darkblue-card rounded-xl py-2 shadow-sm clay-item truncate px-1">
                        ${m.name}
                    </div>
                `;
            }
        });

    } catch (err) {
        console.error("Errore fetch members Lavoro:", err);
    }
}

function updateWeekLabel() {
    const startStr = currentWeekStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const endStr = endOfWeek.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

    document.getElementById('current-week-dates').textContent = `${startStr} - ${endStr}`;
}

function changeWeek(offset) {
    currentWeekStart.setDate(currentWeekStart.getDate() + (offset * 7));
    updateWeekLabel();
    loadShiftsForWeek();
}

async function loadShiftsForWeek() {
    const gridBody = document.getElementById('shifts-grid-body');
    if (!gridBody) return;
    gridBody.innerHTML = `
        <div class="flex justify-center items-center h-32">
            <i class="fa-solid fa-circle-notch fa-spin text-darkblue-accent text-2xl"></i>
        </div>
    `;

    try {
        const familyId = await window.getUserFamilyId();

        // Calcola da Lunedì a Domenica stringhe YYYY-MM-DD
        const mondayStr = getLocalDateStr(currentWeekStart);
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        const sundayStr = getLocalDateStr(endOfWeek);

        const { data, error } = await supabase
            .from('work_shifts')
            .select('*')
            .eq('family_id', familyId)
            .gte('shift_date', mondayStr)
            .lte('shift_date', sundayStr);

        if (error) throw error;
        currentShifts = data || [];
        renderShiftsGrid();

    } catch (err) {
        console.error("Errore fetch shifts:", err);
        gridBody.innerHTML = `<p class="text-sm text-red-500 text-center py-4">Errore durante il caricamento.</p>`;
    }
}

function renderShiftsGrid() {
    const gridBody = document.getElementById('shifts-grid-body');
    if (!gridBody) return;
    gridBody.innerHTML = '';

    const giorniSettimana = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
    const todayStr = getLocalDateStr(new Date());

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(currentWeekStart);
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = getLocalDateStr(currentDate); // YYYY-MM-DD
        const isToday = dateStr === todayStr;

        // Container della riga
        const rowDiv = document.createElement('div');
        rowDiv.className = `flex gap-2 items-stretch ${isToday ? 'bg-darkblue-accent/10 rounded-2xl p-1 -mx-1' : ''}`;

        // Colonna Giorno
        const dayDiv = document.createElement('div');
        dayDiv.className = `w-12 shrink-0 flex flex-col items-center justify-center clay-card bg-darkblue-card rounded-2xl py-2 ${isToday ? 'border-2 border-darkblue-accent' : ''}`;
        dayDiv.innerHTML = `
            <span class="text-[10px] font-bold text-darkblue-icon uppercase">${giorniSettimana[i]}</span>
            <span class="text-lg font-bold ${isToday ? 'text-darkblue-accent' : 'text-darkblue-heading'}">${currentDate.getDate()}</span>
        `;
        rowDiv.appendChild(dayDiv);

        // Colonne Membri
        familyMembersListLavoro.forEach(member => {
            const memberCol = document.createElement('div');
            memberCol.className = 'flex-1 bg-darkblue-card clay-item rounded-2xl p-2 flex flex-col justify-center min-w-0';

            // Cerca il turno di questo utente per questa data
            const shift = currentShifts.find(s => s.shift_date === dateStr && s.member_id === member.id);

            if (shift) {
                const typeInfo = SHIFT_TYPES[shift.shift_type] || SHIFT_TYPES['Altro'];
                let timeText = '';
                if (shift.start_time && shift.end_time) {
                    timeText = `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}`;
                } else {
                    timeText = shift.shift_type;
                }

                memberCol.innerHTML = `
                    <div class="flex items-center gap-2 cursor-pointer w-full" onclick='openShiftDetails(${JSON.stringify(shift).replace(/'/g, "&#39;")})'>
                        <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${typeInfo.color}">
                           <i class="${typeInfo.icon}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                           <p class="text-[10px] font-bold text-darkblue-icon uppercase truncate">${shift.shift_type}</p>
                           <p class="text-xs font-bold text-darkblue-heading truncate">${timeText}</p>
                        </div>
                    </div>
                `;
            } else {
                // Nessun turno registrato, placeholder invisibile per mantenere allineamento
                memberCol.innerHTML = `<div class="w-full text-center text-darkblue-icon/30 text-xs py-2">-</div>`;
            }

            rowDiv.appendChild(memberCol);
        });

        gridBody.appendChild(rowDiv);
    }
}

// ------ MODAL FORM & PRESETS ------

function renderShiftDaysSelector() {
    const container = document.getElementById('shift-days-selector');
    if (!container) return;
    container.innerHTML = '';

    const giorniSettimana = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(currentWeekStart);
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = getLocalDateStr(currentDate);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'py-2 rounded-xl text-xs font-bold border-2 border-darkblue-base text-darkblue-icon transition-colors hover:border-darkblue-accent';
        btn.innerHTML = `${giorniSettimana[i]}<br><span class="text-[10px]">${currentDate.getDate()}</span>`;
        btn.dataset.date = dateStr;

        // Toggle selezione
        btn.onclick = () => {
            btn.classList.toggle('bg-darkblue-accent');
            btn.classList.toggle('text-white');
            btn.classList.toggle('border-darkblue-accent');
            btn.classList.toggle('selected-day');
        };

        container.appendChild(btn);
    }
}

function renderPresets() {
    const container = document.getElementById('shift-presets');
    if (!container) return;

    // Rimuovi vecchi bottoni preset (mantieni solo il titolo)
    const title = container.firstElementChild;
    container.innerHTML = '';
    container.appendChild(title);

    if (recentTimePresets.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    recentTimePresets.forEach(preset => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'text-[10px] font-bold px-3 py-1.5 rounded-full bg-darkblue-base text-darkblue-heading clay-item active:scale-95 transition-transform';
        btn.textContent = `${preset.start} - ${preset.end}`;
        btn.onclick = () => {
            document.getElementById('shift-start').value = preset.start;
            document.getElementById('shift-end').value = preset.end;
        };
        container.appendChild(btn);
    });
}

async function openShiftForm() {
    document.getElementById('form-shift').reset();

    // Mostra input orari per default (Lavoro è il primo)
    document.getElementById('shift-time-container').classList.remove('hidden');

    // Seleziona l'utente corrente come default
    const currentUser = await window.getLoggedUser();
    if (currentUser) {
        document.getElementById('shift-member').value = currentUser.id;
    }

    renderShiftDaysSelector();
    renderPresets();

    const modal = document.getElementById('modal-shift-form');
    const content = modal.querySelector('.clay-card');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
}

function closeShiftForm() {
    const modal = document.getElementById('modal-shift-form');
    const content = modal.querySelector('.clay-card');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95');
}

async function handleSaveShift(e) {
    e.preventDefault();

    const memberId = document.getElementById('shift-member').value;
    const shiftType = document.getElementById('shift-type').value;
    let startTime = document.getElementById('shift-start').value;
    let endTime = document.getElementById('shift-end').value;

    // Raccogli giorni selezionati
    const selectedBtns = document.querySelectorAll('#shift-days-selector button.selected-day');
    if (selectedBtns.length === 0) {
        alert("Seleziona almeno un giorno per il turno.");
        return;
    }

    // Pulisci orari se non è un turno che li richiede
    if (!['Lavoro', 'Permesso', 'Reperibilità'].includes(shiftType)) {
        startTime = null;
        endTime = null;
    }

    // Salva nei preset se sono orari validi
    if (startTime && endTime) {
        const presetObj = { start: startTime, end: endTime };
        // Evitiamo duplicati
        recentTimePresets = recentTimePresets.filter(p => p.start !== startTime || p.end !== endTime);
        recentTimePresets.unshift(presetObj);
        if (recentTimePresets.length > 4) recentTimePresets.pop(); // Max 4 presets
        localStorage.setItem('family_os_shift_presets', JSON.stringify(recentTimePresets));
    }

    try {
        const familyId = await window.getUserFamilyId();

        // Prepariamo l'array da inserire (bulk insert)
        const shiftsToInsert = [];
        selectedBtns.forEach(btn => {
            shiftsToInsert.push({
                family_id: familyId,
                member_id: memberId,
                shift_date: btn.dataset.date,
                shift_type: shiftType,
                start_time: startTime || null,
                end_time: endTime || null
            });
        });

        // Prima dell'insert, potremmo voler eliminare turni preesistenti dello stesso utente negli stessi giorni
        const datesToDelete = shiftsToInsert.map(s => s.shift_date);
        await supabase
            .from('work_shifts')
            .delete()
            .eq('member_id', memberId)
            .in('shift_date', datesToDelete);

        // Insert
        const { error } = await supabase.from('work_shifts').insert(shiftsToInsert);
        if (error) throw error;

        closeShiftForm();
        loadShiftsForWeek(); // ricarica

    } catch (err) {
        console.error("Errore salvataggio turni:", err);
        alert("Errore durante il salvataggio.");
    }
}

// ------ DETTAGLI E CANCELLAZIONE ------

function openShiftDetails(shift) {
    const modal = document.getElementById('modal-shift-details');
    const content = modal.querySelector('.clay-card');

    const typeInfo = SHIFT_TYPES[shift.shift_type] || SHIFT_TYPES['Altro'];

    const iconContainer = document.getElementById('detail-shift-icon');
    iconContainer.className = `w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl clay-item shadow-inner mb-2 ${typeInfo.color}`;
    iconContainer.innerHTML = `<i class="${typeInfo.icon}"></i>`;

    document.getElementById('detail-shift-type').textContent = shift.shift_type;

    const d = new Date(shift.shift_date);
    document.getElementById('detail-shift-date').textContent = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

    const timeEl = document.getElementById('detail-shift-time');
    if (shift.start_time && shift.end_time) {
        timeEl.textContent = `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}`;
        timeEl.classList.remove('hidden');
    } else {
        timeEl.classList.add('hidden');
    }

    const memberName = familyMembersMapLavoro[shift.member_id] ? familyMembersMapLavoro[shift.member_id].name : 'Sconosciuto';
    document.getElementById('detail-shift-member').textContent = memberName;

    const btnDelete = document.getElementById('btn-delete-shift');
    btnDelete.onclick = () => deleteShift(shift.id);

    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
}

function closeShiftDetails() {
    const modal = document.getElementById('modal-shift-details');
    const content = modal.querySelector('.clay-card');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95');
}

async function deleteShift(id) {
    if (!confirm("Sei sicuro di voler eliminare questo turno?")) return;

    try {
        const { error } = await supabase.from('work_shifts').delete().eq('id', id);
        if (error) throw error;

        closeShiftDetails();
        loadShiftsForWeek();
    } catch (err) {
        console.error("Errore eliminazione:", err);
        alert("Errore durante l'eliminazione.");
    }
}
