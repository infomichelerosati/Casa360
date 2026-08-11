// js/multijob.js

let mjCurrentDate = new Date();
let mjCurrentView = 'day'; // 'day', 'week', 'month'
let mjCurrentMemberId = null;
let mjJobs = [];
let mjShifts = [];

async function initMultiJob() {
    console.log("Inizializzazione Multi JOB...");

    if (!window.supabase) return;

    // Imposta la data odierna
    mjCurrentDate = new Date();
    
    // Inizializza Listeners
    setupMjListeners();

    // Carica dati
    await loadMjFamilyMembers();
    await fetchMjJobs();
    
    // Esegue il primo rendering
    renderMjView();
}

function setupMjListeners() {
    const formShift = document.getElementById('form-mj-shift');
    if (formShift) {
        formShift.addEventListener('submit', handleMjShiftSubmit);
    }

    const formJob = document.getElementById('form-mj-job-create');
    if (formJob) {
        formJob.addEventListener('submit', handleMjJobSubmit);
    }
}

// ---------------------------------------------------------
// FETCH DATI
// ---------------------------------------------------------
async function loadMjFamilyMembers() {
    try {
        const { data: userData } = await window.supabase.auth.getUser();
        if (!userData?.user) return;

        const { data: memberData } = await window.supabase
            .from('family_members')
            .select('family_id')
            .eq('id', userData.user.id)
            .single();

        if (!memberData) return;

        const { data: members, error } = await window.supabase
            .from('family_members')
            .select('id, name, avatar_color')
            .eq('family_id', memberData.family_id)
            .order('name');

        if (error) throw error;

        // Limita a 2 per design, se necessario (oppure mostra tutti come chips)
        const filterContainer = document.getElementById('mj-members-filter');
        filterContainer.innerHTML = '';

        if (members && members.length > 0) {
            // Se mjCurrentMemberId non è settato, seleziona l'utente corrente o il primo
            if (!mjCurrentMemberId) {
                const currentMember = members.find(m => m.id === userData.user.id);
                mjCurrentMemberId = currentMember ? currentMember.id : members[0].id;
            }

            members.forEach(m => {
                const isSelected = m.id === mjCurrentMemberId;
                const btn = document.createElement('button');
                btn.className = `px-4 py-2 rounded-full text-xs font-bold transition-all clay-item ${isSelected ? 'bg-darkblue-accent text-white shadow-lg' : 'bg-darkblue-base text-darkblue-icon hover:bg-darkblue-card border border-darkblue-card'}`;
                
                // Initials
                const initials = m.name.substring(0, 2).toUpperCase();
                
                btn.innerHTML = `
                    <div class="flex items-center gap-2">
                        <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white" style="background-color: ${m.avatar_color || '#3b82f6'}">
                            ${initials}
                        </div>
                        ${m.name}
                    </div>
                `;
                btn.onclick = () => {
                    mjCurrentMemberId = m.id;
                    loadMjFamilyMembers(); // re-render filters
                    fetchMjShifts(); // fetch shifts per il nuovo utente
                };
                filterContainer.appendChild(btn);
            });
        }

    } catch (err) {
        console.error("Errore caricamento membri in MultiJOB:", err);
    }
}

async function fetchMjJobs() {
    try {
        const { data, error } = await window.supabase
            .from('mj_jobs')
            .select('*')
            .order('title');

        if (error) throw error;
        mjJobs = data || [];
        
        renderMjJobsSelector();
        renderMjJobsManagerList();

        // Dopo aver caricato i jobs, carichiamo gli shifts
        await fetchMjShifts();

    } catch (err) {
        console.error("Errore fetch mj_jobs:", err);
    }
}

