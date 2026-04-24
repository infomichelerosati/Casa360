// js/salute.js

let sltFamilyMembers = [];
let sltCurrentMemberId = null;
let sltCurrentHealthProfileId = null;
let sltVitalsHistory = [];
let sltCurrentVitalsIndex = 0;
let sltCharts = {}; // Riferimento per distruggere i grafici Chart.js esistenti

async function initSalute() {
    console.log("Inizializzazione Modulo Salute...");
    try {
        // Setup modals
        setupSaluteModals();
    } catch (err) {
        console.error("Errore setupSaluteModals:", err);
    }

    // Setup Report Export
    document.getElementById('btn-export-report')?.addEventListener('click', exportHealthReport);

    await loadFamilyMembersForSalute();
}

async function loadFamilyMembersForSalute() {
    try {
        const { data, error } = await supabase
            .from('family_members')
            .select('id, name, avatar_color')
            .order('created_at', { ascending: true });

        if (error) throw error;
        sltFamilyMembers = data;
        renderMemberSelector(data);

        // Auto-select logged in member if exists
        if (data && data.length > 0) {
            let memberToSelect = data[0].id;
            const currentUser = await window.getLoggedUser();
            if (currentUser) {
                const found = data.find(m => m.id === currentUser.id);
                if (found) memberToSelect = found.id;
            }
            selectMember(memberToSelect);
        }
    } catch (err) {
        console.error("Errore fetch members per salute:", err);
    }
}

function renderMemberSelector(members) {
    const container = document.getElementById('health-member-selector');
    container.innerHTML = '';

    if (members.length === 0) {
        container.innerHTML = '<span class="text-sm text-darkblue-icon">Aggiungi membri alla famiglia prima.</span>';
        return;
    }

    members.forEach(m => {
        const initial = m.name.charAt(0).toUpperCase();
        const btn = document.createElement('button');
        btn.className = `health-mem-btn flex flex-col items-center gap-2 min-w-[70px] transition-all active:scale-95 opacity-50`;
        btn.dataset.id = m.id;

        btn.innerHTML = `
            <div class="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-inner pointer-events-none transition-transform" style="background-color: ${m.avatar_color || '#3b82f6'};">
                ${initial}
            </div>
            <span class="text-xs font-medium text-darkblue-heading truncate w-full text-center pointer-events-none">${m.name}</span>
        `;

        btn.addEventListener('click', () => selectMember(m.id));
        container.appendChild(btn);
    });
}

function selectMember(memberId) {
    sltCurrentMemberId = memberId;

    // UI Update Avatar Selection
    document.querySelectorAll('.health-mem-btn').forEach(btn => {
        if (btn.dataset.id === memberId) {
            btn.classList.remove('opacity-50');
            btn.classList.add('opacity-100');
            btn.querySelector('div').classList.add('scale-110', 'ring-4', 'ring-darkblue-base');
        } else {
            btn.classList.add('opacity-50');
            btn.classList.remove('opacity-100');
            btn.querySelector('div').classList.remove('scale-110', 'ring-4', 'ring-darkblue-base');
        }
    });

    // Toggle Empty State vs Content
    document.getElementById('health-empty-state').classList.add('hidden');
    document.getElementById('health-content-area').classList.remove('hidden');
    document.getElementById('health-content-area').classList.add('flex');
    document.getElementById('btn-export-report')?.classList.remove('hidden');

    loadHealthDataForMember(memberId);
}

async function loadHealthDataForMember(memberId) {
    // 1. Load Profile
    await loadHealthProfile(memberId);
    // 2. Load Meds
    await loadHealthMeds(memberId);
    // 3. Load Records
    await loadHealthRecords(memberId);
    // 4. Load Vitals
    await loadHealthVitals(memberId);
}

