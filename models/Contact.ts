import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContact extends Document {
    _id: mongoose.Types.ObjectId;
    fullName: string;
    email: string;
    subject: string;
    message: string;
    read: boolean;
    replied: boolean;
    source: string;
    ipAddress?: string;
    userAgent?: string;
    status: "new" | "read" | "replied";
    createdAt: Date;
    updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
    {
        fullName: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            maxlength: [100, "Name cannot exceed 100 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
        },
        subject: {
            type: String,
            required: [true, "Subject is required"],
            trim: true,
            minlength: [5, "Subject must be at least 5 characters"],
            maxlength: [200, "Subject cannot exceed 200 characters"],
        },
        message: {
            type: String,
            required: [true, "Message is required"],
            trim: true,
            maxlength: [2000, "Message cannot exceed 2000 characters"],
        },
        read: {
            type: Boolean,
            default: false,
        },
        replied: {
            type: Boolean,
            default: false,
        },
        source: {
            type: String,
            default: "website",
            trim: true,
        },
        ipAddress: {
            type: String,
            default: null,
        },
        userAgent: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ["new", "read", "replied"],
            default: "new",
        },
    },
    {
        timestamps: true,
        collection: "contact_page",
    }
);

// Index for efficient queries
ContactSchema.index({ email: 1 });
ContactSchema.index({ createdAt: -1 });
ContactSchema.index({ status: 1 });

// Check if model exists before creating (for hot reload)
const Contact: Model<IContact> = mongoose.models.Contact || mongoose.model<IContact>("Contact", ContactSchema);

export default Contact;
