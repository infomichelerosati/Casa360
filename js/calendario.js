// js/calendario.js

let calSubscription = null;
let currentDate = new Date();
let selectedDate = new Date();
let eventsMap = {}; // { 'YYYY-MM-DD': [event1, event2] }
let familyMembersMap = {}; // per tendina e colori
let editingEventId = null; // tracking per le modifiche

function getLocalDayStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const COLOR_MAP = {
    'Generico': 'bg-gray-400',
    'Visita Medica': 'bg-red-400',
    'Lavoro': 'bg-blue-400',
    'Scuola': 'bg-orange-400',
    'Scadenza Veicolo': 'bg-red-500', // Scadenze in rosso
    'Scadenza Pet': 'bg-amber-500',
    'Scadenza Documento': 'bg-orange-600',
    'Ferie': 'bg-yellow-500',
    'Riposo': 'bg-green-500',
    'Malattia': 'bg-red-400'
};

async function initCalendario() {
    console.log("Inizializzazione Modulo Calendario...");

    // Binding UI Controlli Mese
    document.getElementById('btn-cal-prev').addEventListener('click', () => changeMonth(-1));
    document.getElementById('btn-cal-next').addEventListener('click', () => changeMonth(1));

    // UI Modale Aggiunta
    const modal = document.getElementById('modal-add-event');
    const modalContent = document.getElementById('modal-content-event');
    const btnAdd = document.getElementById('btn-add-event');
    const btnClose = document.getElementById('btn-close-modal');
    const form = document.getElementById('form-add-event');

    btnAdd.addEventListener('click', () => {
        // Pre-popola la data con quella selezionata
        document.getElementById('ev-date').value = getLocalDayStr(selectedDate);
        document.getElementById('ev-time').value = '10:00';

        modal.classList.remove('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('translate-y-full');
    });

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modalContent.classList.add('translate-y-full');
        form.reset();
        document.getElementById('modal-event-title').textContent = "Nuovo Appuntamento";
        editingEventId = null;
    };

    btnClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(); // Chiudi cliccando fuori
    });

    form.addEventListener('submit', handleAddEvent);

    // Caricamento Dati e Render Base
    await fetchFamilyMembers(); // Serve per popolare la tendina "Assegnato a"
    await fetchEvents();

    setupRealtimeCalendar();
}

async function fetchFamilyMembers() {
    try {
        const { data, error } = await supabase.from('family_members').select('*');
        if (error) throw error;

        const selectBox = document.getElementById('ev-assigned');
        data.forEach(m => {
            familyMembersMap[m.id] = m;
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.name;
            selectBox.appendChild(option);
        });
    } catch (err) {
        console.error("Errore fetch members:", err);
    }
}

