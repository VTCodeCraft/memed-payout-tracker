import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose';

export const ROLES = ['brand', 'creator'] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    // Normalised before the unique index compares values, so "A@x.com" and "a@x.com " collide.
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
    // Excluded from queries unless explicitly requested with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ROLES, immutable: true },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = model('User', userSchema);

/** The only user shape the API ever sends to clients. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
