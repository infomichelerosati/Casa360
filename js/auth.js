// js/auth.js

function initAuth() {
    console.log("Modulo Auth Container caricato");

    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Toggle forms
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginContainer.classList.add('hidden');
        registerContainer.classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    });

    // Tab Switching Logic for Registration
    let isCreatingFamily = true;
    const tabCreate = document.getElementById('tab-create-family');
    const tabJoin = document.getElementById('tab-join-family');
    const secCreate = document.getElementById('section-create-family');
    const secJoin = document.getElementById('section-join-family');
    const inputFamilyName = document.getElementById('reg-family-name');
    const inputJoinCode = document.getElementById('reg-join-code');

    tabCreate.addEventListener('click', () => {
        isCreatingFamily = true;
        tabCreate.className = "w-1/2 py-2 text-sm font-bold text-darkblue-accent bg-darkblue-card rounded-clay shadow-inner transition-all";
        tabJoin.className = "w-1/2 py-2 text-sm font-bold text-darkblue-icon hover:text-darkblue-heading transition-all";
        secCreate.classList.remove('hidden');
        secJoin.classList.add('hidden');
        inputFamilyName.required = true;
        inputJoinCode.required = false;
    });

    tabJoin.addEventListener('click', () => {
        isCreatingFamily = false;
        tabJoin.className = "w-1/2 py-2 text-sm font-bold text-darkblue-accent bg-darkblue-card rounded-clay shadow-inner transition-all";
        tabCreate.className = "w-1/2 py-2 text-sm font-bold text-darkblue-icon hover:text-darkblue-heading transition-all";
        secJoin.classList.remove('hidden');
        secCreate.classList.add('hidden');
        inputJoinCode.required = true;
        inputFamilyName.required = false;
    });

    // Set initial required state
    inputFamilyName.required = true;
    inputJoinCode.required = false;

    // Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        submitBtn.disabled = true;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            console.log("Login success!", data);
            // Il listener auth onAuthStateChange in app.js gestirà il redirect
            if (typeof renderApp === 'function') {
                renderApp(); // Ricarica layout principale se necessario
            }

        } catch (error) {
            console.error("Login Error:", error);
            showConfirmModal("Errore Login", "Credenziali non valide o errore di rete. Riprova.", null);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Handle Registration
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const submitBtn = registerForm.querySelector('button[type="submit"]');

        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        submitBtn.disabled = true;

        try {
            let targetFamilyId = null;

            // PRE-FLIGHT CHECK SE SI UNISCE A UNA FAMIGLIA
            if (!isCreatingFamily) {
                const joinCode = document.getElementById('reg-join-code').value.trim().toUpperCase();

                // Usiamo una Remote Procedure Call (RPC) definita in Supabase che gira come SECURITY DEFINER
                // in modo da poter verificare il codice anche se non siamo ancora loggati / inseriti in famiglia
                const { data: familyId, error: familyError } = await supabase.rpc('check_join_code', { code_to_check: joinCode });

                if (familyError || !familyId) {
                    throw new Error("Codice di invito non valido o famiglia inesistente.");
                }
                targetFamilyId = familyId;
            }

            // 1. SignUp con Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: name
                    }
                }
            });

            if (authError) throw authError;

            // 2. Setup Famiglia
            if (authData.user) {
                // Scegli un colore casuale
                const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                let role = 'member';

                if (isCreatingFamily) {
                    const familyName = document.getElementById('reg-family-name').value.trim();
                    // Generate random 6 character code
                    const newJoinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                    const newFamilyId = crypto.randomUUID();

                    const { error: createFamilyError } = await supabase
                        .from('family_groups')
                        .insert([{ id: newFamilyId, name: familyName, join_code: newJoinCode }]);

                    if (createFamilyError) throw createFamilyError;

                    targetFamilyId = newFamilyId;
                    role = 'admin'; // Chi crea è admin
                }

                // 3. Crea il profilo in family_members
                const { error: profileError } = await supabase
                    .from('family_members')
                    .insert([
                        {
                            id: authData.user.id,
                            family_id: targetFamilyId,
                            name: name,
                            role: role,
                            avatar_color: randomColor
                        }
                    ]);

                if (profileError) {
                    console.error("Errore creazione profilo:", profileError);
                }
            }

            console.log("Registration success!", authData);
            showConfirmModal("Successo", "Registrazione completata! Ora sei connesso.", () => {
                if (typeof renderApp === 'function') {
                    renderApp();
                }
            });

        } catch (error) {
            console.error("Registration Error:", error);
            showConfirmModal("Errore Registrazione", error.message || "Errore durante la registrazione.", null);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}
