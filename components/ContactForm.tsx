"use client";

import { useState } from "react";

interface FormErrors {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
}

export default function ContactForm() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        subject: "",
        message: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [submittedEmail, setSubmittedEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [apiError, setApiError] = useState<string>("");

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 setErrors({});
 setApiError("");

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
 setApiError(data.error || "Failed to submit form");
 }
 setLoading(false);
 return;
 }

 // Success
 setSubmittedEmail(formData.email);
 setSubmitted(true);
 setFormData({ name: "", email: "", subject: "", message: "" });

 // Reset success message after 10 seconds
 setTimeout(() => {
 setSubmitted(false);
 setSubmittedEmail("");
 }, 10000);
 } catch (error) {
 console.error("Form submission error:", error);
 setApiError("Network error. Please check your connection and try again.");
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

    if (submitted) {
        return (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-8 text-center animate-fade-in">
                <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Message Sent Successfully!</h3>
                <p className="text-gray-500 dark:text-slate-400 mb-4">
                    Thank you for reaching out. We have received your message and will get back to you within 24-48 hours.
                </p>
                <p className="text-sm text-gray-400 dark:text-slate-500 mb-6">
                    We will respond to <strong>{submittedEmail || "your email address"}</strong>.
                </p>
                <button
                    onClick={() => { setSubmitted(false); setSubmittedEmail(""); }}
                    className="text-indigo-400 hover:text-indigo-300 font-medium"
                >
                    Send another message
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-white/5 rounded-xl shadow-sm border border-gray-200 dark:border-white/5 p-6 md:p-8">
            {apiError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-500 dark:text-red-300">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {apiError}
                    </div>
                </div>
            )}

            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
                    Full Name <span className="text-red-400">*</span>
                </label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    maxLength={100}
                    className={`w-full px-4 py-3 border ${errors.name ? "border-red-500" : "border-gray-200 dark:border-white/15"} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white dark:bg-white/5`}
                    placeholder="John Doe"
                    disabled={loading}
                />
                {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
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
                    className={`w-full px-4 py-3 border ${errors.email ? "border-red-500" : "border-gray-200 dark:border-white/15"} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white dark:bg-white/5`}
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
                    className={`w-full px-4 py-3 border ${errors.subject ? "border-red-500" : "border-gray-200 dark:border-white/15"} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white dark:bg-white/5`}
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
                    className={`w-full px-4 py-3 border ${errors.message ? "border-red-500" : "border-gray-200 dark:border-white/15"} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none bg-white dark:bg-white/5`}
                    placeholder="Your message details..."
                    disabled={loading}
                />
                {errors.message && <p className="mt-1 text-sm text-red-400">{errors.message}</p>}
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-lg font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
    );
}