import { GuildMember } from "discord.js";
import { getConfig } from "../db";

/**
 * True se il membro è un manager: ha il ruolo configurato con /setmanagerrole,
 * oppure ha permesso Administrator (fallback finché il ruolo non è configurato).
 */
export function isManager(member: GuildMember): boolean {
  if (member.permissions.has("Administrator")) return true;
  const cfg = getConfig(member.guild.id);
  if (!cfg.manager_role_id) return false;
  return member.roles.cache.has(cfg.manager_role_id);
}