async function loadHealthProfile(memberId) {
    try {
        const { data, error } = await supabase
            .from('health_profiles')
            .select('*')
            .eq('member_id', memberId)
            .maybeSingle();

        if (error) throw error;

        const bloodTypeEl = document.getElementById('display-blood-type');
        const allergiesEl = document.getElementById('display-allergies');
        const doctorEl = document.getElementById('display-primary-doctor');

        if (data) {
            sltCurrentHealthProfileId = data.id;
            bloodTypeEl.textContent = data.blood_type && data.blood_type !== 'Desconosciuto' ? data.blood_type : '--';

            // Render Allergies & Chronic
            let tagsHtml = '';
            if (data.allergies && data.allergies.length > 0) {
                data.allergies.forEach(a => {
                    tagsHtml += `<span class="bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-xs font-bold border border-red-500/30">${a}</span>`;
                });
            }
            if (data.chronic_conditions && data.chronic_conditions.length > 0) {
                data.chronic_conditions.forEach(c => {
                    tagsHtml += `<span class="bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/30">${c}</span>`;
                });
            }

            allergiesEl.innerHTML = tagsHtml || `<span class="text-sm text-darkblue-icon italic">Nessuna segnalazione.</span>`;
            doctorEl.textContent = data.primary_doctor && data.primary_doctor.trim() !== '' ? data.primary_doctor : 'Non specificato';

        } else {
            // Profile Non Esiste, reset values
            sltCurrentHealthProfileId = null;
            bloodTypeEl.textContent = '--';
            allergiesEl.innerHTML = `<span class="text-sm text-darkblue-icon italic">Profilo non compilato.</span>`;
            doctorEl.textContent = 'Non configurato';
        }

    } catch (err) {
        console.error("Error loading health profile", err);
    }
}

async function loadHealthMeds(memberId) {
    try {
        const { data, error } = await supabase
            .from('health_medications')
            .select('*')
            .eq('assigned_to', memberId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const list = document.getElementById('health-medications-list');
        list.innerHTML = '';

        if (!data || data.length === 0) {
            list.innerHTML = '<div class="text-center text-darkblue-icon text-sm py-4 italic">Nessuna terapia attiva registrata.</div>';
            return;
        }

        data.forEach(med => {
            const dosageStr = med.dosage ? `${med.dosage}` : '';
            const freqStr = med.frequency ? ` • ${med.frequency}` : '';

            const el = document.createElement('div');
            el.className = 'clay-card bg-darkblue-card rounded-2xl p-4 flex justify-between items-center group relative overflow-hidden';
            el.innerHTML = `
                <div class="flex items-center gap-4 z-10 w-full">
                    <div class="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-pills lg"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-darkblue-heading truncate">${med.name}</h4>
                        <p class="text-xs text-darkblue-icon truncate">${dosageStr}${freqStr}</p>
                    </div>
                    <button class="delete-med-btn w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 active:scale-95 transition-colors" data-id="${med.id}">
                        <i class="fa-solid fa-trash pointer-events-none text-sm"></i>
                    </button>
                </div>
            `;
            list.appendChild(el);
        });

        // Delete handlers
        document.querySelectorAll('.delete-med-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                window.showConfirmModal("Rimuovi Terapia", "Sei sicuro di voler eliminare questa terapia?", async () => {
                    await supabase.from('health_medications').delete().eq('id', id);
                    loadHealthMeds(sltCurrentMemberId);
                });
            });
        });

    } catch (err) {
        console.error("Error meds", err);
    }
}

async function loadHealthRecords(memberId) {
    try {
        const { data, error } = await supabase
            .from('health_records')
            .select('*')
            .eq('member_id', memberId)
            .order('record_date', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('health-records-timeline');
        container.innerHTML = '';

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="text-darkblue-icon text-sm py-2 italic">Nessun evento registrato.</div>';
            return;
        }

        data.forEach(rec => {
            // Colore e icona in base al tipo
            let badgeClass = 'bg-darkblue-base text-darkblue-accent';
            let dotClass = 'bg-darkblue-accent';

            if (rec.record_type === 'Vaccino') { badgeClass = 'bg-blue-500/20 text-blue-400'; dotClass = 'bg-blue-500'; }
            else if (rec.record_type === 'Esame') { badgeClass = 'bg-purple-500/20 text-purple-400'; dotClass = 'bg-purple-500'; }
            else if (rec.record_type === 'Malattia') { badgeClass = 'bg-amber-500/20 text-amber-500'; dotClass = 'bg-amber-500'; }
            else if (rec.record_type === 'Intervento') { badgeClass = 'bg-red-500/20 text-red-500'; dotClass = 'bg-red-500'; }

            // Format date
            const dateObj = new Date(rec.record_date);
            const dateStr = dateObj.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

            const el = document.createElement('div');
            el.className = 'relative';
            el.innerHTML = `
                <div class="absolute -left-[31px] ${dotClass} w-4 h-4 rounded-full border-4 border-darkblue-base z-10"></div>
                <div class="clay-card bg-darkblue-card rounded-2xl p-4 ml-1 relative group">
                    <button class="delete-record-btn absolute top-3 right-3 w-8 h-8 rounded-full bg-darkblue-base text-darkblue-icon flex items-center justify-center active:scale-95" data-id="${rec.id}">
                        <i class="fa-solid fa-trash text-xs pointer-events-none hover:text-red-500 transition-colors"></i>
                    </button>
                    <div class="flex justify-between items-start mb-2 pr-8">
                        <span class="text-[10px] font-bold ${badgeClass} px-2 py-1 rounded-md uppercase tracking-wide">${rec.record_type}</span>
                        <span class="text-xs text-darkblue-accent font-medium mt-1">${dateStr}</span>
                    </div>
                    <h4 class="font-bold text-darkblue-heading text-sm md:text-base">${rec.title}</h4>
                    ${rec.description && rec.description.trim() ? `<p class="text-xs text-darkblue-icon mt-2 leading-relaxed">${rec.description}</p>` : ''}
                </div>
            `;
            container.appendChild(el);
        });

        // Delete handlers
        document.querySelectorAll('.delete-record-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                window.showConfirmModal("Elimina Evento", "Sei sicuro di voler rimuovere questo evento dallo storico?", async () => {
                    await supabase.from('health_records').delete().eq('id', id);
                    loadHealthRecords(sltCurrentMemberId);
                });
            });
        });

    } catch (err) {
        console.error("Error records", err);
    }
}


