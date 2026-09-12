import { DatabaseSync } from "node:sqlite";
import path from "path";

export const db = new DatabaseSync(path.join(process.cwd(), "data.sqlite"));
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
CREATE TABLE IF NOT EXISTS points (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  points   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS config (
  guild_id              TEXT PRIMARY KEY,
  manager_role_id       TEXT,
  loot_channel_id       TEXT,
  leaderboard_channel_id TEXT,
  leaderboard_message_id TEXT,
  notify_role_id        TEXT,
  inventory_channel_id  TEXT,
  inventory_message_id  TEXT,
  default_min_points    INTEGER NOT NULL DEFAULT 1,
  default_duration_hours REAL NOT NULL DEFAULT 24,
  join_emoji            TEXT NOT NULL DEFAULT '✅',
  redeem_emoji          TEXT NOT NULL DEFAULT '🎁'
);

CREATE TABLE IF NOT EXISTS item_presets (
  guild_id       TEXT NOT NULL,
  name           TEXT NOT NULL,
  icon_url       TEXT,
  min_points     INTEGER,
  duration_hours REAL,
  PRIMARY KEY (guild_id, name)
);

CREATE TABLE IF NOT EXISTS polls (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id          TEXT NOT NULL,
  channel_id        TEXT NOT NULL,
  message_id        TEXT NOT NULL,
  item_name         TEXT NOT NULL,
  item_qty          INTEGER NOT NULL,
  icon_url          TEXT,
  min_points        INTEGER NOT NULL,
  end_at            INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active',
  inventory_linked  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_participants (
  poll_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS winners (
  poll_id             INTEGER PRIMARY KEY,
  winner_id           TEXT NOT NULL,
  announce_channel_id TEXT NOT NULL,
  announce_message_id TEXT NOT NULL,
  redeemed             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory (
  guild_id TEXT NOT NULL,
  name     TEXT NOT NULL,
  icon_url TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, name)
);
`);

// Migrazione leggera: aggiunge colonne mancanti a database creati con versioni precedenti dello schema,
// senza toccare i dati già presenti.
function ensureColumn(table: string, column: string, definition: string) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as {
    name: string;
  }[];
  if (!existing.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn("config", "notify_role_id", "TEXT");
ensureColumn("config", "inventory_channel_id", "TEXT");
ensureColumn("config", "inventory_message_id", "TEXT");
ensureColumn("item_presets", "min_points", "INTEGER");
ensureColumn("item_presets", "duration_hours", "REAL");
ensureColumn("polls", "inventory_linked", "INTEGER NOT NULL DEFAULT 0");

// ---------- Config ----------
export interface GuildConfig {
  guild_id: string;
  manager_role_id: string | null;
  loot_channel_id: string | null;
  leaderboard_channel_id: string | null;
  leaderboard_message_id: string | null;
  notify_role_id: string | null;
  inventory_channel_id: string | null;
  inventory_message_id: string | null;
  default_min_points: number;
  default_duration_hours: number;
  join_emoji: string;
  redeem_emoji: string;
}

export function getConfig(guildId: string): GuildConfig {
  let cfg = db
    .prepare("SELECT * FROM config WHERE guild_id = ?")
    .get(guildId) as unknown as GuildConfig | undefined;
  if (!cfg) {
    db.prepare("INSERT INTO config (guild_id) VALUES (?)").run(guildId);
    cfg = db
      .prepare("SELECT * FROM config WHERE guild_id = ?")
      .get(guildId) as unknown as GuildConfig;
  }
  return cfg;
}

const CONFIG_COLUMNS = [
  "manager_role_id",
  "loot_channel_id",
  "leaderboard_channel_id",
  "leaderboard_message_id",
  "notify_role_id",
  "inventory_channel_id",
  "inventory_message_id",
  "default_min_points",
  "default_duration_hours",
  "join_emoji",
  "redeem_emoji",
] as const;

export function updateConfig(guildId: string, fields: Partial<GuildConfig>) {
  getConfig(guildId); // assicura che la riga esista
  const keys = CONFIG_COLUMNS.filter((k) => k in fields);
  if (keys.length === 0) return;
  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (fields as any)[k] ?? null);
  db.prepare(`UPDATE config SET ${setClause} WHERE guild_id = ?`).run(
    ...values,
    guildId
  );
}

// ---------- Points ----------
export function getPoints(guildId: string, userId: string): number {
  const row = db
    .prepare("SELECT points FROM points WHERE guild_id = ? AND user_id = ?")
    .get(guildId, userId) as { points: number } | undefined;
  return row?.points ?? 0;
}

export function addPoints(guildId: string, userId: string, amount: number) {
  db.prepare(
    `INSERT INTO points (guild_id, user_id, points) VALUES (?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET points = points + excluded.points`
  ).run(guildId, userId, amount);
}

export function removePoints(guildId: string, userId: string, amount: number) {
  const current = getPoints(guildId, userId);
  const next = Math.max(0, current - amount);
  db.prepare(
    `INSERT INTO points (guild_id, user_id, points) VALUES (?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET points = ?`
  ).run(guildId, userId, next, next);
}

export function getLeaderboard(
  guildId: string
): { user_id: string; points: number }[] {
  return db
    .prepare(
      "SELECT user_id, points FROM points WHERE guild_id = ? AND points > 0 ORDER BY points DESC"
    )
    .all(guildId) as unknown as { user_id: string; points: number }[];
}

// ---------- Polls ----------
export interface PollRow {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  item_name: string;
  item_qty: number;
  icon_url: string | null;
  min_points: number;
  end_at: number;
  status: string;
  inventory_linked: number;
}

export function createPoll(
  poll: Omit<PollRow, "id" | "status" | "inventory_linked"> & {
    inventory_linked?: boolean;
  }
): number {
  const info = db
    .prepare(
      `INSERT INTO polls (guild_id, channel_id, message_id, item_name, item_qty, icon_url, min_points, end_at, inventory_linked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      poll.guild_id,
      poll.channel_id,
      poll.message_id,
      poll.item_name,
      poll.item_qty,
      poll.icon_url,
      poll.min_points,
      poll.end_at,
      poll.inventory_linked ? 1 : 0
    );
  return Number(info.lastInsertRowid);
}

export function getPollById(pollId: number): PollRow | undefined {
  return db
    .prepare("SELECT * FROM polls WHERE id = ?")
    .get(pollId) as unknown as PollRow | undefined;
}

export function getPollByMessageId(messageId: string): PollRow | undefined {
  return db
    .prepare("SELECT * FROM polls WHERE message_id = ? AND status = 'active'")
    .get(messageId) as unknown as PollRow | undefined;
}

export function getExpiredActivePolls(): PollRow[] {
  const now = Date.now();
  return db
    .prepare("SELECT * FROM polls WHERE status = 'active' AND end_at <= ?")
    .all(now) as unknown as PollRow[];
}

export function getActivePollsForGuild(guildId: string): PollRow[] {
  return db
    .prepare(
      "SELECT * FROM polls WHERE guild_id = ? AND status = 'active' ORDER BY end_at ASC"
    )
    .all(guildId) as unknown as PollRow[];
}

export function setPollStatus(pollId: number, status: string) {
  db.prepare("UPDATE polls SET status = ? WHERE id = ?").run(status, pollId);
}

export function addParticipant(pollId: number, userId: string) {
  db.prepare(
    "INSERT OR IGNORE INTO poll_participants (poll_id, user_id) VALUES (?, ?)"
  ).run(pollId, userId);
}

export function removeParticipant(pollId: number, userId: string) {
  db.prepare(
    "DELETE FROM poll_participants WHERE poll_id = ? AND user_id = ?"
  ).run(pollId, userId);
}

export function isParticipant(pollId: number, userId: string): boolean {
  return !!db
    .prepare(
      "SELECT 1 FROM poll_participants WHERE poll_id = ? AND user_id = ?"
    )
    .get(pollId, userId);
}

export function getParticipants(pollId: number): string[] {
  const rows = db
    .prepare("SELECT user_id FROM poll_participants WHERE poll_id = ?")
    .all(pollId) as unknown as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

// ---------- Winners ----------
export function saveWinner(
  pollId: number,
  winnerId: string,
  announceChannelId: string,
  announceMessageId: string
) {
  db.prepare(
    `INSERT INTO winners (poll_id, winner_id, announce_channel_id, announce_message_id)
     VALUES (?, ?, ?, ?)`
  ).run(pollId, winnerId, announceChannelId, announceMessageId);
}

export function getWinnerByAnnounceMessageId(messageId: string) {
  return db
    .prepare("SELECT * FROM winners WHERE announce_message_id = ?")
    .get(messageId) as unknown as
    | {
        poll_id: number;
        winner_id: string;
        announce_channel_id: string;
        announce_message_id: string;
        redeemed: number;
      }
    | undefined;
}

export function markRedeemed(pollId: number) {
  db.prepare("UPDATE winners SET redeemed = 1 WHERE poll_id = ?").run(pollId);
}

// ---------- Item presets ----------
export interface ItemPreset {
  guild_id: string;
  name: string;
  icon_url: string | null;
  min_points: number | null;
  duration_hours: number | null;
}

export function upsertPreset(
  guildId: string,
  name: string,
  iconUrl: string | null,
  minPoints: number | null,
  durationHours: number | null
) {
  db.prepare(
    `INSERT INTO item_presets (guild_id, name, icon_url, min_points, duration_hours) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, name) DO UPDATE SET
       icon_url = excluded.icon_url,
       min_points = excluded.min_points,
       duration_hours = excluded.duration_hours`
  ).run(guildId, name, iconUrl, minPoints, durationHours);
}

export function deletePreset(guildId: string, name: string) {
  db.prepare(
    "DELETE FROM item_presets WHERE guild_id = ? AND name = ? COLLATE NOCASE"
  ).run(guildId, name);
}

// COLLATE NOCASE qui è importante: evita che un manager che digita un nome con
// maiuscole/minuscole leggermente diverse (es. "Mithril ore" invece di "Mithril Ore")
// crei per sbaglio un preset duplicato invece di aggiornare quello esistente.
export function getPreset(guildId: string, name: string): ItemPreset | undefined {
  return db
    .prepare(
      "SELECT * FROM item_presets WHERE guild_id = ? AND name = ? COLLATE NOCASE"
    )
    .get(guildId, name) as unknown as ItemPreset | undefined;
}

export function listPresets(guildId: string): ItemPreset[] {
  return db
    .prepare("SELECT * FROM item_presets WHERE guild_id = ? ORDER BY name COLLATE NOCASE")
    .all(guildId) as unknown as ItemPreset[];
}

export function searchPresets(guildId: string, query: string): ItemPreset[] {
  return db
    .prepare(
      "SELECT * FROM item_presets WHERE guild_id = ? AND name LIKE ? ORDER BY name COLLATE NOCASE LIMIT 25"
    )
    .all(guildId, `%${query}%`) as unknown as ItemPreset[];
}

// ---------- Inventory ----------
export interface InventoryItem {
  guild_id: string;
  name: string;
  icon_url: string | null;
  quantity: number;
  reserved: number;
}

export function getInventoryItem(
  guildId: string,
  name: string
): InventoryItem | undefined {
  return db
    .prepare(
      "SELECT * FROM inventory WHERE guild_id = ? AND name = ? COLLATE NOCASE"
    )
    .get(guildId, name) as unknown as InventoryItem | undefined;
}

export function addStock(
  guildId: string,
  name: string,
  qty: number,
  iconUrl: string | null
) {
  const existing = getInventoryItem(guildId, name);
  if (existing) {
    db.prepare(
      `UPDATE inventory SET quantity = quantity + ?, icon_url = COALESCE(?, icon_url)
       WHERE guild_id = ? AND name = ?`
    ).run(qty, iconUrl, guildId, existing.name);
  } else {
    db.prepare(
      "INSERT INTO inventory (guild_id, name, icon_url, quantity, reserved) VALUES (?, ?, ?, ?, 0)"
    ).run(guildId, name, iconUrl, qty);
  }
}

/** Rimuove manualmente dalla quantità DISPONIBILE (non tocca quella riservata in poll). Ritorna false se non c'è abbastanza disponibile. */
export function removeStock(guildId: string, name: string, qty: number): boolean {
  const existing = getInventoryItem(guildId, name);
  if (!existing || existing.quantity < qty) return false;
  db.prepare(
    "UPDATE inventory SET quantity = quantity - ? WHERE guild_id = ? AND name = ?"
  ).run(qty, guildId, existing.name);
  return true;
}

/** Sposta qty da disponibile a riservato (apertura poll collegata a un oggetto tracciato). Ritorna false se non c'è abbastanza disponibile. */
export function reserveStock(guildId: string, name: string, qty: number): boolean {
  const existing = getInventoryItem(guildId, name);
  if (!existing || existing.quantity < qty) return false;
  db.prepare(
    "UPDATE inventory SET quantity = quantity - ?, reserved = reserved + ? WHERE guild_id = ? AND name = ?"
  ).run(qty, qty, guildId, existing.name);
  return true;
}

/** Rilascia qty da riservato a disponibile di nuovo (poll annullata o senza vincitore valido). */
export function releaseStock(guildId: string, name: string, qty: number) {
  db.prepare(
    "UPDATE inventory SET quantity = quantity + ?, reserved = MAX(0, reserved - ?) WHERE guild_id = ? AND name = ? COLLATE NOCASE"
  ).run(qty, qty, guildId, name);
}

/** Consuma definitivamente qty da riservato (premio ritirato in game, confermato dal riscatto). */
export function consumeStock(guildId: string, name: string, qty: number) {
  db.prepare(
    "UPDATE inventory SET reserved = MAX(0, reserved - ?) WHERE guild_id = ? AND name = ? COLLATE NOCASE"
  ).run(qty, guildId, name);
}

export function listInventory(guildId: string): InventoryItem[] {
  return db
    .prepare(
      "SELECT * FROM inventory WHERE guild_id = ? AND (quantity > 0 OR reserved > 0) ORDER BY name COLLATE NOCASE"
    )
    .all(guildId) as unknown as InventoryItem[];
}

export function searchInventory(guildId: string, query: string): InventoryItem[] {
  return db
    .prepare(
      "SELECT * FROM inventory WHERE guild_id = ? AND name LIKE ? ORDER BY name COLLATE NOCASE LIMIT 25"
    )
    .all(guildId, `%${query}%`) as unknown as InventoryItem[];
}
