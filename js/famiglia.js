// js/famiglia.js

let familyMembersData = [];
let editingMemberId = null;
let currentUserRole = 'member';
let currentUserId = null;

async function initFamiglia() {
    console.log("Inizializzazione Modulo Famiglia...");

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (typeof window.logoutUser === 'function') {
                window.logoutUser();
            }
        });
    }

    // Modal logic
    const modal = document.getElementById('modal-member');
    const modalContent = document.getElementById('modal-content-member');
    const btnAdd = document.getElementById('btn-add-member');
    const btnClose = document.getElementById('btn-close-member-modal');
    const form = document.getElementById('form-member');

    btnAdd.addEventListener('click', () => {
        editingMemberId = null;
        document.getElementById('modal-member-title').textContent = "Aggiungi Membro";
        form.reset();
        // default color
        document.querySelector('input[name="member-color"][value="#3b82f6"]').checked = true;

        modal.classList.remove('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('translate-y-full');
    });

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modalContent.classList.add('translate-y-full');
    };

    btnClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    form.addEventListener('submit', handleSaveMember);

    // Weather Settings Initialization
    const inputCity = document.getElementById('input-weather-city');
    const btnSaveCity = document.getElementById('btn-save-city');
    const cityFeedback = document.getElementById('weather-city-feedback');

    // Mostra la città salvata se c'è
    const savedCity = localStorage.getItem('family_os_city_name');
    if (savedCity && inputCity) {
        inputCity.value = savedCity;
        cityFeedback.innerHTML = `<span class="text-green-500"><i class="fa-solid fa-check"></i> Impostato su ${savedCity}</span>`;
    }

    if (btnSaveCity && inputCity) {
        btnSaveCity.addEventListener('click', async () => {
            const query = inputCity.value.trim();
            if (!query) {
                // Se svuota l'input, resetta al GPS automatico
                localStorage.removeItem('family_os_city_manual');
                localStorage.removeItem('family_os_city_name');
                cityFeedback.innerHTML = `Ripristinato il meteo automatico (GPS).`;
                return;
            }

            const icon = btnSaveCity.querySelector('i');
            icon.className = 'fa-solid fa-circle-notch fa-spin';

            try {
                const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=it&format=json`);
                const data = await res.json();

                if (data.results && data.results.length > 0) {
                    const city = data.results[0];
                    localStorage.setItem('family_os_lat', city.latitude);
                    localStorage.setItem('family_os_lon', city.longitude);
                    localStorage.setItem('family_os_city_name', city.name);
                    localStorage.setItem('family_os_city_manual', 'true'); // Flag per bloccare il GPS

                    cityFeedback.innerHTML = `<span class="text-green-500"><i class="fa-solid fa-check"></i> Città trovata: ${city.name} (${city.admin1 || city.country})</span>`;

                    // Se la fetchWeather è disponibile (magari ricaricando i moduli), aggiorna al volo
                    if (typeof window.fetchWeather === 'function') {
                        window.fetchWeather();
                    }
                } else {
                    cityFeedback.innerHTML = `<span class="text-red-500"><i class="fa-solid fa-triangle-exclamation"></i> Città non trovata.</span>`;
                }
            } catch (err) {
                cityFeedback.innerHTML = `<span class="text-red-500">Errore di rete.</span>`;
            } finally {
                icon.className = 'fa-solid fa-magnifying-glass';
            }
        });
    }

    await fetchFamilyInfo();
    await fetchAndRenderMembers();
}

async function fetchFamilyInfo() {
    try {
        // First get the user's family_id from their member profile
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: memberProfile } = await supabase
            .from('family_members')
            .select('family_id, role')
            .eq('id', user.id)
            .single();

        if (memberProfile && memberProfile.family_id) {
            currentUserRole = memberProfile.role;
            currentUserId = user.id;
            // Fetch the family group details
            const { data: familyObj, error } = await supabase
                .from('family_groups')
                .select('name, join_code')
                .eq('id', memberProfile.family_id)
                .single();

            if (error) throw error;

            if (familyObj) {
                // Populate the UI
                document.getElementById('display-family-name').textContent = familyObj.name;
                document.getElementById('display-join-code').textContent = familyObj.join_code;
                document.getElementById('family-info-banner').classList.remove('hidden');

                // Copy to clipboard setup
                const btnCopy = document.getElementById('btn-copy-code');
                btnCopy.addEventListener('click', () => {
                    navigator.clipboard.writeText(familyObj.join_code).then(() => {
                        const icon = btnCopy.querySelector('i');
                        icon.className = 'fa-solid fa-check text-green-500';
                        setTimeout(() => {
                            icon.className = 'fa-solid fa-copy';
                        }, 2000);
                    });
                });
            }
        }
    } catch (err) {
        console.error("Errore fetch info famiglia:", err);
    }
}

async function fetchAndRenderMembers() {
    try {
        const { data, error } = await supabase.from('family_members').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        familyMembersData = data;
        renderMembersList();
    } catch (err) {
        console.error("Errore fetch members:", err);
    }
}

function renderMembersList() {
    const listEl = document.getElementById('family-members-list');
    listEl.innerHTML = '';

    if (familyMembersData.length === 0) {
        listEl.innerHTML = `<div class="p-6 text-center text-darkblue-icon text-sm">Nessun membro trovato. Aggiungine uno!</div>`;
        return;
    }

    familyMembersData.forEach(member => {
        const roleStr = member.role === 'admin' ? 'Amministratore' : (member.role === 'child' ? 'Bambino' : 'Membro Base');

        let actionButtons = '';
        const isSelf = member.id === currentUserId;
        const isAdmin = currentUserRole === 'admin';
        const isTargetAdmin = member.role === 'admin';

        // Nascondi i pulsanti di modifica/eliminazione se l'utente 'base' tenta di agire su un 'admin'
        if (isAdmin || isSelf || !isTargetAdmin) {
            actionButtons = `
                <div class="flex items-center gap-2 pr-2">
                    <button onclick="editMember('${member.id}')" class="w-10 h-10 rounded-full flex items-center justify-center text-darkblue-icon hover:text-darkblue-accent transition-colors clay-item bg-darkblue-base" title="Modifica">
                        <i class="fa-solid fa-pen text-sm"></i>
                    </button>
                    ${!isSelf ? `
                    <button onclick="deleteMember('${member.id}')" class="w-10 h-10 rounded-full flex items-center justify-center text-darkblue-icon hover:text-red-500 transition-colors" title="Elimina">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                    ` : ''}
                </div>
            `;
        }

        const html = `
            <div class="clay-item p-4 rounded-clay bg-darkblue-card flex items-center justify-between gap-4">
                
                <div class="w-14 h-14 rounded-full bg-[${member.avatar_color}] flex flex-col items-center justify-center shrink-0 border-2 border-darkblue-base shadow-inner text-white relative">
                    <span class="text-xl font-bold">${member.name[0].toUpperCase()}</span>
                </div>
                
                <div class="flex-1 overflow-hidden">
                    <h4 class="font-bold text-darkblue-heading leading-tight truncate px-1 text-lg">${member.name}</h4>
                    <span class="text-xs text-darkblue-icon font-medium flex items-center gap-1 mt-1">
                        <i class="fa-solid ${member.role === 'admin' ? 'fa-crown text-yellow-500' : 'fa-user'}"></i> 
                        ${roleStr}
                    </span>
                </div>
                
                ${actionButtons}
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });
}

window.editMember = function (id) {
    const member = familyMembersData.find(m => m.id === id);
    if (!member) return;

    editingMemberId = id;
    document.getElementById('modal-member-title').textContent = "Modifica Membro";

    document.getElementById('member-name').value = member.name;
    document.getElementById('member-role').value = member.role || 'member';

    // Check color
    const colorRad = document.querySelector(`input[name="member-color"][value="${member.avatar_color}"]`);
    if (colorRad) {
        colorRad.checked = true;
    } else {
        // Fallback
        document.querySelector('input[name="member-color"][value="#3b82f6"]').checked = true;
    }

    document.getElementById('modal-member').classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('modal-content-member').classList.remove('translate-y-full');
}

async function handleSaveMember(e) {
    e.preventDefault();

    const name = document.getElementById('member-name').value.trim();
    const role = document.getElementById('member-role').value;
    const color = document.querySelector('input[name="member-color"]:checked').value;

    const payload = {
        name: name,
        role: role,
        avatar_color: color
    };

    const btnClose = document.getElementById('btn-close-member-modal');

    try {
        if (editingMemberId) {
            const { error } = await supabase.from('family_members').update(payload).eq('id', editingMemberId);
            if (error) throw error;
        } else {
            // Need to get current user's family_id to attach to new manual profile
            const { data: { user } } = await supabase.auth.getUser();
            const { data: currentUserProfile } = await supabase
                .from('family_members')
                .select('family_id')
                .eq('id', user.id)
                .single();

            if (currentUserProfile && currentUserProfile.family_id) {
                payload.family_id = currentUserProfile.family_id;
            }

            const { error } = await supabase.from('family_members').insert([payload]);
            if (error) throw error;
        }

        btnClose.click();
        fetchAndRenderMembers(); // Ricarica
    } catch (err) {
        console.error("Save error:", err);
        alert("Errore salvataggio!");
    }
}

window.deleteMember = function (id) {
    if (window.showConfirmModal) {
        window.showConfirmModal("Elimina Profilo", "Sei sicuro di voler eliminare questo profilo dalla famiglia?", async () => {
            const { error } = await supabase.from('family_members').delete().eq('id', id);
            if (!error) fetchAndRenderMembers();
        });
    }
}
