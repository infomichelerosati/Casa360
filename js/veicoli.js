// js/veicoli.js

let vehSubscription = null;
let currentVehicles = [];
let editingVehicleId = null;

async function initVeicoli() {
    console.log("Inizializzazione Modulo Veicoli...");

    // Modale Binding
    const modal = document.getElementById('modal-add-vehicle');
    const modalContent = document.getElementById('modal-content-vehicle');
    const btnAdd = document.getElementById('btn-add-vehicle');
    const btnClose = document.getElementById('btn-close-vehicle');
    const form = document.getElementById('form-add-vehicle');

    btnAdd.addEventListener('click', () => {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('translate-y-full');
    });

    const closeMod = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modalContent.classList.add('translate-y-full');
        form.reset();
        document.getElementById('modal-vehicle-title').textContent = "Nuovo Veicolo";
        editingVehicleId = null;

        // Reset GPL state
        document.getElementById('gpl-expiry-container').classList.add('hidden', 'max-h-0');
        document.getElementById('gpl-expiry-container').classList.remove('max-h-40');
        document.getElementById('veh-gpl-date').required = false;
    };

    btnClose.addEventListener('click', closeMod);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeMod();
    });

    form.addEventListener('submit', handleAddVehicle);

    // Toggle visibilità GPL Date
    const gplCheckbox = document.getElementById('veh-is-gpl');
    const gplContainer = document.getElementById('gpl-expiry-container');
    const gplInput = document.getElementById('veh-gpl-date');

    gplCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            gplContainer.classList.remove('hidden', 'max-h-0');
            gplContainer.classList.add('max-h-40');
            gplInput.required = true;
        } else {
            gplContainer.classList.add('hidden', 'max-h-0');
            gplContainer.classList.remove('max-h-40');
            gplInput.required = false;
            gplInput.value = ''; // svuota se si deseleziona
        }
    });

    await fetchVehicles();
    setupVehiclesRealtime();
}

