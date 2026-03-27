import mongoose, { Schema, Document } from 'mongoose';

export interface IWatchlistItem {
    contentId: string;
    title: string;
    type: 'movie' | 'tv';
    posterPath?: string;
    status: 'want' | 'watching' | 'watched';
    rating?: number;
    notes?: string;
    addedAt: Date;
    updatedAt?: Date;
}

export interface ICustomVibe {
    id: string;           // UUID for identification
    name: string;         // User-defined name
    genres: number[];     // TMDB genre IDs
    minRating?: number;   // Optional minimum rating filter
    color?: string;       // Optional custom color hex
    createdAt: Date;
}

export interface IUser extends Document {
    firebaseUid: string;
    email: string;
    name?: string;
    photoURL?: string;
    services: string[];
    genres: number[];
    watchlist: IWatchlistItem[];
    customVibes: ICustomVibe[];
    createdAt: Date;
    updatedAt: Date;
}

const WatchlistItemSchema = new Schema<IWatchlistItem>({
    contentId: { type: String, required: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['movie', 'tv'], required: true },
    posterPath: String,
    status: { type: String, enum: ['want', 'watching', 'watched'], default: 'want' },
    rating: { type: Number, min: 0, max: 10 },
    notes: String,
    addedAt: { type: Date, default: Date.now },
    updatedAt: Date
}, { _id: false });

const CustomVibeSchema = new Schema<ICustomVibe>({
    id: { type: String, required: true },
    name: { type: String, required: true, maxlength: 50 },
    genres: { type: [Number], required: true, validate: [(v: number[]) => v.length > 0, 'At least one genre required'] },
    minRating: { type: Number, min: 0, max: 10 },
    color: { type: String, match: /^#[0-9A-Fa-f]{6}$/ },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const UserSchema = new Schema<IUser>({
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    name: String,
    photoURL: String,
    services: { type: [String], default: [] },
    genres: { type: [Number], default: [] },
    watchlist: { type: [WatchlistItemSchema], default: [] },
    customVibes: { type: [CustomVibeSchema], default: [], validate: [(v: ICustomVibe[]) => v.length <= 5, 'Maximum 5 custom vibes allowed'] }
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
