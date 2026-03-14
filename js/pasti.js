// js/pasti.js

let currentWeekStartDate = null;
let recipesData = [];
let mealPlanData = [];

// DOM Elements (will be mapped in initPasti)
const DOM = {};

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
}

function formatDateForDB(date) {
    return date.toISOString().split('T')[0];
}

function formatDateForDisplay(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'short' };
    let formatted = date.toLocaleDateString('it-IT', options);
    // Capitalize first letter
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getDayName(date) {
    const options = { weekday: 'long' };
    let formatted = date.toLocaleDateString('it-IT', options);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// -------------------------------------------------------------
// INIZIALIZZAZIONE & EVENT LISTENERS
// -------------------------------------------------------------

async function initPasti() {
    console.log("Inizializzazione Modulo Pasti & Dispensa...");
    
    // Auth Check (Using standard supabase auth check if checkAuth is not global)
    let user = null;
    if (typeof checkAuth === 'function') {
        user = await checkAuth();
    } else {
        const { data } = await window.supabase.auth.getUser();
        user = data?.user;
    }
    
    if (!user) {
        console.error("Utente non autenticato per initPasti");
        return;
    }

    // Map DOM Elements
    DOM.weekDisplay = document.getElementById('pasti-week-display');
    DOM.btnPrevWeek = document.getElementById('btn-pasti-prev-week');
    DOM.btnNextWeek = document.getElementById('btn-pasti-next-week');
    DOM.calendarContainer = document.getElementById('pasti-calendar-container');
    
    DOM.recipesGrid = document.getElementById('pasti-recipes-grid');
    DOM.btnAddRecipe = document.getElementById('btn-add-recipe');
    DOM.searchInput = document.getElementById('recipe-search');
    DOM.recipeSort = document.getElementById('recipe-sort');
    
    DOM.btnGenerateSpesa = document.getElementById('btn-generate-spesa');

    // Modals
    DOM.modalNewRecipe = document.getElementById('modal-new-recipe');
    DOM.modalSelectMeal = document.getElementById('modal-select-meal');
    DOM.modalSelectMealContent = document.getElementById('modal-select-meal-content');
    DOM.modalGenerateSpesa = document.getElementById('modal-generate-spesa');

    // Set Init Date (Monday of current week)
    const today = new Date();
    currentWeekStartDate = getStartOfWeek(today);

    // Setup Listeners
    setupPastiEventListeners();

    // Load Data
    await loadRecipes();
    updateCalendarUI(); // Render empty calendar with dates first
    await loadMealPlan();
    
    // Set up Realtime
    setupPastiRealtime();
}

function setupPastiEventListeners() {
    // Navigation
    DOM.btnPrevWeek.addEventListener('click', () => {
        currentWeekStartDate.setDate(currentWeekStartDate.getDate() - 7);
        reloadCalendar();
    });

    DOM.btnNextWeek.addEventListener('click', () => {
        currentWeekStartDate.setDate(currentWeekStartDate.getDate() + 7);
        reloadCalendar();
    });

    // Recipes List
    DOM.btnAddRecipe.addEventListener('click', openNewRecipeModal);
    DOM.searchInput.addEventListener('input', (e) => filterRecipes(e.target.value));
    if(DOM.recipeSort) {
        DOM.recipeSort.addEventListener('change', () => filterRecipes(DOM.searchInput.value));
    }

    // New Recipe Modal Actions
    document.getElementById('btn-add-ingredient-row').addEventListener('click', addIngredientRow);
    document.getElementById('btn-new-recipe-cancel').addEventListener('click', closeNewRecipeModal);
    document.getElementById('btn-new-recipe-save').addEventListener('click', saveNewRecipe);
    
    // Meal Selection Modal Actions
    document.getElementById('btn-select-meal-close').addEventListener('click', closeSelectMealModal);
    document.getElementById('btn-save-custom-meal').addEventListener('click', saveCustomMeal);
    document.getElementById('btn-clear-meal').addEventListener('click', clearMealSlot);

    // Gestione Swipe down per chiudere modale Meal Selection
    let touchStartY = 0;
    DOM.modalSelectMealContent.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, {passive: true});
    DOM.modalSelectMealContent.addEventListener('touchend', e => {
        let touchEndY = e.changedTouches[0].clientY;
        if(touchEndY - touchStartY > 50) { closeSelectMealModal(); }
    }, {passive: true});

    // Generate List Actions
    DOM.btnGenerateSpesa.addEventListener('click', openGenerateSpesaModal);
    document.getElementById('btn-cancel-spesa').addEventListener('click', closeGenerateSpesaModal);
    document.getElementById('btn-confirm-spesa').addEventListener('click', confirmGenerateSpesa);
}

