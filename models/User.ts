import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    password?: string;
    image?: string;
    provider?: string;
    plan: "free" | "pro";
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            maxlength: [100, "Name cannot exceed 100 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
        },
        password: {
            type: String,
            minlength: [8, "Password must be at least 8 characters"],
            select: false, // Don't return password by default
        },
        image: {
            type: String,
            default: "",
        },
        provider: {
            type: String,
            enum: ["credentials", "google"],
            default: "credentials",
        },
        plan: {
            type: String,
            enum: ["free", "pro"],
            default: "free",
        },
    },
    {
        timestamps: true,
    }
);

// Check if model exists before creating (for hot reload)
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
