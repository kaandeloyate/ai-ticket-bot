import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  guildId: string;
  tag: string;
  ticketCount: number;
  closedTicketCount: number;
  isBanned: boolean;
  banReason?: string;
  warnings: Warning[];
  lastTicketAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Warning {
  reason: string;
  moderatorId: string;
  issuedAt: Date;
}

const warningSchema = new Schema<Warning>(
  {
    reason: { type: String, required: true },
    moderatorId: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    tag: { type: String, required: true },
    ticketCount: { type: Number, default: 0 },
    closedTicketCount: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    warnings: { type: [warningSchema], default: [] },
    lastTicketAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ userId: 1, guildId: 1 }, { unique: true });

userSchema.statics.findOrCreate = async function (
  userId: string,
  guildId: string,
  tag: string,
): Promise<IUser> {
  let user = await this.findOne({ userId, guildId });
  if (!user) {
    user = await this.create({ userId, guildId, tag });
  }
  return user;
};

export const UserModel = model<IUser>('User', userSchema);
