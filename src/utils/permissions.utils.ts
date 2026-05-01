import { GuildMember, PermissionFlagsBits, TextChannel } from 'discord.js';
import { IGuild } from '../models/Guild';

export function isAdmin(member: GuildMember, guildConfig: IGuild): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return guildConfig.ticketConfig.adminRoleIds.some((roleId) =>
    member.roles.cache.has(roleId),
  );
}

export function isSupport(member: GuildMember, guildConfig: IGuild): boolean {
  if (isAdmin(member, guildConfig)) return true;
  return guildConfig.ticketConfig.supportRoleIds.some((roleId) =>
    member.roles.cache.has(roleId),
  );
}

export function canViewTicket(
  member: GuildMember,
  ticket: { userId: string },
  guildConfig: IGuild,
): boolean {
  if (member.id === ticket.userId) return true;
  return isSupport(member, guildConfig);
}

export function hasRequiredPermissions(channel: TextChannel): boolean {
  const me = channel.guild.members.me;
  if (!me) return false;
  return (
    channel
      .permissionsFor(me)
      ?.has([
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ViewChannel,
      ]) ?? false
  );
}
