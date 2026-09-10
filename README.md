# RO Loot Bot

Bot Discord per gestire punti e assegnazione loot (roll pesato) nella gilda.

## Cosa fa

- `/addpoints` — un manager assegna punti a più partecipanti dopo una run.
- `/removepoints` — un manager toglie punti manualmente a uno o più utenti (casi eccezionali/correzioni).
- `/startpoll` — un manager avvia una poll per un oggetto: gli utenti si iscrivono mettendo una reazione (✅ di default) sul messaggio, solo se hanno abbastanza punti (altrimenti la reazione viene rimossa e ricevono un DM). Il messaggio menziona (ping vero, non solo testo) il ruolo configurato con `/setnotifyrole`, se impostato.
- `/addpreset`, `/removepreset` (con autocomplete), `/listpresets` — salva nome+icona di un oggetto una volta sola; in `/startpoll` poi basta scegliere il preset dal menu che compare mentre scrivi, senza dover ricopiare l'URL dell'icona ogni volta. Per l'icona puoi **allegare direttamente uno screenshot dal tuo PC** (campo `icona`), non serve un URL — se preferisci comunque un link diretto puoi usare `icona_url` in alternativa.
- Allo scadere del timer, il bot estrae un vincitore con probabilità proporzionale ai punti **attuali** di ciascun iscritto, cancella il messaggio di iscrizione, pubblica l'annuncio del vincitore (con ping vero al vincitore, percentuali, elenco partecipanti, riepilogo premio) e detrae al vincitore i punti costo della poll.
- Un manager reagisce con 🎁 sul messaggio del vincitore per archiviarlo (viene cancellato) una volta consegnato il premio.
- `/leaderboard` forza l'aggiornamento della classifica punti nel canale configurato (si aggiorna comunque automaticamente ad ogni variazione punti).
- `/mypoints` per far controllare a chiunque i propri punti.
- `/setmanagerrole`, `/setlootchannel`, `/setleaderboardchannel`, `/setnotifyrole`, `/setdefaults` per la configurazione (solo Amministratori del server).

Tutto è persistito in un singolo file `data.sqlite` (SQLite), niente database esterni da gestire.

---

## 1. Creare l'app Discord e il bot

1. Vai su https://discord.com/developers/applications e clicca **New Application**. Dagli un nome (es. "RO Loot Bot").
2. Nel menu a sinistra vai su **Bot** → **Reset Token** → copia il token (ti servirà come `DISCORD_TOKEN`). **Non condividerlo mai con nessuno.**
3. Sempre nella pagina Bot, scorri fino a **Privileged Gateway Intents** e attiva **SERVER MEMBERS INTENT** (serve per controllare i ruoli quando qualcuno reagisce).
4. Vai su **General Information** e copia l'**Application ID** (ti servirà come `CLIENT_ID`).
5. Vai su **OAuth2 → URL Generator**:
   - Scopes: seleziona `bot` e `applications.commands`.
   - Bot Permissions: seleziona almeno `Send Messages`, `Embed Links`, `Add Reactions`, `Read Message History`, `Manage Messages` (serve per cancellare i messaggi di poll/annuncio scaduti), `View Channels`.
   - Copia il link generato in basso, aprilo nel browser e invita il bot nel tuo server.

## 2. Configurare il progetto

Richiede **Node.js 22.5 o superiore** (il database usa il modulo `node:sqlite` integrato in Node, quindi non serve compilare nulla e non servono Visual Studio Build Tools su Windows).

```bash
npm install
cp .env.example .env
```

Apri `.env` e compila:

```
DISCORD_TOKEN=il-token-copiato-prima
CLIENT_ID=l-application-id-copiato-prima
GUILD_ID=   # lascialo vuoto, o metti l'ID del tuo server durante lo sviluppo per registrare i comandi istantaneamente
```

Per ottenere l'ID del server: nelle impostazioni Discord attiva **Modalità sviluppatore** (Impostazioni → Avanzate), poi click destro sull'icona del server → **Copia ID server**.

Compila e registra i comandi:

```bash
npm run build
npm run deploy-commands
```

Avvia il bot:

```bash
npm start
```

Se vedi `✅ Loggato come RO Loot Bot#1234` in console, sei a posto.

## 3. Primo setup dentro Discord

Da amministratore del server, in qualsiasi canale:

```
/setmanagerrole ruolo:@Manager
/setlootchannel canale:#loot-roll
/setleaderboardchannel canale:#classifica-punti
/setnotifyrole ruolo:@LootRoll
/setdefaults punti_minimi:1 durata_ore:24
```

Da qui in poi, chiunque abbia il ruolo `@Manager` (o sia Administrator) può usare `/addpoints`, `/removepoints`, `/startpoll`, `/addpreset`, `/removepreset`.

## 4. Flusso d'uso tipico

