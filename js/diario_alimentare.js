// js/diario_alimentare.js

window.diarioAlimentareModule = (function() {
    let currentMemberId = null;
    let selectedDate = new Date();
    let members = [];
    let entries = [];
    let waterLogs = [];
    let familyId = null;

    const DOM = {};

    async function init() {
        console.log("Diario Alimentare: Initializing...");
        
        // Map DOM
        DOM.memberSelector = document.getElementById('diary-member-selector');
        DOM.contentArea = document.getElementById('diary-content-area');
        DOM.emptyState = document.getElementById('diary-empty-state');
        DOM.timeline = document.getElementById('diary-timeline');
        DOM.emptyTimeline = document.getElementById('diary-empty-timeline');
        DOM.waterCount = document.getElementById('water-count');
        DOM.waterRing = document.getElementById('water-percentage-ring');
        DOM.dateDisplay = document.getElementById('diary-current-date');
        DOM.dateFormatted = document.getElementById('diary-formatted-date');

        // Buttons
        DOM.btnAddMeal = document.getElementById('btn-add-meal');
        DOM.btnAddWater = document.getElementById('btn-add-water');
        DOM.btnPrevDay = document.getElementById('btn-prev-day');
        DOM.btnNextDay = document.getElementById('btn-next-day');
        DOM.btnExportWeekly = document.getElementById('btn-export-weekly');
        DOM.btnExportTotal = document.getElementById('btn-export-total');
        DOM.btnImportFromPasti = document.getElementById('btn-import-from-pasti');

        // Modals
        DOM.modalMeal = document.getElementById('modal-diary-meal');
        DOM.modalMealContent = document.getElementById('modal-content-diary-meal');
        DOM.btnCloseMeal = document.getElementById('btn-close-diary-meal');
        DOM.formMeal = document.getElementById('form-diary-meal');

        setupEventListeners();
        
        familyId = await window.getUserFamilyId();
        await loadMembers();
        
        updateDateDisplay();
        
        // Seleziona il membro corrente (utente loggato) di default
        const { data: { user } } = await window.supabase.auth.getUser();
        const currentMember = members.find(m => m.id === user.id);
        
        if (currentMember) {
            selectMember(currentMember.id);
        } else if (members.length > 0) {
            selectMember(members[0].id);
        }

        setupRealtime();
    }

    function setupEventListeners() {
        DOM.btnPrevDay.addEventListener('click', () => {
            selectedDate.setDate(selectedDate.getDate() - 1);
            updateDateDisplay();
            loadData();
        });

        DOM.btnNextDay.addEventListener('click', () => {
            selectedDate.setDate(selectedDate.getDate() + 1);
            updateDateDisplay();
            loadData();
        });

        DOM.btnAddMeal.addEventListener('click', openMealModal);
        DOM.btnCloseMeal.addEventListener('click', closeMealModal);
        DOM.btnAddWater.addEventListener('click', addWater);
        
        DOM.formMeal.addEventListener('submit', saveMeal);
        
        DOM.btnExportWeekly.addEventListener('click', () => exportPDF('weekly'));
        DOM.btnExportTotal.addEventListener('click', () => exportPDF('total'));
        
        DOM.btnImportFromPasti.addEventListener('click', importFromPasti);

        // Close modal on swipe down
        let touchStartY = 0;
        DOM.modalMealContent.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, {passive: true});
        DOM.modalMealContent.addEventListener('touchend', e => {
            let touchEndY = e.changedTouches[0].clientY;
            if(touchEndY - touchStartY > 100) { closeMealModal(); }
        }, {passive: true});
    }

    async function loadMembers() {
        try {
            const { data, error } = await window.supabase
                .from('family_members')
                .select('*')
                .order('name');
            
            if (error) throw error;
            members = data || [];
            renderMemberSelector();
        } catch (e) {
            console.error("Error loading members:", e);
        }
    }

    function renderMemberSelector() {
        DOM.memberSelector.innerHTML = members.map(m => `
            <button onclick="window.diarioAlimentareModule.selectMember('${m.id}')" 
                class="flex flex-col items-center gap-2 min-w-[70px] transition-all member-chip" 
                id="chip-${m.id}">
                <div class="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg border-4 border-transparent transition-all chip-avatar" 
                    style="background-color: ${m.avatar_color || '#3b82f6'}">
                    ${m.name.charAt(0).toUpperCase()}
                </div>
                <span class="text-[10px] font-bold text-darkblue-heading uppercase tracking-wider">${m.name}</span>
            </button>
        `).join('');
    }

    function selectMember(id) {
        currentMemberId = id;
        
        // UI updates
        document.querySelectorAll('.member-chip').forEach(c => {
            c.querySelector('.chip-avatar').classList.remove('border-white', 'scale-110');
            c.querySelector('.chip-avatar').classList.add('opacity-60');
        });
        const activeChip = document.getElementById(`chip-${id}`);
        if (activeChip) {
            activeChip.querySelector('.chip-avatar').classList.add('border-white', 'scale-110');
            activeChip.querySelector('.chip-avatar').classList.remove('opacity-60');
        }

        DOM.emptyState.classList.add('hidden');
        DOM.contentArea.classList.remove('hidden');
        DOM.contentArea.classList.add('flex');

        loadData();
    }

    function updateDateDisplay() {
        const today = new Date();
        const isToday = selectedDate.toDateString() === today.toDateString();
        const isYesterday = new Date(today.setDate(today.getDate() - 1)).toDateString() === selectedDate.toDateString();
        
        today.setDate(today.getDate() + 1); // restore today
        
        if (isToday) DOM.dateDisplay.textContent = "Oggi";
        else if (isYesterday) DOM.dateDisplay.textContent = "Ieri";
        else DOM.dateDisplay.textContent = selectedDate.toLocaleDateString('it-IT', { weekday: 'long' });

        DOM.dateFormatted.textContent = selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    async function loadData() {
        if (!currentMemberId) return;

        const dateStr = selectedDate.toISOString().split('T')[0];

        try {
            // Load Entries
            const { data: entriesData, error: entriesErr } = await window.supabase
                .from('food_diary_entries')
                .select('*')
                .eq('member_id', currentMemberId)
                .eq('entry_date', dateStr)
                .order('created_at', { ascending: true });

            if (entriesErr) throw entriesErr;
            entries = entriesData || [];

            // Load Water
            const { data: waterData, error: waterErr } = await window.supabase
                .from('food_diary_water')
                .select('glasses')
                .eq('member_id', currentMemberId)
                .eq('entry_date', dateStr);

            if (waterErr) throw waterErr;
            waterLogs = waterData || [];

            renderTimeline();
            renderWater();
        } catch (e) {
            console.error("Error loading diary data:", e);
        }
    }

    function renderTimeline() {
        if (entries.length === 0) {
            DOM.emptyTimeline.classList.remove('hidden');
            DOM.timeline.innerHTML = '';
            return;
        }

        DOM.emptyTimeline.classList.add('hidden');

        // Ordinamento logico per tipo di pasto
        const order = ['Colazione', 'Spuntino Mattina', 'Pranzo', 'Merenda', 'Cena', 'Dopocena'];
        const sortedEntries = [...entries].sort((a, b) => order.indexOf(a.meal_type) - order.indexOf(b.meal_type));

        DOM.timeline.innerHTML = sortedEntries.map(entry => {
            const time = entry.meal_time ? entry.meal_time.substring(0, 5) : new Date(entry.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            const emoji = getMealEmoji(entry.meal_type);
            const hungerLabels = ["", "Per nulla", "Quasi nulla", "Sazio", "Soddisfatto", "Equilibrato", "Appetito", "Fame", "Molta Fame", "Fame Chimica", "Incontenibile"];
            
            return `
                <div class="clay-card bg-darkblue-card rounded-3xl p-4 flex gap-4 relative group animate-fade-in">
                    <div class="flex flex-col items-center shrink-0 w-12">
                        <div class="w-10 h-10 rounded-full bg-darkblue-base flex items-center justify-center text-xl shadow-inner">
                            ${emoji}
                        </div>
                        <div class="h-full w-0.5 bg-darkblue-base/30 my-2"></div>
                        <span class="text-[9px] font-bold text-darkblue-icon/60">${time}</span>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start mb-1">
                            <div class="flex flex-col">
                                <h4 class="text-xs font-bold text-darkblue-accent uppercase tracking-wider">${entry.meal_type}</h4>
                                ${entry.location ? `<span class="text-[9px] text-darkblue-icon/60 font-medium"><i class="fa-solid fa-location-dot mr-1"></i>${entry.location}</span>` : ''}
                            </div>
                            <button onclick="window.diarioAlimentareModule.deleteEntry('${entry.id}')" class="text-red-500/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>
                        <p class="text-darkblue-heading font-bold text-sm mb-1">${entry.foods}</p>
                        ${entry.quantity ? `<p class="text-[10px] text-darkblue-icon font-medium mb-1"><i class="fa-solid fa-scale-balanced mr-1"></i> ${entry.quantity}</p>` : ''}
                        
                        <div class="flex flex-wrap gap-2 mt-2">
                            ${entry.is_cheat_meal ? `<span class="bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-orange-500/20">🔥 Sgarro</span>` : ''}
                            ${entry.hunger_level ? `<span class="bg-darkblue-base text-darkblue-icon px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-darkblue-card">${hungerLabels[entry.hunger_level]}</span>` : ''}
                            ${entry.calories ? `<span class="bg-darkblue-base text-darkblue-icon px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-darkblue-card">${entry.calories} kcal</span>` : ''}
                        </div>

                        ${entry.notes ? `<p class="text-[10px] text-darkblue-icon/60 italic mt-2 border-t border-darkblue-card pt-2">"${entry.notes}"</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderWater() {
        const totalGlasses = waterLogs.reduce((sum, log) => sum + log.glasses, 0);
        DOM.waterCount.textContent = totalGlasses;
        
        // Obiettivo 8 bicchieri
        const percentage = Math.min((totalGlasses / 8) * 100, 100);
        const rotation = (percentage / 100) * 360;
        DOM.waterRing.style.transform = `rotate(${rotation}deg)`;
        
        if (percentage >= 100) {
            DOM.waterRing.classList.remove('border-t-blue-500');
            DOM.waterRing.classList.add('border-green-500', 'border-4');
        } else {
            DOM.waterRing.classList.add('border-t-blue-500');
            DOM.waterRing.classList.remove('border-green-500', 'border-4');
        }
    }

    function getMealEmoji(type) {
        switch(type) {
            case 'Colazione': return '☕';
            case 'Spuntino Mattina': return '🍎';
            case 'Pranzo': return '🍝';
            case 'Merenda': return '🥪';
            case 'Cena': return '🍗';
            case 'Dopocena': return '🍵';
            default: return '🍴';
        }
    }

    // MODAL LOGIC
    function openMealModal() {
        DOM.formMeal.reset();
        
        // Pre-fill current time
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        document.getElementById('dm-time').value = timeStr;
        document.getElementById('dm-hunger-val').textContent = "5";
        
        DOM.modalMeal.classList.remove('opacity-0', 'pointer-events-none');
        DOM.modalMealContent.classList.remove('translate-y-full');
    }

    function closeMealModal() {
        DOM.modalMeal.classList.add('opacity-0', 'pointer-events-none');
        DOM.modalMealContent.classList.add('translate-y-full');
    }

    async function saveMeal(e) {
        e.preventDefault();
        if (!currentMemberId || !familyId) return;

        const formData = {
            family_id: familyId,
            member_id: currentMemberId,
            entry_date: selectedDate.toISOString().split('T')[0],
            meal_type: document.getElementById('dm-type').value,
            foods: document.getElementById('dm-foods').value,
            quantity: document.getElementById('dm-quantity').value || null,
            calories: parseInt(document.getElementById('dm-calories').value) || null,
            hunger_level: parseInt(document.getElementById('dm-hunger').value),
            meal_time: document.getElementById('dm-time').value || null,
            location: document.getElementById('dm-location').value || null,
            is_cheat_meal: document.getElementById('dm-cheat').checked,
            notes: document.getElementById('dm-notes').value || null
        };

        try {
            const { error } = await window.supabase
                .from('food_diary_entries')
                .insert([formData]);

            if (error) throw error;
            
            window.showToast("Pasto registrato!", "success");
            closeMealModal();
            loadData();
        } catch (e) {
            console.error("Error saving meal:", e);
            window.showToast("Errore durante il salvataggio", "error");
        }
    }

    async function addWater() {
        if (!currentMemberId || !familyId) return;

        const dateStr = selectedDate.toISOString().split('T')[0];

        try {
            const { error } = await window.supabase
                .from('food_diary_water')
                .insert([{
                    family_id: familyId,
                    member_id: currentMemberId,
                    entry_date: dateStr,
                    glasses: 1
                }]);

            if (error) throw error;
            
            // Animazione tattile sul tasto
            DOM.btnAddWater.classList.add('scale-125');
            setTimeout(() => DOM.btnAddWater.classList.remove('scale-125'), 200);
            
            loadData();
        } catch (e) {
            console.error("Error saving water:", e);
        }
    }

    async function deleteEntry(id) {
        if (!window.showConfirmModal) return;
        
        window.showConfirmModal("Elimina Voce", "Sei sicuro di voler eliminare questo pasto dal diario?", async () => {
            try {
                const { error } = await window.supabase
                    .from('food_diary_entries')
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;
                window.showToast("Voce eliminata", "success");
                loadData();
            } catch (e) {
                console.error("Error deleting entry:", e);
            }
        });
    }

    async function importFromPasti() {
        const dateStr = selectedDate.toISOString().split('T')[0];
        
        try {
            const { data, error } = await window.supabase
                .from('meal_plan')
                .select('*, family_recipes(name)')
                .eq('planned_date', dateStr);

            if (error) throw error;
            
            if (!data || data.length === 0) {
                window.showToast("Nessun pasto pianificato per oggi", "info");
                return;
            }

            // Mostriamo una lista rapida da importare? O importiamo tutto?
            // Per semplicità, se ce n'è uno solo per quel tipo di pasto o se vogliamo solo "riempire" il campo food
            let summary = data.map(p => p.recipe_id ? p.family_recipes.name : p.custom_meal_name).join(", ");
            
            const currentFoods = document.getElementById('dm-foods').value;
            document.getElementById('dm-foods').value = (currentFoods ? currentFoods + ", " : "") + summary;
            
            window.showToast("Importato da Piano Pasti!", "success");
        } catch (e) {
            console.error("Error importing from pasti:", e);
        }
    }

    async function exportPDF(type) {
        if (!currentMemberId) return;

        const member = members.find(m => m.id === currentMemberId);
        window.showToast("Generazione PDF in corso...", "info");

        try {
            let query = window.supabase.from('food_diary_entries').select('*').eq('member_id', currentMemberId).order('entry_date', { ascending: false });
            
            if (type === 'weekly') {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                query = query.gte('entry_date', oneWeekAgo.toISOString().split('T')[0]);
            }

            const { data: allEntries, error: errE } = await query;
            const { data: allWater, error: errW } = await window.supabase.from('food_diary_water').select('*').eq('member_id', currentMemberId);
            
            // Recupera anche sport
            let sportQuery = window.supabase.from('sport_activities').select('*').eq('member_id', currentMemberId).eq('is_completed', true);
            if (type === 'weekly') {
                 const oneWeekAgo = new Date();
                 oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                 sportQuery = sportQuery.gte('activity_date', oneWeekAgo.toISOString().split('T')[0]);
            }
            const { data: allSport, error: errS } = await sportQuery;

            if (errE || errW || errS) throw (errE || errW || errS);

            // Raggruppa per data
            const diaryByDate = {};
            allEntries.forEach(e => {
                if (!diaryByDate[e.entry_date]) diaryByDate[e.entry_date] = { meals: [], water: 0, sport: [] };
                diaryByDate[e.entry_date].meals.push(e);
            });
            allWater.forEach(w => {
                if (!diaryByDate[w.entry_date]) diaryByDate[w.entry_date] = { meals: [], water: 0, sport: [] };
                diaryByDate[w.entry_date].water += w.glasses;
            });
            allSport.forEach(s => {
                if (!diaryByDate[s.activity_date]) diaryByDate[s.activity_date] = { meals: [], water: 0, sport: [] };
                diaryByDate[s.activity_date].sport.push(s);
            });

            const sortedDates = Object.keys(diaryByDate).sort((a, b) => new Date(b) - new Date(a));

            // Crea il container temporaneo per html2pdf
            const container = document.createElement('div');
            container.style.padding = '20px'; // Ridotto padding per guadagnare spazio
            container.style.backgroundColor = '#fff';
            container.style.color = '#333';
            container.style.fontFamily = 'Arial, sans-serif';
            container.style.width = '700px'; // Larghezza ottimale per A4 verticale

            let html = `
                <div style="border-bottom: 3px solid #3b82f6; padding-bottom: 20px; mb-30px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1 style="margin: 0; color: #1a2235; font-size: 28px;">Diario Alimentare</h1>
                        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Family OS - Report Nutrizionale</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; color: #3b82f6;">${member.name}</h2>
                        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">Generato il ${new Date().toLocaleDateString('it-IT')}</p>
                    </div>
                </div>
                
                <div style="margin-top: 30px;">
                    <p style="font-size: 14px; font-weight: bold; color: #3b82f6; text-transform: uppercase;">Riepilogo ${type === 'weekly' ? 'Settimanale' : 'Completo'}</p>
                </div>
            `;

            sortedDates.forEach(date => {
                const dayData = diaryByDate[date];
                const dateObj = new Date(date);
                const formattedDate = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                
                html += `
                    <div style="margin-top: 25px; page-break-inside: avoid;">
                        <h3 style="background: #f1f5f9; padding: 10px 15px; border-radius: 8px; font-size: 16px; color: #1e293b; margin-bottom: 10px;">${formattedDate}</h3>
                        <div style="padding-left: 10px;">
                            <div style="display: flex; gap: 20px; margin-bottom: 10px;">
                                <p style="font-size: 12px; color: #3b82f6; font-weight: bold; margin: 0;">💧 Acqua: ${dayData.water} bicchieri (${(dayData.water * 0.25).toFixed(1)}L)</p>
                                ${dayData.sport.length > 0 ? `
                                    <p style="font-size: 12px; color: #f97316; font-weight: bold; margin: 0;">
                                        🏃 Sport: ${dayData.sport.map(s => {
                                            let details = s.sport_name;
                                            if (s.start_time && s.end_time) {
                                                const start = new Date(`2000-01-01T${s.start_time}`);
                                                const end = new Date(`2000-01-01T${s.end_time}`);
                                                const diff = (end - start) / (1000 * 60);
                                                if (diff > 0) {
                                                    const h = Math.floor(diff / 60);
                                                    const m = Math.floor(diff % 60);
                                                    details += ` (${h > 0 ? h + 'h ' : ''}${m}m)`;
                                                }
                                            }
                                            if (s.calories) details += ` - ${s.calories} kcal`;
                                            return details;
                                        }).join(', ')}
                                    </p>` : ''}
                            </div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;">
                                <thead>
                                    <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; color: #64748b;">
                                        <th style="padding: 8px 0; width: 60px;">Ora</th>
                                        <th style="padding: 8px 0; width: 70px;">Pasto</th>
                                        <th style="padding: 8px 0; width: 180px;">Alimenti / Luogo</th>
                                        <th style="padding: 8px 0; width: 60px;">Qtà</th>
                                        <th style="padding: 8px 0; width: 40px;">Fame</th>
                                        <th style="padding: 8px 0; width: 130px;">Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;

                const order = ['Colazione', 'Spuntino Mattina', 'Pranzo', 'Merenda', 'Cena', 'Dopocena'];
                dayData.meals.sort((a, b) => order.indexOf(a.meal_type) - order.indexOf(b.meal_type)).forEach(m => {
                    html += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px 5px 10px 0; vertical-align: top; word-wrap: break-word;">${m.meal_time ? m.meal_time.substring(0, 5) : '-'}</td>
                            <td style="padding: 10px 5px 10px 0; font-weight: bold; vertical-align: top; word-wrap: break-word;">${m.meal_type}</td>
                            <td style="padding: 10px 5px 10px 0; vertical-align: top; word-wrap: break-word;">
                                <div style="font-weight: 500;">${m.foods}</div>
                                ${m.location ? `<div style="font-size: 9px; color: #64748b; margin-top: 2px;">📍 ${m.location}</div>` : ''}
                                ${m.is_cheat_meal ? '<span style="color: #f97316; font-weight: bold; font-size: 9px;">(SGARRO)</span>' : ''}
                            </td>
                            <td style="padding: 10px 5px 10px 0; vertical-align: top; word-wrap: break-word;">${m.quantity || '-'}</td>
                            <td style="padding: 10px 5px 10px 0; vertical-align: top; word-wrap: break-word;">${m.hunger_level || '-'}</td>
                            <td style="padding: 10px 5px 10px 0; vertical-align: top; word-wrap: break-word; font-style: italic; color: #64748b;">${m.notes || ''}</td>
                        </tr>
                    `;
                });

                html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });

            html += `
                <div style="margin-top: 50px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    Report generato automaticamente da Family OS - Your Family Digital Home
                </div>
            `;

            container.innerHTML = html;
            
            const options = {
                margin: 10,
                filename: `Diario_Alimentare_${member.name}_${type}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            await window.html2pdf().set(options).from(container).save();
            window.showToast("PDF generato con successo!", "success");

        } catch (e) {
            console.error("PDF Export Error:", e);
            window.showToast("Errore durante la generazione del PDF", "error");
        }
    }

    function setupRealtime() {
        if (!window.supabase) return;
        
        window.supabase.channel('diary_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'food_diary_entries' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'food_diary_water' }, () => loadData())
            .subscribe();
    }

    return {
        init,
        selectMember,
        deleteEntry
    };
})();
