"use client";

import { useState } from "react";

interface FormErrors {
    fullName?: string;
    email?: string;
    subject?: string;
    message?: string;
}

export default function ContactForm() {
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        subject: "",
        message: "",
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [apiError, setApiError] = useState<string>("");
    const [successMessage, setSuccessMessage] = useState<string>("");

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (loading) return;
 setLoading(true);
 setErrors({});
 setApiError("");
 setSuccessMessage("");

 try {
 const response = await fetch("/api/contact", {
 method: "POST",
 headers: { "Content-Type": "application/json",
 },
 body: JSON.stringify(formData),
 });

 const data = await response.json();

 if (!response.ok) {
 if (data.details) {
 // Validation errors
 const newErrors: FormErrors = {};
 data.details.forEach((error: { field: string; message: string }) => {
 newErrors[error.field as keyof FormErrors] = error.message;
 });
 setErrors(newErrors);
 } else {
 setApiError(data.error || "Something went wrong. Please try again.");
 }
 setLoading(false);
 return;
 }

 // Success
 setFormData({ fullName: "", email: "", subject: "", message: "" });
 setSuccessMessage("Thank you! Your message has been received.");
 window.setTimeout(() => {
 setSuccessMessage("");
 }, 5000);
 } catch (error) {
 console.error("Form submission error:", error);
 setApiError("We could not send your message right now. Please try again in a moment.");
 } finally {
 setLoading(false);
 }
 };

 const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
 const { name, value } = e.target;
 setFormData({
 ...formData,
 [name]: value,
 });
 // Clear error for this field when user starts typing
 if (errors[name as keyof FormErrors]) {
 setErrors({
 ...errors,
 [name]: undefined,
 });
 }
 };

    return (
        <div className="space-y-4">
            {(successMessage || apiError) && (
                <div
                    className={`rounded-xl border p-4 text-sm ${
                        successMessage
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-300"
                    }`}
                    role="status"
                    aria-live="polite"
                >
                    {successMessage || apiError}
                </div>
            )}

        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-white/5 md:p-8">
            {apiError && (
                <div className="hidden" />
            )}

            <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
                    Full Name <span className="text-red-400">*</span>
                </label>
                <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    maxLength={100}
                    className={`w-full rounded-lg border px-4 py-3 transition-all outline-none focus:border-transparent focus:ring-2 focus:ring-violet-500 ${errors.fullName ? "border-red-500" : "border-gray-200 dark:border-white/15"} bg-white dark:bg-white/5`}
                    placeholder="John Doe"
                    disabled={loading}
                />
                {errors.fullName && <p className="mt-1 text-sm text-red-400">{errors.fullName}</p>}
            </div>

            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
                    Email Address <span className="text-red-400">*</span>
                </label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className={`w-full rounded-lg border px-4 py-3 transition-all outline-none focus:border-transparent focus:ring-2 focus:ring-violet-500 ${errors.email ? "border-red-500" : "border-gray-200 dark:border-white/15"} bg-white dark:bg-white/5`}
                    placeholder="john@example.com"
                    disabled={loading}
                />
                {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
            </div>

            <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
                    Subject <span className="text-red-400">*</span>
                </label>
                <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    maxLength={200}
                    className={`w-full rounded-lg border px-4 py-3 transition-all outline-none focus:border-transparent focus:ring-2 focus:ring-violet-500 ${errors.subject ? "border-red-500" : "border-gray-200 dark:border-white/15"} bg-white dark:bg-white/5`}
                    placeholder="How can we help?"
                    disabled={loading}
                />
                {errors.subject && <p className="mt-1 text-sm text-red-400">{errors.subject}</p>}
            </div>

            <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
                    Message <span className="text-red-400">*</span>
                    <span className="text-gray-400 dark:text-slate-500 font-normal ml-2">({formData.message.length}/2000)</span>
                </label>
                <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    maxLength={2000}
                    className={`w-full resize-none rounded-lg border px-4 py-3 transition-all outline-none focus:border-transparent focus:ring-2 focus:ring-violet-500 ${errors.message ? "border-red-500" : "border-gray-200 dark:border-white/15"} bg-white dark:bg-white/5`}
                    placeholder="Your message details..."
                    disabled={loading}
                />
                {errors.message && <p className="mt-1 text-sm text-red-400">{errors.message}</p>}
            </div>

            <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-lg bg-violet-600 py-4 text-lg font-bold text-white shadow-lg shadow-violet-500/20 transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? (
                    <>
                        <svg className="-ml-1 mr-3 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                    </>
                ) : (
                    "Send Message"
                )}
            </button>

            <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
                We typically respond within 24-48 hours during business days.
            </p>
        </form>
        </div>
    );
}