async function fetchMjShifts() {
    if (!mjCurrentMemberId) return;

    try {
        let query = window.supabase
            .from('mj_shifts')
            .select('*, mj_jobs(title, color, hourly_rate)')
            .eq('member_id', mjCurrentMemberId);

        // Filtro date in base alla view
        if (mjCurrentView === 'day') {
            const dateStr = formatDateISO(mjCurrentDate);
            query = query.eq('shift_date', dateStr);
        } else if (mjCurrentView === 'week') {
            const { start, end } = getWeekBounds(mjCurrentDate);
            query = query.gte('shift_date', formatDateISO(start)).lte('shift_date', formatDateISO(end));
        } else if (mjCurrentView === 'month') {
            const start = new Date(mjCurrentDate.getFullYear(), mjCurrentDate.getMonth(), 1);
            const end = new Date(mjCurrentDate.getFullYear(), mjCurrentDate.getMonth() + 1, 0);
            query = query.gte('shift_date', formatDateISO(start)).lte('shift_date', formatDateISO(end));
        }

        const { data, error } = await query.order('shift_date').order('start_time');

        if (error) throw error;
        mjShifts = data || [];
        
        renderMjView();

    } catch (err) {
        console.error("Errore fetch mj_shifts:", err);
    }
}

// ---------------------------------------------------------
// NAVIGAZIONE E VISTE
// ---------------------------------------------------------
function setMjView(view) {
    mjCurrentView = view;
    
    // Aggiorna stile tab
    ['day', 'week', 'month'].forEach(v => {
        const tab = document.getElementById(`tab-mj-${v}`);
        if (v === view) {
            tab.className = "px-6 py-2 rounded-full text-sm font-bold text-white bg-darkblue-base clay-item shadow-sm transition-all";
        } else {
            tab.className = "px-6 py-2 rounded-full text-sm font-bold text-darkblue-icon hover:text-white transition-all";
        }
    });

    fetchMjShifts();
}

function changeMjDate(offset) {
    if (mjCurrentView === 'day') {
        mjCurrentDate.setDate(mjCurrentDate.getDate() + offset);
    } else if (mjCurrentView === 'week') {
        mjCurrentDate.setDate(mjCurrentDate.getDate() + (offset * 7));
    } else if (mjCurrentView === 'month') {
        mjCurrentDate.setMonth(mjCurrentDate.getMonth() + offset);
    }
    fetchMjShifts();
}

function renderMjView() {
    updateMjDateLabels();

    const container = document.getElementById('mj-view-container');
    container.innerHTML = '';

    if (mjCurrentView === 'day') {
        renderMjTimeline(container);
    } else if (mjCurrentView === 'week') {
        renderMjWeekView(container);
    } else if (mjCurrentView === 'month') {
        renderMjMonthView(container);
    }
}

function updateMjDateLabels() {
    const titleEl = document.getElementById('mj-current-date-label');
    const subEl = document.getElementById('mj-current-date-sub');

    if (mjCurrentView === 'day') {
        const optsTitle = { weekday: 'long', day: 'numeric', month: 'long' };
        titleEl.textContent = mjCurrentDate.toLocaleDateString('it-IT', optsTitle);
        subEl.textContent = "Giornata Singola";
    } else if (mjCurrentView === 'week') {
        const { start, end } = getWeekBounds(mjCurrentDate);
        titleEl.textContent = `Settimana`;
        subEl.textContent = `${start.getDate()} ${start.toLocaleString('it-IT', {month:'short'})} - ${end.getDate()} ${end.toLocaleString('it-IT', {month:'short'})}`;
    } else if (mjCurrentView === 'month') {
        titleEl.textContent = mjCurrentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        subEl.textContent = "Intero Mese";
    }
}

