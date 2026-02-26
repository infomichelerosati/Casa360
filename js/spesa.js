// js/spesa.js

let spesaSubscription = null;
let currentIsUrgent = false;

// Funzione chiamata da app.js quando il modulo viene caricato
function initSpesa() {
    console.log("Inizializzazione Modulo Spesa...");

    // Binding UI
    const form = document.getElementById('form-spesa');
    const input = document.getElementById('input-spesa');
    const btnUrgente = document.getElementById('btn-urgente');

    // Toggle Urgenza
    btnUrgente.addEventListener('click', () => {
        currentIsUrgent = !currentIsUrgent;
        if (currentIsUrgent) {
            btnUrgente.classList.remove('text-darkblue-icon');
            btnUrgente.classList.add('text-red-500');
        } else {
            btnUrgente.classList.remove('text-red-500');
            btnUrgente.classList.add('text-darkblue-icon');
        }
    });

    // Submit Nuovo Prodotto
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemName = input.value.trim();
        if (!itemName) return;

        // Disabilita input durante salvataggio
        input.disabled = true;

        try {
            const user = await getLoggedUser();
            const familyId = await window.getUserFamilyId();

            if (!familyId) throw new Error("Utente non assegnato a nessuna famiglia.");

            const { error } = await supabase
                .from('shopping_list')
                .insert([
                    {
                        family_id: familyId,
                        item_name: itemName,
                        is_urgent: currentIsUrgent,
                        added_by: user ? user.id : null
                    }
                ]);

            if (error) throw error;

            // Reset Form (Il realtime aggiornerà la UI)
            input.value = '';
            currentIsUrgent = false;
            btnUrgente.classList.remove('text-red-500');
            btnUrgente.classList.add('text-darkblue-icon');

        } catch (err) {
            console.error("Errore aggiunta spesa:", err);
            alert("Errore Supabase: " + err.message);
        } finally {
            input.disabled = false;
            input.focus();
        }
    });

    // Caricamento Iniziale Dati
    fetchShoppingList();

    // Setup Supabase Realtime
    setupRealtimeSubscription();
}

async function fetchShoppingList() {
    try {
        const { data, error } = await supabase
            .from('shopping_list')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderList(data);
    } catch (err) {
        console.error("Errore fetch spesa:", err);
        document.getElementById('spesa-counter').textContent = "Errore di caricamento";
    }
}

function renderList(items) {
    const listDaComprare = document.getElementById('lista-da-comprare');
    const listComprati = document.getElementById('lista-comprati');

    listDaComprare.innerHTML = '';
    listComprati.innerHTML = '';

    let toBuyCount = 0;

    items.forEach(item => {
        const html = `
            <label class="clay-item flex items-center gap-4 p-4 rounded-clay bg-darkblue-card cursor-pointer group hover:brightness-110 transition-all">
                <div class="relative flex items-center justify-center w-6 h-6">
                    <input type="checkbox" onchange="toggleSpesaStatus('${item.id}', this.checked)" ${item.is_bought ? 'checked' : ''} class="clay-checkbox peer appearance-none w-6 h-6 rounded-full bg-darkblue-base cursor-pointer transition-all checked:bg-darkblue-accent flex-shrink-0">
                    <i class="fa-solid fa-check absolute text-white text-xs opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"></i>
                </div>
                <span class="font-medium flex-1 transition-colors ${item.is_bought ? 'line-through opacity-50 text-darkblue-icon' : 'text-darkblue-text group-hover:text-darkblue-heading'}">${item.item_name}</span>
                
                ${item.is_urgent && !item.is_bought ? '<span class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>' : ''}
                
                <!-- Pulsante Elimina -->
                <button type="button" onclick="deleteSpesaItem(event, '${item.id}')" class="w-8 h-8 rounded-full flex items-center justify-center text-darkblue-icon hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <i class="fa-regular fa-trash-can text-sm"></i>
                </button>
            </label>
        `;

        if (item.is_bought) {
            listComprati.insertAdjacentHTML('beforeend', html);
        } else {
            toBuyCount++;
            listDaComprare.insertAdjacentHTML('beforeend', html);
        }
    });

    if (listDaComprare.children.length === 0) listDaComprare.innerHTML = '<div class="text-center text-darkblue-icon text-sm py-4 italic">Hai comprato tutto! 🎉</div>';
    if (listComprati.children.length === 0) listComprati.innerHTML = '';

    document.getElementById('spesa-counter').textContent = `${toBuyCount} elementi da comprare`;
}

// Global scope functions for inline HTML event handlers
window.toggleSpesaStatus = async function (id, isBought) {
    // Aggiornamento ottimistico disabilitato per semplicità, ci affidiamo al realtime 
    // o forziamo l'aggiornamento. In produzione un update ottimistico è preferibile.
    try {
        const { error } = await supabase
            .from('shopping_list')
            .update({ is_bought: isBought })
            .eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error("Update error:", err);
        fetchShoppingList(); // revert on error
    }
};

window.deleteSpesaItem = function (event, id) {
    event.preventDefault(); // prevents checkbox toggle
    if (window.showConfirmModal) {
        window.showConfirmModal("Elimina Prodotto", "Vuoi rimuovere l'elemento dalla spesa?", async () => {
            try {
                const { error } = await supabase.from('shopping_list').delete().eq('id', id);
                if (error) throw error;
            } catch (err) { console.error("Delete error:", err); }
        });
    } else {
        if (!confirm("Vuoi eliminare questo elemento?")) return;
        supabase.from('shopping_list').delete().eq('id', id);
    }
};


function setupRealtimeSubscription() {
    // Pulisce l'eventuale sottoscrizione esistente se ricarico il modulo
    if (spesaSubscription) {
        supabase.removeChannel(spesaSubscription);
    }

    spesaSubscription = supabase
        .channel('public:shopping_list')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list' }, payload => {
            console.log('Realtime change received!', payload);
            fetchShoppingList(); // Ricarica tutta la lista (semplice per ora, ottimizzabile aggiornando solo l'elemento DOM)
        })
        .subscribe();
}

// Hook pulizia quando si esce dal modulo
function cleanupSpesa() {
    if (spesaSubscription) {
        supabase.removeChannel(spesaSubscription);
        spesaSubscription = null;
    }
}