async function loadHealthVitals(memberId) {
    try {
        const { data, error } = await supabase
            .from('health_vitals_logs')
            .select('*')
            .eq('member_id', memberId)
            .order('recorded_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        sltVitalsHistory = data || [];
        sltCurrentVitalsIndex = 0;
        renderCurrentVitals();
    } catch (err) {
        console.error("Error vitals", err);
    }
}

function renderCurrentVitals() {
    const display = document.getElementById('health-vitals-display');
    const lastUpdate = document.getElementById('vitals-last-update');
    const btnPrev = document.getElementById('btn-prev-vitals');
    const btnNext = document.getElementById('btn-next-vitals');

    display.innerHTML = '';
    lastUpdate.textContent = '';

    if (sltVitalsHistory.length === 0) {
        display.innerHTML = '<div class="text-center py-4 col-span-2 text-darkblue-icon text-sm italic">Nessuna misurazione recente.</div>';
        btnPrev.disabled = true;
        btnNext.disabled = true;
        return;
    }

    const data = sltVitalsHistory[sltCurrentVitalsIndex];
    const dateObj = new Date(data.recorded_at);
    const dateStr = dateObj.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    
    lastUpdate.textContent = `(${sltCurrentVitalsIndex + 1}/${sltVitalsHistory.length}) ${dateStr}`;

    // Update buttons
    btnPrev.disabled = sltCurrentVitalsIndex >= sltVitalsHistory.length - 1;
    btnNext.disabled = sltCurrentVitalsIndex <= 0;

    const items = [
        { label: 'Pressione', value: data.systolic_pressure && data.diastolic_pressure ? `${data.systolic_pressure}/${data.diastolic_pressure}` : '--', unit: 'mmHg', icon: 'fa-heart-pulse', color: 'text-red-400' },
        { label: 'Battiti', value: data.heart_rate || '--', unit: 'BPM', icon: 'fa-wave-square', color: 'text-blue-400' },
        { label: 'Saturaz.', value: data.oxygen_saturation || '--', unit: '%', icon: 'fa-lungs', color: 'text-cyan-400' },
        { label: 'Glicemia', value: data.blood_sugar || '--', unit: 'mg/dL', icon: 'fa-droplet', color: 'text-amber-500' },
        { label: 'Peso', value: data.weight || '--', unit: 'kg', icon: 'fa-weight-scale', color: 'text-purple-400' },
        { label: 'Temp.', value: data.temperature || '--', unit: '°C', icon: 'fa-thermometer-half', color: 'text-emerald-400' }
    ];

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'flex flex-col gap-1 p-3 rounded-2xl bg-darkblue-base/30 border border-darkblue-base/50';
        el.innerHTML = `
            <div class="flex items-center gap-2 opacity-70">
                <i class="fa-solid ${item.icon} text-xs ${item.color}"></i>
                <span class="text-[10px] font-bold uppercase tracking-wider text-darkblue-icon">${item.label}</span>
            </div>
            <div class="flex items-baseline gap-1">
                <span class="text-lg font-bold text-darkblue-heading">${item.value}</span>
                <span class="text-[9px] font-medium text-darkblue-icon">${item.unit}</span>
            </div>
        `;
        display.appendChild(el);
    });

    // Se ci sono note, aggiungiamole sotto
    if (data.notes) {
        const notesEl = document.createElement('div');
        notesEl.className = 'col-span-2 mt-2 p-3 bg-darkblue-base/20 rounded-xl border border-dashed border-darkblue-icon/30 text-[10px] text-darkblue-icon italic';
        notesEl.innerHTML = `<i class="fa-solid fa-note-sticky mr-1"></i> ${data.notes}`;
        display.appendChild(notesEl);
    }
}


