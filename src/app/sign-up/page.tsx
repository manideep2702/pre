"use client";

import { useEffect, useState } from "react";
import { GradientButton } from "@/components/ui/gradient-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CalendarDays, BookOpenText, HeartHandshake } from "lucide-react";

// Simple Google mark used on auth buttons
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  // OTP flow removed: simple password sign-up
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // resend state removed with OTP flow


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!fullName || !email || !password || !confirm) {
      setError("Please fill full name, email, and password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const siteUrl = ((typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || "")) as string).replace(/\/$/, "");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
          data: { full_name: fullName, name: fullName, phone, city },
        },
      });
      if (error) {
        setError(error.message || "Failed to create account.");
        return;
      }
      // If email confirmation is disabled, session exists → go to profile
      if (data?.session?.user) {
        window.location.assign("/profile/edit");
        return;
      }
      // Otherwise, send them to sign-in after verification link
      setInfo("Account created. Please check your email to verify and then sign in.");
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }


  async function onGoogleSignUp() {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const supabase = getSupabaseBrowserClient();
    try { sessionStorage.setItem("ayya.auth.next", "/profile/edit"); } catch {}
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
    const redirectTo = `${siteUrl}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) alert(error.message);
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Hero */}
      <section className="relative">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: "url('/b1.jpeg')" }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-amber-700/40 via-amber-800/40 to-background/95" />
        <div className="mx-auto max-w-5xl px-6 pt-28 pb-10 text-center">
          <h1 className="animate-element text-3xl md:text-5xl font-bold tracking-tight text-white">
            Join the Sree Sabari Sastha Seva Samithi (SSSSS) Community
          </h1>
          <p className="animate-element animate-delay-200 mt-3 text-white/90 md:text-lg">
            Sign up to receive event updates, devotional content, and special announcements.
          </p>
        </div>
      </section>

      {/* Signup form */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-10">
          <form onSubmit={onSubmit} className="animate-element rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
            <h2 className="text-xl md:text-2xl font-semibold">Create your account</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Full Name" required>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
              </Field>
              <Field label="Email" required>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
              <Field label="Password" required>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" />
              </Field>
              <Field label="Confirm Password" required>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" />
              </Field>
              <Field label="Phone Number (optional)">
                <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" />
              </Field>
              <Field label="City">
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Your city" />
              </Field>
            </div>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            {info ? <p className="mt-3 text-sm text-emerald-600">{info}</p> : null}

            <p className="mt-4 text-xs text-muted-foreground">Your details are safe with us — used only for Samithi communication.</p>

            <div className="mt-6 flex justify-center">
              <GradientButton className="min-w-[220px] text-[17px]" disabled={loading}>{loading ? "Creating…" : "Create Account"}</GradientButton>
            </div>

            <div className="mt-6 relative flex items-center justify-center">
              <span className="w-full border-t border-border"></span>
              <span className="absolute bg-background px-3 text-xs text-muted-foreground">Or continue with</span>
            </div>
            <button
              type="button"
              onClick={onGoogleSignUp}
              className="mt-4 w-full inline-flex items-center justify-center gap-3 rounded-xl border border-border px-4 py-3 text-sm hover:bg-secondary"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>
      </section>

      {/* Community benefits */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          <Benefit icon={<CalendarDays className="h-5 w-5" />} title="Know dates early" desc="Be notified about opening/closing dates and festival schedules." />
          <Benefit icon={<BookOpenText className="h-5 w-5" />} title="Devotional content" desc="Receive slokas and updates in your language." />
          <Benefit icon={<HeartHandshake className="h-5 w-5" />} title="Support sevas" desc="Stay informed about annadanam and donation drives." />
        </div>
      </section>

      {/* Footer links */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link className="underline underline-offset-2" href="/privacy">Privacy Policy</Link>
          <span className="opacity-40">•</span>
          <Link className="underline underline-offset-2" href="/contact">Contact</Link>
          <span className="opacity-40">•</span>
          <Link className="underline underline-offset-2" href="/donate">Donate</Link>
        </div>
      </section>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-left">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}{required ? " *" : ""}</span>
      {children}
    </label>
  );
}

// Preferences UI removed

function Benefit({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-5 text-left shadow-sm">
      <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-amber-600/10 px-3 py-1 text-amber-600">
        {icon} <span className="text-xs font-medium">Community</span>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