// ---------------------------------------------------------
// TIMELINE GIORNALIERA E CALCOLI
// ---------------------------------------------------------
function renderMjTimeline(container) {
    document.getElementById('mj-daily-summary').classList.remove('hidden');

    // Crea le linee orarie da 0 a 24
    let html = `<div class="relative w-full h-[600px] overflow-y-auto hidden-scrollbar" id="mj-timeline-scroll">`;
    html += `<div class="relative w-full min-h-[1440px] bg-darkblue-base rounded-2xl">`; // 1 min = 1px => 1440px
    
    for (let i = 0; i <= 24; i++) {
        const topPx = i * 60;
        html += `
            <div class="absolute w-full flex items-center gap-2 border-t border-darkblue-card/50" style="top: ${topPx}px; z-index: 1;">
                <span class="text-[10px] text-darkblue-icon font-bold w-10 text-right pr-2 bg-darkblue-base">${String(i).padStart(2, '0')}:00</span>
            </div>
        `;
    }

    let totalMinutesAll = 0;
    const jobBreakdown = {};

    mjShifts.forEach((shift, index) => {
        // Calcola top e height in minuti (che corrispondono a pixel 1:1)
        const [startH, startM] = shift.start_time.split(':').map(Number);
        const [endH, endM] = shift.end_time.split(':').map(Number);
        
        let startTotal = (startH * 60) + startM;
        let endTotal = (endH * 60) + endM;
        if (endTotal < startTotal) endTotal += (24 * 60); // scavalla mezzanotte
        
        const duration = endTotal - startTotal;
        totalMinutesAll += duration;

        const jobColor = shift.mj_jobs?.color || '#3b82f6';
        const jobTitle = shift.mj_jobs?.title || 'Sconosciuto';

        // Aggiorna Breakdown
        if (!jobBreakdown[shift.job_id]) {
            jobBreakdown[shift.job_id] = { title: jobTitle, color: jobColor, minutes: 0 };
        }
        jobBreakdown[shift.job_id].minutes += duration;

        html += `
            <div class="absolute left-14 right-2 rounded-xl p-2 shadow-lg clay-item flex flex-col justify-center overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" 
                style="top: ${startTotal}px; height: ${duration}px; background-color: ${jobColor}40; border-left: 4px solid ${jobColor}; z-index: 10;"
                onclick="openMjShiftEditModal('${shift.id}')">
                <p class="text-xs font-bold text-white drop-shadow-md truncate">${jobTitle}</p>
                <p class="text-[10px] text-white/80 font-medium">${shift.start_time.substring(0,5)} - ${shift.end_time.substring(0,5)}</p>
                ${shift.notes ? `<p class="text-[9px] text-white/60 truncate mt-1 italic">${shift.notes}</p>` : ''}
            </div>
        `;

        // Calcolo Tempo Morto tra questo turno e il successivo
        if (index < mjShifts.length - 1) {
            const nextShift = mjShifts[index + 1];
            const [nextStartH, nextStartM] = nextShift.start_time.split(':').map(Number);
            const nextStartTotal = (nextStartH * 60) + nextStartM;
            
            if (nextStartTotal > endTotal) {
                const gap = nextStartTotal - endTotal;
                if (gap > 0 && gap < 720) { // Mostra gap solo se < 12h
                    html += `
                        <div class="absolute left-14 right-2 border-l-2 border-dashed border-darkblue-icon/30 flex items-center pl-2"
                            style="top: ${endTotal}px; height: ${gap}px; z-index: 5;">
                            <span class="text-[9px] text-darkblue-icon font-medium">Pausa: ${formatMinutes(gap)}</span>
                        </div>
                    `;
                }
            }
        }
    });

    html += `</div></div>`;
    container.innerHTML = html;

    // Scrolla automaticamente al primo turno o alle 08:00
    setTimeout(() => {
        const scrollEl = document.getElementById('mj-timeline-scroll');
        if (scrollEl) {
            if (mjShifts.length > 0) {
                const [startH, startM] = mjShifts[0].start_time.split(':').map(Number);
                const startTotal = (startH * 60) + startM;
                scrollEl.scrollTop = Math.max(0, startTotal - 60);
            } else {
                scrollEl.scrollTop = 8 * 60; // 08:00
            }
        }
    }, 100);

    // Aggiorna Riepilogo
    document.getElementById('mj-daily-total-hours').textContent = formatMinutes(totalMinutesAll);
    const breakdownEl = document.getElementById('mj-daily-breakdown');
    breakdownEl.innerHTML = '';
    
    Object.values(jobBreakdown).forEach(b => {
        breakdownEl.innerHTML += `
            <div class="flex justify-between items-center bg-darkblue-base rounded-lg p-2 px-3">
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full" style="background-color: ${b.color}"></div>
                    <span class="text-xs font-bold text-darkblue-icon">${b.title}</span>
                </div>
                <span class="text-xs font-bold text-darkblue-heading">${formatMinutes(b.minutes)}</span>
            </div>
        `;
    });
    
    if (Object.keys(jobBreakdown).length === 0) {
        breakdownEl.innerHTML = `<p class="text-xs text-darkblue-icon italic p-2 text-center">Nessun turno registrato oggi.</p>`;
    }
}