function setupSaluteModals() {
    // 1. Modal Profilo
    const modProfile = document.getElementById('modal-health-profile');
    const modProfileContent = document.getElementById('modal-content-health-profile');

    document.getElementById('btn-edit-health-profile')?.addEventListener('click', async () => {
        if (!sltCurrentMemberId) return;
        // Pre-fill form
        const frm = document.getElementById('form-health-profile');
        frm.reset();
        try {
            const { data } = await supabase.from('health_profiles').select('*').eq('member_id', sltCurrentMemberId).maybeSingle();
            if (data) {
                document.getElementById('hp-blood-type').value = data.blood_type || 'Desconosciuto';
                document.getElementById('hp-allergies').value = (data.allergies || []).join(', ');
                document.getElementById('hp-chronic').value = (data.chronic_conditions || []).join(', ');
                document.getElementById('hp-doctor').value = data.primary_doctor || '';
                document.getElementById('hp-vitals-interval').value = data.vitals_reminder_interval || 0;
            }
        } catch (e) { }

        modProfile.classList.remove('opacity-0', 'pointer-events-none');
        modProfileContent.classList.remove('translate-y-full');
    });

    const closeProfileModal = () => {
        modProfile.classList.add('opacity-0', 'pointer-events-none');
        modProfileContent.classList.add('translate-y-full');
    };
    document.getElementById('btn-close-h-profile').addEventListener('click', closeProfileModal);

    document.getElementById('form-health-profile').addEventListener('submit', async (e) => {
        e.preventDefault();
        const blood = document.getElementById('hp-blood-type').value;
        const allergiesRaw = document.getElementById('hp-allergies').value;
        const chronicRaw = document.getElementById('hp-chronic').value;
        const doctor = document.getElementById('hp-doctor').value;
        const interval = parseInt(document.getElementById('hp-vitals-interval').value) || 0;

        const allergies = allergiesRaw ? allergiesRaw.split(',').map(s => s.trim()).filter(s => s !== '') : [];
        const chronic = chronicRaw ? chronicRaw.split(',').map(s => s.trim()).filter(s => s !== '') : [];

        try {
            // Needs to get family_id
            let family_id = null;
            const { data: memData } = await supabase.from('family_members').select('family_id').eq('id', sltCurrentMemberId).single();
            if (memData) family_id = memData.family_id;

            const payload = {
                member_id: sltCurrentMemberId,
                family_id: family_id,
                blood_type: blood,
                allergies: allergies,
                chronic_conditions: chronic,
                primary_doctor: doctor,
                vitals_reminder_interval: interval,
                updated_at: new Date().toISOString()
            };

            if (sltCurrentHealthProfileId) {
                await supabase.from('health_profiles').update(payload).eq('id', sltCurrentHealthProfileId);
            } else {
                await supabase.from('health_profiles').insert([payload]);
            }

            closeProfileModal();
            loadHealthProfile(sltCurrentMemberId);
        } catch (err) {
            console.error("error saving profile", err);
            alert("Errore salvataggio profilo.");
        }
    });

    // 2. Modal Medication
    const modMed = document.getElementById('modal-health-med');
    const modMedContent = document.getElementById('modal-content-health-med');

    document.getElementById('btn-add-medication').addEventListener('click', () => {
        document.getElementById('form-health-med').reset();
        modMed.classList.remove('opacity-0', 'pointer-events-none');
        modMedContent.classList.remove('translate-y-full');
    });

    const closeMedModal = () => {
        modMed.classList.add('opacity-0', 'pointer-events-none');
        modMedContent.classList.add('translate-y-full');
    };
    document.getElementById('btn-close-h-med').addEventListener('click', closeMedModal);
    modMed.addEventListener('click', (e) => { if (e.target === modMed) closeMedModal(); });

    document.getElementById('form-health-med').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('hm-name').value;
        const dosage = document.getElementById('hm-dosage').value;
        const freq = document.getElementById('hm-freq').value;

        try {
            let family_id = null;
            const { data: memData } = await supabase.from('family_members').select('family_id').eq('id', sltCurrentMemberId).single();
            if (memData) family_id = memData.family_id;

            await supabase.from('health_medications').insert([{
                family_id: family_id,
                assigned_to: sltCurrentMemberId,
                name: name,
                dosage: dosage,
                frequency: freq
            }]);

            closeMedModal();
            loadHealthMeds(sltCurrentMemberId);
        } catch (err) {
            console.error("Error save med", err);
        }
    });

    // 3. Modal Records
    const modRecord = document.getElementById('modal-health-record');
    const modRecordContent = document.getElementById('modal-content-health-record');

    document.getElementById('btn-add-record').addEventListener('click', () => {
        document.getElementById('form-health-record').reset();
        document.getElementById('hr-date').valueAsDate = new Date();
        modRecord.classList.remove('opacity-0', 'pointer-events-none');
        modRecordContent.classList.remove('translate-y-full');
    });

    const closeRecordModal = () => {
        modRecord.classList.add('opacity-0', 'pointer-events-none');
        modRecordContent.classList.add('translate-y-full');
    };
    document.getElementById('btn-close-h-record').addEventListener('click', closeRecordModal);
    modRecord.addEventListener('click', (e) => { if (e.target === modRecord) closeRecordModal(); });

    document.getElementById('form-health-record').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            let family_id = null;
            const { data: memData } = await supabase.from('family_members').select('family_id').eq('id', sltCurrentMemberId).single();
            if (memData) family_id = memData.family_id;

            await supabase.from('health_records').insert([{
                family_id: family_id,
                member_id: sltCurrentMemberId,
                record_type: document.getElementById('hr-type').value,
                record_date: document.getElementById('hr-date').value,
                title: document.getElementById('hr-title').value,
                description: document.getElementById('hr-desc').value
            }]);

            closeRecordModal();
            loadHealthRecords(sltCurrentMemberId);
        } catch (err) { console.error("Error save record", err); }
    });

    // 4. Modal Vitals
    const modVitals = document.getElementById('modal-health-vitals');
    const modVitalsContent = document.getElementById('modal-content-health-vitals');

    document.getElementById('btn-add-vitals')?.addEventListener('click', async () => {
        document.getElementById('form-health-vitals').reset();
        
        // Recupera l'intervallo attuale dal profilo per pre-popolare il campo
        if (sltCurrentMemberId) {
            const { data } = await supabase.from('health_profiles')
                .select('vitals_reminder_interval')
                .eq('member_id', sltCurrentMemberId)
                .maybeSingle();
            if (data) {
                document.getElementById('hv-interval').value = data.vitals_reminder_interval || 0;
            }
        }

        modVitals.classList.remove('opacity-0', 'pointer-events-none');
        modVitalsContent.classList.remove('translate-y-full');
    });

    const closeVitalsModal = () => {
        modVitals.classList.add('opacity-0', 'pointer-events-none');
        modVitalsContent.classList.add('translate-y-full');
    };
    document.getElementById('btn-close-h-vitals').addEventListener('click', closeVitalsModal);
    modVitals.addEventListener('click', (e) => { if (e.target === modVitals) closeVitalsModal(); });

    document.getElementById('form-health-vitals').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            member_id: sltCurrentMemberId,
            systolic_pressure: parseInt(document.getElementById('hv-systolic').value) || null,
            diastolic_pressure: parseInt(document.getElementById('hv-diastolic').value) || null,
            heart_rate: parseInt(document.getElementById('hv-heart-rate').value) || null,
            oxygen_saturation: parseInt(document.getElementById('hv-saturation').value) || null,
            blood_sugar: parseFloat(document.getElementById('hv-blood-sugar').value) || null,
            weight: parseFloat(document.getElementById('hv-weight').value) || null,
            temperature: parseFloat(document.getElementById('hv-temp').value) || null,
            notes: document.getElementById('hv-notes').value || null,
            recorded_at: new Date().toISOString()
        };

        const interval = parseInt(document.getElementById('hv-interval').value) || 0;

        try {
            const familyId = await window.getUserFamilyId();
            payload.family_id = familyId;

            const { error } = await supabase.from('health_vitals_logs').insert([payload]);
            if (error) throw error;

            // Aggiorna l'intervallo nel profilo salute (se esiste)
            if (sltCurrentMemberId) {
                await supabase.from('health_profiles')
                    .update({ vitals_reminder_interval: interval })
                    .eq('member_id', sltCurrentMemberId);
            }

            closeVitalsModal();
            loadHealthVitals(sltCurrentMemberId);
            
            // Se siamo nel calendario, forziamo il refresh per vedere il nuovo promemoria
            if (typeof window.fetchEvents === 'function') window.fetchEvents();
        } catch (err) {
            console.error("Error saving vitals", err);
            alert("Errore durante il salvataggio dei parametri.");
        }
    });

    // 5. Navigation Buttons
    console.log("Setting up vitals navigation listeners...");
    document.getElementById('btn-prev-vitals')?.addEventListener('click', () => {
        console.log("Prev clicked, current index:", sltCurrentVitalsIndex);
        if (sltCurrentVitalsIndex < sltVitalsHistory.length - 1) {
            sltCurrentVitalsIndex++;
            renderCurrentVitals();
        }
    });
    document.getElementById('btn-next-vitals')?.addEventListener('click', () => {
        console.log("Next clicked, current index:", sltCurrentVitalsIndex);
        if (sltCurrentVitalsIndex > 0) {
            sltCurrentVitalsIndex--;
            renderCurrentVitals();
        }
    });

    // 6. Modal Charts
    console.log("Setting up charts modal listeners...");
    const modCharts = document.getElementById('modal-health-charts');
    const modChartsContent = document.getElementById('modal-content-health-charts');

    document.getElementById('btn-show-vitals-charts')?.addEventListener('click', () => {
        console.log("Opening charts modal...");
        modCharts?.classList.remove('opacity-0', 'pointer-events-none');
        modChartsContent?.classList.remove('translate-y-full');
        renderHealthCharts();
    });

    const closeChartsModal = () => {
        modCharts?.classList.add('opacity-0', 'pointer-events-none');
        modChartsContent?.classList.add('translate-y-full');
    };
    document.getElementById('btn-close-h-charts')?.addEventListener('click', closeChartsModal);
    modCharts?.addEventListener('click', (e) => { if (e.target === modCharts) closeChartsModal(); });
    console.log("Salute listeners setup complete.");
}

