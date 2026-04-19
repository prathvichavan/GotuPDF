"use client";

import Link from "next/link";
import { useState } from "react";
import AuthLogo from "@/components/AuthLogo";

type Step = "email" | "otp" | "reset";

export default function ForgotPasswordPage() {
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [resendTimer, setResendTimer] = useState(0);

    const inputCls =
        "w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all duration-200";

    /* ---------- handlers ---------- */
    const handleSendOtp = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!email.trim()) { setError("Please enter your email address."); return; }
        setLoading(true);
        // Placeholder – pretend we sent OTP
        setTimeout(() => {
            setLoading(false);
            setStep("otp");
            startResendTimer();
        }, 1200);
    };

    const startResendTimer = () => {
        setResendTimer(30);
        const id = setInterval(() => {
            setResendTimer((prev) => {
                if (prev <= 1) { clearInterval(id); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const handleOtpChange = (index: number, value: string) => {
        if (!/^[0-9]?$/.test(value)) return;
        const updated = [...otp];
        updated[index] = value;
        setOtp(updated);
        // Auto-focus next input
        if (value && index < 5) {
            const next = document.getElementById(`otp-${index + 1}`);
            next?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            const prev = document.getElementById(`otp-${index - 1}`);
            prev?.focus();
        }
    };

    const handleVerifyOtp = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (otp.join("").length < 6) { setError("Please enter the 6-digit code."); return; }
        setLoading(true);
        setTimeout(() => { setLoading(false); setStep("reset"); }, 1000);
    };

    const handleResetPassword = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!password) { setError("Please enter a new password."); return; }
        if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
        if (password !== confirmPassword) { setError("Passwords do not match."); return; }
        setLoading(true);
        // Placeholder
        setTimeout(() => setLoading(false), 1200);
    };

    /* ---------- shared UI ---------- */
    const SubmitButton = ({ children, loadingText }: { children: React.ReactNode; loadingText: string }) => (
        <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
            {loading ? (
                <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {loadingText}
                </>
            ) : (
                children
            )}
        </button>
    );

    /* ---------- step content ---------- */
    const renderStep = () => {
        switch (step) {
            /* --- Step 1: Enter email --- */
            case "email":
                return (
                    <form onSubmit={handleSendOtp} className="space-y-5">
                        <div className="text-center mb-2">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reset Password</h1>
                            <p className="text-gray-500 dark:text-slate-400 text-sm mt-1.5">Enter your email and we&apos;ll send a verification code</p>
                        </div>

                        <div>
                            <label htmlFor="fp-email" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5">Email Address</label>
                            <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} autoComplete="email" />
                        </div>

                        <SubmitButton loadingText="Sending code...">Send Verification Code</SubmitButton>
                    </form>
                );

            /* --- Step 2: OTP verification --- */
            case "otp":
                return (
                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                        <div className="text-center mb-2">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify Code</h1>
                            <p className="text-gray-500 dark:text-slate-400 text-sm mt-1.5">
                                We sent a 6-digit code to <span className="text-gray-700 dark:text-slate-200 font-medium">{email}</span>
                            </p>
                        </div>

                        {/* OTP Boxes */}
                        <div className="flex justify-center gap-2 sm:gap-3">
                            {otp.map((digit, i) => (
                                <input
                                    key={i}
                                    id={`otp-${i}`}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleOtpChange(i, e.target.value)}
                                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                    className="w-11 h-12 sm:w-12 sm:h-14 text-center text-lg font-semibold rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all duration-200"
                                />
                            ))}
                        </div>

                        <SubmitButton loadingText="Verifying...">Verify Code</SubmitButton>

                        <p className="text-center text-sm text-gray-400 dark:text-slate-500">
                            Didn&apos;t receive the code?{" "}
                            {resendTimer > 0 ? (
                                <span className="text-gray-500 dark:text-slate-400">Resend in {resendTimer}s</span>
                            ) : (
                                <button type="button" onClick={() => { startResendTimer(); }} className="text-red-400 hover:text-red-300 font-semibold transition-colors">
                                    Resend
                                </button>
                            )}
                        </p>
                    </form>
                );

            /* --- Step 3: New password --- */
            case "reset":
                return (
                    <form onSubmit={handleResetPassword} className="space-y-5">
                        <div className="text-center mb-2">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Password</h1>
                            <p className="text-gray-500 dark:text-slate-400 text-sm mt-1.5">Set a strong new password for your account</p>
                        </div>

                        <div>
                            <label htmlFor="fp-new-pw" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5">New Password</label>
                            <div className="relative">
                                <input id="fp-new-pw" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={`${inputCls} pr-11`} autoComplete="new-password" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-800 dark:hover:text-slate-300 transition-colors">
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="fp-confirm-pw" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1.5">Confirm Password</label>
                            <input id="fp-confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className={inputCls} autoComplete="new-password" />
                            {confirmPassword && password !== confirmPassword && (
                                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                            )}
                        </div>

                        <SubmitButton loadingText="Resetting...">Reset Password</SubmitButton>
                    </form>
                );
        }
    };

    /* ---------- render ---------- */
    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md animate-fade-in relative z-10">
                <div className="bg-white/90 dark:bg-[#141825]/80 backdrop-blur-xl border border-gray-200 dark:border-white/[0.06] rounded-2xl shadow-2xl shadow-gray-200/50 dark:shadow-black/30 p-8 sm:p-10">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <AuthLogo />
                    </div>

                    {/* Step progress bar */}
                    <div className="flex items-center gap-1 mb-8">
                        {(["email", "otp", "reset"] as Step[]).map((s, i) => (
                            <div key={s} className="flex-1 flex items-center gap-1">
                                <div className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                                    (["email", "otp", "reset"] as Step[]).indexOf(step) >= i
                                        ? "bg-gradient-to-r from-red-500 to-rose-500"
                                        : "bg-gray-200 dark:bg-white/[0.06]"
                                }`} />
                            </div>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {renderStep()}
                </div>

                {/* Footer */}
                <p className="text-center mt-6 text-sm text-gray-400 dark:text-slate-500">
                    Remember your password?{" "}
                    <Link href="/login" className="text-red-400 hover:text-red-300 font-semibold transition-colors">
                        Back to Login
                    </Link>
                </p>
            </div>
        </div>
    );
}