function renderMjWeekView(container) {
    document.getElementById('mj-daily-summary').classList.add('hidden');
    
    let html = `<div class="grid grid-cols-7 gap-1 h-full min-h-[400px]">`;
    const { start } = getWeekBounds(mjCurrentDate);
    
    for (let i = 0; i < 7; i++) {
        let currentDay = new Date(start);
        currentDay.setDate(currentDay.getDate() + i);
        let dateStr = formatDateISO(currentDay);
        
        // Cerca turni per questo giorno
        let dayShifts = mjShifts.filter(s => s.shift_date === dateStr);
        let totalMins = 0;
        
        let dayHtml = `<div class="flex flex-col bg-darkblue-base rounded-xl overflow-hidden h-full">`;
        dayHtml += `<div class="bg-darkblue-card/50 text-center py-2 border-b border-darkblue-card">
            <p class="text-[10px] uppercase font-bold text-darkblue-icon">${currentDay.toLocaleDateString('it-IT', {weekday: 'short'})}</p>
            <p class="text-sm font-bold text-darkblue-heading">${currentDay.getDate()}</p>
        </div>`;
        
        dayHtml += `<div class="flex-1 p-1 space-y-1 overflow-y-auto hidden-scrollbar">`;
        
        dayShifts.forEach(shift => {
            const startM = timeToMinutes(shift.start_time);
            let endM = timeToMinutes(shift.end_time);
            if (endM < startM) endM += 24*60;
            totalMins += (endM - startM);
            
            const jobColor = shift.mj_jobs?.color || '#3b82f6';
            const jobTitle = shift.mj_jobs?.title || 'Job';
            
            dayHtml += `<div class="rounded p-1 cursor-pointer active:scale-95 transition-transform" style="background-color: ${jobColor}30; border-left: 2px solid ${jobColor}" onclick="mjJumpToDate('${dateStr}')">
                <p class="text-[9px] font-bold text-white truncate">${jobTitle}</p>
                <p class="text-[8px] text-white/80">${shift.start_time.substring(0,5)}-${shift.end_time.substring(0,5)}</p>
            </div>`;
        });
        
        dayHtml += `</div>`;
        
        if (totalMins > 0) {
            dayHtml += `<div class="bg-darkblue-card text-center py-1 border-t border-darkblue-base">
                <span class="text-[9px] font-bold text-darkblue-heading">${formatMinutes(totalMins)}</span>
            </div>`;
        }
        
        dayHtml += `</div>`;
        html += dayHtml;
    }
    html += `</div>`;
    container.innerHTML = html;
}

