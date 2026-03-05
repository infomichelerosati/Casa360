// js/bambini.js
// Logica del Modulo Bambini per Family OS

const BambiniModule = {
    currentKidId: null,

    async init() {
        console.log("Inizializzazione Modulo Bambini...");
        if (!window.supabase) {
            console.error("Supabase non inizializzato");
            return;
        }

        this.cacheDOM();
        this.bindEvents();
        await this.loadKids();
    },

    cacheDOM() {
        // Liste & Container
        this.containerKids = document.getElementById('kids-container');

        // Buttons Modali
        this.btnAddKid = document.getElementById('btn-add-kid');
        this.btnCloseKidForm = document.getElementById('btn-close-kid-form');
        this.btnCloseGeneric = document.getElementById('btn-close-generic');
        this.btnDeleteKid = document.getElementById('btn-delete-kid');

        // Modali
        this.modalKidDetails = document.getElementById('modal-kid-details');
        this.modalKidForm = document.getElementById('modal-kid-form');
        this.modalGenericForm = document.getElementById('modal-kid-generic-form');
        this.modalEditEmergencies = document.getElementById('modal-edit-emergencies');
        this.modalEditSizes = document.getElementById('modal-edit-sizes');
        this.modalEditDocs = document.getElementById('modal-edit-docs');

        // Forms
        this.formKid = document.getElementById('form-kid');
        this.formGeneric = document.getElementById('form-kid-generic');
        this.formEditEmergencies = document.getElementById('form-edit-emergencies');
        this.formEditSizes = document.getElementById('form-edit-sizes');
        this.formEditDocs = document.getElementById('form-edit-docs');
        this.genericFieldsContainer = document.getElementById('generic-form-fields-container');
        this.genericTarget = document.getElementById('generic-table-target');

        // Tabs
        this.tabBtns = document.querySelectorAll('.kid-tab-btn');
        this.tabContents = document.querySelectorAll('.kid-tab-content');

        // Close Detail Btn
        this.btnCloseKidDetails = document.getElementById('btn-close-kid-details');
    },

    bindEvents() {
        // Tab Navigation
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.getAttribute('data-tab');
                this.switchTab(targetId, e.currentTarget);
            });
        });

        // Apertura chiusura Modali Principali
        this.btnAddKid?.addEventListener('click', () => {
            this.formKid.reset();
            document.getElementById('kid-id').value = '';
            document.getElementById('kid-form-title').innerText = "Nuovo Bambino";
            this.openModal(this.modalKidForm);
        });

        this.btnCloseKidForm?.addEventListener('click', () => this.closeModal(this.modalKidForm));
        this.btnCloseKidDetails?.addEventListener('click', () => {
            this.closeModalFullscreen(this.modalKidDetails);
            this.currentKidId = null;
        });

        // Submit Form Principale Profilo
        this.formKid?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveKidProfile();
        });

        // Elimina Bimbo
        this.btnDeleteKid?.addEventListener('click', () => {
            if (this.currentKidId && window.showConfirmModal) {
                window.showConfirmModal("Elimina Profilo", "Sei sicuro di voler eliminare tutti i dati di questo bambino? L'azione è irreversibile.", async () => {
                    await this.deleteKid(this.currentKidId);
                });
            }
        });

        // --- Eventi Apertura Modale Generica ---
        document.querySelectorAll('.btn-add-growth').forEach(b => b.addEventListener('click', () => this.openGenericForm('growth')));
        document.querySelectorAll('.btn-add-event').forEach(b => b.addEventListener('click', () => this.openGenericForm('events')));
        document.getElementById('btn-add-medical-record')?.addEventListener('click', () => this.openGenericForm('medical'));
        document.querySelectorAll('.btn-add-milestone').forEach(b => b.addEventListener('click', () => this.openGenericForm('milestones')));
        document.querySelectorAll('.btn-add-routine').forEach(b => b.addEventListener('click', () => this.openGenericForm('routine')));

        this.btnCloseGeneric?.addEventListener('click', () => this.closeModal(this.modalGenericForm));
        if (this.formGeneric) {
            this.formGeneric.onsubmit = async (e) => {
                e.preventDefault();
                await this.saveGenericForm();
            };
        }

        // Eventi Export PDF
        document.querySelectorAll('.btn-export-pdf').forEach(b => {
            b.addEventListener('click', (e) => {
                const format = e.currentTarget.getAttribute('data-format');
                this.exportPDF(format);
            });
        });

        // Eventi Modifica Info Rapide Modals
        document.getElementById('btn-edit-emergencies')?.addEventListener('click', () => this.editEmergencies());
        document.getElementById('btn-edit-sizes')?.addEventListener('click', () => this.editSizes());
        document.getElementById('btn-edit-docs')?.addEventListener('click', () => this.editDocs());

        document.getElementById('btn-close-edit-emergencies')?.addEventListener('click', () => this.closeModal(this.modalEditEmergencies));
        document.getElementById('btn-close-edit-sizes')?.addEventListener('click', () => this.closeModal(this.modalEditSizes));
        document.getElementById('btn-close-edit-docs')?.addEventListener('click', () => this.closeModal(this.modalEditDocs));

        this.formEditEmergencies?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveEmergencies();
        });

        this.formEditSizes?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveSizes();
        });

        this.formEditDocs?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveDocs();
        });

        // Evento di delega per eliminare singoli record (Salute, Milestones, Routine)
        document.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-delete-record');
            if (btn) {
                const recordId = btn.getAttribute('data-id');
                const tableName = btn.getAttribute('data-table');

                if (recordId && tableName && window.showConfirmModal) {
                    window.showConfirmModal(
                        "Elimina Registrazione",
                        "Vuoi eliminare questa voce? L'azione è irreversibile.",
                        () => this.deleteKidRecord(recordId, tableName)
                    );
                }
            }
        });
    },

    // ==========================================
    // UTILS MODALI E UI
    // ==========================================
    openModal(modal) {
        if (!modal) return;
        modal.classList.remove('hidden', 'pointer-events-none');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('.clay-card')?.classList.remove('scale-95');
        }, 10);
    },

    closeModal(modal) {
        if (!modal) return;
        modal.classList.add('opacity-0');
        modal.querySelector('.clay-card')?.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.remove('flex');
            modal.classList.add('hidden', 'pointer-events-none');
        }, 300);
    },

    openModalFullscreen(modal) {
        if (!modal) return;
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('translate-x-full');
        }, 10);
        // Resetta i tab alla prima (Anagrafica)
        if (this.tabBtns.length > 0) {
            this.switchTab('tab-anagrafica', this.tabBtns[0]);
        }
    },

    closeModalFullscreen(modal) {
        if (!modal) return;
        modal.classList.add('translate-x-full');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    },

    switchTab(targetId, activeBtn) {
        // Togli active dai btn
        this.tabBtns.forEach(b => {
            b.classList.remove('active', 'text-darkblue-heading');
            b.classList.add('text-darkblue-icon');
        });
        // Togli active dal contenuto
        this.tabContents.forEach(c => c.classList.add('hidden'));

        // Metti active al corrente
        activeBtn.classList.add('active', 'text-darkblue-heading');
        activeBtn.classList.remove('text-darkblue-icon');
        document.getElementById(targetId)?.classList.remove('hidden');
    },

    showToast(message, type = 'success') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    },

    // ==========================================
    // CRUD BASE KIDS PROFILES
    // ==========================================
    async loadKids() {
        try {
            const { data, error } = await window.supabase
                .from('kids_profiles')
                .select('*')
                .order('first_name', { ascending: true });

            if (error) throw error;
            this.renderKidsList(data);
        } catch (error) {
            console.error("Errore fetching bambini:", error);
            this.containerKids.innerHTML = `<p class="text-center text-red-400 mt-4">Errore di caricamento</p>`;
        }
    },

    calculateDetailedAge(dateString) {
        if (!dateString) return "Data non impostata";
        const birthDate = new Date(dateString);
        const today = new Date();

        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();
        let days = today.getDate() - birthDate.getDate();

        if (months < 0 || (months === 0 && days < 0)) {
            years--;
            months += 12;
        }

        if (days < 0) {
            const lastMonthDate = new Date(today.getFullYear(), today.getMonth(), 0);
            days += lastMonthDate.getDate();
            months--;
            if (months < 0) months += 12;
        }

        let parts = [];
        if (years > 0) parts.push(`${years} ${years === 1 ? 'anno' : 'anni'}`);
        if (months > 0) parts.push(`${months} ${months === 1 ? 'mese' : 'mesi'}`);
        if (days > 0 || (years === 0 && months === 0 && days === 0)) parts.push(`${days} ${days === 1 ? 'giorno' : 'giorni'}`);
        else if (years === 0 && months === 0 && days === 0) parts.push("Neo-nato");

        return parts.join(', ');
    },

    renderKidsList(kids) {
        if (!kids || kids.length === 0) {
            this.containerKids.innerHTML = `
                <div class="text-center py-10 opacity-60">
                    <i class="fa-solid fa-child-reaching text-6xl mb-4 text-darkblue-icon"></i>
                    <p class="text-darkblue-heading font-medium">Nessun bambino inserito</p>
                    <p class="text-sm text-darkblue-icon mt-1">Clicca sul <i class="fa-solid fa-plus text-xs mx-1"></i> per iniziare</p>
                </div>
            `;
            return;
        }

        this.containerKids.innerHTML = '';
        kids.forEach(kid => {
            // Calcolo rapido età
            let ageText = this.calculateDetailedAge(kid.date_of_birth);

            const card = document.createElement('div');
            card.className = "clay-card bg-darkblue-card rounded-clay p-4 flex items-center justify-between cursor-pointer active:scale-95 transition-transform hover:bg-[#2a364f]";
            card.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-full bg-darkblue-base flex items-center justify-center text-3xl clay-item shadow-inner">
                        ${kid.gender === 'Femmina' ? '👧' : '👦'}
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-darkblue-heading">${kid.first_name} <span class="text-sm text-darkblue-icon">${kid.last_name || ''}</span></h3>
                        <p class="text-xs font-medium text-darkblue-accent flex items-center mt-0.5">
                            <i class="fa-solid fa-cake-candles mr-1.5"></i> ${ageText}
                        </p>
                    </div>
                </div>
                <div class="w-10 h-10 rounded-full bg-darkblue-base flex items-center justify-center text-darkblue-icon clay-item shadow-inner">
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            `;

            card.addEventListener('click', () => this.openKidDetail(kid));
            this.containerKids.appendChild(card);
        });
    },

    async saveKidProfile() {
        const currentUser = await window.supabase.auth.getUser();
        if (!currentUser.data.user) return;

        // Per il family id, lo deleghiamo al backend se usiamo get_user_family_id(),
        // ma via client dobbiamo reperirlo o usare un insert select.
        // Recuperiamolo da LocalStorage o dal DB
        const { data: memberData } = await window.supabase.from('family_members').select('family_id').eq('id', currentUser.data.user.id).single();
        if (!memberData) return this.showToast("Impossibile trovare la tua famiglia", "error");

        const id = document.getElementById('kid-id').value;
        const payload = {
            family_id: memberData.family_id,
            first_name: document.getElementById('kid-firstname').value,
            last_name: document.getElementById('kid-lastname').value,
            date_of_birth: document.getElementById('kid-birthdate').value,
            gender: document.getElementById('kid-gender').value,
            blood_group: document.getElementById('kid-blood').value,
            pediatrician_name: document.getElementById('kid-pediatra-name').value,
            pediatrician_phone: document.getElementById('kid-pediatra-phone').value
        };

        const btn = this.modalKidForm.querySelector('button[type="submit"]');
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        try {
            if (id) {
                const { error } = await window.supabase.from('kids_profiles').update(payload).eq('id', id);
                if (error) throw error;
                this.showToast("Profilo aggiornato");
            } else {
                const { error } = await window.supabase.from('kids_profiles').insert([payload]);
                if (error) throw error;
                this.showToast("Bambino aggiunto!");
            }
            this.closeModal(this.modalKidForm);
            this.loadKids();
        } catch (error) {
            console.error(error);
            this.showToast("Errore durante il salvataggio", "error");
        } finally {
            btn.innerHTML = 'Salva Profilo';
        }
    },

    async deleteKid(id) {
        try {
            const { error } = await window.supabase.from('kids_profiles').delete().eq('id', id);
            if (error) throw error;
            this.showToast("Profilo Eliminato", "success");
            this.closeModalFullscreen(this.modalKidDetails);
            this.loadKids();
        } catch (e) {
            this.showToast("Impossibile eliminare", "error");
        }
    },


    // ==========================================
    // DETTAGLI E POPOLAMENTO TABS
    // ==========================================
    openKidDetail(kid) {
        this.currentKidId = kid.id;

        // Anagrafica Base
        document.getElementById('kid-detail-name').innerText = kid.first_name;
        document.getElementById('kid-detail-fullname').innerText = `${kid.first_name} ${kid.last_name}`;
        document.getElementById('kid-detail-icon').innerText = kid.gender === 'Femmina' ? '👧' : '👦';

        // Età Calcolata
        let ageText = "Data non impostata";
        if (kid.date_of_birth) {
            const bd = new Date(kid.date_of_birth);
            ageText = bd.toLocaleDateString('it-IT') + ` (${this.calculateDetailedAge(kid.date_of_birth)})`;
        }
        document.getElementById('kid-detail-age').innerText = ageText;
        document.getElementById('kid-detail-gender_blood').innerText = `Sesso: ${kid.gender} | Gruppo: ${kid.blood_group || '-'}`;

        document.getElementById('kid-detail-pediatra').innerText = kid.pediatrician_name || "Non specificato";
        document.getElementById('btn-call-pediatra').onclick = () => {
            if (kid.pediatrician_phone) window.open(`tel:${kid.pediatrician_phone}`);
            else this.showToast("Nessun numero salvato");
        };

        // Popola Contatti Emergenza
        const emergenciesContainer = document.getElementById('kid-detail-emergencies');
        let emergenciesHtml = '';
        if (kid.emergency_contact_1_name || kid.emergency_contact_1_phone) {
            emergenciesHtml += `
             <div class="bg-darkblue-base rounded-2xl p-2 px-3 clay-item shadow-inner flex justify-between items-center">
                 <p class="text-sm font-bold text-darkblue-heading">${kid.emergency_contact_1_name || 'Contatto 1'}</p>
                 <a href="tel:${kid.emergency_contact_1_phone}" class="text-xs text-darkblue-accent font-bold"><i class="fa-solid fa-phone mr-1"></i>${kid.emergency_contact_1_phone || 'Nessun num.'}</a>
             </div>`;
        }
        if (kid.emergency_contact_2_name || kid.emergency_contact_2_phone) {
            emergenciesHtml += `
             <div class="bg-darkblue-base rounded-2xl p-2 px-3 clay-item shadow-inner flex justify-between items-center mt-2">
                 <p class="text-sm font-bold text-darkblue-heading">${kid.emergency_contact_2_name || 'Contatto 2'}</p>
                 <a href="tel:${kid.emergency_contact_2_phone}" class="text-xs text-darkblue-accent font-bold"><i class="fa-solid fa-phone mr-1"></i>${kid.emergency_contact_2_phone || 'Nessun num.'}</a>
             </div>`;
        }
        emergenciesContainer.innerHTML = emergenciesHtml || `<p class="text-xs text-darkblue-icon text-center italic py-2">Nessun contatto rapido inserito</p>`;

        // Popola Taglie
        document.getElementById('kid-detail-shoesize').innerText = kid.shoe_size || '-';
        document.getElementById('kid-detail-clothsize').innerText = kid.clothing_size || '-';

        // Popola Documenti e calcolo scadenze
        const formatExpiry = (dateString, elementId) => {
            const el = document.getElementById(elementId);
            if (!dateString) {
                el.innerText = '-';
                el.className = 'text-sm font-bold text-darkblue-heading';
                return;
            }
            const expDate = new Date(dateString);
            const today = new Date();
            const timeDiff = expDate.getTime() - today.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

            el.innerText = expDate.toLocaleDateString('it-IT');

            if (daysDiff < 0) {
                el.className = 'text-sm font-bold text-red-500'; // Scaduto
            } else if (daysDiff <= 30) {
                el.className = 'text-sm font-bold text-orange-500'; // In scadenza
            } else {
                el.className = 'text-sm font-bold text-green-500'; // Valido
            }
        };

        formatExpiry(kid.id_card_expiry, 'kid-detail-idcard');
        formatExpiry(kid.health_card_expiry, 'kid-detail-healthcard');

        // Controlla Allergie per Bollino
        this.checkAllergies(kid.id);

        // Fetch asincrono delle altre tab qui
        this.loadKidHealthTab(kid.id);
        this.loadKidMilestones(kid.id);
        this.loadKidRoutineTab(kid.id);

        this.openModalFullscreen(this.modalKidDetails);
    },

    // ==========================================
    // EDIT RAPIDO ANAGRAFICA (Emergenze / Taglie)
    // ==========================================
    async editEmergencies() {
        if (!this.currentKidId) return;

        const { data } = await window.supabase.from('kids_profiles').select('*').eq('id', this.currentKidId).single();
        if (data) {
            document.getElementById('em-name-1').value = data.emergency_contact_1_name || '';
            document.getElementById('em-phone-1').value = data.emergency_contact_1_phone || '';
            document.getElementById('em-name-2').value = data.emergency_contact_2_name || '';
            document.getElementById('em-phone-2').value = data.emergency_contact_2_phone || '';
        }

        this.openModal(this.modalEditEmergencies);
    },

    async saveEmergencies() {
        if (!this.currentKidId) return;
        const c1Name = document.getElementById('em-name-1').value;
        const c1Phone = document.getElementById('em-phone-1').value;
        const c2Name = document.getElementById('em-name-2').value;
        const c2Phone = document.getElementById('em-phone-2').value;

        const btn = this.formEditEmergencies.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        try {
            const { error } = await window.supabase.from('kids_profiles').update({
                emergency_contact_1_name: c1Name,
                emergency_contact_1_phone: c1Phone,
                emergency_contact_2_name: c2Name,
                emergency_contact_2_phone: c2Phone
            }).eq('id', this.currentKidId);

            if (error) throw error;
            this.showToast("Contatti d'emergenza aggiornati!");
            this.closeModal(this.modalEditEmergencies);
            this.forceReloadCurrentKidView();
        } catch (e) {
            console.error(e);
            this.showToast("Errore salvataggio", "error");
        } finally {
            btn.innerHTML = originalText;
        }
    },

    async editSizes() {
        if (!this.currentKidId) return;

        const { data } = await window.supabase.from('kids_profiles').select('*').eq('id', this.currentKidId).single();
        if (data) {
            document.getElementById('size-shoe').value = data.shoe_size || '';
            document.getElementById('size-cloth').value = data.clothing_size || '';
        }

        this.openModal(this.modalEditSizes);
    },

    async saveSizes() {
        if (!this.currentKidId) return;
        const shoe = document.getElementById('size-shoe').value;
        const cloth = document.getElementById('size-cloth').value;

        const btn = this.formEditSizes.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        try {
            const { error } = await window.supabase.from('kids_profiles').update({
                shoe_size: shoe,
                clothing_size: cloth
            }).eq('id', this.currentKidId);

            if (error) throw error;
            this.showToast("Misure aggiornate!");
            this.closeModal(this.modalEditSizes);
            this.forceReloadCurrentKidView();
        } catch (e) {
            console.error(e);
            this.showToast("Errore salvataggio", "error");
        } finally {
            btn.innerHTML = originalText;
        }
    },

    async editDocs() {
        if (!this.currentKidId) return;

        const { data } = await window.supabase.from('kids_profiles').select('*').eq('id', this.currentKidId).single();
        if (data) {
            document.getElementById('doc-idcard').value = data.id_card_expiry || '';
            document.getElementById('doc-healthcard').value = data.health_card_expiry || '';
        }

        this.openModal(this.modalEditDocs);
    },

    async saveDocs() {
        if (!this.currentKidId) return;
        const idcard = document.getElementById('doc-idcard').value;
        const healthcard = document.getElementById('doc-healthcard').value;

        const btn = this.formEditDocs.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        try {
            const { error } = await window.supabase.from('kids_profiles').update({
                id_card_expiry: idcard || null,
                health_card_expiry: healthcard || null
            }).eq('id', this.currentKidId);

            if (error) throw error;
            this.showToast("Scadenze aggiornate!");
            this.closeModal(this.modalEditDocs);
            this.forceReloadCurrentKidView();
        } catch (e) {
            console.error(e);
            this.showToast("Errore salvataggio", "error");
        } finally {
            btn.innerHTML = originalText;
        }
    },

    // Aggiornamento Allergie Profile Badge
    async checkAllergies(kidId) {
        const container = document.getElementById('kid-detail-allergies-container');
        const listText = document.getElementById('kid-detail-allergies-list');

        try {
            const { data, error } = await window.supabase
                .from('kids_medical')
                .select('title')
                .eq('kid_id', kidId)
                .eq('record_type', 'allergy');

            if (data && data.length > 0) {
                const allergyNames = data.map(a => a.title).join(', ');
                listText.innerText = allergyNames;
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
                listText.innerText = '-';
            }
        } catch (err) {
            console.error("Errore fetch allergie", err);
        }
    },

    async forceReloadCurrentKidView() {
        if (!this.currentKidId) return;
        const { data } = await window.supabase.from('kids_profiles').select('*').eq('id', this.currentKidId).single();
        if (data) this.openKidDetail(data); // Richiama la funzione con i dati aggiornati
        // Ricarichiamo anche la lista in background
        this.loadKids();
    },

    // ==========================================
    // GENERATORI FORM DINAMICI
    // ==========================================
    async openGenericForm(type) {
        if (!this.currentKidId) return;

        this.formGeneric.reset();
        this.genericTarget.value = type;
        this.genericFieldsContainer.innerHTML = '';

        // Fetch membri della famiglia per il dropdown Spese (usato in Medical e Routine)
        let familyMembersHtml = `<option value="">Seleziona chi paga</option>`;
        if (type === 'medical' || type === 'routine') {
            try {
                const currentUser = await window.supabase.auth.getUser();
                if (currentUser.data.user) {
                    const { data: memberData } = await window.supabase.from('family_members').select('family_id').eq('id', currentUser.data.user.id).single();
                    if (memberData) {
                        const { data: members } = await window.supabase.from('family_members').select('id, name').eq('family_id', memberData.family_id).order('name');
                        if (members && members.length > 0) {
                            familyMembersHtml = members.map(m => `<option value="${m.id}" ${m.id === currentUser.data.user.id ? 'selected' : ''}>${m.name}</option>`).join('');
                        }
                    }
                }
            } catch (err) {
                console.error("Spese: Errore recupero membri famiglia", err);
            }
        }

        // Template HTML del blocco spese opzionale
        const expenseBlockHtml = `
            <div class="mt-4 pt-4 border-t border-darkblue-base">
                <label class="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" id="gen-has-expense" class="w-4 h-4 rounded appearance-none checked:bg-darkblue-accent border border-darkblue-icon bg-darkblue-base transition-colors flex items-center justify-center after:content-['✓'] after:text-white after:text-xs after:hidden checked:after:block">
                    <span class="text-sm font-bold text-darkblue-heading">Questa voce ha avuto un costo? <span class="text-[10px] text-darkblue-icon ml-1 font-normal">(Esporta in Finanze)</span></span>
                </label>
                
                <div id="gen-expense-fields" class="hidden space-y-3 bg-darkblue-card/50 p-4 rounded-2xl border border-darkblue-base">
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-darkblue-icon uppercase pl-2">Importo (€)</label>
                        <input type="number" step="0.01" id="gen-exp-amount" placeholder="0.00" class="w-full bg-darkblue-base text-darkblue-heading rounded-xl px-4 py-2 shadow-inner text-right font-bold">
                    </div>
                     <div class="space-y-1">
                        <label class="text-[10px] font-bold text-darkblue-icon uppercase pl-2">Anticipato da</label>
                        <select id="gen-exp-paidby" class="w-full bg-darkblue-base text-darkblue-heading rounded-xl px-4 py-2 shadow-inner">
                            ${familyMembersHtml}
                        </select>
                    </div>
                </div>
            </div>
        `;

        // Template HTML del blocco Calendario
        const calendarBlockHtml = `
            <div class="mt-2 pt-4 border-t border-darkblue-base">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="gen-has-calendar" class="w-4 h-4 rounded appearance-none checked:bg-darkblue-accent border border-darkblue-icon bg-darkblue-base transition-colors flex items-center justify-center after:content-['✓'] after:text-white after:text-xs after:hidden checked:after:block">
                    <span class="text-sm font-bold text-darkblue-heading">Aggiungi evento nel Calendario di Famiglia?</span>
                </label>
                <div id="gen-calendar-fields" class="hidden mt-3 space-y-3 bg-darkblue-card/50 p-4 rounded-2xl border border-darkblue-base">
                     <p class="text-[10px] font-bold text-darkblue-icon uppercase text-center mb-1">Dettagli Appuntamento</p>
                     <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-darkblue-icon uppercase pl-2">Ora Inizio</label>
                            <input type="time" id="gen-cal-time" class="w-full bg-darkblue-base text-darkblue-heading rounded-xl px-4 py-2 shadow-inner" style="color-scheme: dark;">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-darkblue-icon uppercase pl-2">Durata</label>
                            <select id="gen-cal-duration" class="w-full bg-darkblue-base text-darkblue-heading rounded-xl px-4 py-2 shadow-inner">
                                <option value="30">30 min</option>
                                <option value="60">1 Ora</option>
                                <option value="120">2 Ore</option>
                                <option value="ALL">Tutto il giorno</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;

        let title = "Aggiungi";

        switch (type) {
            case 'growth':
                title = "Misura Crescita";
                this.genericFieldsContainer.innerHTML = `
                   <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Peso (Kg)</label>
                            <input type="number" step="0.1" name="weight" id="gen-weight" required class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Altezza (cm)</label>
                            <input type="number" step="0.5" name="height" id="gen-height" required class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                        </div>
                   </div>
                   <div class="space-y-1 mt-3">
                        <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Circonferenza Cranio (cm)</label>
                        <input type="number" step="0.1" name="head" id="gen-head" class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                    </div>
                `;
                break;
            case 'events':
                title = "Evento Acuto (Febbre)";
                this.genericFieldsContainer.innerHTML = `
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Note Evento</label>
                        <input type="text" name="desc" id="gen-desc" placeholder="Es. Febbre alta o caduta" required class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                    </div>
                    <div class="grid grid-cols-2 gap-3 mt-3">
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Temperatura</label>
                            <input type="number" step="0.1" name="temp" id="gen-temp" placeholder="38.5" class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                        </div>
                         <div class="space-y-1">
                            <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Farmaco</label>
                            <input type="text" name="med" id="gen-med" placeholder="Es. Tachipirina" class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                        </div>
                    </div>
                `;
                break;
            case 'medical':
                title = "Record Clinico";
                this.genericFieldsContainer.innerHTML = `
                    <div class="space-y-1">
                         <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Tipo</label>
                        <select name="type" id="gen-type" required class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                            <option value="vaccine">Vaccino</option>
                            <option value="visit">Visita</option>
                            <option value="allergy">Allergia</option>
                             <option value="dental">Dentista</option>
                        </select>
                    </div>
                     <div class="space-y-1 mt-3">
                        <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Titolo / Descrizione Visita</label>
                        <input type="text" name="title" id="gen-title" required class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                    </div>
                     <div class="space-y-1 mt-3">
                        <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Data</label>
                        <input type="date" name="date" id="gen-date" required class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner" style="color-scheme: dark;">
                    </div>
                    ${calendarBlockHtml}
                    ${expenseBlockHtml}
                 `;
                break;
            case 'milestones':
                title = "Nuova Tappa";
                this.genericFieldsContainer.innerHTML = `
                    <div class="space-y-1">
                         <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Categoria</label>
                        <select name="cat" id="gen-cat" required class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                            <option value="language">Linguaggio / Frasi Buffe</option>
                            <option value="autonomy">Autonomia</option>
                            <option value="motor">Sviluppo Motorio</option>
                            <option value="first_times">Prime Volte</option>
                        </select>
                    </div>
                     <div class="space-y-1 mt-3">
                        <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Traguardo</label>
                        <input type="text" name="mtitle" id="gen-mtitle" required placeholder="Es. Ha camminato!" class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                    </div>
                     <div class="space-y-1 mt-3">
                        <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Data (Opzionale)</label>
                        <input type="date" name="mdate" id="gen-mdate" class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner" style="color-scheme: dark;">
                    </div>
                 `;
                break;
            case 'routine':
                title = "Diario Routine";
                this.genericFieldsContainer.innerHTML = `
                    <div class="space-y-1">
                         <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Ambito</label>
                        <select name="type" id="gen-rtype" required class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                            <option value="food">Svezzamento / Alimentazione</option>
                            <option value="sleep">Nanna</option>
                            <option value="school">Nido / Scuola</option>
                            <option value="checklist">Checklist (es. Zaino)</option>
                        </select>
                    </div>
                     <div class="space-y-1 mt-3">
                        <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Titolo / Alimento</label>
                        <input type="text" name="rtitle" id="gen-rtitle" required placeholder="Es. Provato il pomodoro" class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                    </div>
                    <div class="space-y-1 mt-3">
                        <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Gradimento (1-5)</label>
                        <input type="number" name="rrating" id="gen-rrating" min="1" max="5" placeholder="5" class="w-full bg-darkblue-base text-darkblue-heading rounded-full px-5 py-3 shadow-inner">
                    </div>
                     <div class="space-y-1 mt-3">
                        <label class="text-xs font-bold text-darkblue-icon uppercase pl-4">Note aggiuntive / Dettagli Acquisto</label>
                        <textarea name="rcontent" id="gen-rcontent" rows="2" class="w-full bg-darkblue-base text-darkblue-heading rounded-[1rem] px-5 py-3 shadow-inner"></textarea>
                    </div>
                    ${expenseBlockHtml}
                 `;
                break;
            default:
                this.showToast("Form non supportato", "error");
                return;
        }

        document.getElementById('generic-form-title').innerText = title;

        // Aggiungi listener per toggle visibilità expense solo se esiste il blocco spesa nel form (Medical/Routine)
        const expCheckbox = this.formGeneric.querySelector('#gen-has-expense');
        const expFields = this.formGeneric.querySelector('#gen-expense-fields');
        if (expCheckbox && expFields) {
            expCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    expFields.classList.remove('hidden');
                    document.getElementById('gen-exp-amount').setAttribute('required', 'true');
                } else {
                    expFields.classList.add('hidden');
                    document.getElementById('gen-exp-amount').removeAttribute('required');
                }
            });
        }

        // Listener per toggle visibilità Calendario (solo Medical/Routine)
        const calCheckbox = this.formGeneric.querySelector('#gen-has-calendar');
        const calFields = this.formGeneric.querySelector('#gen-calendar-fields');
        if (calCheckbox && calFields) {
            calCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) calFields.classList.remove('hidden');
                else calFields.classList.add('hidden');
            });
        }

        this.openModal(this.modalGenericForm);
    },

    async saveGenericForm() {
        const target = this.genericTarget.value;
        const kid_id = this.currentKidId;

        const currentUser = await window.supabase.auth.getUser();
        const { data: memberData } = await window.supabase.from('family_members').select('family_id').eq('id', currentUser.data.user.id).single();
        const family_id = memberData.family_id;

        let payload = { kid_id, family_id };
        let table = '';

        if (target === 'growth') {
            table = 'kids_growth';
            payload.weight_kg = document.getElementById('gen-weight').value;
            payload.height_cm = document.getElementById('gen-height').value;
            payload.head_circumference_cm = document.getElementById('gen-head').value || null;
            payload.record_date = new Date().toISOString().split('T')[0];
        } else if (target === 'events') {
            table = 'kids_events';
            payload.event_type = 'fever';
            payload.description = document.getElementById('gen-desc').value;
            payload.temperature = document.getElementById('gen-temp').value || null;
            payload.medication_given = document.getElementById('gen-med').value || null;
        } else if (target === 'medical') {
            table = 'kids_medical';
            payload.record_type = document.getElementById('gen-type').value;
            payload.title = document.getElementById('gen-title').value;
            payload.date_occurred = document.getElementById('gen-date').value;
        } else if (target === 'milestones') {
            table = 'kids_milestones';
            payload.category = document.getElementById('gen-cat').value;
            payload.title = document.getElementById('gen-mtitle').value;
            payload.date_achieved = document.getElementById('gen-mdate').value || new Date().toISOString().split('T')[0];
        } else if (target === 'routine') {
            table = 'kids_routine';
            payload.routine_type = document.getElementById('gen-rtype').value;
            payload.title = document.getElementById('gen-rtitle').value;
            payload.rating = document.getElementById('gen-rrating').value || null;
            payload.content = document.getElementById('gen-rcontent').value;
        }

        const btn = this.formGeneric.querySelector('button');
        if (btn.disabled) return; // Prevent double click
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        try {
            // Se in medical o routine c'è una spesa allegata
            const expCheckbox = document.getElementById('gen-has-expense');
            const hasExpense = expCheckbox && expCheckbox.checked;

            // Se spuntato Calendario
            const calCheckbox = document.getElementById('gen-has-calendar');
            const hasCalendar = calCheckbox && calCheckbox.checked;

            // 1. INSERIMENTO DEL RECORD PRINCIPALE (UNA SOLA VOLTA)
            const { error, data: insertedData } = await window.supabase.from(table).insert([payload]).select();
            if (error) throw error;

            const baseDate = payload.date_occurred || payload.record_date || payload.created_at || new Date().toISOString().split('T')[0];
            const kidName = document.getElementById('kid-detail-name').innerText || 'Bambino';

            // 2. Sync Finanze
            if (hasExpense) {
                const amount = parseFloat(document.getElementById('gen-exp-amount').value);
                const paidBy = document.getElementById('gen-exp-paidby').value;

                const expPayload = {
                    family_id: family_id,
                    description: `[Salute ${kidName}] ${payload.title}`,
                    amount: amount,
                    category: 'Bambini',
                    date: baseDate,
                    paid_by: paidBy
                };

                const { error: expErr } = await window.supabase.from('family_expenses').insert([expPayload]);
                if (expErr) console.error("Errore salvataggio sync finanze", expErr);
            }

            // 3. Sync Calendario
            if (hasCalendar) {
                const timeStr = document.getElementById('gen-cal-time').value;
                const duration = document.getElementById('gen-cal-duration').value;

                let startTimestamp = null;
                let endTimestamp = null;

                if (duration === 'ALL' || !timeStr) {
                    // Evento Giorno Intero: forziamo a mezzanotte locale
                    startTimestamp = new Date(`${baseDate}T00:00:00`).toISOString();
                    endTimestamp = new Date(`${baseDate}T23:59:59`).toISOString();
                } else {
                    // Impostato Orario
                    const startDateObj = new Date(`${baseDate}T${timeStr}:00`);
                    startTimestamp = startDateObj.toISOString();

                    const endDateObj = new Date(startDateObj.getTime() + (parseInt(duration) * 60000));
                    endTimestamp = endDateObj.toISOString();
                }

                const calPayload = {
                    family_id: family_id,
                    title: `[Med] ${payload.title} - ${kidName}`,
                    start_time: startTimestamp,
                    end_time: endTimestamp,
                    event_type: 'Salute',
                    created_by: currentUser.data.user.id
                };

                const { error: calErr } = await window.supabase.from('calendar_events').insert([calPayload]);
                if (calErr) console.error("Errore sync calendario", calErr);
            }

            this.showToast("Record aggiunto!");
            this.closeModal(this.modalGenericForm);

            // Ricarica la sezione giusta
            this.loadKidHealthTab(kid_id);
            this.loadKidMilestones(kid_id);
            this.loadKidRoutineTab(kid_id);
        } catch (e) {
            console.error(e);
            this.showToast("Salvataggio fallito", "error");
        } finally {
            btn.innerHTML = 'Salva Record';
            btn.disabled = false;
        }
    },


    // ==========================================
    // CARICAMENTO SEZIONI SPECIFICHE
    // ==========================================
    async loadKidHealthTab(kid_id) {
        // --- 1. Growth (Storico Scrollabile) ---
        const rGrowth = await window.supabase.from('kids_growth').select('*').eq('kid_id', kid_id).order('record_date', { ascending: false });
        const contG = document.getElementById('kid-latest-growth');
        if (rGrowth.data && rGrowth.data.length > 0) {
            contG.innerHTML = rGrowth.data.map(g => {
                const dataMisurazione = new Date(g.record_date).toLocaleDateString('it-IT');
                return `
                <div class="bg-darkblue-base rounded-2xl p-3 clay-item shadow-inner flex flex-col gap-2 relative">
                    <button class="btn-delete-record absolute top-2 right-2 text-darkblue-icon hover:text-red-400 active:scale-95" data-id="${g.id}" data-table="kids_growth">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                    <div class="text-center border-b border-darkblue-card/50 pb-1 mr-4">
                        <p class="text-[10px] text-darkblue-icon uppercase tracking-wider font-bold"><i class="fa-regular fa-calendar-check mr-1"></i>${dataMisurazione}</p>
                    </div>
                    <div class="grid grid-cols-3 text-center">
                        <div><p class="text-[10px] text-darkblue-icon uppercase font-bold">Peso</p><p class="text-sm font-bold text-darkblue-heading mt-1">${g.weight_kg} kg</p></div>
                        <div class="border-x border-darkblue-card/50"><p class="text-[10px] text-darkblue-icon uppercase font-bold">Altezza</p><p class="text-sm font-bold text-darkblue-heading mt-1">${g.height_cm} cm</p></div>
                        <div><p class="text-[10px] text-darkblue-icon uppercase font-bold">Cranio</p><p class="text-sm font-bold text-darkblue-heading mt-1">${g.head_circumference_cm || '-'} cm</p></div>
                    </div>
                </div>
                `;
            }).join('');
        } else {
            contG.innerHTML = `<p class="text-xs text-darkblue-icon text-center italic py-2">Nessun dato registrato</p>`;
        }

        // --- 2. Medical ---
        const rMed = await window.supabase.from('kids_medical').select('*').eq('kid_id', kid_id).order('date_occurred', { ascending: false });
        const contMed = document.getElementById('kid-medical-list');
        if (rMed.data && rMed.data.length > 0) {
            contMed.innerHTML = rMed.data.map(m => `
                 <div class="relative mb-4 pr-6">
                     <span class="absolute -left-[23px] top-1 w-3 h-3 bg-green-500 rounded-full border-2 border-darkblue-card outline outline-2 outline-green-500/20"></span>
                     <p class="text-sm font-bold text-darkblue-heading">${m.title}</p>
                     <p class="text-xs text-darkblue-icon">${new Date(m.date_occurred).toLocaleDateString('it-IT')} <span class="uppercase tracking-wider ml-2 opacity-50">${m.record_type}</span></p>
                     <button class="btn-delete-record absolute top-1 right-0 text-darkblue-icon hover:text-red-400 active:scale-95" data-id="${m.id}" data-table="kids_medical">
                         <i class="fa-solid fa-trash-can text-sm"></i>
                     </button>
                 </div>
             `).join('');
        } else {
            contMed.innerHTML = `<p class="text-xs text-darkblue-icon text-center italic py-4">Nessun record medico.</p>`;
        }

        // --- 3. Events (Raggruppati per Mese) ---
        const rEvents = await window.supabase.from('kids_events').select('*').eq('kid_id', kid_id).order('event_time', { ascending: false });
        const contEv = document.getElementById('kid-events-list');
        if (rEvents.data && rEvents.data.length > 0) {
            // Raggruppa per mese
            const groupedEvents = {};
            rEvents.data.forEach(e => {
                const date = new Date(e.event_time);
                // Es "Marzo 2026"
                const monthYear = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
                if (!groupedEvents[monthYear]) groupedEvents[monthYear] = [];
                groupedEvents[monthYear].push(e);
            });

            let htmlString = '';
            for (const [month, eventsArray] of Object.entries(groupedEvents)) {
                htmlString += `
                    <div class="mb-4">
                        <div class="sticky top-0 bg-darkblue-card/90 backdrop-blur-sm z-10 py-1 mb-2 border-b border-darkblue-base">
                            <h4 class="text-[11px] font-bold text-darkblue-icon uppercase tracking-widest capitalize">${month}</h4>
                        </div>
                        <div class="space-y-2">
                            ${eventsArray.map(e => `
                            <div class="bg-darkblue-base rounded-2xl p-3 clay-item shadow-inner flex justify-between items-center relative pr-8">
                                <div>
                                    <p class="text-[11px] text-red-500 font-bold mb-0.5"><i class="fa-regular fa-clock mr-1"></i>${new Date(e.event_time).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                    <p class="text-xs font-medium text-darkblue-heading">${e.description}</p>
                                    ${e.medication_given ? `<p class="text-[10px] text-darkblue-icon mt-1"><i class="fa-solid fa-pills mr-1"></i>${e.medication_given}</p>` : ''}
                                </div>
                                <div class="flex items-center gap-2">
                                    ${e.temperature ? `<div class="bg-red-500/20 text-red-500 rounded-full px-2 py-1 text-[10px] font-bold shrink-0"><i class="fa-solid fa-fire mr-1"></i>${e.temperature}°</div>` : ''}
                                    <button class="btn-delete-record text-darkblue-icon hover:text-red-400 active:scale-95 absolute top-3 right-3" data-id="${e.id}" data-table="kids_events">
                                        <i class="fa-solid fa-trash-can text-sm"></i>
                                    </button>
                                </div>
                            </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            contEv.innerHTML = htmlString;
        } else {
            contEv.innerHTML = `<p class="text-xs text-darkblue-icon text-center italic py-2">Nessun evento acuto.</p>`;
        }
    },

    async loadKidMilestones(kid_id) {
        const res = await window.supabase.from('kids_milestones').select('*').eq('kid_id', kid_id).order('date_achieved', { ascending: true });
        const cont = document.getElementById('kid-milestones-list');
        if (res.data && res.data.length > 0) {
            cont.innerHTML = res.data.map(m => `
                  <div class="bg-darkblue-base rounded-2xl p-4 clay-item shadow-inner mb-3 relative">
                      <div class="flex justify-between items-center mb-1 pr-6">
                          <span class="text-[10px] tracking-wider uppercase font-bold text-yellow-500">${m.category}</span>
                          <span class="text-[10px] text-darkblue-icon">${new Date(m.date_achieved).toLocaleDateString()}</span>
                      </div>
                      <p class="text-sm font-bold text-darkblue-heading italic">"${m.title}"</p>
                      <button class="btn-delete-record absolute top-3 right-3 text-darkblue-icon hover:text-red-400 active:scale-95" data-id="${m.id}" data-table="kids_milestones">
                          <i class="fa-solid fa-trash-can text-xs"></i>
                      </button>
                  </div>
              `).join('');
        } else {
            cont.innerHTML = `<p class="text-xs text-darkblue-icon text-center italic py-4">Nessun traguardo registrato.</p>`;
        }
    },

    async loadKidRoutineTab(kid_id) {
        const res = await window.supabase.from('kids_routine').select('*').eq('kid_id', kid_id).order('created_at', { ascending: false });
        const cont = document.getElementById('kid-routine-list');
        if (res.data && res.data.length > 0) {
            cont.innerHTML = res.data.map(r => {
                let ratingHtml = '';
                if (r.rating) {
                    ratingHtml = Array(5).fill(0).map((_, i) =>
                        `<i class="fa-solid fa-star ${i < r.rating ? 'text-yellow-400' : 'text-darkblue-icon opacity-30'} text-[10px]"></i>`
                    ).join('');
                }

                let icon = 'fa-check';
                if (r.routine_type === 'food') icon = 'fa-utensils text-orange-400';
                if (r.routine_type === 'sleep') icon = 'fa-moon text-indigo-400';
                if (r.routine_type === 'school') icon = 'fa-school text-blue-400';
                if (r.routine_type === 'checklist') icon = 'fa-list-check text-green-400';

                return `
                  <div class="bg-darkblue-base rounded-[1.5rem] p-4 clay-item shadow-inner flex flex-col gap-2 relative overflow-hidden">
                      <div class="flex justify-between items-start z-10 pr-6">
                          <div class="flex items-center gap-2">
                              <div class="w-8 h-8 rounded-full bg-darkblue-card flex items-center justify-center shrink-0">
                                  <i class="fa-solid ${icon}"></i>
                              </div>
                              <div>
                                  <p class="text-sm font-bold text-darkblue-heading leading-tight">${r.title}</p>
                                  <p class="text-[9px] text-darkblue-icon tracking-wider uppercase">${new Date(r.created_at).toLocaleDateString()}</p>
                              </div>
                          </div>
                          ${ratingHtml ? `<div class="flex gap-0.5">${ratingHtml}</div>` : ''}
                      </div>
                      ${r.content ? `<p class="text-xs text-darkblue-icon mt-2 bg-darkblue-card/30 p-2 rounded-xl z-10">${r.content}</p>` : ''}
                      <button class="btn-delete-record absolute top-3 right-4 text-darkblue-icon hover:text-red-400 active:scale-95 z-20" data-id="${r.id}" data-table="kids_routine">
                          <i class="fa-solid fa-trash-can text-sm"></i>
                      </button>
                  </div>
              `;
            }).join('');
        } else {
            cont.innerHTML = `<p class="text-xs text-darkblue-icon text-center italic py-4">Nessuna routine o nota registrata.</p>`;
        }
    },

    // ==========================================
    // ELIMINAZIONE SINGOLI RECORD DINAMICI
    // ==========================================
    async deleteKidRecord(id, tableName) {
        try {
            const { error } = await window.supabase
                .from(tableName)
                .delete()
                .eq('id', id);

            if (error) throw error;
            this.showToast("Voce eliminata", "success");
            this.forceReloadCurrentKidView();
        } catch (e) {
            console.error("Errore cancellazione record:", e);
            this.showToast("Impossibile eliminare", "error");
        }
    },

    // ==========================================
    // EXPORT PDF (Anteprima Stampa Nativa Browser)
    // ==========================================
    async exportPDF(format) {
        if (!this.currentKidId) return;

        this.showToast(`Generazione ${format === 'medical' ? 'Report Medico' : 'Diario Ricordi'} in corso...`);

        // 1. Fetch Dati Bambino
        let kidName = document.getElementById('kid-detail-fullname').innerText;
        let kidAge = document.getElementById('kid-detail-age').innerText;
        let kidGenderBlood = document.getElementById('kid-detail-gender_blood').innerText;

        let titleStr = '';
        if (format === 'medical') titleStr = 'Report Medico';
        else if (format === 'memories') titleStr = 'Diario dei Ricordi';
        else titleStr = 'Fascicolo Completo';

        let htmlContent = `
            <!DOCTYPE html>
            <html lang="it">
            <head>
                <meta charset="UTF-8">
                <title>${kidName} - ${titleStr}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
                    h1 { color: #0f172a; margin: 0 0 10px 0; font-size: 28px; }
                    .subtitle { color: #64748b; font-size: 14px; margin: 0; }
                    .metadata { display: flex; justify-content: center; gap: 20px; margin-top: 15px; font-size: 13px; font-weight: bold; background: #f8fafc; padding: 10px; border-radius: 10px;}
                    h2 { color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 30px; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
                    .record-card { margin-bottom: 15px; padding: 15px; background: #f1f5f9; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; page-break-inside: avoid; }
                    .record-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
                    .record-title { font-weight: bold; font-size: 15px; margin:0;}
                    .record-date { font-size: 12px; color: #64748b; font-weight: bold;}
                    .record-content { font-size: 13px; color: #475569; margin: 0; }
                    
                    /* Varianti colore per categorie */
                    .border-medical { border-left-color: #10b981; }
                    .border-event { border-left-color: #ef4444; }
                    .border-growth { border-left-color: #3b82f6; }
                    .border-milestone { border-left-color: #f59e0b; }
                    
                    @media print {
                        body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .record-card { border-left-width: 6px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${kidName}</h1>
                    <p class="subtitle">${titleStr.toUpperCase()}</p>
                    <div class="metadata">
                        <span>Data di nascita: ${kidAge.split(' ')[0]}</span>
                        <span>${kidGenderBlood}</span>
                    </div>
                </div>
        `;

        try {
            // === LOGICA MEDICAL & FULL ===
            if (format === 'medical' || format === 'full') {
                // Fetch Crescita
                const rGrowth = await window.supabase.from('kids_growth').select('*').eq('kid_id', this.currentKidId).order('record_date', { ascending: false });
                if (rGrowth.data && rGrowth.data.length > 0) {
                    htmlContent += `<h2>Ultimi Rilevamenti Crescita</h2>`;
                    rGrowth.data.slice(0, format === 'full' ? 50 : 5).forEach(g => {
                        htmlContent += `
                        <div class="record-card border-growth">
                            <div class="record-header">
                                <p class="record-title">Misure corporee</p>
                                <p class="record-date">${new Date(g.record_date).toLocaleDateString('it-IT')}</p>
                            </div>
                            <p class="record-content">Peso: <b>${g.weight_kg} kg</b> | Altezza: <b>${g.height_cm} cm</b> ${g.head_circumference_cm ? `| Cranio: <b>${g.head_circumference_cm} cm</b>` : ''}</p>
                        </div>`;
                    });
                }

                // Fetch Medico
                const rMed = await window.supabase.from('kids_medical').select('*').eq('kid_id', this.currentKidId).order('date_occurred', { ascending: false });
                if (rMed.data && rMed.data.length > 0) {
                    htmlContent += `<h2>Storico Medico / Vaccinazioni</h2>`;
                    rMed.data.forEach(m => {
                        htmlContent += `
                        <div class="record-card border-medical">
                            <div class="record-header">
                                <p class="record-title">${m.title} <span style="font-size:10px;text-transform:uppercase;color:#94a3b8;margin-left:5px;">(${m.record_type})</span></p>
                                <p class="record-date">${new Date(m.date_occurred).toLocaleDateString('it-IT')}</p>
                            </div>
                        </div>`;
                    });
                }

                // Fetch Eventi Acuti
                const rEvents = await window.supabase.from('kids_events').select('*').eq('kid_id', this.currentKidId).order('event_time', { ascending: false });
                if (rEvents.data && rEvents.data.length > 0) {
                    htmlContent += `<h2>Diario Eventi Acuti</h2>`;
                    rEvents.data.forEach(e => {
                        htmlContent += `
                        <div class="record-card border-event">
                            <div class="record-header">
                                <p class="record-title">${e.description}</p>
                                <p class="record-date">${new Date(e.event_time).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</p>
                            </div>
                            ${e.temperature ? `<p class="record-content">Temperatura: <b>${e.temperature}°C</b></p>` : ''}
                            ${e.medication_given ? `<p class="record-content">Farmaco: <b>${e.medication_given}</b></p>` : ''}
                        </div>`;
                    });
                }
            }

            // === LOGICA MEMORIES & FULL ===
            if (format === 'memories' || format === 'full') {
                // Fetch Milestones
                const rMile = await window.supabase.from('kids_milestones').select('*').eq('kid_id', this.currentKidId).order('date_achieved', { ascending: true });
                if (rMile.data && rMile.data.length > 0) {
                    htmlContent += `<h2>Diario dei Traguardi e Delle Prime Volte</h2>`;
                    rMile.data.forEach(m => {
                        let catName = m.category;
                        if (catName === 'language') catName = 'Linguaggio';
                        if (catName === 'autonomy') catName = 'Autonomia';
                        if (catName === 'motor') catName = 'Motorio';
                        if (catName === 'first_times') catName = 'Prime Volte';

                        htmlContent += `
                        <div class="record-card border-milestone">
                            <div class="record-header">
                                <p class="record-title">"${m.title}"</p>
                                <p class="record-date">${new Date(m.date_achieved).toLocaleDateString('it-IT')}</p>
                            </div>
                            <p class="record-content" style="text-transform:uppercase;font-size:10px;margin-top:5px;font-weight:bold;">${catName}</p>
                        </div>`;
                    });
                } else if (format === 'memories') {
                    htmlContent += `<p style="text-align:center; color:#94a3b8; padding:30px;">Ancora nessun ricordo registrato.</p>`;
                }
            }

            // === LOGICA ROUTINE LOGISTICA (SOLO FULL) ===
            if (format === 'full') {
                const rRout = await window.supabase.from('kids_routine').select('*').eq('kid_id', this.currentKidId).order('created_at', { ascending: false });
                if (rRout.data && rRout.data.length > 0) {
                    htmlContent += `<h2>Registro Routine e Logistica</h2>`;
                    rRout.data.forEach(r => {
                        let rType = r.routine_type;
                        if (rType === 'food') rType = 'Alimentazione';
                        if (rType === 'sleep') rType = 'Nanna';
                        if (rType === 'school') rType = 'Asilo/Scuola';
                        if (rType === 'checklist') rType = 'Checklist';

                        htmlContent += `
                          <div class="record-card" style="border-left-color: #64748b;">
                              <div class="record-header">
                                  <p class="record-title">${r.title}</p>
                                  <p class="record-date">${new Date(r.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</p>
                              </div>
                              <p class="record-content" style="text-transform:uppercase;font-size:10px;margin-top:5px;font-weight:bold;">${rType} ${r.rating ? `| Voto: ${r.rating}/5` : ''}</p>
                              ${r.content ? `<p class="record-content" style="margin-top:8px;">${r.content}</p>` : ''}
                          </div>`;
                    });
                }
            }

            htmlContent += `
                <div style="text-align:center; margin-top: 50px; font-size:11px; color:#94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                    Generato automaticamente da Family OS in data ${new Date().toLocaleDateString('it-IT')}
                </div>
            </body>
            </html>`;

            // Apri in una nuova finestra ed esegui la stampa/salvataggio nativo
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                // Aggiungiamo un listener per effettuare la stampa solo a rendering completato
                printWindow.onload = function () {
                    printWindow.focus();
                    printWindow.print();
                };
            } else {
                this.showToast("Il blocco popup ha impedito l'apertura. Consenti i popup per questa pagina.", "error");
            }

        } catch (error) {
            console.error("Errore fetch export:", error);
            this.showToast("Errore durante la creazione del report", "error");
        }
    }
};

window.BambiniModule = BambiniModule;