async function renderHealthCharts() {
    if (!sltCurrentMemberId) return;

    try {
        // Fetch last 30 for better trends
        const { data, error } = await supabase
            .from('health_vitals_logs')
            .select('*')
            .eq('member_id', sltCurrentMemberId)
            .order('recorded_at', { ascending: true }) // Ascending for charts (left to right)
            .limit(30);

        if (error) throw error;
        if (!data || data.length === 0) return;

        const labels = data.map(v => new Date(v.recorded_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }));

        // Destroy previous charts if they exist
        Object.values(sltCharts).forEach(c => c.destroy());
        sltCharts = {};

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { color: '#8a9ab4', font: { size: 10 } } } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 8 } } },
                y: { grid: { color: '#222d41' }, ticks: { color: '#64748b', font: { size: 8 } } }
            }
        };

        // 1. Pressione
        sltCharts.pressure = new Chart(document.getElementById('chart-pressure'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Sistolica', data: data.map(v => v.systolic_pressure), borderColor: '#f87171', backgroundColor: '#f8717122', tension: 0.3, fill: true },
                    { label: 'Diastolica', data: data.map(v => v.diastolic_pressure), borderColor: '#ef4444', backgroundColor: '#ef444422', tension: 0.3, fill: true }
                ]
            },
            options: chartOptions
        });

        // 2. Battiti & Saturazione
        sltCharts.vitals = new Chart(document.getElementById('chart-vitals'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'BPM', data: data.map(v => v.heart_rate), borderColor: '#60a5fa', tension: 0.3, yAxisID: 'y' },
                    { label: 'O2 %', data: data.map(v => v.oxygen_saturation), borderColor: '#22d3ee', tension: 0.3, yAxisID: 'y1' }
                ]
            },
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: { position: 'left', title: { display: true, text: 'BPM', color: '#64748b', font: { size: 8 } } },
                    y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'SpO2%', color: '#64748b', font: { size: 8 } } }
                }
            }
        });

        // 3. Peso
        sltCharts.weight = new Chart(document.getElementById('chart-weight'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ label: 'Peso (kg)', data: data.map(v => v.weight), borderColor: '#c084fc', backgroundColor: '#c084fc22', tension: 0.3, fill: true }]
            },
            options: chartOptions
        });

    } catch (err) {
        console.error("Error rendering charts", err);
    }
}