function renderMjMonthView(container) {
    document.getElementById('mj-daily-summary').classList.add('hidden');
    
    let html = `<div class="flex flex-col h-full min-h-[400px]">`;
    // Header giorni settimana
    html += `<div class="grid grid-cols-7 gap-1 mb-2">`;
    const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    days.forEach(d => {
        html += `<div class="text-center text-[10px] font-bold text-darkblue-icon uppercase">${d}</div>`;
    });
    html += `</div>`;
    
    html += `<div class="grid grid-cols-7 gap-1 flex-1">`;
    
    const year = mjCurrentDate.getFullYear();
    const month = mjCurrentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Domenica = 6
    
    // Celle vuote prima del 1°
    for (let i = 0; i < startDayOfWeek; i++) {
        html += `<div class="bg-transparent rounded-xl"></div>`;
    }
    
    // Giorni del mese
    for (let d = 1; d <= lastDay.getDate(); d++) {
        let currentDay = new Date(year, month, d);
        let dateStr = formatDateISO(currentDay);
        
        let dayShifts = mjShifts.filter(s => s.shift_date === dateStr);
        let hasShifts = dayShifts.length > 0;
        
        let isToday = dateStr === formatDateISO(new Date());
        let todayClass = isToday ? 'border border-darkblue-accent' : '';
        let bgClass = hasShifts ? 'bg-darkblue-card cursor-pointer hover:bg-darkblue-card/80 active:scale-95 transition-transform shadow-sm' : 'bg-darkblue-base/50';
        
        html += `<div class="${bgClass} ${todayClass} rounded-xl p-1 flex flex-col items-center min-h-[50px]" ${hasShifts ? `onclick="mjJumpToDate('${dateStr}')"` : ''}>
            <span class="text-xs font-bold ${isToday ? 'text-darkblue-accent' : 'text-darkblue-heading'} mb-1">${d}</span>
            <div class="flex flex-wrap justify-center gap-0.5">`;
            
        // Pallini/Badge colorati per ogni lavoro diverso nel giorno
        if (hasShifts) {
            let colors = [...new Set(dayShifts.map(s => s.mj_jobs?.color || '#3b82f6'))];
            colors.forEach(c => {
                html += `<div class="w-1.5 h-1.5 rounded-full" style="background-color: ${c}"></div>`;
            });
        }
        
        html += `</div></div>`;
    }
    
    html += `</div></div>`;
    container.innerHTML = html;
}

function mjJumpToDate(dateStr) {
    mjCurrentDate = new Date(dateStr);
    setMjView('day');
}

// ---------------------------------------------------------
// GESTIONE JOBS (LAVORI)
// ---------------------------------------------------------
function openMjJobsModal() {
    const modal = document.getElementById('modal-mj-jobs-manager');
    if (modal) {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.querySelector('.clay-card').classList.remove('scale-95');
    }
}

function closeMjJobsModal() {
    const modal = document.getElementById('modal-mj-jobs-manager');
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.querySelector('.clay-card').classList.add('scale-95');
    }
}

function renderMjJobsManagerList() {
    const list = document.getElementById('mj-jobs-list');
    if (!list) return;

    list.innerHTML = '';
    if (mjJobs.length === 0) {
        list.innerHTML = `<p class="text-xs text-darkblue-icon italic text-center">Nessun lavoro salvato.</p>`;
        return;
    }

    mjJobs.forEach(job => {
        list.innerHTML += `
            <div class="flex items-center justify-between bg-darkblue-base p-3 rounded-2xl clay-item shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="w-4 h-4 rounded-full" style="background-color: ${job.color}"></div>
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-darkblue-heading">${job.title}</span>
                        ${job.hourly_rate > 0 ? `<span class="text-[10px] text-darkblue-icon">${job.hourly_rate} €/h</span>` : ''}
                    </div>
                </div>
                <button class="text-red-500/80 hover:text-red-500 p-2" onclick="deleteMjJob('${job.id}')">
                    <i class="fa-solid fa-trash-can text-sm"></i>
                </button>
            </div>
        `;
    });
}

async function handleMjJobSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('mj-job-title').value.trim();
    const rate = parseFloat(document.getElementById('mj-job-rate').value) || 0;
    const color = document.getElementById('mj-job-color').value;

    if (!title) return;

    try {
        const { data: memberData } = await window.supabase
            .from('family_members')
            .select('family_id')
            .eq('id', window.currentSessionId || (await window.supabase.auth.getUser()).data.user.id)
            .single();

        const { error } = await window.supabase.from('mj_jobs').insert([{
            family_id: memberData.family_id,
            member_id: mjCurrentMemberId, // Collega al membro attualmente selezionato
            title: title,
            color: color,
            hourly_rate: rate
        }]);

        if (error) throw error;

        // Reset form e ricarica
        document.getElementById('form-mj-job-create').reset();
        await fetchMjJobs();
        showToast("Lavoro aggiunto!", "success");

    } catch (err) {
        console.error("Errore salvataggio job:", err);
        showToast("Errore durante il salvataggio", "error");
    }
}