1. Finita una run: `/addpoints punti:5 partecipanti:@Mario @Luigi @Peach`
2. (Una tantum, per ogni oggetto che droppa spesso) `/addpreset nome:"Piuma di Fenice" icona:` (allega lo screenshot dell'icona dal tuo PC)
3. Quando avete abbastanza materiali: `/startpoll preset:"Piuma di Fenice" quantita:3 punti_minimi:5 durata_ore:24` — inizia a scrivere il nome nel campo `preset` e Discord ti suggerisce quelli salvati. Se preferisci non usare un preset, lascia `preset` vuoto e compila `oggetto` (e opzionalmente allega `icona` o metti `icona_url`) a mano.
4. Le persone reagiscono con ✅ sul messaggio per iscriversi (chi non ha punti sufficienti viene rimosso automaticamente e avvisato in DM). Se hai configurato `/setnotifyrole`, il ruolo scelto riceve un ping vero all'apertura della poll.
5. Dopo 24h il bot estrae il vincitore automaticamente, lo pinga (ping vero, non solo menzione nell'embed) e pubblica l'annuncio.
6. Consegnato il premio in gioco, un manager reagisce con 🎁 sul messaggio d'annuncio: viene archiviato (cancellato).
7. Se serve correggere punti assegnati per errore: `/removepoints punti:5 utenti:@Mario`.

Le emoji ✅ e 🎁 sono quelle di default; se vuoi cambiarle dimmelo e aggiungo un comando `/setemoji` (bastano due righe, non l'ho messo di default per non appesantire troppo la configurazione iniziale).

---

## 5. Aggiornare un'installazione già avviata

Ogni volta che ricevi una nuova versione del progetto (nuovi comandi, fix):

```bash
npm install        # nel caso siano cambiate le dipendenze
npm run build
npm run deploy-commands   # registra su Discord eventuali comandi nuovi/modificati
```

Poi riavvia il processo del bot (`Ctrl+C` e `npm start`, oppure `pm2 restart ro-loot-bot` se lo hai messo su un server con pm2).

Il file `data.sqlite` (punti, poll, classifica) **non va mai toccato o cancellato** in questo processo: il bot aggiunge da solo eventuali nuove colonne/tabelle al database esistente senza perdere i dati già salvati.

## 6. Hosting: dove far girare il bot 24/7 gratis

Il bot deve restare **sempre acceso** per rispondere alle reazioni e chiudere le poll in orario. Il tuo PC di casa va bene solo se lo lasci acceso sempre, quindi meglio un server remoto. Opzione consigliata, gratis per sempre:

### Oracle Cloud Free Tier (consigliata)

1. Crea un account su https://www.oracle.com/cloud/free/ (serve una carta di credito per la verifica identità, ma il tier "Always Free" non ti addebita nulla se resti nei limiti gratuiti).
2. Crea una istanza VM gratuita (Compute → Create Instance), immagine **Ubuntu**, shape **Ampere A1 (ARM), Always Free eligible** (o la VM.Standard.E2.1.Micro x86 se preferisci, sempre gratuita).
3. Scarica la chiave SSH generata, collegati via terminale:
   ```bash
   ssh -i tua-chiave.key ubuntu@IP_DELLA_VM
   ```
4. Installa Node.js:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
5. Carica il progetto sulla VM (con `git` se lo metti su una repo GitHub, oppure `scp -r` della cartella dal tuo PC).
6. Dentro la cartella del progetto: `npm install`, crea `.env`, poi `npm run build && npm run deploy-commands`.
7. Installa **pm2** per farlo ripartire da solo se crasha o se la VM si riavvia:
   ```bash
   sudo npm install -g pm2
   pm2 start dist/index.js --name ro-loot-bot
   pm2 save
   pm2 startup   # esegui il comando che ti stampa, per farlo partire al boot
   ```

Da qui in poi il bot resta online 24/7 senza costi. Per aggiornare il codice in futuro: carichi i file nuovi, `npm run build`, `pm2 restart ro-loot-bot`.

### Alternativa più semplice (a pagamento, ~5$/mese): Railway o Render

Se non vuoi gestire una VM: crei un account su https://railway.app o https://render.com, colleghi la repo GitHub del progetto, imposti le variabili d'ambiente (`DISCORD_TOKEN`, `CLIENT_ID`) nel loro pannello, e loro fanno build/deploy/restart automaticamente. Più comodo, ma non gratuito oltre una piccola prova iniziale, e su alcuni piani il filesystem non è persistente tra un deploy e l'altro — attenzione a usare un "volume" persistente per `data.sqlite`, altrimenti perdi punti e classifica ad ogni deploy.

---

## Note tecniche

- Tutti i dati (punti, config, poll attive, vincitori) sono in `data.sqlite` nella cartella del progetto (più i file di supporto `data.sqlite-wal` e `data.sqlite-shm` che SQLite crea accanto): **fai backup periodici di questi file**.
- Il database usa `node:sqlite`, il modulo SQLite integrato in Node.js dalla versione 22.5 — è "experimental" nel senso che l'API potrebbe cambiare in future major di Node, ma è già usato in produzione da molti progetti. Vedrai un avviso `ExperimentalWarning` in console all'avvio: è normale, non è un errore.
- Il controllo delle poll scadute gira ogni minuto (cron interno), quindi la chiusura avviene con un ritardo massimo di ~60 secondi rispetto all'orario esatto — impercettibile per l'uso previsto.
- Se il bot va offline e torna online, le poll attive e i timer sopravvivono perché tutto è su database, non in memoria.
- Se un utente rimuove la propria reazione ✅ prima della scadenza, viene tolto dalla poll (si ritira volontariamente).
