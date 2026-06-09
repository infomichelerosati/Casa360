# Procedura di Sincronizzazione GitHub per Family OS

Questo documento serve a ricordare a Gemini (e ad altri agenti o sviluppatori) come gestire il versionamento e il push del codice per questo specifico progetto (`Family OS`).

## Situazione Iniziale
Spesso lavoriamo su file locali nella cartella `c:\Users\miche\Desktop\Family OS\family-os`. Questo progetto è collegato a un repository remoto su GitHub: 
**[https://github.com/infomichelerosati/Casa360](https://github.com/infomichelerosati/Casa360)**

## Step per fare il Push delle modifiche

Se l'utente chiede di "fare il push", "salvare su github" o "sincronizzare", esegui questi passaggi tramite linea di comando (PowerShell/CMD):

1. **Verifica dello stato Git**
   Controlla se la cartella corrente ha una sottocartella `.git`. Se manca, inizializza il repository e collegalo al remote:
   ```bash
   git init
   git remote add origin https://github.com/infomichelerosati/Casa360.git
   ```

2. **Allineamento con il Remote (Fetch & Reset)**
   Per evitare di perdere i file locali appena creati/modificati ma allinearci con la storia remota:
   ```bash
   git fetch origin
   git branch -M main
   git reset --mixed origin/main
   ```
   *(Nota: l'uso di `reset --mixed` è fondamentale. Evita sovrascritture distruttive sui file locali non ancora committati e prepara l'index).*

3. **Staging e Commit**
   Aggiungi i file modificati e crea un commit descrittivo:
   ```bash
   git add .
   git commit -m "feat: [breve descrizione delle ultime modifiche]"
   ```

4. **Push su GitHub**
   Infine, invia il codice al branch `main`:
   ```bash
   git push -u origin main
   ```

---
*Nota per l'Agente: ricordati sempre di controllare i conflitti se `git fetch` e `git reset` mostrano divergenze sostanziali prima di forzare modifiche.*
