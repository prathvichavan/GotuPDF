"use client";

import { useEffect, useState } from "react";

export default function CookieConsent() {
 const [show, setShow] = useState(false);

 useEffect(() => {
 const saved = localStorage.getItem("cookieConsent");
 if (!saved) setShow(true);
 }, []);

 const accept = () => {
 localStorage.setItem("cookieConsent", "accepted");
 setShow(false);
 loadTracking();
 };

 const reject = () => {
 localStorage.setItem("cookieConsent", "rejected");
 setShow(false);
 };

 const loadTracking = () => {
 if ((window as any)._trackingLoaded) return;
 (window as any)._trackingLoaded = true;

 console.log("Tracking enabled - AdSense/Analytics ready");

 // Example AdSense loader (add your real code here)
 // const s = document.createElement("script");
 // s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
 // s.async = true;
 // document.head.appendChild(s);
 };

 return show ? (
 <div id="cookieBanner" className="fixed bottom-0 w-full bg-white dark:bg-white/5 border-t border-gray-200 dark:border-white/10 p-4 flex justify-between items-center z-50">
 <p className="text-sm text-gray-700 dark:text-slate-300">
 We use cookies to enhance your experience. By continuing to use our site, you agree to our{' '}
 <a href="/privacy" className="text-indigo-400 hover:underline">Privacy Policy</a>
 {' '}and{' '}
 <a href="/terms" className="text-indigo-400 hover:underline">Terms & Conditions</a>.
 </p>
 <div className="flex gap-2">
 <button onClick={reject} className="bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-slate-300 px-4 py-2 rounded">
 Reject Non-Essential
 </button>
 <button onClick={accept} className="bg-indigo-600 text-white px-4 py-2 rounded">
 Accept All
 </button>
 </div>
 </div>
 ) : null;
}