// -------------------------------------------------------------
// CORE DATA LOADING
// -------------------------------------------------------------

async function reloadCalendar() {
    updateCalendarUI();
    await loadMealPlan();
}

async function loadRecipes() {
    try {
        const { data, error } = await window.supabase
            .from('family_recipes')
            .select('*, recipe_ingredients(*)')
            .order('name');

        if (error) throw error;
        recipesData = data || [];
        renderRecipesGrid(recipesData);
    } catch (e) {
        console.error("Errore nel caricamento ricette:", e);
        window.showToast("Errore di caricamento ricettario", "error");
    }
}

async function loadMealPlan() {
    // Calcoliamo la fine della settimana (Domenica)
    let endDate = new Date(currentWeekStartDate);
    endDate.setDate(endDate.getDate() + 6);

    try {
        const { data, error } = await window.supabase
            .from('meal_plan')
            .select(`*, family_recipes(name, emoji)`)
            .gte('planned_date', formatDateForDB(currentWeekStartDate))
            .lte('planned_date', formatDateForDB(endDate));

        if (error) throw error;
        mealPlanData = data || [];
        populateCalendarData();
    } catch (e) {
        console.error("Errore nel caricamento piano pasti:", e);
        window.showToast("Impossibile caricare il piano dei pasti", "error");
    }
}

// -------------------------------------------------------------
// UI RENDERING - CALENDAR
// -------------------------------------------------------------

