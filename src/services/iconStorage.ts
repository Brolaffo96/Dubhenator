import { AttachmentBuilder } from "discord.js";
import fs from "fs";
import path from "path";

// Le icone caricate come allegato vengono scaricate e salvate qui invece di essere
// riferite con l'URL della CDN di Discord: quegli URL hanno una firma con scadenza e
// smettono di funzionare dopo un po', anche se restano salvati nel database.
const ICONS_DIR = path.join(process.cwd(), "icons");
fs.mkdirSync(ICONS_DIR, { recursive: true });

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "icona"
  );
}

function extensionFromContentType(contentType: string | null): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

export function isExternalUrl(iconRef: string): boolean {
  return /^https?:\/\//i.test(iconRef);
}

/**
 * Scarica un'immagine (tipicamente un allegato Discord appena caricato) e la salva su
 * disco. Ritorna il nome file da salvare nel database al posto dell'URL.
 */
export async function downloadIcon(
  sourceUrl: string,
  guildId: string,
  label: string
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Download icona fallito: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = extensionFromContentType(res.headers.get("content-type"));
  const filename = `${guildId}_${slugify(label)}_${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(ICONS_DIR, filename), buffer);
  return filename;
}

/** Elimina un'icona locale precedente. Ignora URL esterni e file già assenti. */
export function deleteIconIfLocal(iconRef: string | null | undefined) {
  if (!iconRef || isExternalUrl(iconRef)) return;
  try {
    fs.unlinkSync(path.join(ICONS_DIR, iconRef));
  } catch {
    /* già cancellata o mai esistita, ignora */
  }
}

/**
 * Risolve un icon_url salvato (URL esterno o nome file locale) in ciò che serve per un
 * embed: se è un file locale, lo allega di nuovo fresco invece di riusare un link
 * Discord potenzialmente scaduto.
 */
export function resolveIconForEmbed(iconRef: string | null | undefined): {
  thumbnail: string | null;
  file: AttachmentBuilder | null;
} {
  if (!iconRef) return { thumbnail: null, file: null };
  if (isExternalUrl(iconRef)) return { thumbnail: iconRef, file: null };

  const filePath = path.join(ICONS_DIR, iconRef);
  if (!fs.existsSync(filePath)) return { thumbnail: null, file: null };

  return {
    thumbnail: `attachment://${iconRef}`,
    file: new AttachmentBuilder(filePath, { name: iconRef }),
  };
}
