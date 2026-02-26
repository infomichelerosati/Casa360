// js/animali.js

let pets = [];
let currentPetId = null;

async function initAnimali() {
    console.log("Inizializzazione Modulo Animali...");

    // Setup Listeners
    setupAnimaliListeners();

    // Load Data
    await loadPets();
}

function setupAnimaliListeners() {
    // 1. Modale Form Pet (Aggiungi/Modifica)
    document.getElementById('btn-add-pet').addEventListener('click', () => {
        openPetForm();
    });
    document.getElementById('btn-close-pet-form').addEventListener('click', closePetForm);
    document.getElementById('form-pet').addEventListener('submit', handleSavePet);

    // 2. Modale Dettagli Pet
    document.getElementById('btn-close-pet-details').addEventListener('click', closePetDetails);
    document.getElementById('btn-delete-pet').addEventListener('click', handleDeletePet);

    // 3. Form Scadenze
    document.getElementById('btn-add-reminder').addEventListener('click', openReminderForm);
    document.getElementById('btn-close-reminder-form').addEventListener('click', closeReminderForm);
    document.getElementById('form-reminder').addEventListener('submit', handleSaveReminder);

    // 4. Form Medico
    document.getElementById('btn-add-medical').addEventListener('click', openMedicalForm);
    document.getElementById('btn-close-medical-form').addEventListener('click', closeMedicalForm);
    document.getElementById('form-medical').addEventListener('submit', handleSaveMedical);
}

// ==========================================
// CORE: GET & RENDER PETS
// ==========================================
async function loadPets() {
    const container = document.getElementById('pets-container');
    container.innerHTML = '<div class="flex justify-center mt-10"><i class="fa-solid fa-circle-notch fa-spin text-darkblue-accent text-3xl"></i></div>';

    try {
        const currentUser = await window.getLoggedUser();
        if (!currentUser) throw new Error("Utente non loggato");

        const familyId = await window.getUserFamilyId();

        const { data, error } = await supabase
            .from('family_pets')
            .select('*')
            .eq('family_id', familyId)
            .order('name', { ascending: true });

        if (error) throw error;

        pets = data || [];
        renderPetsList();

    } catch (err) {
        console.error("Errore fetch pets:", err);
        container.innerHTML = '<p class="text-center text-red-500 mt-10">Errore caricamento animali.</p>';
    }
}

