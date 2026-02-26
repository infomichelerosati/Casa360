// js/finanze.js

let finanzeSubscription = null;
let finanzeMembersMap = {};

const CAT_COLORS = {
    'Spesa': 'text-green-400 bg-green-500/10',
    'Bollette': 'text-red-400 bg-red-500/10',
    'Bambini': 'text-purple-400 bg-purple-500/10',
    'Svago': 'text-yellow-400 bg-yellow-500/10',
    'Altro': 'text-gray-400 bg-gray-500/10'
};

const CAT_ICONS = {
    'Spesa': 'fa-cart-shopping',
    'Bollette': 'fa-bolt',
    'Bambini': 'fa-child',
    'Svago': 'fa-gamepad',
    'Altro': 'fa-receipt'
};

async function initFinanze() {
    console.log("Inizializzazione Modulo Finanze...");

    // UI Mese
    const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    document.getElementById('fin-month-label').textContent = `Spese di ${monthNames[new Date().getMonth()]}`;

    // Modale Binding
    const modal = document.getElementById('modal-add-expense');
    const modalContent = document.getElementById('modal-content-expense');
    const btnAdd = document.getElementById('btn-add-expense');
    const btnClose = document.getElementById('btn-close-expense-modal');
    const form = document.getElementById('form-add-expense');

    btnAdd.addEventListener('click', () => {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('translate-y-full');
    });

    const closeMod = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modalContent.classList.add('translate-y-full');
        form.reset();
    };

    btnClose.addEventListener('click', closeMod);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeMod();
    });

    form.addEventListener('submit', handleAddExpense);

    // Dati
    await fetchFinanzeMembers();
    await fetchExpenses();
    setupFinanzeRealtime();
}

async function fetchFinanzeMembers() {
    try {
        const { data, error } = await supabase.from('family_members').select('*');
        if (error) throw error;

        const selectBox = document.getElementById('exp-paidby');
        selectBox.innerHTML = ''; // reset
        finanzeMembersMap = {};

        data.forEach(m => {
            finanzeMembersMap[m.id] = m;
            const option = document.createElement('option');
            option.value = m.id;
            // Pre-seleziona Papà o primo membro come default
            option.textContent = m.name;
            selectBox.appendChild(option);
        });
    } catch (err) { }
}

async function fetchExpenses() {
    // Filtra per mese in corso
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    try {
        const { data, error } = await supabase
            .from('family_expenses')
            .select('*')
            .gte('date', firstDay)
            .order('date', { ascending: false });

        if (error) throw error;

        renderExpenses(data);
        calculateBalances(data);

    } catch (err) {
        console.error("Errore spese:", err);
    }
}