function updateCalendarUI() {
    // Update Header
    let endDate = new Date(currentWeekStartDate);
    endDate.setDate(endDate.getDate() + 6);
    
    const optionsShort = { day: 'numeric', month: 'short' };
    DOM.weekDisplay.innerHTML = `${currentWeekStartDate.toLocaleDateString('it-IT', optionsShort)} - ${endDate.toLocaleDateString('it-IT', optionsShort)}`;

    // Build Empty Grid
    DOM.calendarContainer.innerHTML = '';
    
    let currentDate = new Date(currentWeekStartDate);
    const todayStr = formatDateForDB(new Date());

    for (let i = 0; i < 7; i++) {
        const dateStr = formatDateForDB(currentDate);
        const dayName = getDayName(currentDate);
        const dateFormatted = `${currentDate.getDate()} ${currentDate.toLocaleDateString('it-IT', {month: 'short'})}`;
        
        const isToday = dateStr === todayStr;
        const dayIndicator = isToday ? `<span class="bg-orange-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ml-2">Oggi</span>` : '';

        const html = `
            <div class="bg-darkblue-base rounded-2xl p-3 border border-darkblue-card shadow-inner" data-date="${dateStr}">
                <div class="flex items-center justify-between mb-3 pl-1 border-b border-darkblue-card pb-2">
                    <div class="flex items-center">
                        <span class="font-bold text-darkblue-heading text-sm">${dayName}</span>
                        <span class="text-xs text-darkblue-icon ml-1">${dateFormatted}</span>
                        ${dayIndicator}
                    </div>
                </div>
                
                <div class="flex gap-2">
                    <!-- PRANZO -->
                    <button class="meal-slot flex-1 bg-darkblue-card rounded-xl p-2 flex flex-col items-center justify-center text-center transition-all hover:bg-darkblue-card/80 min-h-[70px] border border-transparent border-dashed"
                            onclick="openSelectMealModal('${dateStr}', 'Pranzo')" id="slot-${dateStr}-Pranzo">
                        <span class="text-[10px] font-bold text-darkblue-icon uppercase tracking-wide mb-1"><i class="fa-regular fa-sun text-yellow-500/70 mr-1"></i> Pranzo</span>
                        <div class="meal-content text-sm text-darkblue-icon/50 italic">Aggiungi...</div>
                    </button>

                    <!-- CENA -->
                    <button class="meal-slot flex-1 bg-darkblue-card rounded-xl p-2 flex flex-col items-center justify-center text-center transition-all hover:bg-darkblue-card/80 min-h-[70px] border border-transparent border-dashed"
                            onclick="openSelectMealModal('${dateStr}', 'Cena')" id="slot-${dateStr}-Cena">
                        <span class="text-[10px] font-bold text-darkblue-icon uppercase tracking-wide mb-1"><i class="fa-solid fa-moon text-blue-300/70 mr-1"></i> Cena</span>
                        <div class="meal-content text-sm text-darkblue-icon/50 italic">Aggiungi...</div>
                    </button>
                </div>
            </div>
        `;
        
        DOM.calendarContainer.insertAdjacentHTML('beforeend', html);
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

function populateCalendarData() {
    // Reset all slots to empty state
    document.querySelectorAll('.meal-slot').forEach(slot => {
        slot.classList.add('border-dashed', 'border-darkblue-icon/30');
        slot.classList.remove('bg-orange-500/10', 'border-orange-500/20');
        slot.querySelector('.meal-content').innerHTML = ``; // Clear list
        
        // Add default placeholder
        const html = `<div class="text-xs text-darkblue-icon/50 italic placeholder-text py-2">Aggiungi...</div>`;
        slot.querySelector('.meal-content').insertAdjacentHTML('beforeend', html);
    });

    // Populate with data mapping plans to their slots
    // Multiple plans can exist for the same slot (planned_date + meal_type)
    mealPlanData.forEach(plan => {
        const slotEl = document.getElementById(`slot-${plan.planned_date}-${plan.meal_type}`);
        if(slotEl) {
            slotEl.classList.remove('border-dashed', 'border-darkblue-icon/30');
            // Remove full orange bg, we'll style individual items instead
            
            const contentEl = slotEl.querySelector('.meal-content');
            
            // Remove placeholder if it exists
            const placeholder = contentEl.querySelector('.placeholder-text');
            if (placeholder) placeholder.remove();
            
            let itemHtml = '';
            
            if(plan.recipe_id && plan.family_recipes) {
                // Ricetta dal DB
                itemHtml = `
                    <div class="bg-darkblue-card relative border border-darkblue-icon/10 rounded-lg p-1.5 mb-1.5 flex items-center gap-2 group cursor-default text-left shadow-sm">
                        <span class="text-base">${plan.family_recipes.emoji}</span>
                        <span class="leading-tight text-xs font-bold text-darkblue-heading flex-1 truncate">${plan.family_recipes.name}</span>
                        <button class="w-5 h-5 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation(); clearMealSlot('${plan.id}')"><i class="fa-solid fa-times text-[10px]"></i></button>
                    </div>
                `;
            } else if (plan.custom_meal_name) {
                // Testo manuale
                itemHtml = `
                    <div class="bg-darkblue-card relative border border-darkblue-icon/10 rounded-lg p-1.5 mb-1.5 flex items-center gap-2 group cursor-default text-left shadow-sm">
                        <span class="text-base">🍴</span>
                        <span class="leading-tight text-xs font-bold text-darkblue-heading flex-1 truncate">${plan.custom_meal_name}</span>
                        <button class="w-5 h-5 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation(); clearMealSlot('${plan.id}')"><i class="fa-solid fa-times text-[10px]"></i></button>
                    </div>
                `;
            }

            contentEl.insertAdjacentHTML('beforeend', itemHtml);
            
            // Adjust the slot styles to look like a container
            slotEl.classList.add('bg-darkblue-base/50');
        }
    });
}

// -------------------------------------------------------------
// UI RENDERING - RECIPES
// -------------------------------------------------------------

function renderRecipesGrid(recipes) {
    DOM.recipesGrid.innerHTML = '';
    
    if(recipes.length === 0) {
        DOM.recipesGrid.innerHTML = `<div class="col-span-full text-center py-6 text-darkblue-icon text-sm">Nessuna ricetta salvata. Inizia dal tasto +</div>`;
        return;
    }

    // Sort logic based on dropdown
    const sortValue = DOM.recipeSort ? DOM.recipeSort.value : 'name_asc';
    
    const sortedRecipes = [...recipes].sort((a, b) => {
        if (sortValue === 'name_asc') {
            return a.name.localeCompare(b.name, 'it', { sensitivity: 'base' });
        } else if (sortValue === 'name_desc') {
            return b.name.localeCompare(a.name, 'it', { sensitivity: 'base' });
        } else if (sortValue === 'time_asc') {
            const timeA = a.prep_time_minutes || 999;
            const timeB = b.prep_time_minutes || 999;
            return timeA - timeB;
        } else if (sortValue === 'recent') {
            // we assume created_at is present from the * select
            return new Date(b.created_at) - new Date(a.created_at);
        }
        return 0;
    });

    sortedRecipes.forEach(recipe => {
        const ingCount = recipe.recipe_ingredients ? recipe.recipe_ingredients.length : 0;
        
        const html = `
            <div class="clay-card bg-darkblue-base rounded-2xl p-3 flex flex-col items-center text-center relative overflow-hidden group">
                <div class="text-3xl mb-1">${recipe.emoji || '🍽️'}</div>
                <h4 class="font-bold text-darkblue-heading text-sm mb-1 leading-tight line-clamp-2">${recipe.name}</h4>
                <div class="text-[10px] text-darkblue-icon font-medium mt-auto flex gap-2">
                   ${recipe.prep_time_minutes ? `<span><i class="fa-regular fa-clock"></i> ${recipe.prep_time_minutes}'</span>` : ''}
                   <span>${ingCount} ingr.</span>
                </div>
                <!-- Delete Button (Only on tap/hover) -->
                <button class="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center transform scale-90" onclick="deleteRecipe('${recipe.id}', event)">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        `;
        DOM.recipesGrid.insertAdjacentHTML('beforeend', html);
    });
}

function filterRecipes(term) {
    if(!term) {
        renderRecipesGrid(recipesData);
        return;
    }
    const lowerTerm = term.toLowerCase();
    const filtered = recipesData.filter(r => r.name.toLowerCase().includes(lowerTerm));
    renderRecipesGrid(filtered);
}

// -------------------------------------------------------------
// CRUD RECIPES
// -------------------------------------------------------------

function openNewRecipeModal() {
    document.getElementById('new-recipe-name').value = '';
    document.getElementById('new-recipe-emoji').value = '🍽️';
    document.getElementById('new-recipe-time').value = '';
    // Reset ingredients to 1 empty row
    const list = document.getElementById('new-recipe-ingredients-list');
    list.innerHTML = '';
    addIngredientRow();
    
    DOM.modalNewRecipe.classList.remove('opacity-0', 'pointer-events-none');
    DOM.modalNewRecipe.children[0].classList.remove('scale-95');
}

function closeNewRecipeModal() {
    DOM.modalNewRecipe.classList.add('opacity-0', 'pointer-events-none');
    DOM.modalNewRecipe.children[0].classList.add('scale-95');
}

function addIngredientRow() {
    const list = document.getElementById('new-recipe-ingredients-list');
    const html = `
        <div class="flex gap-2 items-center ingredient-row fade-in">
            <input type="text" placeholder="Nome (es. Uova)" class="flex-1 bg-darkblue-base text-darkblue-text rounded-xl p-2 text-sm border-none focus:ring-2 focus:ring-darkblue-accent shadow-inner outline-none ingredient-name">
            <input type="text" placeholder="Q.tà (Opz.)" class="w-20 bg-darkblue-base text-darkblue-text rounded-xl p-2 text-sm border-none focus:ring-2 focus:ring-darkblue-accent shadow-inner outline-none ingredient-qty">
            <button type="button" class="text-red-500 w-8 h-8 flex items-center justify-center hover:bg-red-500/20 rounded-full btn-remove-ingredient" onclick="this.parentElement.remove()"><i class="fa-solid fa-times"></i></button>
        </div>
    `;
    list.insertAdjacentHTML('beforeend', html);
}

async function saveNewRecipe() {
    const name = document.getElementById('new-recipe-name').value.trim();
    const emoji = document.getElementById('new-recipe-emoji').value.trim() || '🍽️';
    const time = document.getElementById('new-recipe-time').value;

    if (!name) {
        window.showToast("Inserisci il nome della ricetta", "error");
        return;
    }

    const { data: userData } = await window.supabase.auth.getUser();
    const familyId = await window.getUserFamilyId();

    if (!familyId) {
        window.showToast("Errore: Impossibile identificare la famiglia", "error");
        return;
    }
    
    // Raccogli ingredienti validi
    const ingredients = [];
    document.querySelectorAll('.ingredient-row').forEach(row => {
        const iName = row.querySelector('.ingredient-name').value.trim();
        const iQty = row.querySelector('.ingredient-qty').value.trim();
        if(iName) {
            ingredients.push({ ingredient_name: iName, quantity: iQty || null });
        }
    });

    try {
        // 1. Inserisci Ricetta
        const { data: recipeData, error: recipeErr } = await window.supabase
            .from('family_recipes')
            .insert([{ 
                family_id: familyId,
                name, 
                emoji, 
                prep_time_minutes: time ? parseInt(time) : null,
                created_by: userData.user.id
            }])
            .select()
            .single();

        if (recipeErr) throw recipeErr;

        // 2. Inserisci Ingredienti (se presenti)
        if (ingredients.length > 0) {
            const ingredientsToInsert = ingredients.map(i => ({
                family_id: familyId,
                recipe_id: recipeData.id,
                ingredient_name: i.ingredient_name,
                quantity: i.quantity
            }));
            
            const { error: ingErr } = await window.supabase
                .from('recipe_ingredients')
                .insert(ingredientsToInsert);
                
            if (ingErr) throw ingErr;
        }

        window.showToast("Ricetta salvata", "success");
        closeNewRecipeModal();
        // The realtime subscription will trigger loadRecipes()

    } catch (e) {
        console.error("Errore salvataggio ricetta:", e);
        window.showToast("Errore durante il salvataggio", "error");
    }
}

async function deleteRecipe(id, event) {
    event.stopPropagation();
    
    if(window.showConfirmModal) {
         window.showConfirmModal(
             "Elimina Ricetta", 
             "Sei sicuro di voler eliminare questa ricetta? Non sarà più disponibile nel ricettario.", 
             async () => {
                 try {
                     const { error } = await window.supabase.from('family_recipes').delete().eq('id', id);
                     if (error) throw error;
                     window.showToast("Ricetta eliminata", "success");
                     // Realtime will update UI
                 } catch (e) {
                     console.error("Delete error", e);
                     window.showToast("Errore eliminazione", "error");
                 }
             }
         );
    }
}

// -------------------------------------------------------------
// MEAL SELECTION (CALENDAR SLOTS)
// -------------------------------------------------------------

let currentSelectedSlot = { date: null, type: null };

function openSelectMealModal(dateStr, mealType) {
    currentSelectedSlot = { date: dateStr, type: mealType };
    
    // Update Header
    const d = new Date(dateStr);
    document.getElementById('select-meal-title').textContent = getDayName(d) + " " + d.getDate();
    document.getElementById('select-meal-subtitle').innerHTML = mealType === 'Pranzo' ? `<i class="fa-regular fa-sun text-yellow-500/70"></i> Pranzo` : `<i class="fa-solid fa-moon text-blue-300/70"></i> Cena`;
    
    // Reset inputs
    document.getElementById('custom-meal-input').value = '';
    
    // Rimosso il controllo e il bottone "Svuota questo pasto" 
    // Ora l'eliminazione avviene singolarmente da dentro il calendario
    const btnClear = document.getElementById('btn-clear-meal');
    if(btnClear) btnClear.classList.add('hidden');

    // Sort recipes for the modal selection list too
    const sortedSelectionRecipes = [...recipesData].sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));

    // Populate Recipes List for selection
    const listHtml = sortedSelectionRecipes.map(r => `
        <button class="bg-darkblue-base p-3 rounded-2xl text-left flex items-center justify-between hover:bg-darkblue-base/70 transition-colors border border-transparent hover:border-darkblue-accent/30"
                onclick="assignRecipeToSlot('${r.id}')">
            <div class="flex items-center gap-3">
                <span class="text-2xl">${r.emoji || '🍽️'}</span>
                <div>
                    <div class="font-bold text-darkblue-heading text-sm">${r.name}</div>
                    <div class="text-[10px] text-darkblue-icon">
                        ${r.recipe_ingredients ? r.recipe_ingredients.length + ' ingredienti' : 'Nessun ingrediente base salvato'}
                    </div>
                </div>
            </div>
            <i class="fa-solid fa-plus text-darkblue-accent"></i>
        </button>
    `).join('');
    
    document.getElementById('modal-recipes-list').innerHTML = listHtml || `<div class="text-center py-4 text-darkblue-icon text-sm">Nessuna ricetta disponibile. Creane una dal Ricettario!</div>`;

    // Open Modal (Slide up)
    DOM.modalSelectMeal.classList.remove('opacity-0', 'pointer-events-none');
    DOM.modalSelectMealContent.classList.remove('translate-y-full');
}

function closeSelectMealModal() {
    DOM.modalSelectMeal.classList.add('opacity-0', 'pointer-events-none');
    DOM.modalSelectMealContent.classList.add('translate-y-full');
    currentSelectedSlot = { date: null, type: null };
}

async function assignRecipeToSlot(recipeId) {
    if(!currentSelectedSlot.date || !currentSelectedSlot.type) return;

    const { data: userData } = await window.supabase.auth.getUser();
    const familyId = await window.getUserFamilyId();

    try {
        // Multi-course support: Always Insert (remove existingPlan check/update)
        const payload = {
            family_id: familyId,
            recipe_id: recipeId,
            custom_meal_name: null,
            planned_date: currentSelectedSlot.date,
            meal_type: currentSelectedSlot.type,
            created_by: userData.user.id
        };

        await window.supabase.from('meal_plan').insert([payload]);

        window.showToast("Pasto assegnato!", "success");
        closeSelectMealModal();
        // UI updates via Realtime
    } catch (e) {
        console.error("Errore assegnazione pasto:", e);
        window.showToast("Errore durante l'assegnazione", "error");
    }
}

async function saveCustomMeal() {
    const customName = document.getElementById('custom-meal-input').value.trim();
    if(!customName || !currentSelectedSlot.date || !currentSelectedSlot.type) return;

    const { data: userData } = await window.supabase.auth.getUser();
    const familyId = await window.getUserFamilyId();

    try {
        // Multi-course support: Always Insert (remove existingPlan check/update)
        const payload = {
            family_id: familyId,
            recipe_id: null,
            custom_meal_name: customName,
            planned_date: currentSelectedSlot.date,
            meal_type: currentSelectedSlot.type,
            created_by: userData.user.id
        };

        await window.supabase.from('meal_plan').insert([payload]);

        window.showToast("Pasto salvato nel calendario!", "success");
        closeSelectMealModal();
        
        // Wait a small delay then ask to save to recipe book
        setTimeout(() => {
            if (window.showConfirmModal) {
                 window.showConfirmModal(
                     "Aggiungi al Ricettario?", 
                     `Mangi spesso "${customName}"? Vuoi salvare questo piatto nel ricettario per le prossime volte (con relativi ingredienti)?`, 
                     () => {
                         openNewRecipeModal();
                         document.getElementById('new-recipe-name').value = customName;
                     }
                 );
            }
        }, 500);

    } catch (e) {
        console.error("Errore salvataggio pasto custom:", e);
        window.showToast("Errore durante il salvataggio", "error");
    }
}

async function clearMealSlot(planId) {
    try {
        await window.supabase.from('meal_plan').delete().eq('id', planId);
        window.showToast("Pasto rimosso", "success");
        closeSelectMealModal();
    } catch (e) {
        console.error("Errore rimozione pasto:", e);
        window.showToast("Errore durante la rimozione", "error");
    }
}

// -------------------------------------------------------------
// GENERATION DEL CARRELLO SPESA
// -------------------------------------------------------------

let currentGeneratedIngredients = [];

function openGenerateSpesaModal() {
    // 1. Raccogli tutti gli ID ricetta dal mealPlanData corrente (che rappresenta la settimana visualizzata)
    const recipeIdsInWeek = mealPlanData.map(p => p.recipe_id).filter(id => id !== null);
    
    if(recipeIdsInWeek.length === 0) {
        window.showToast("Nessuna ricetta pianificata per questa settimana", "info");
        return;
    }

    // 2. Estrai gli ingredienti da quelle ricette
    let allIngredients = [];
    recipeIdsInWeek.forEach(id => {
        const recipe = recipesData.find(r => r.id === id);
        if(recipe && recipe.recipe_ingredients) {
            allIngredients.push(...recipe.recipe_ingredients);
        }
    });

    if(allIngredients.length === 0) {
        window.showToast("Le ricette pianificate non hanno ingredienti base salvati", "info");
        return;
    }

    // 3. Raggruppa per nome, sommando (opzionale) o concatenando le quantità
    // Per semplicità qui creiamo una lista unica senza duplicati di nome
    // Se c'è "Passata" 2 volte, lo mettiamo 1 volta sola. Se hanno quantità diverse manteniamo la prima o le uniamo.
    const uniqueIngredientsMap = new Map();
    allIngredients.forEach(ing => {
        const nameKey = ing.ingredient_name.toLowerCase().trim();
        if(!uniqueIngredientsMap.has(nameKey)) {
            uniqueIngredientsMap.set(nameKey, { name: ing.ingredient_name, qty: ing.quantity ? [ing.quantity] : [] });
        } else {
            if(ing.quantity) uniqueIngredientsMap.get(nameKey).qty.push(ing.quantity);
        }
    });

    currentGeneratedIngredients = Array.from(uniqueIngredientsMap.values()).map(item => {
        const qtyStr = item.qty.length > 0 ? ` (${item.qty.join(', ')})` : '';
        return {
            name: item.name,
            qtyStr: qtyStr,
            selected: true // By default, all selected to be bought
        };
    });

    // 4. Renderizza la UI
    renderGeneratedSpesaList();

    // Apri Modale
    DOM.modalGenerateSpesa.classList.remove('opacity-0', 'pointer-events-none');
    DOM.modalGenerateSpesa.children[0].classList.remove('scale-95');
}

function renderGeneratedSpesaList() {
    const listContainer = document.getElementById('generated-ingredients-list');
    
    const html = currentGeneratedIngredients.map((ing, index) => `
        <div class="flex items-center justify-between p-2 border-b border-darkblue-card last:border-0" onclick="toggleIngredientSelection(${index})">
            <div class="flex items-center gap-3">
                <div class="w-5 h-5 rounded border ${ing.selected ? 'bg-orange-500 border-orange-500 text-white' : 'border-darkblue-icon/50'} flex items-center justify-center transition-colors">
                    ${ing.selected ? '<i class="fa-solid fa-check text-xs"></i>' : ''}
                </div>
                <span class="${ing.selected ? 'text-darkblue-heading font-medium' : 'text-darkblue-icon line-through'} transition-colors">${ing.name} <span class="text-xs text-darkblue-icon/70 font-normal">${ing.qtyStr}</span></span>
            </div>
        </div>
    `).join('');

    listContainer.innerHTML = html;
}

function toggleIngredientSelection(index) {
    currentGeneratedIngredients[index].selected = !currentGeneratedIngredients[index].selected;
    renderGeneratedSpesaList();
}

function closeGenerateSpesaModal() {
    DOM.modalGenerateSpesa.classList.add('opacity-0', 'pointer-events-none');
    DOM.modalGenerateSpesa.children[0].classList.add('scale-95');
}

async function confirmGenerateSpesa() {
    const itemsToBuy = currentGeneratedIngredients.filter(ing => ing.selected);
    
    if(itemsToBuy.length === 0) {
        window.showToast("Nessun ingrediente selezionato", "info");
        closeGenerateSpesaModal();
        return;
    }

    const { data: userData } = await window.supabase.auth.getUser();

    // Preparazione Array for insertion in shopping_list
    const insertPayload = itemsToBuy.map(ing => ({
        item_name: ing.name + ing.qtyStr,
        category: 'Alimentari',
        is_urgent: false,
        added_by: userData.user.id
        // family_id verrà gestito automaticamente/dal trigger o lo possiamo passare qui se necessario (ma solitamente RLS blocca se non c'è, qui supponiamo ci sia o RLS forzi il default)
        // Per sicurezza lo recuperiamo come fatto per auth se RLS non ha default value su insert.
    }));

    try {
        // Retrieve family_id first
        const { data: memberData } = await window.supabase
            .from('family_members')
            .select('family_id')
            .eq('id', userData.user.id)
            .single();

        if(memberData) {
            insertPayload.forEach(p => p.family_id = memberData.family_id);
        }

        const { error } = await window.supabase
            .from('shopping_list')
            .insert(insertPayload);

        if(error) throw error;

        window.showToast(`${itemsToBuy.length} articoli aggiunti alla Spesa!`, "success");
        closeGenerateSpesaModal();
        
        // Show indicator on cart icon in menu
        const spesaBadge = document.getElementById('nav-badge-spesa');
        if(spesaBadge) spesaBadge.classList.remove('hidden');

    } catch(e) {
        console.error("Errore esportazione in lista spesa:", e);
        window.showToast("Errore durante l'aggiunta alla lista", "error");
    }
}

// -------------------------------------------------------------
// REALTIME SUBSCRIPTIONS
// -------------------------------------------------------------

function setupPastiRealtime() {
    window.supabase.channel('public:pasti_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'family_recipes' }, payload => {
            console.log("Realtime: Ricette aggiornate");
            loadRecipes(); // reload and re-render
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_plan' }, payload => {
            console.log("Realtime: Piano Pasti aggiornato");
            loadMealPlan(); // reload and re-render calendar
        })
        .subscribe();
}