function renderPetsList() {
    const container = document.getElementById('pets-container');

    if (pets.length === 0) {
        // Empty State super carino 🐶🐱
        container.innerHTML = `
            <div class="clay-card bg-darkblue-card rounded-clay p-8 text-center flex flex-col items-center justify-center mt-4">
                <div class="flex gap-4 mb-6">
                    <div class="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-4xl clay-item shadow-inner pb-1">🐶</div>
                    <div class="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-4xl clay-item shadow-inner pb-1">🐱</div>
                </div>
                <h3 class="text-xl font-bold text-darkblue-heading mb-2">Nessun Pet Trovato</h3>
                <p class="text-darkblue-icon text-sm mb-6">Aggiungi subito il tuo primo amico a 4 zampe per gestire libretto, visite e scadenze!</p>
                <button onclick="document.getElementById('btn-add-pet').click()" class="clay-btn bg-darkblue-accent text-white px-6 py-3 rounded-full font-bold active:scale-95 transition-transform">
                    <i class="fa-solid fa-plus mr-2"></i>Aggiungi Animale
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    pets.forEach(pet => {
        const icon = getPetIcon(pet.species);
        const age = pet.birth_date ? calculateAge(pet.birth_date) : 'Età N/D';

        html += `
            <div class="clay-card bg-darkblue-card rounded-clay p-4 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer" onclick="openPetDetails('${pet.id}')">
                <div class="w-16 h-16 rounded-full bg-darkblue-base flex-shrink-0 flex items-center justify-center text-3xl clay-item shadow-inner pb-1">
                    ${icon}
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-xl font-bold text-darkblue-heading truncate">${pet.name}</h3>
                    <p class="text-sm text-darkblue-icon font-medium truncate">${pet.species} ${pet.breed ? '· ' + pet.breed : ''}</p>
                </div>
                <div class="text-xs font-bold text-darkblue-accent bg-darkblue-base px-3 py-1 rounded-full clay-item whitespace-nowrap">
                    ${age}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ==========================================
// PET DETAILS MODAL
// ==========================================

async function openPetDetails(id) {
    currentPetId = id;
    const pet = pets.find(p => p.id === id);
    if (!pet) return;

    // Popola Header e Info Base
    document.getElementById('pet-detail-name').textContent = pet.name;
    document.getElementById('pet-detail-icon').textContent = getPetIcon(pet.species);
    document.getElementById('pet-detail-species-breed').textContent = `${pet.species} ${pet.breed ? '· ' + pet.breed : ''} ${pet.gender !== 'Sconosciuto' ? '(' + pet.gender + ')' : ''}`;
    document.getElementById('pet-detail-age').textContent = pet.birth_date ? calculateAge(pet.birth_date) : 'Data di nascita non inserita';

    document.getElementById('pet-detail-chip').textContent = pet.microchip || 'Non inserito';
    document.getElementById('pet-detail-passport').textContent = pet.passport || 'Non inserito';
    document.getElementById('pet-detail-notes').textContent = pet.notes || 'Nessuna nota aggiuntiva';

    // Show Modal
    const modal = document.getElementById('modal-pet-details');
    modal.classList.remove('hidden');
    // Piccolo delay per l'animazione di slide
    setTimeout(() => {
        modal.classList.remove('translate-x-full');
    }, 10);

    // Carica Dati Async (Reminders, Medical)
    loadPetReminders(id);
    loadPetMedical(id);
}

function closePetDetails() {
    const modal = document.getElementById('modal-pet-details');
    modal.classList.add('translate-x-full');
    setTimeout(() => {
        modal.classList.add('hidden');
        currentPetId = null;
    }, 300); // Wait for transition
}

// ==========================================
// CRUD PETS
// ==========================================

function openPetForm(pet = null) {
    const form = document.getElementById('form-pet');
    form.reset();

    const title = document.getElementById('pet-form-title');

    if (pet) {
        title.textContent = 'Modifica Amico';
        document.getElementById('pet-id').value = pet.id;
        document.getElementById('pet-name').value = pet.name;
        document.getElementById('pet-species').value = pet.species;
        document.getElementById('pet-breed').value = pet.breed || '';
        document.getElementById('pet-birthdate').value = pet.birth_date || '';
        document.getElementById('pet-gender').value = pet.gender || 'Sconosciuto';
        document.getElementById('pet-chip').value = pet.microchip || '';
        document.getElementById('pet-passport').value = pet.passport || '';
        document.getElementById('pet-weight').value = pet.weight || '';
        document.getElementById('pet-notes').value = pet.notes || '';
    } else {
        title.textContent = 'Nuovo Amico';
        document.getElementById('pet-id').value = '';
    }

    const modal = document.getElementById('modal-pet-form');
    const content = modal.querySelector('.clay-card');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
}

function closePetForm() {
    const modal = document.getElementById('modal-pet-form');
    const content = modal.querySelector('.clay-card');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95');
}

async function handleSavePet(e) {
    e.preventDefault();
    const btnSave = document.getElementById('btn-save-pet');
    btnSave.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    btnSave.disabled = true;

    try {
        const currentUser = await window.getLoggedUser();
        const familyId = await window.getUserFamilyId();

        const id = document.getElementById('pet-id').value;
        const petData = {
            family_id: familyId,
            name: document.getElementById('pet-name').value,
            species: document.getElementById('pet-species').value,
            breed: document.getElementById('pet-breed').value || null,
            birth_date: document.getElementById('pet-birthdate').value || null,
            gender: document.getElementById('pet-gender').value,
            microchip: document.getElementById('pet-chip').value || null,
            passport: document.getElementById('pet-passport').value || null,
            weight: document.getElementById('pet-weight').value ? parseFloat(document.getElementById('pet-weight').value) : null,
            notes: document.getElementById('pet-notes').value || null
        };

        let req;
        if (id) {
            req = supabase.from('family_pets').update(petData).eq('id', id);
        } else {
            req = supabase.from('family_pets').insert([petData]);
        }

        const { error } = await req;
        if (error) throw error;

        closePetForm();
        await loadPets();

    } catch (err) {
        console.error("Errore salvataggio pet:", err);
        alert("Errore durante il salvataggio.");
    } finally {
        btnSave.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Salva';
        btnSave.disabled = false;
    }
}

async function handleDeletePet() {
    if (!currentPetId) return;

    window.showConfirmModal("Elimina Pet", "Sei sicuro di voler eliminare questo animale? Tutti i suoi dati medici andranno persi per sempre.", async () => {
        try {
            const { error } = await supabase.from('family_pets').delete().eq('id', currentPetId);
            if (error) throw error;

            closePetDetails();
            await loadPets();
        } catch (err) {
            console.error("Errore eliminazione:", err);
            alert("Errore durante l'eliminazione.");
        }
    });
}

// ==========================================
// SCADENZE (REMINDERS)
// ==========================================

async function loadPetReminders(petId) {
    const list = document.getElementById('pet-reminders-list');
    list.innerHTML = '<p class="text-sm text-darkblue-icon italic">Caricamento...</p>';

    try {
        const { data, error } = await supabase
            .from('pet_reminders')
            .select('*')
            .eq('pet_id', petId)
            .order('due_date', { ascending: true });

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = '<p class="text-sm text-darkblue-icon italic">Nessuna scadenza a breve.</p>';
            return;
        }

        let html = '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        data.forEach(rem => {
            const dueDate = new Date(rem.due_date);
            const isScaduto = dueDate < today && !rem.is_completed;
            const statusColor = isScaduto ? 'text-red-500 bg-red-500/10' : 'text-amber-500 bg-amber-500/10';
            const statusIcon = getReminderIcon(rem.reminder_type);

            html += `
                <div class="flex items-center justify-between bg-darkblue-base rounded-2xl p-3 clay-item shadow-inner group">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg ${statusColor}">
                            ${statusIcon}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-darkblue-heading ${rem.is_completed ? 'line-through opacity-50' : ''}">${rem.title}</p>
                            <p class="text-xs text-darkblue-icon flex items-center gap-1 ${isScaduto ? 'text-red-500 font-bold' : ''}">
                                <i class="fa-regular fa-clock"></i> ${formatDateIT(rem.due_date)} ${rem.due_time ? ' - ' + rem.due_time.substring(0, 5) : ''}
                            </p>
                        </div>
                    </div>
                    <button onclick="deleteReminder('${rem.id}')" class="text-darkblue-icon hover:text-red-500 transition-colors p-2 active:scale-95 text-xs">
                         <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        });
        list.innerHTML = html;

    } catch (err) {
        list.innerHTML = '<p class="text-sm text-red-500">Errore</p>';
    }
}

function openReminderForm() {
    document.getElementById('form-reminder').reset();
    document.getElementById('reminder-id').value = '';
    document.getElementById('reminder-time').value = '';

    // Default data to today
    document.getElementById('reminder-date').valueAsDate = new Date();

    const modal = document.getElementById('modal-reminder-form');
    const content = modal.querySelector('.clay-card');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
}

function closeReminderForm() {
    const modal = document.getElementById('modal-reminder-form');
    const content = modal.querySelector('.clay-card');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95');
}

async function handleSaveReminder(e) {
    e.preventDefault();
    if (!currentPetId) return;

    try {
        const currentUser = await window.getLoggedUser();
        const familyId = await window.getUserFamilyId();

        const remData = {
            family_id: familyId,
            pet_id: currentPetId,
            reminder_type: document.getElementById('reminder-type').value,
            title: document.getElementById('reminder-title').value,
            due_date: document.getElementById('reminder-date').value,
            due_time: document.getElementById('reminder-time').value || null
        };

        const { error } = await supabase.from('pet_reminders').insert([remData]);
        if (error) throw error;

        closeReminderForm();
        loadPetReminders(currentPetId);

    } catch (err) {
        console.error("Errore salvataggio reminder:", err);
        alert("Errore salvataggio");
    }
}

async function deleteReminder(id) {
    if (confirm("Eliminare scadenza?")) {
        await supabase.from('pet_reminders').delete().eq('id', id);
        loadPetReminders(currentPetId);
    }
}

// ==========================================
// STORICO MEDICO (MEDICAL RECORDS)
// ==========================================

async function loadPetMedical(petId) {
    const list = document.getElementById('pet-medical-list');
    list.innerHTML = '<p class="text-sm text-darkblue-icon italic">Caricamento...</p>';

    try {
        const { data, error } = await supabase
            .from('pet_medical_records')
            .select('*')
            .eq('pet_id', petId)
            .order('record_date', { ascending: false }); // Dal più recente

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = '<p class="text-sm text-darkblue-icon italic">Nessun record medico.</p>';
            return;
        }

        let html = '';
        data.forEach(rec => {
            const icon = getMedicalIcon(rec.record_type);
            html += `
                <div class="bg-darkblue-base rounded-2xl p-3 clay-item shadow-inner group">
                    <div class="flex justify-between items-start mb-2">
                         <div class="flex items-center gap-2">
                             <span class="text-lg">${icon}</span>
                             <p class="text-sm font-bold text-darkblue-heading">${rec.title}</p>
                         </div>
                         <button onclick="deleteMedical('${rec.id}')" class="text-darkblue-icon hover:text-red-500 transition-colors active:scale-95 text-xs">
                            <i class="fa-solid fa-trash-can"></i>
                         </button>
                    </div>
                    <p class="text-xs text-darkblue-icon mb-2">${formatDateIT(rec.record_date)} · ${rec.record_type}</p>
                    ${rec.description ? `<p class="text-xs text-darkblue-heading bg-darkblue-card p-2 rounded-xl">${rec.description}</p>` : ''}
                </div>
            `;
        });
        list.innerHTML = html;

    } catch (err) {
        list.innerHTML = '<p class="text-sm text-red-500">Errore</p>';
    }
}

function openMedicalForm() {
    document.getElementById('form-medical').reset();
    document.getElementById('medical-id').value = '';

    // Default data to today
    document.getElementById('medical-date').valueAsDate = new Date();

    const modal = document.getElementById('modal-medical-form');
    const content = modal.querySelector('.clay-card');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
}

function closeMedicalForm() {
    const modal = document.getElementById('modal-medical-form');
    const content = modal.querySelector('.clay-card');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95');
}

async function handleSaveMedical(e) {
    e.preventDefault();
    if (!currentPetId) return;

    try {
        const currentUser = await window.getLoggedUser();
        const familyId = await window.getUserFamilyId();

        const recData = {
            family_id: familyId,
            pet_id: currentPetId,
            record_type: document.getElementById('medical-type').value,
            title: document.getElementById('medical-title').value,
            record_date: document.getElementById('medical-date').value,
            description: document.getElementById('medical-desc').value || null
        };

        const { error } = await supabase.from('pet_medical_records').insert([recData]);
        if (error) throw error;

        closeMedicalForm();
        loadPetMedical(currentPetId);

    } catch (err) {
        console.error("Errore:", err);
        alert("Errore salvataggio record medico");
    }
}

async function deleteMedical(id) {
    if (confirm("Eliminare record medico?")) {
        await supabase.from('pet_medical_records').delete().eq('id', id);
        loadPetMedical(currentPetId);
    }
}

// ==========================================
// UTILS
// ==========================================

function getPetIcon(species) {
    switch (species) {
        case 'Cane': return '🐶';
        case 'Gatto': return '🐱';
        case 'Uccello': return '🐦';
        case 'Roditore': return '🐹';
        case 'Rettile': return '🦎';
        case 'Pesce': return '🐠';
        default: return '🐾';
    }
}

function getReminderIcon(type) {
    switch (type) {
        case 'Vaccino': return '💉';
        case 'Antiparassitario': return '🦟';
        case 'Sverminazione': return '💊';
        case 'Visita Controllo': return '🩺';
        default: return '📅';
    }
}

function getMedicalIcon(type) {
    switch (type) {
        case 'Visita': return '🩺';
        case 'Intervento': return '✂️';
        case 'Esame': return '🧪';
        case 'Malattia': return '🤒';
        default: return '📝';
    }
}

function calculateAge(birthDateStr) {
    const birth = new Date(birthDateStr);
    const today = new Date();

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    if (age === 0) {
        // Calcola mesi
        let months = (today.getFullYear() - birth.getFullYear()) * 12;
        months -= birth.getMonth();
        months += today.getMonth();
        return months <= 0 ? 'Cucciolo (Meno di 1 mese)' : months + ' Mesi';
    }

    return age + (age === 1 ? ' Anno' : ' Anni');
}

function formatDateIT(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