async function fetchVehicles() {
    try {
        const { data, error } = await supabase
            .from('family_vehicles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        currentVehicles = data;
        renderVehicles(data);

    } catch (err) {
        console.error("Errore vehicles:", err);
    }
}

function renderVehicles(vehicles) {
    const listEl = document.getElementById('vehicles-list');
    listEl.innerHTML = '';

    if (vehicles.length === 0) {
        listEl.innerHTML = `<div class="clay-item p-6 rounded-clay bg-darkblue-base text-center text-darkblue-icon text-sm shadow-inner">Nessun veicolo registrato.</div>`;
        return;
    }

    const now = new Date();

    vehicles.forEach(veh => {
        const typeIcon = veh.vehicle_type === 'Moto' ? 'fa-motorcycle' : 'fa-car-side';
        const plateStr = veh.plate ? veh.plate.toUpperCase() : 'NO TARGA';

        // Helper Status calcolatore
        const insStatus = calculateExpiryStatus(veh.insurance_expiry, now);
        const taxStatus = calculateExpiryStatus(veh.tax_expiry, now);
        const revStatus = calculateExpiryStatus(veh.inspection_expiry, now);

        const html = `
            <div class="clay-card bg-darkblue-card rounded-clay p-5 relative overflow-hidden">
                <!-- Icona Veicolo Background Watermark -->
                <i class="fa-solid ${typeIcon} absolute -right-4 -bottom-4 text-8xl text-darkblue-base opacity-50 z-0"></i>
                
                <div class="relative z-10 flex justify-between items-start mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-full bg-darkblue-base clay-item text-[#3b82f6] shadow-inner flex items-center justify-center">
                            <i class="fa-solid ${typeIcon} text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-darkblue-heading leading-tight">${veh.name}</h3>
                            <div class="px-2 py-0.5 border-2 border-darkblue-base rounded text-xs font-mono font-bold text-darkblue-icon mt-1 inline-block bg-darkblue-base/50 tracking-widest">${plateStr}</div>
                        </div>
                    </div>
                    <!-- Delete / Edit -->
                    <div class="flex items-center gap-1">
                        <button onclick="editVehicle('${veh.id}')" class="w-8 h-8 flex items-center justify-center text-darkblue-icon hover:text-darkblue-heading transition-colors" title="Modifica">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="deleteVehicle('${veh.id}')" class="w-8 h-8 flex items-center justify-center text-darkblue-icon hover:text-red-500 transition-colors" title="Elimina">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </div>

                <div class="relative z-10 flex flex-col gap-3 mt-4">
                    <!-- Progress Assicurazione -->
                    ${renderProgressRow('Assicurazione', 'fa-shield-halved', 'text-blue-400', veh.insurance_expiry, insStatus, veh.id, 'insurance')}
                    <!-- Progress Bollo -->
                    ${renderProgressRow('Bollo', 'fa-file-invoice-dollar', 'text-yellow-400', veh.tax_expiry, taxStatus, veh.id, 'tax')}
                    <!-- Progress Revisione -->
                    ${renderProgressRow('Revisione', 'fa-wrench', 'text-green-400', veh.inspection_expiry, revStatus, veh.id, 'inspection')}
                    
                    <!-- Progress GPL se presente -->
                    ${veh.is_gpl && veh.gpl_expiry ? renderProgressRow('Scadenza Impianto / Bombola GPL', 'fa-fire-burner', 'text-purple-400', veh.gpl_expiry, calculateExpiryStatus(veh.gpl_expiry, now), veh.id, 'gpl') : ''}
                </div>
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });
}

// Ritorna { colorClass, percentStr, label, barColorClass } in base alla data di scadenza
function calculateExpiryStatus(expiryDateStr, now) {
    const expDate = new Date(expiryDateStr);
    const diffTime = expDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Assumiamo un rinnovo annuale (365 gg) per calcolare una finta percentuale (0% vuota, 100% piena)
    let rawPercent = ((diffDays / 365) * 100);
    // Vogliamo che la barra si SVUOTI quando manca poco. 
    // Se diffDays > 365, mettiamo la barra piena al max.
    if (rawPercent > 100) rawPercent = 100;
    if (rawPercent < 0) rawPercent = 0; // Scaduta

    const percentStr = `${rawPercent.toFixed(1)}%`;

    if (diffDays < 0) {
        return {
            colorClass: 'text-red-500 font-bold',
            label: 'Scaduta',
            percentStr: '100%',
            barColorClass: 'bg-red-500',
            bgIconColor: 'bg-red-500/10'
        };
    } else if (diffDays <= 30) {
        return {
            colorClass: 'text-orange-400 font-bold',
            label: `Tra ${diffDays} gg`,
            percentStr,
            barColorClass: 'bg-orange-400',
            bgIconColor: 'bg-orange-500/10'
        };
    } else {
        const monthDiff = Math.ceil(diffDays / 30);
        return {
            colorClass: 'text-darkblue-heading font-medium',
            label: `Tra ${monthDiff} mesi`,
            percentStr,
            barColorClass: 'bg-[#3b82f6]', // Blu standard
            bgIconColor: 'bg-darkblue-base'
        };
    }
}

function renderProgressRow(title, iconClass, iconColorClass, dateStr, statusObj, vehId, typeKey) {
    const dStr = new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Mostra il pulsante di "Rinnovo Effettuato" se la scadenza è vicina o superata
    const showRenewBtn = (statusObj.percentStr === '100%' && statusObj.barColorClass === 'bg-red-500') || parseInt(statusObj.percentStr) < 20;

    return `
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full ${statusObj.bgIconColor} ${iconColorClass} flex items-center justify-center shrink-0">
                <i class="fa-solid ${iconClass} text-sm"></i>
            </div>
            <div class="flex-1 min-w-0"> <!-- min-w-0 aiuta truncate in flexbox -->
                <div class="flex justify-between items-end mb-1 w-full">
                    <span class="text-xs font-bold text-darkblue-icon truncate mr-2">${title}</span>
                    <span class="text-[10px] sm:text-xs ${statusObj.colorClass} text-right whitespace-nowrap">${statusObj.label} (${dStr})</span>
                </div>
                <!-- Barra e bottone rinnovo -->
                <div class="flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-darkblue-base rounded-full overflow-hidden shadow-inner w-full">
                        <div class="h-full ${statusObj.barColorClass} transition-all duration-1000" style="width: ${statusObj.percentStr}"></div>
                    </div>
                    ${showRenewBtn ? `
                         <button onclick="renewExpiry('${vehId}', '${typeKey}', '${dateStr}')" class="text-[10px] bg-darkblue-accent/20 text-darkblue-accent px-2 py-0.5 rounded-full font-bold uppercase hover:bg-darkblue-accent hover:text-white transition-colors">
                            Rinnova
                         </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// Funzione globale che aggiunge mesi/anni alla data in base al tipo
window.renewExpiry = function (vehId, typeKey, oldDateStr) {
    if (window.showConfirmModal) {
        window.showConfirmModal("Rinnovo Scadenza", "Vuoi registrare il rinnovo? La data verrà prolungata automaticamente. Puoi modificarla entrando in Edit (prossimamente).", async () => {
            const dateObj = new Date(oldDateStr);
            let updatePayload = {};

            // Logica semplificata:
            // Assicurazione default 12 mesi o 6 mesi. Gestiamo 12 mesi di base.
            // Bollo 1 anno.
            // Revisione 2 anni (di base, quella dei 4 anni richiederebbe UI complessa o calcolo dalla immatricolazione).
            // GPL 10 anni.

            if (typeKey === 'insurance') {
                dateObj.setMonth(dateObj.getMonth() + 12); // Assumiamo annuale di default per praticità
                updatePayload.insurance_expiry = dateObj.toISOString();
            } else if (typeKey === 'tax') {
                dateObj.setFullYear(dateObj.getFullYear() + 1);
                updatePayload.tax_expiry = dateObj.toISOString();
            } else if (typeKey === 'inspection') {
                dateObj.setFullYear(dateObj.getFullYear() + 2); // default 2 anni
                updatePayload.inspection_expiry = dateObj.toISOString();
            } else if (typeKey === 'gpl') {
                dateObj.setFullYear(dateObj.getFullYear() + 10);
                updatePayload.gpl_expiry = dateObj.toISOString();
            }

            try {
                await supabase.from('family_vehicles').update(updatePayload).eq('id', vehId);
            } catch (e) { console.error("Update error: ", e); }
        });
    }
}

window.deleteVehicle = function (id) {
    if (window.showConfirmModal) {
        window.showConfirmModal("Elimina Veicolo", "Sei sicuro di voler rimuovere per sempre questo veicolo dal garage famigliare?", async () => {
            await supabase.from('family_vehicles').delete().eq('id', id);
        });
    }
}

window.editVehicle = function (id) {
    const veh = currentVehicles.find(v => v.id === id);
    if (!veh) return;

    editingVehicleId = id;
    document.getElementById('modal-vehicle-title').textContent = "Modifica Veicolo";

    document.getElementById('veh-type').value = veh.vehicle_type;
    document.getElementById('veh-name').value = veh.name;
    document.getElementById('veh-plate').value = veh.plate || '';

    document.getElementById('veh-ins').value = veh.insurance_expiry;
    document.getElementById('veh-tax').value = veh.tax_expiry;
    document.getElementById('veh-rev').value = veh.inspection_expiry;

    const gplCheckbox = document.getElementById('veh-is-gpl');
    const gplDate = document.getElementById('veh-gpl-date');
    const gplContainer = document.getElementById('gpl-expiry-container');

    if (veh.is_gpl) {
        gplCheckbox.checked = true;
        gplContainer.classList.remove('hidden', 'max-h-0');
        gplContainer.classList.add('max-h-40');
        gplDate.required = true;
        gplDate.value = veh.gpl_expiry;
    } else {
        gplCheckbox.checked = false;
        gplContainer.classList.add('hidden', 'max-h-0');
        gplContainer.classList.remove('max-h-40');
        gplDate.required = false;
        gplDate.value = '';
    }

    // Apri modale
    document.getElementById('modal-add-vehicle').classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('modal-content-vehicle').classList.remove('translate-y-full');
}

async function handleAddVehicle(e) {
    e.preventDefault();

    const type = document.getElementById('veh-type').value;
    const name = document.getElementById('veh-name').value;
    const plate = document.getElementById('veh-plate').value;

    const ins = document.getElementById('veh-ins').value;
    const tax = document.getElementById('veh-tax').value;
    const rev = document.getElementById('veh-rev').value;

    const isGpl = document.getElementById('veh-is-gpl').checked;
    const gplDate = document.getElementById('veh-gpl-date').value;

    try {
        const payload = {
            name: name,
            plate: plate,
            vehicle_type: type,
            insurance_expiry: ins,
            tax_expiry: tax,
            inspection_expiry: rev,
            is_gpl: isGpl
        };
        if (isGpl && gplDate) {
            payload.gpl_expiry = gplDate;
        } else {
            payload.gpl_expiry = null; // Forza a nullo se gpl rimosso
        }

        if (editingVehicleId) {
            const { error } = await supabase.from('family_vehicles').update(payload).eq('id', editingVehicleId);
            if (error) throw error;
        } else {
            const familyId = await window.getUserFamilyId();
            if (!familyId) throw new Error("Utente non assegnato a nessuna famiglia.");

            payload.family_id = familyId;
            const { error } = await supabase.from('family_vehicles').insert([payload]);
            if (error) throw error;
        }

        document.getElementById('btn-close-vehicle').click();
    } catch (err) {
        alert("Errore inserimento veicolo: " + err.message);
    }
}

function setupVehiclesRealtime() {
    if (vehSubscription) supabase.removeChannel(vehSubscription);

    vehSubscription = supabase
        .channel('public:family_vehicles')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'family_vehicles' }, payload => {
            fetchVehicles();
        })
        .subscribe();
}