async function exportHealthReport() {
    if (!sltCurrentMemberId) return;

    // Feedback visuale caricamento
    const btn = document.getElementById('btn-export-report');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span class="text-[10px]">Generazione...</span>';
    btn.classList.add('pointer-events-none');

    try {
        const member = sltFamilyMembers.find(m => m.id === sltCurrentMemberId);
        if (!member) throw new Error("Membro non trovato");

        // 1. Recupero di TUTTI i dati per il report
        const [profileRes, medsRes, recordsRes, vitalsRes] = await Promise.all([
            supabase.from('health_profiles').select('*').eq('member_id', sltCurrentMemberId).maybeSingle(),
            supabase.from('health_medications').select('*').eq('assigned_to', sltCurrentMemberId),
            supabase.from('health_records').select('*').eq('member_id', sltCurrentMemberId).order('record_date', { ascending: false }),
            supabase.from('health_vitals_logs').select('*').eq('member_id', sltCurrentMemberId).order('recorded_at', { ascending: false }).limit(20)
        ]);

        const profile = profileRes.data;
        const meds = medsRes.data || [];
        const records = recordsRes.data || [];
        const vitals = vitalsRes.data || [];

        // 2. Costruzione del Template HTML per il PDF (Stile Professionale Medico)
        const reportContainer = document.createElement('div');
        reportContainer.style.padding = '40px';
        reportContainer.style.backgroundColor = '#ffffff';
        reportContainer.style.color = '#1a2235';
        reportContainer.style.fontFamily = "'Helvetica', 'Arial', sans-serif";

        reportContainer.innerHTML = `
            <!-- Header Report -->
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px;">
                <div>
                    <h1 style="margin: 0; color: #3b82f6; font-size: 28px; letter-spacing: -1px;">FAMILY OS</h1>
                    <p style="margin: 5px 0 0; font-weight: 800; color: #64748b; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Report Medico Personale</p>
                </div>
                <div style="text-align: right; color: #64748b; font-size: 11px;">
                    <p style="margin: 0;">Data Generazione: <strong>${new Date().toLocaleDateString('it-IT')}</strong></p>
                    <p style="margin: 5px 0 0;">Paziente: <strong style="color: #1a2235; font-size: 16px;">${member.name}</strong></p>
                </div>
            </div>

            <!-- Info Profilo -->
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 16px; color: #3b82f6; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 15px;">Dati Anagrafici e Clinici</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <p style="margin: 0 0 5px; font-size: 10px; color: #64748b; font-weight: bold;">GRUPPO SANGUIGNO</p>
                        <p style="margin: 0; font-size: 18px; font-weight: bold; color: #ef4444;">${profile?.blood_type || 'Non specificato'}</p>
                    </div>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <p style="margin: 0 0 5px; font-size: 10px; color: #64748b; font-weight: bold;">MEDICO CURANTE</p>
                        <p style="margin: 0; font-size: 14px; font-weight: bold;">${profile?.primary_doctor || 'Non specificato'}</p>
                    </div>
                </div>
                <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <p style="margin: 0 0 5px; font-size: 10px; color: #64748b; font-weight: bold;">ALLERGIE</p>
                        <p style="margin: 0; font-size: 12px; line-height: 1.5;">${(profile?.allergies || []).join(', ') || 'Nessuna allergia segnalata'}</p>
                    </div>
                    <div>
                        <p style="margin: 0 0 5px; font-size: 10px; color: #64748b; font-weight: bold;">CONDIZIONI CRONICHE</p>
                        <p style="margin: 0; font-size: 12px; line-height: 1.5;">${(profile?.chronic_conditions || []).join(', ') || 'Nessuna patologia cronica'}</p>
                    </div>
                </div>
            </div>

            <!-- Terapie -->
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 16px; color: #3b82f6; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 15px;">Terapie Farmacologiche Attive</h2>
                ${meds.length > 0 ? `
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background: #3b82f6; color: #ffffff;">
                                <th style="padding: 10px; text-align: left; border: 1px solid #3b82f6;">Farmaco</th>
                                <th style="padding: 10px; text-align: left; border: 1px solid #3b82f6;">Dosaggio</th>
                                <th style="padding: 10px; text-align: left; border: 1px solid #3b82f6;">Frequenza</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${meds.map(m => `
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">${m.name}</td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${m.dosage || '-'}</td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${m.frequency || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p style="font-style: italic; color: #94a3b8; font-size: 12px;">Nessuna terapia registrata.</p>'}
            </div>

            <!-- Parametri Vitali -->
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 16px; color: #3b82f6; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 15px;">Ultime Misurazioni Parametri</h2>
                ${vitals.length > 0 ? `
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: center;">
                        <thead>
                            <tr style="background: #f1f5f9; color: #475569;">
                                <th style="padding: 8px; border: 1px solid #e2e8f0;">Data</th>
                                <th style="padding: 8px; border: 1px solid #e2e8f0;">Press.</th>
                                <th style="padding: 8px; border: 1px solid #e2e8f0;">BPM</th>
                                <th style="padding: 8px; border: 1px solid #e2e8f0;">O2%</th>
                                <th style="padding: 8px; border: 1px solid #e2e8f0;">Glic.</th>
                                <th style="padding: 8px; border: 1px solid #e2e8f0;">Peso</th>
                                <th style="padding: 8px; border: 1px solid #e2e8f0;">Temp.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${vitals.slice(0, 10).map(v => `
                                <tr>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${new Date(v.recorded_at).toLocaleDateString('it-IT')}</td>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${v.systolic_pressure || '-'}/${v.diastolic_pressure || '-'}</td>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${v.heart_rate || '-'}</td>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${v.oxygen_saturation || '-'}%</td>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${v.blood_sugar || '-'}</td>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${v.weight || '-'}</td>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${v.temperature || '-'}</td>
                                </tr>
                                ${v.notes ? `<tr><td colspan="7" style="padding: 5px 10px; border: 1px solid #e2e8f0; font-size: 9px; color: #64748b; background: #fdfdfd; text-align: left;">Note: ${v.notes}</td></tr>` : ''}
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p style="font-style: italic; color: #94a3b8; font-size: 12px;">Nessuna misurazione recente.</p>'}
            </div>

            <!-- Storico Eventi -->
            <div style="margin-bottom: 30px; page-break-before: auto;">
                <h2 style="font-size: 16px; color: #3b82f6; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 15px;">Storico Eventi Medici</h2>
                ${records.length > 0 ? records.map(r => `
                    <div style="margin-bottom: 15px; padding: 10px; border-left: 3px solid #cbd5e1; background: #f8fafc;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-size: 10px; font-weight: bold; color: #3b82f6; text-transform: uppercase;">${r.record_type}</span>
                            <span style="font-size: 10px; color: #64748b;">${new Date(r.record_date).toLocaleDateString('it-IT')}</span>
                        </div>
                        <h4 style="margin: 0; font-size: 14px; color: #1a2235;">${r.title}</h4>
                        ${r.description ? `<p style="margin: 5px 0 0; font-size: 11px; color: #475569; line-height: 1.4;">${r.description}</p>` : ''}
                    </div>
                `).join('') : '<p style="font-style: italic; color: #94a3b8; font-size: 12px;">Nessun evento registrato nello storico.</p>'}
            </div>

            <!-- Footer -->
            <div style="margin-top: 60px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <p style="margin: 0; font-size: 10px; color: #94a3b8;">Family OS - Piattaforma di Gestione Familiare Integrata</p>
                <p style="margin: 5px 0 0; font-size: 9px; color: #cbd5e1;">Questo documento ha scopo puramente informativo e non sostituisce il parere di un medico professionista.</p>
            </div>
        `;

        // 3. Generazione PDF con html2pdf
        const options = {
            margin: 10,
            filename: `Report_Salute_${member.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Genera e scarica
        await html2pdf().set(options).from(reportContainer).save();

    } catch (err) {
        console.error("Errore export report:", err);
        alert("Si è verificato un errore durante la generazione del report PDF.");
    } finally {
        btn.innerHTML = originalHtml;
        btn.classList.remove('pointer-events-none');
    }
}
