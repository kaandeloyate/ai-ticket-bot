import { Schema, model, Document } from 'mongoose';
import { GuildTicketConfig, TicketCategory } from '../types';

export interface IGuild extends Document {
  guildId: string;
  guildName: string;
  ticketConfig: GuildTicketConfig;
  stats: {
    totalTickets: number;
    closedTickets: number;
    avgResponseTimeMs: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const guildTicketConfigSchema = new Schema<GuildTicketConfig>(
  {
    enabled: { type: Boolean, default: true },
    categoryId: { type: String, default: null },
    logChannelId: { type: String, default: null },
    transcriptChannelId: { type: String, default: null },
    supportRoleIds: { type: [String], default: [] },
    adminRoleIds: { type: [String], default: [] },
    maxOpenTickets: { type: Number, default: 3 },
    autoCloseAfterHours: { type: Number, default: 48 },
    slaHours: { type: Number, default: 24 },
    welcomeMessage: {
      type: String,
      default:
        'Ticket açıldı! Destek ekibimiz en kısa sürede size yardımcı olacak.',
    },
    closeMessage: {
      type: String,
      default: 'Ticket kapatıldı. İyi günler dileriz!',
    },
    allowedCategories: {
      type: [String],
      enum: Object.values(TicketCategory),
      default: Object.values(TicketCategory),
    },
  },
  { _id: false },
);

const guildSchema = new Schema<IGuild>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    guildName: { type: String, required: true },
    ticketConfig: { type: guildTicketConfigSchema, default: () => ({}) },
    stats: {
      totalTickets: { type: Number, default: 0 },
      closedTickets: { type: Number, default: 0 },
      avgResponseTimeMs: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

guildSchema.statics.findOrCreate = async function (
  guildId: string,
  guildName: string,
): Promise<IGuild> {
  let guild = await this.findOne({ guildId });
  if (!guild) {
    guild = await this.create({ guildId, guildName });
  }
  return guild;
};

export const GuildModel = model<IGuild>('Guild', guildSchema);
