# RO Loot Bot — contesto del progetto

Bot Discord per la gilda su Ragnarok Online Zero: gestisce punti guadagnati facendo i
dungeon giornalieri e assegna il loot scarso tramite una lotteria pesata sui punti,
per dividerlo in modo equo tra i partecipanti.

## Stack tecnico

- TypeScript + discord.js v14, Node.js >= 22.5 (richiesto dal modulo `node:sqlite`)
- Database: **`node:sqlite`** (built-in di Node), non `better-sqlite3` — scelta
  deliberata per evitare compilazione nativa C++ (problema bloccante riscontrato su
  Windows senza Visual Studio Build Tools). Nessuna dipendenza nativa nel progetto.
- Processo mantenuto vivo con **pm2**
- Hosting: **Google Cloud, VM e2-micro (Always Free tier)**, zona `us-central1-a`,
  nome istanza `ro-loot-bot`, utente `sanzosan1996`, progetto sulla VM in
  `~/bot/Dubhenator`

## Perché Google Cloud e non altro (storia utile se si tocca l'hosting)

Prima tentato Oracle Cloud Free Tier (shape ARM `VM.Standard.A1.Flex`, gratis per
sempre) ma cronicamente "out of host capacity" nella regione `eu-turin-1`, mai
riuscita la creazione nemmeno con uno script di retry automatico in Cloud Shell.
Abbandonato in favore di Google Cloud `e2-micro`, che non ha questo problema (region
USA, latenza ininfluente per un bot Discord).

## Come si aggiorna il bot in produzione

```
# sul PC, dopo aver applicato le modifiche al codice:
git add . && git commit -m "..." && git push

# accesso alla VM da PowerShell:
gcloud compute ssh ro-loot-bot --zone=us-central1-a

# sulla VM:
cd ~/bot/Dubhenator
git pull
npm install
npm run build
npm run deploy-commands   # registra su Discord eventuali comandi nuovi/modificati
pm2 restart ro-loot-bot   # OBBLIGATORIO, pm2 non si accorge da solo dei file cambiati
```

Il file `.env` (token, client id) sulla VM non è tracciato da git (`.gitignore`) e
non va mai toccato durante gli aggiornamenti. Il file `data.sqlite` contiene punti,
config e inventario reali della gilda: **va preservato**, il codice fa da solo
migrazioni additive dello schema (mai distruttive) tramite `ensureColumn()` in
`src/db.ts`.

## Architettura del codice

- `src/db.ts` — layer dati unico su `node:sqlite`. Ogni nuova colonna va aggiunta
  sia nel `CREATE TABLE IF NOT EXISTS` sia con un `ensureColumn(...)` per non
  rompere i database già in produzione.
- `src/commands/*.ts` — uno slash command per file: esporta `data`
  (SlashCommandBuilder), `execute`, e opzionalmente `autocomplete`.
- `src/events/` — `interactionCreate.ts` instrada comandi/autocomplete;
  `reactionAdd.ts`/`reactionRemove.ts` gestiscono iscrizione e riscatto delle poll
  via reazioni.
- `src/services/` — `pollService.ts` (cuore: creazione/chiusura/cancellazione poll,
  estrazione pesata), `leaderboardService.ts` e `inventoryService.ts` (pannelli
  auto-aggiornanti in canali dedicati).
- **Pattern importante**: i mention che devono generare una notifica vera (ping) vanno
  sempre nel campo `content` del messaggio, MAI dentro un embed — i mention dentro un
  embed non notificano l'utente, restano solo un link cliccabile silenzioso.

## Concetti chiave del dominio

- **Punti**: assegnati con `/addpoints` dopo le run (10 punti/run concordato con la
  gilda), tolti manualmente con `/removepoints` per correzioni.
- **Poll di loot** (`/startpoll`): registrazione con reazione ✅, durata e punti
  minimi configurabili. Alla chiusura, l'estrazione è pesata sui punti **attuali**
  di ciascun iscritto **nel momento esatto della chiusura** (non quando si sono
  iscritti) — e chi in quel momento non ha più almeno i punti minimi richiesti (es.
  li ha già spesi vincendo un'altra poll chiusa poco prima) viene **escluso**
  dall'estrazione, non solo penalizzato. Questo previene per costruzione doppie
  vincite e punti negativi, anche con più poll attive in contemporanea.
- **Preset** (`/addpreset`): unica fonte di verità per nome/icona/punti
  minimi/durata di default di un oggetto. **L'inventario può essere popolato solo
  scegliendo un preset esistente** (mai testo libero) apposta per evitare che typo
  diversi (es. "Mithril Ore" vs "Mithrilore") creino doppioni scollegati
  nell'inventario. Il collegamento poll↔inventario scatta solo se `/startpoll` usa
  il campo `preset` (mai il campo libero `oggetto`, pensato per poll una tantum non
  tracciate).
- **Inventario di gilda** (`/addstock`, `/removestock`, pannello in
  `inventoryService.ts`): ogni oggetto ha `quantity` (disponibile) e `reserved`
  (attualmente "in poll", non ancora consegnato). Il ciclo `reserve → release/consume`
  è automatico e agganciato al ciclo di vita della poll collegata: creazione poll =
  reserve; nessun vincitore valido o `/cancelpoll` = release (torna disponibile);
  riscatto del premio (reazione 🎁 di un manager sul messaggio vincitore) = consume
  definitivo.

## Comandi disponibili (18)

Punti: `/addpoints` `/removepoints` `/mypoints` `/leaderboard`
Poll: `/startpoll` `/cancelpoll` `/endpollnow`
Preset: `/addpreset` `/removepreset` `/listpresets`
Inventario: `/addstock` `/removestock` `/refreshinventory`
Config (solo Administrator): `/setmanagerrole` `/setlootchannel`
`/setleaderboardchannel` `/setnotifyrole` `/setinventorychannel` `/setdefaults`

Dettagli completi di ogni comando, opzioni ed esempi d'uso: vedi `README.md` nella
root del progetto — è aggiornato e va consultato per primo.

## Economia dei punti concordata con la gilda (contesto, non hardcoded nel bot)

- 10 punti per run dungeon completata (Sewer o Orc, stesso peso)
- Vanno a lotteria: **Shimmering Opal**, **Cursed Emerald** (scarsi, 2 a run)
- NON vanno a lotteria (troppo abbondanti per un premio a singolo vincitore):
  **Faintly Glowing Crystal** (si dividono a mano in game), **Mithril Ore** (gestito
  come risorsa di gilda a discrezione degli officer)
- Punti minimi consigliati per iscriversi alle poll: 10 (= aver fatto almeno 1 run)

## File da leggere per primi

1. `README.md` — documentazione utente completa (comandi, setup Discord, hosting)
2. `src/db.ts` — schema dati e ogni funzione di accesso
3. `src/services/pollService.ts` — logica più delicata del progetto
