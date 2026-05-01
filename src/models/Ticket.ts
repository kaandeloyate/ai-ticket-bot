import { Schema, model, Document } from 'mongoose';
import {
  TicketCategory,
  TicketStatus,
  TicketPriority,
  TicketMessage,
  AIAnalysis,
  MessageSentiment,
} from '../types';

export interface ITicket extends Document {
  ticketId: string; // ticket-username-1234 formatı
  guildId: string;
  channelId: string;
  userId: string;
  userTag: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
  messages: TicketMessage[];
  aiAnalysis?: AIAnalysis;
  closedBy?: string;
  closedAt?: Date;
  closedReason?: string;
  transcriptUrl?: string;
  slaDeadline: Date;
  slaBreached: boolean;
  firstResponseAt?: Date;
  lastActivityAt: Date;
  assignedTo?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  // Methods
  addMessage(message: TicketMessage): Promise<ITicket>;
  close(closedBy: string, reason?: string): Promise<ITicket>;
  getMessageHistory(limit?: number): TicketMessage[];
}

const ticketMessageSchema = new Schema<TicketMessage>(
  {
    authorId: { type: String, required: true },
    authorTag: { type: String, required: true },
    content: { type: String, required: true, maxlength: 4000 },
    isAI: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    attachments: { type: [String], default: [] },
  },
  { _id: false },
);

const aiAnalysisSchema = new Schema<AIAnalysis>(
  {
    category: { type: String, enum: Object.values(TicketCategory) },
    priority: { type: String, enum: Object.values(TicketPriority) },
    sentiment: { type: String, enum: Object.values(MessageSentiment) },
    summary: { type: String },
    suggestedResponse: { type: String },
    isSpam: { type: Boolean, default: false },
    isToxic: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    language: { type: String, enum: ['tr', 'en', 'other'], default: 'tr' },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
  },
  { _id: false },
);

const ticketSchema = new Schema<ITicket>(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    userTag: { type: String, required: true },
    category: {
      type: String,
      enum: Object.values(TicketCategory),
      default: TicketCategory.SUPPORT,
    },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.OPEN,
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      default: TicketPriority.MEDIUM,
    },
    subject: { type: String, required: true, maxlength: 200 },
    messages: { type: [ticketMessageSchema], default: [] },
    aiAnalysis: { type: aiAnalysisSchema, default: null },
    closedBy: { type: String, default: null },
    closedAt: { type: Date, default: null },
    closedReason: { type: String, default: null },
    transcriptUrl: { type: String, default: null },
    slaDeadline: { type: Date, required: true },
    slaBreached: { type: Boolean, default: false },
    firstResponseAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    assignedTo: { type: String, default: null },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Compound indexes
ticketSchema.index({ guildId: 1, status: 1 });
ticketSchema.index({ guildId: 1, userId: 1 });
ticketSchema.index({ guildId: 1, createdAt: -1 });
ticketSchema.index({ slaDeadline: 1, slaBreached: 1 });

// Methods
ticketSchema.methods.addMessage = async function (
  message: TicketMessage,
): Promise<ITicket> {
  this.messages.push(message);
  this.lastActivityAt = new Date();
  if (!this.firstResponseAt && !message.isAI) {
    this.firstResponseAt = new Date();
  }
  return this.save();
};

ticketSchema.methods.close = async function (
  closedBy: string,
  reason?: string,
): Promise<ITicket> {
  this.status = TicketStatus.CLOSED;
  this.closedBy = closedBy;
  this.closedAt = new Date();
  this.closedReason = reason || 'Kapatıldı';
  return this.save();
};

ticketSchema.methods.getMessageHistory = function (
  limit: number = 50,
): TicketMessage[] {
  return this.messages.slice(-limit);
};

// Static: ticket numarası üret
ticketSchema.statics.generateTicketId = async function (
  guildId: string,
  username: string,
): Promise<string> {
  const count = await this.countDocuments({ guildId });
  const num = String(count + 1).padStart(4, '0');
  const sanitized = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10);
  return `ticket-${sanitized}-${num}`;
};

export const TicketModel = model<ITicket>('Ticket', ticketSchema);