function renderExpenses(expenses) {
    const listEl = document.getElementById('expenses-list');
    listEl.innerHTML = '';

    if (expenses.length === 0) {
        listEl.innerHTML = `<div class="clay-item p-6 rounded-clay bg-darkblue-base text-center text-darkblue-icon text-sm shadow-inner">Nessuna spesa questo mese.</div>`;
        return;
    }

    expenses.forEach(exp => {
        const dateStr = new Date(exp.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
        const member = finanzeMembersMap[exp.paid_by];
        const memberName = member ? member.name : 'User';
        const cClass = CAT_COLORS[exp.category] || CAT_COLORS['Altro'];
        const iClass = CAT_ICONS[exp.category] || CAT_ICONS['Altro'];

        const html = `
            <div class="clay-item p-4 rounded-clay bg-darkblue-card flex items-center justify-between gap-4">
                
                <div class="w-12 h-12 rounded-full ${cClass} flex items-center justify-center shrink-0">
                    <i class="fa-solid ${iClass} text-xl"></i>
                </div>
                
                <div class="flex-1 overflow-hidden">
                    <h4 class="font-bold text-darkblue-heading leading-tight truncate px-1">${exp.description}</h4>
                    <span class="text-xs text-darkblue-icon font-medium mt-1 flex items-center gap-2">
                        <span><i class="fa-regular fa-calendar mr-1"></i>${dateStr}</span>
                        <span>•</span>
                        <span>Pagato da <b class="text-darkblue-text">${memberName}</b></span>
                    </span>
                </div>
                
                <div class="flex flex-col items-end shrink-0">
                    <span class="text-lg font-bold text-[#3b82f6]">- ${exp.amount} €</span>
                    <button onclick="deleteExpense('${exp.id}')" class="text-xs text-red-500/80 hover:text-red-500 mt-1 uppercase font-bold tracking-wider">Elimina</button>
                </div>
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });
}

function calculateBalances(expenses) {
    let total = 0;
    let paidByMember = {};

    // Inizializza i contatori per tutti i membri
    Object.keys(finanzeMembersMap).forEach(id => paidByMember[id] = 0);

    // Calcola totali
    expenses.forEach(exp => {
        const amt = parseFloat(exp.amount);
        total += amt;
        if (paidByMember[exp.paid_by] !== undefined) {
            paidByMember[exp.paid_by] += amt;
        }
    });

    // Aggiorna UI Totale
    document.getElementById('fin-total-amount').textContent = total.toFixed(2);

    // Genera UI "Chi ha pagato cosa"
    const balEl = document.getElementById('fin-balances');
    balEl.innerHTML = '';

    const memberIds = Object.keys(paidByMember);
    if (memberIds.length === 0 || total === 0) {
        balEl.innerHTML = '<span class="text-darkblue-icon text-sm">Nessuna transazione</span>';
        return;
    }

    // Dividiamo fifty-fifty o in parti uguali tra i membri attivi?
    // Costruiamo una mini-statistica su quanto hanno sborsato
    memberIds.forEach((id, index) => {
        const member = finanzeMembersMap[id];
        const spent = paidByMember[id];

        const html = `
            <div class="flex flex-col items-center">
                <div class="w-8 h-8 rounded-full bg-[${member.avatar_color}] text-white flex justify-center items-center text-xs font-bold shadow-md mb-1 border-2 border-darkblue-base">
                    ${member.name[0]}
                </div>
                <span class="text-xs font-bold text-darkblue-text">${spent.toFixed(2)}€</span>
            </div>
        `;
        balEl.insertAdjacentHTML('beforeend', html);

        // Aggiungi un separatore "VS" se non è l'ultimo
        if (index < memberIds.length - 1) {
            balEl.insertAdjacentHTML('beforeend', `<div class="w-[1px] h-8 bg-darkblue-icon/20"></div>`);
        }
    });
}

async function handleAddExpense(e) {
    e.preventDefault();
    const desc = document.getElementById('exp-desc').value;
    const amountStr = document.getElementById('exp-amount').value;
    const cat = document.getElementById('exp-category').value;
    const paidby = document.getElementById('exp-paidby').value;

    try {
        const familyId = await window.getUserFamilyId();
        if (!familyId) throw new Error("Utente non assegnato a nessuna famiglia.");

        const { error } = await supabase.from('family_expenses').insert([{
            family_id: familyId,
            description: desc,
            amount: parseFloat(amountStr),
            category: cat,
            paid_by: paidby
        }]);

        if (error) throw error;
        document.getElementById('btn-close-expense-modal').click();
    } catch (err) {
        alert("Errore inserimento spesa: " + err.message);
    }
}

window.deleteExpense = function (id) {
    if (window.showConfirmModal) {
        window.showConfirmModal("Rimuovi Spesa", "Vuoi cancellare questa transazione dal bilancio di classe?", async () => {
            await supabase.from('family_expenses').delete().eq('id', id);
        });
    }
}

function setupFinanzeRealtime() {
    if (finanzeSubscription) supabase.removeChannel(finanzeSubscription);

    finanzeSubscription = supabase
        .channel('public:family_expenses')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'family_expenses' }, payload => {
            fetchExpenses();
        })
        .subscribe();
}