async function fetchEvents() {
    // Carichiamo gli eventi del mese corrente e limitrofi (per semplicità prendiamo un range largo)
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString();

    try {
        const [eventsRes, vehRes, petsRes, shiftsRes, docsRes] = await Promise.all([
            supabase.from('calendar_events')
                .select('*')
                .gte('start_time', firstDay)
                .lte('start_time', lastDay)
                .order('start_time', { ascending: true }),
            supabase.from('family_vehicles').select('*'),
            supabase.from('pet_reminders').select('*, family_pets(name)'),
            supabase.from('work_shifts')
                .select('*, family_members(name)')
                .in('shift_type', ['Ferie', 'Riposo', 'Malattia', 'Permesso'])
                .gte('shift_date', getLocalDayStr(new Date(firstDay)))
                .lte('shift_date', getLocalDayStr(new Date(lastDay))),
            supabase.from('family_documents')
                .select('id, title, category, expiry_date, family_members(name)')
                .gte('expiry_date', getLocalDayStr(new Date(firstDay)))
                .lte('expiry_date', getLocalDayStr(new Date(lastDay)))
        ]);

        if (eventsRes.error) throw eventsRes.error;
        if (vehRes.error) throw vehRes.error;
        if (petsRes.error) throw petsRes.error;
        if (shiftsRes.error) throw shiftsRes.error;
        if (docsRes.error) throw docsRes.error;

        let data = eventsRes.data;

        // Generazione Eventi Virtuali per le Scadenze Veicoli
        const firstDayStr = getLocalDayStr(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        const lastDayStr = getLocalDayStr(new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0));

        vehRes.data.forEach(veh => {
            const addExp = (dateStr, typeName) => {
                if (dateStr && dateStr >= firstDayStr && dateStr <= lastDayStr) {
                    data.push({
                        id: 'v-' + veh.id + '-' + typeName,
                        title: `${typeName} ${veh.name}`,
                        start_time: dateStr + "T08:00:00Z", // Mostra genericamente alle 8 del mattino
                        end_time: dateStr + "T09:00:00Z",
                        event_type: 'Scadenza Veicolo',
                        is_virtual: true // flag
                    });
                }
            };
            addExp(veh.insurance_expiry, 'Assicurazione');
            addExp(veh.tax_expiry, 'Bollo');
            addExp(veh.inspection_expiry, 'Revisione');
            if (veh.is_gpl && veh.gpl_expiry) addExp(veh.gpl_expiry, 'Bombola GPL');
        });

        // Generazione Eventi Virtuali per le Scadenze Animali
        petsRes.data.forEach(rem => {
            const petName = rem.family_pets ? rem.family_pets.name : 'Pet';
            const dateStr = rem.due_date;
            if (dateStr && dateStr >= firstDayStr && dateStr <= lastDayStr && !rem.is_completed) {
                const timeStr = rem.due_time || '08:00:00';

                data.push({
                    id: 'p-' + rem.id,
                    title: `${rem.reminder_type} ${petName}`,
                    start_time: `${dateStr}T${timeStr}Z`,
                    end_time: `${dateStr}T${timeStr}Z`,
                    event_type: 'Scadenza Pet',
                    is_virtual: true,
                    virtual_type: 'pet'
                });
            }
        });

        // Generazione Eventi Virtuali per Riposi e Ferie (Modulo Lavoro)
        if (shiftsRes.data) {
            shiftsRes.data.forEach(shift => {
                const memberName = shift.family_members ? shift.family_members.name : 'Sconosciuto';
                data.push({
                    id: 'w-' + shift.id,
                    title: `${shift.shift_type} ${memberName}`,
                    start_time: `${shift.shift_date}T08:00:00Z`, // virtuale tutto il giorno
                    end_time: `${shift.shift_date}T09:00:00Z`,
                    event_type: shift.shift_type,
                    is_virtual: true,
                    virtual_type: 'work'
                });
            });
        }

        // Generazione Eventi Virtuali per Documenti in Scadenza
        if (docsRes.data) {
            docsRes.data.forEach(doc => {
                const owner = doc.family_members ? doc.family_members.name : '';
                const ownerText = owner ? ` (${owner})` : '';
                data.push({
                    id: 'd-' + doc.id,
                    title: `Scadenza ${doc.title}${ownerText}`,
                    start_time: `${doc.expiry_date}T08:00:00Z`,
                    end_time: `${doc.expiry_date}T09:00:00Z`,
                    event_type: 'Scadenza Documento',
                    is_virtual: true,
                    virtual_type: 'doc'
                });
            });
        }

        // Raggruppiamo gli eventi per stringa data (YYYY-MM-DD)
        eventsMap = {};
        let totalCount = 0;

        data.forEach(ev => {
            const dStr = ev.start_time.split('T')[0];
            if (!eventsMap[dStr]) eventsMap[dStr] = [];
            eventsMap[dStr].push(ev);
            totalCount++;
        });

        document.getElementById('cal-events-counter').textContent = `${totalCount} impegni previsti`;

        renderCalendar();
        renderDayEvents();

    } catch (err) {
        console.error("Fetch Events Error:", err);
    }
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Aggiorna titolo Mese
    const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    document.getElementById('cal-month-year').textContent = `${monthNames[month]} ${year}`;

    // Calcolo giorni
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Aggiustamento: in JS 0 = Domenica, noi vogliamo 0 = Lunedì
    let emptyDays = firstDay === 0 ? 6 : firstDay - 1;

    // Genera celle vuote iniziali
    for (let i = 0; i < emptyDays; i++) {
        grid.insertAdjacentHTML('beforeend', `<div class="aspect-square opacity-0"></div>`);
    }

    // Genera celle giorni
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const dayStr = getLocalDayStr(d);
        const isToday = dayStr === getLocalDayStr(new Date());
        const isSelected = dayStr === getLocalDayStr(selectedDate);

        // Controlla se ci sono eventi in questo giorno
        const dayEvents = eventsMap[dayStr] || [];

        // Creiamo i pallini indicatori (massimo 3)
        let dotsHTML = '';
        dayEvents.slice(0, 3).forEach(ev => {
            const colorClass = ev.assigned_to && familyMembersMap[ev.assigned_to]
                ? `bg-[${familyMembersMap[ev.assigned_to].avatar_color}]`
                : COLOR_MAP[ev.event_type] || 'bg-gray-400';

            // Per via di tailwind safe list, in prototipo usiamo colori fissi per type come fallback
            const finalColor = COLOR_MAP[ev.event_type] || 'bg-darkblue-accent';
            dotsHTML += `<span class="w-1.5 h-1.5 rounded-full ${finalColor}"></span>`;
        });

        // Stile Claymorphism se selezionato
        const baseClass = "aspect-square flex flex-col items-center justify-start pt-1.5 pb-1 rounded-2xl cursor-pointer transition-all text-sm font-bold relative";

        const activeClass = isSelected
            ? "clay-item bg-[#3b82f6] text-white shadow-[inset_2px_2px_4px_rgba(255,255,255,0.3),4px_4px_10px_rgba(9,13,22,0.5)]"
            : "hover:bg-darkblue-base/50 text-darkblue-text";

        const todayStyle = isToday && !isSelected ? "border border-darkblue-accent/30 text-darkblue-accent" : "";

        grid.insertAdjacentHTML('beforeend', `
            <div class="${baseClass} ${activeClass} ${todayStyle}" onclick="selectDate('${dayStr}')">
                <span>${i}</span>
                <div class="flex gap-0.5 mt-auto">${dotsHTML}</div>
            </div>
        `);
    }
}