async function deleteMjJob(id) {
    if(!confirm("Sicuro di voler eliminare questo lavoro? Verranno eliminati anche tutti i turni collegati!")) return;
    try {
        const {error} = await window.supabase.from('mj_jobs').delete().eq('id', id);
        if(error) throw error;
        await fetchMjJobs();
        showToast("Lavoro eliminato", "info");
    } catch(e) {
        showToast("Errore eliminazione", "error");
    }
}

// ---------------------------------------------------------
// GESTIONE TURNI
// ---------------------------------------------------------
function renderMjJobsSelector() {
    const container = document.getElementById('mj-job-selector');
    const hiddenInput = document.getElementById('mj-shift-job-id');
    if (!container || !hiddenInput) return;

    container.innerHTML = '';
    hiddenInput.value = '';

    if (mjJobs.length === 0) {
        container.innerHTML = `<span class="text-xs text-darkblue-icon">Nessun lavoro disponibile. Creane uno.</span>`;
        return;
    }

    mjJobs.forEach((job, index) => {
        const btn = document.createElement('div');
        btn.className = `cursor-pointer px-4 py-2 rounded-full text-xs font-bold transition-all border border-darkblue-card`;
        btn.textContent = job.title;
        btn.style.color = 'white';
        
        // Seleziona il primo di default
        if (index === 0) {
            btn.style.backgroundColor = job.color;
            btn.classList.add('shadow-md', 'scale-105');
            hiddenInput.value = job.id;
        } else {
            btn.style.backgroundColor = 'transparent';
            btn.style.borderColor = job.color;
            btn.style.color = job.color;
        }

        btn.onclick = () => {
            // Deseleziona tutti
            Array.from(container.children).forEach(c => {
                c.style.backgroundColor = 'transparent';
                c.style.color = c.dataset.color;
                c.classList.remove('shadow-md', 'scale-105');
            });
            // Seleziona questo
            btn.style.backgroundColor = job.color;
            btn.style.color = 'white';
            btn.classList.add('shadow-md', 'scale-105');
            hiddenInput.value = job.id;
        };
        btn.dataset.color = job.color;
        container.appendChild(btn);
    });
}

function openMjShiftModal() {
    const modal = document.getElementById('modal-mj-shift');
    if (modal) {
        // Pre-compila data
        document.getElementById('mj-shift-date').value = formatDateISO(mjCurrentDate);
        
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.querySelector('.clay-card').classList.remove('scale-95');
    }
}

function closeMjShiftModal() {
    const modal = document.getElementById('modal-mj-shift');
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.querySelector('.clay-card').classList.add('scale-95');
    }
}

async function handleMjShiftSubmit(e) {
    e.preventDefault();

    const jobId = document.getElementById('mj-shift-job-id').value;
    const dateStr = document.getElementById('mj-shift-date').value;
    const startT = document.getElementById('mj-shift-start').value;
    const endT = document.getElementById('mj-shift-end').value;
    const notes = document.getElementById('mj-shift-notes').value.trim();
    const keepOpen = document.getElementById('mj-shift-keep-open').checked;

    if (!jobId || !dateStr || !startT || !endT) {
        showToast("Compila tutti i campi obbligatori", "error");
        return;
    }

    if (!mjCurrentMemberId) {
        showToast("Nessun membro selezionato", "error");
        return;
    }

    // Validazione Overlap (Logica lato client per avviso)
    if (mjCurrentView === 'day' && dateStr === formatDateISO(mjCurrentDate)) {
        const startMin = timeToMinutes(startT);
        const endMin = timeToMinutes(endT);
        
        for (let shift of mjShifts) {
            const sStart = timeToMinutes(shift.start_time);
            const sEnd = timeToMinutes(shift.end_time);
            
            // Logica semplice overlap
            if (startMin < sEnd && endMin > sStart) {
                if(!confirm(`Attenzione: questo orario si sovrappone con il turno "${shift.mj_jobs?.title}" (${shift.start_time.substring(0,5)} - ${shift.end_time.substring(0,5)}). Vuoi forzare l'inserimento?`)) {
                    return; // Interrompi
                }
                break; // Se ha accettato una volta, basta
            }
        }
    }

    try {
        const { data: memberData } = await window.supabase
            .from('family_members')
            .select('family_id')
            .eq('id', window.currentSessionId || (await window.supabase.auth.getUser()).data.user.id)
            .single();

        const { error } = await window.supabase.from('mj_shifts').insert([{
            family_id: memberData.family_id,
            member_id: mjCurrentMemberId,
            job_id: jobId,
            shift_date: dateStr,
            start_time: startT,
            end_time: endT,
            notes: notes
        }]);

        if (error) throw error;

        showToast("Turno salvato!", "success");
        await fetchMjShifts();

        if (keepOpen) {
            // Reset solo orari
            document.getElementById('mj-shift-start').value = '';
            document.getElementById('mj-shift-end').value = '';
            document.getElementById('mj-shift-notes').value = '';
        } else {
            closeMjShiftModal();
            document.getElementById('form-mj-shift').reset();
            renderMjJobsSelector(); // resel prima opzione
        }

    } catch (err) {
        console.error("Errore salvataggio shift:", err);
        showToast("Errore durante il salvataggio", "error");
    }
}

