// js/salute.js

let sltFamilyMembers = [];
let sltCurrentMemberId = null;
let sltCurrentHealthProfileId = null;

async function initSalute() {
    console.log("Inizializzazione Modulo Salute...");

    // Setup modals
    setupSaluteModals();

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

    loadHealthDataForMember(memberId);
}

async function loadHealthDataForMember(memberId) {
    // 1. Load Profile
    await loadHealthProfile(memberId);
    // 2. Load Meds
    await loadHealthMeds(memberId);
    // 3. Load Records
    await loadHealthRecords(memberId);
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
}
