import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUsageLimit extends Document {
    identifier: string;       // userId OR SHA256 hash of IP+userAgent
    type: "guest" | "user";
    plan: "free" | "pro";
    count: number;
    lastReset: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UsageLimitSchema = new Schema<IUsageLimit>(
    {
        identifier: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        type: {
            type: String,
            enum: ["guest", "user"],
            required: true,
        },
        plan: {
            type: String,
            enum: ["free", "pro"],
            default: "free",
        },
        count: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastReset: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient queries
UsageLimitSchema.index({ identifier: 1, lastReset: 1 });

// TTL index to auto-cleanup old guest records after 30 days of inactivity
UsageLimitSchema.index(
    { updatedAt: 1 },
    { 
        expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
        partialFilterExpression: { type: "guest" }
    }
);

const UsageLimit: Model<IUsageLimit> = 
    mongoose.models.UsageLimit || mongoose.model<IUsageLimit>("UsageLimit", UsageLimitSchema);

export default UsageLimit;