// ---------------------------------------------------------
// UTILS
// ---------------------------------------------------------
function formatDateISO(dateObj) {
    const d = new Date(dateObj);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekBounds(dateObj) {
    const curr = new Date(dateObj);
    const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1); // Monday
    const last = first + 6;
    
    const start = new Date(curr.setDate(first));
    const end = new Date(curr.setDate(last));
    
    return { start, end };
}

function formatMinutes(totalMins) {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${m}m`;
}

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
}

// ---------------------------------------------------------
// MODIFICA ED ELIMINAZIONE TURNO
// ---------------------------------------------------------

function openMjShiftEditModal(shiftId) {
    const shift = mjShifts.find(s => s.id === shiftId);
    if (!shift) return;

    document.getElementById('mj-edit-shift-id').value = shift.id;
    document.getElementById('mj-edit-shift-start').value = shift.start_time.substring(0, 5);
    document.getElementById('mj-edit-shift-end').value = shift.end_time.substring(0, 5);
    document.getElementById('mj-edit-shift-notes').value = shift.notes || '';

    const jobSelect = document.getElementById('mj-edit-shift-job');
    jobSelect.innerHTML = mjJobs.map(job => 
        `<option value="${job.id}" ${job.id === shift.job_id ? 'selected' : ''}>${job.title}</option>`
    ).join('');

    const modal = document.getElementById('modal-mj-shift-edit');
    if (modal) {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.querySelector('.clay-card').classList.remove('translate-y-full');
    }
}

function closeMjShiftEditModal() {
    const modal = document.getElementById('modal-mj-shift-edit');
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.querySelector('.clay-card').classList.add('translate-y-full');
    }
}

async function saveMjShiftEdit() {
    const shiftId = document.getElementById('mj-edit-shift-id').value;
    const jobId = document.getElementById('mj-edit-shift-job').value;
    const start = document.getElementById('mj-edit-shift-start').value;
    const end = document.getElementById('mj-edit-shift-end').value;
    const notes = document.getElementById('mj-edit-shift-notes').value;

    if (!shiftId || !jobId || !start || !end) return;

    try {
        const { error } = await window.supabase
            .from('mj_shifts')
            .update({
                job_id: jobId,
                start_time: start,
                end_time: end,
                notes: notes
            })
            .eq('id', shiftId);

        if (error) throw error;
        
        closeMjShiftEditModal();
        fetchMjShifts();
    } catch (err) {
        console.error("Errore modifica turno:", err);
        alert("Errore durante la modifica del turno.");
    }
}

async function deleteMjShift() {
    const shiftId = document.getElementById('mj-edit-shift-id').value;
    if (!shiftId) return;

    if (!confirm("Sei sicuro di voler eliminare questo turno? L'operazione è irreversibile.")) return;

    try {
        const { error } = await window.supabase
            .from('mj_shifts')
            .delete()
            .eq('id', shiftId);

        if (error) throw error;
        
        closeMjShiftEditModal();
        fetchMjShifts();
    } catch (err) {
        console.error("Errore eliminazione turno:", err);
        alert("Errore durante l'eliminazione del turno.");
    }
}
