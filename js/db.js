// js/db.js
// Configurazione del Client Supabase

const SUPABASE_URL = 'https://xgfdlyymbvpdnmomcxhd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WrFDN_QKYFHqDzmn9jc7GA_gz8QgV2q';

// Inizializza il client Supabase globale
// La CDN espone l'oggetto globale "supabase" (window.supabase)
// Usiamo quello per creare il nostro client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// E riassegniamo la variabile globale al nostro client inizializzato per comodità
window.supabase = supabaseClient;

// Funzione Helper per testare la connessione
async function testDbConnection() {
    try {
        const { data, error } = await supabase
            .from('family_members')
            .select('*');

        if (error) throw error;
        console.log("Connessione Supabase OK. Membri caricati:", data);
        return data;
    } catch (err) {
        console.error("Errore connessione Supabase:", err.message);
        return null;
    }
}

// Funzioni Helper per l'Autenticazione condivise
window.getLoggedUser = async function () {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    return session.user;
}

// Funzione Helper per ottenere l'ID della famiglia dell'utente
window.getUserFamilyId = async function () {
    const user = await window.getLoggedUser();
    if (!user) return null;

    // Controlla localStorage per caching (così non facciamo query ogni volta)
    const cachedFamId = localStorage.getItem(`family_id_${user.id}`);
    if (cachedFamId) return cachedFamId;

    try {
        const { data, error } = await supabase
            .from('family_members')
            .select('family_id')
            .eq('id', user.id)
            .single();

        if (error || !data) throw error || new Error("Famiglia non trovata");

        // Cache this
        localStorage.setItem(`family_id_${user.id}`, data.family_id);
        return data.family_id;
    } catch (err) {
        console.error("Errore fetch User Family ID:", err);
        return null;
    }
}

// Funzione globale di logout (utilizzabile, ad esempio, dalla nav o da un menù impostazioni)
window.logoutUser = async function () {
    showConfirmModal("Esci", "Vuoi davvero disconnetterti?", async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Errore Logout:", error);
        } else {
            console.log("Logout effettuato.");
            if (typeof renderApp === 'function') {
                renderApp(null); // Forza il ritorno alla schermata di login
            }
        }
    });
}