// Global hook
window.selectDate = function (dateStr) {
    selectedDate = new Date(dateStr);
    renderCalendar(); // Ridisegna per muovere "l'effetto active"
    renderDayEvents(); // Carica la card eventi sotto
}

function changeMonth(offset) {
    currentDate.setMonth(currentDate.getMonth() + offset);
    fetchEvents(); // Ricarica eventi per il nuovo span di date
}

function renderDayEvents() {
    const titleEl = document.getElementById('selected-date-title');
    const listEl = document.getElementById('day-events-list');

    const dayStr = getLocalDayStr(selectedDate);
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    titleEl.textContent = selectedDate.toLocaleDateString('it-IT', options);

    const events = eventsMap[dayStr] || [];

    listEl.innerHTML = '';

    if (events.length === 0) {
        listEl.innerHTML = `<div class="clay-item p-6 rounded-clay bg-darkblue-base text-center text-darkblue-icon text-sm shadow-inner">Giornata Libera ☕</div>`;
        return;
    }

    // Ordiniamo gli eventi di oggi per orario
    events.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    events.forEach(ev => {
        const timeStr = new Date(ev.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const avatarName = ev.assigned_to && familyMembersMap[ev.assigned_to] ? familyMembersMap[ev.assigned_to].name[0] : 'F'; // 'F' per Family
        const eventColor = COLOR_MAP[ev.event_type] || 'bg-gray-400';

        const isVirtual = ev.is_virtual;
        let deleteButton = '';
        if (isVirtual) {
            if (ev.virtual_type === 'pet') {
                deleteButton = `<div class="text-xs text-darkblue-icon/50 uppercase font-bold text-center mt-2 flex items-center justify-center gap-1"><i class="fa-solid fa-paw"></i> Pet</div>`;
            } else if (ev.virtual_type === 'work') {
                deleteButton = `<div class="text-xs text-darkblue-icon/50 uppercase font-bold text-center mt-2 flex items-center justify-center gap-1"><i class="fa-solid fa-briefcase"></i> Turni</div>`;
            } else if (ev.virtual_type === 'doc') {
                deleteButton = `<div class="text-xs text-darkblue-icon/50 uppercase font-bold text-center mt-2 flex items-center justify-center gap-1"><i class="fa-solid fa-folder"></i> Archivio</div>`;
            } else {
                deleteButton = `<div class="text-xs text-darkblue-icon/50 uppercase font-bold text-center mt-2 flex items-center justify-center gap-1"><i class="fa-solid fa-car"></i> Veicoli</div>`;
            }
        } else {
            deleteButton = `<div class="flex items-center gap-2 mt-2">
                   <button onclick="editEvent('${ev.id}')" class="w-6 h-6 flex items-center justify-center text-darkblue-icon hover:text-darkblue-heading transition-colors" title="Modifica"><i class="fa-solid fa-pen text-xs"></i></button>
                   <button onclick="deleteEvent('${ev.id}')" class="w-6 h-6 flex items-center justify-center text-darkblue-icon hover:text-red-500 transition-colors" title="Elimina"><i class="fa-regular fa-trash-can text-xs"></i></button>
               </div>`;
        }

        const avatarHTML = ev.assigned_to && familyMembersMap[ev.assigned_to]
            ? `<div class="w-8 h-8 rounded-full bg-darkblue-base clay-checkbox flex items-center justify-center text-xs font-bold text-darkblue-icon border border-darkblue-base self-center shrink-0" title="Assegnato">
                ${avatarName}
               </div>`
            : `<div class="w-8 h-8 rounded-full bg-darkblue-base clay-checkbox flex items-center justify-center text-xs font-bold text-darkblue-icon border border-darkblue-base self-center shrink-0" title="Assegnato">
                ${avatarName}
               </div>`; // Fallback for 'F'

        const html = `
            <div class="clay-item p-4 rounded-clay bg-darkblue-card flex items-center gap-4 group">
                <!-- Orario -->
                <div class="w-16 text-center shrink-0">
                    <span class="block text-xl font-bold text-darkblue-heading leading-none">${(isVirtual && !ev.virtual_type) ? 'Tutto<br><span class="text-sm">il gg</span>' : timeStr}</span>
                </div>
                
                <div class="w-1 bg-darkblue-base rounded-full h-12"></div> <!-- Separatore -->

                <!-- Dettagli -->
                <div class="flex-1 overflow-hidden border-l-2 border-darkblue-base pl-4 pb-1">
                    <h4 class="font-bold text-darkblue-heading leading-tight truncate px-1">${ev.title}</h4>
                    <span class="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${eventColor} text-white">${ev.event_type}</span>
                </div>

                <!-- Assegnatario e Azioni -->
                <div class="flex flex-col items-center justify-center shrink-0 min-w-[3rem]">
                    ${avatarHTML}
                    ${deleteButton}
                </div>
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });
}

// Global deletion
window.deleteEvent = function (id) {
    if (window.showConfirmModal) {
        window.showConfirmModal("Elimina Evento", "Vuoi cancellare questo impegno dal calendario?", async () => {
            try {
                await supabase.from('calendar_events').delete().eq('id', id);
            } catch (err) { console.error(err); }
        });
    } else {
        // Fallback
        if (!confirm("Cancellare l'impegno?")) return;
        supabase.from('calendar_events').delete().eq('id', id);
    }
}

window.editEvent = function (id) {
    // Cerchiamo l'evento in eventsMap
    let targetEv = null;
    for (const [day, list] of Object.entries(eventsMap)) {
        const found = list.find(e => e.id === id);
        if (found) { targetEv = found; break; }
    }

    if (!targetEv || targetEv.is_virtual) return;

    editingEventId = id;
    document.getElementById('modal-event-title').textContent = "Modifica Appuntamento";

    const dStr = targetEv.start_time.split('T')[0];
    const tStr = new Date(targetEv.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    document.getElementById('ev-title').value = targetEv.title;
    document.getElementById('ev-type').value = targetEv.event_type;
    document.getElementById('ev-date').value = dStr;
    document.getElementById('ev-time').value = tStr;
    document.getElementById('ev-assigned').value = targetEv.assigned_to || '';

    // Apri modale
    document.getElementById('modal-add-event').classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('modal-content-event').classList.remove('translate-y-full');
}

async function handleAddEvent(e) {
    e.preventDefault();

    const title = document.getElementById('ev-title').value;
    const type = document.getElementById('ev-type').value;
    const dateStr = document.getElementById('ev-date').value;
    const timeStr = document.getElementById('ev-time').value;
    const assigned = document.getElementById('ev-assigned').value;

    const startTimestamp = new Date(`${dateStr}T${timeStr}:00`).toISOString();

    // Dal momento che l'UI corrente non chiede la fine, impostiamo +1 ora di default
    const endDate = new Date(`${dateStr}T${timeStr}:00`);
    endDate.setHours(endDate.getHours() + 1);
    const endTimestamp = endDate.toISOString();

    const payload = {
        title: title,
        event_type: type,
        start_time: startTimestamp,
        end_time: endTimestamp,
        assigned_to: assigned ? assigned : null
    };

    try {
        const user = await getLoggedUser();
        if (user) {
            payload.created_by = user.id;
        }

        if (editingEventId) {
            const { error } = await supabase.from('calendar_events').update(payload).eq('id', editingEventId);
            if (error) throw error;
        } else {
            const familyId = await window.getUserFamilyId();
            if (!familyId) throw new Error("Utente non assegnato a nessuna famiglia.");

            payload.family_id = familyId;
            const { error } = await supabase.from('calendar_events').insert([payload]);
            if (error) throw error;
        }

        document.getElementById('btn-close-modal').click();
    } catch (err) {
        alert("Errore salvataggio: " + err.message);
    }
}

function setupRealtimeCalendar() {
    if (calSubscription) supabase.removeChannel(calSubscription);

    calSubscription = supabase
        .channel('public:calendar_events')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, payload => {
            console.log('Calendario changed!', payload);
            fetchEvents(); // Rifetch e redraw
        })
        .subscribe();
}
