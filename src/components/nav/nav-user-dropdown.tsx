"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnClickOutside } from "usehooks-ts";
import { User, LogIn, LogOut, ChevronDown, CalendarDays, Camera, X } from "lucide-react";
import { useAlert } from "@/components/ui/alert-provider";

export default function NavUserDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("User");
  const [email, setEmail] = useState<string>("");
  const [hasGoogle, setHasGoogle] = useState<boolean>(false);
  const { show } = useAlert();
  const anchorRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef<ReturnType<any> | null>(null);
  useOnClickOutside<HTMLDivElement>(anchorRef as unknown as React.RefObject<HTMLDivElement>, () => setOpen(false));
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    if (!hasSupabaseEnv) {
      // No env: keep dropdown functional but unauthenticated
      setLoggedIn(false);
      setAvatarUrl(null);
      return;
    }
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
        const supabase = getSupabaseBrowserClient();
        supabaseRef.current = supabase as unknown as ReturnType<any>;
        const applyUser = async () => {
          try {
            const { data: userRes } = await supabase.auth.getUser();
            const user = userRes?.user;
            const ok = Boolean(user);
            setLoggedIn(ok);
            if (!ok) {
              setAvatarUrl(null);
              setDisplayName("User");
              setEmail("");
              return;
            }
            let name = (user.user_metadata?.full_name || user.user_metadata?.name || "").toString();
            let photo = (user.user_metadata?.avatar_url || user.user_metadata?.picture || "").toString();
            setEmail(user.email || "");
            try {
              const identities: any[] = (user as any)?.identities || [];
              const providers = Array.isArray(identities) ? identities.map((i) => i.provider) : [];
              setHasGoogle(providers.includes("google"));
            } catch { setHasGoogle(false); }
            try {
              let { data: row } = await supabase
                .from("Profile-Table")
                .select("name, full_name, image_url, avatar_url")
                .eq("user_id", user.id)
                .maybeSingle();
              if (!row) {
                const alt = await supabase
                  .from("Profile-Table")
                  .select("name, full_name, image_url, avatar_url")
                  .eq("id", user.id)
                  .maybeSingle();
                row = alt.data ?? null;
              }
              if (row) {
                name = (row.name || row.full_name || name || "").toString();
                photo = (row.image_url || row.avatar_url || photo || "").toString();
              }
            } catch {}
            setDisplayName(name || user.email || "User");
            setAvatarUrl(photo || null);
          } catch {
            setLoggedIn(false);
            setAvatarUrl(null);
            setDisplayName("User");
            setEmail("");
          }
        };
        // initial
        applyUser();
        const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
          applyUser();
        });
        unsub = () => sub.subscription?.unsubscribe?.();
      } catch (err) {
        // Soft-fail if env misconfigured
        setLoggedIn(false);
        setAvatarUrl(null);
      }
    })();
    return () => { try { unsub?.(); } catch {} };
  }, []);

  const login = () => {
    window.location.href = "/sign-in";
  };

  const logout = async () => {
    if (!hasSupabaseEnv) {
      show({ title: "Auth not configured", description: "Contact admin to configure Supabase.", variant: "warning" });
      setLoggedIn(false);
      setOpen(false);
      try { router.replace("/"); } catch {}
      if (typeof window !== "undefined") window.location.assign("/");
      return;
    }
    let supabase = supabaseRef.current as any;
    if (!supabase) {
      const mod = await import("@/lib/supabase/client");
      supabase = mod.getSupabaseBrowserClient();
      supabaseRef.current = supabase;
    }
    // Capture user's name/email before signing out
    let who = "User";
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (user) {
        let name = (user.user_metadata?.full_name || user.user_metadata?.name || "").toString();
        if (!name) {
          try {
            let { data: row } = await supabase
              .from("Profile-Table")
              .select("name, full_name")
              .eq("user_id", user.id)
              .maybeSingle();
            if (!row) {
              const alt = await supabase
                .from("Profile-Table")
                .select("name, full_name")
                .eq("id", user.id)
                .maybeSingle();
              row = alt.data ?? null;
            }
            name = (row?.name || row?.full_name || "").toString();
          } catch {}
        }
        who = name || user.email || who;
      }
    } catch {}
    await supabase.auth.signOut();
    setLoggedIn(false);
    setOpen(false);
    show({ title: "Logged out", description: `${who}`, variant: "info" });
    try { router.replace("/"); } catch {}
    // Fallback if router is unavailable for any reason
    if (typeof window !== "undefined") window.location.assign("/");
  };

  const linkGoogle = async () => {
    try {
      let supabase = supabaseRef.current as any;
      if (!supabase) {
        const mod = await import("@/lib/supabase/client");
        supabase = mod.getSupabaseBrowserClient();
        supabaseRef.current = supabase;
      }
      const siteUrl = ((typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || "")) as string).replace(/\/$/, "");
      const redirectTo = `${siteUrl}/auth/callback`;
      const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } as any });
      if (error) {
        show({ title: "Link failed", description: error.message, variant: "error" });
        return;
      }
      show({ title: "Continue with Google", description: "Complete linking in the Google window.", variant: "info" });
    } catch (e: any) {
      show({ title: "Link failed", description: e?.message || "Unexpected error", variant: "error" });
    }
  };

  const onTriggerClick = () => {
    if (!loggedIn) return login();
    setOpen((v) => !v);
  };
  const initial = (displayName || "U").trim().charAt(0).toUpperCase();

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        onClick={onTriggerClick}
        aria-expanded={loggedIn ? open : undefined}
        className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/20 hover:bg-white/25"
      >
        {loggedIn ? (
          <>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName || "Profile"}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-white/20"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="grid place-items-center h-8 w-8 rounded-full bg-white/20 text-[0.8rem] font-semibold">
                {initial}
              </span>
            )}
            <ChevronDown size={14} className="opacity-80" />
          </>
        ) : (
          <>
            <LogIn size={16} />
            <span className="hidden sm:inline">Login</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[110%] z-50">
          <div className="w-[340px] sm:w-[380px] overflow-hidden rounded-2xl border border-border bg-white/95 text-foreground shadow-xl backdrop-blur dark:bg-neutral-900/95">
            {/* Header with email and close */}
            <div className="flex items-center justify-between px-4 py-3 text-sm border-b border-border/60">
              <span className="truncate max-w-[260px] sm:max-w-[300px] opacity-80">{email || (loggedIn ? "Account" : "Not signed in")}</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Avatar + greeting */}
            <div className="px-6 pt-5 pb-4 text-center">
              <div className="relative mx-auto h-16 w-16">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName || "Profile"} className="h-16 w-16 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/10" />
                ) : (
                  <div className="grid place-items-center h-16 w-16 rounded-full bg-violet-500 text-white text-2xl font-bold ring-1 ring-black/10 dark:ring-white/10">
                    {initial}
                  </div>
                )}
                <button
                  onClick={() => router.push("/profile/edit")}
                  title="Change photo"
                  className="absolute -bottom-0 -right-1 grid place-items-center h-6 w-6 rounded-full bg-white text-black shadow-sm ring-1 ring-black/10 dark:bg-neutral-800 dark:text-white dark:ring-white/10"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 text-xl font-semibold">
                {loggedIn ? `Hi, ${displayName.split(" ")[0] || "there"}!` : "Welcome!"}
              </div>
              {loggedIn ? (
                <button
                  onClick={() => router.push("/profile")}
                  className="mt-3 inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Manage your account
                </button>
              ) : (
                <button
                  onClick={login}
                  className="mt-3 inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Sign in to your account
                </button>
              )}
            </div>

            {/* Primary actions */}
            <div className="grid grid-cols-2 gap-3 px-4 pb-4">
              <button
                onClick={() => (window.location.href = "/sign-in")}
                className="rounded-2xl border px-4 py-3 text-sm text-left hover:bg-black/5 dark:hover:bg-white/10"
              >
                <div className="flex items-center gap-2">
                  <span className="grid place-items-center h-6 w-6 rounded-full border">+</span>
                  <span>Add account</span>
                </div>
              </button>
              {loggedIn ? (
                hasGoogle ? (
                  <button disabled className="rounded-2xl border px-4 py-3 text-sm text-left opacity-60" title="Google already linked">
                    <div className="flex items-center gap-2">
                      <span className="grid place-items-center h-6 w-6 rounded-full border">G</span>
                      <span>Google linked</span>
                    </div>
                  </button>
                ) : (
                  <button onClick={linkGoogle} className="rounded-2xl border px-4 py-3 text-sm text-left hover:bg-black/5 dark:hover:bg-white/10">
                    <div className="flex items-center gap-2">
                      <span className="grid place-items-center h-6 w-6 rounded-full border">G</span>
                      <span>Link Google</span>
                    </div>
                  </button>
                )
              ) : (
                <div />
              )}
              <button
                onClick={loggedIn ? logout : login}
                className="rounded-2xl border px-4 py-3 text-sm text-left hover:bg-black/5 dark:hover:bg-white/10"
              >
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  <span>{loggedIn ? "Sign out" : "Sign in"}</span>
                </div>
              </button>
            </div>

            {/* Extra quick link */}
            {loggedIn && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => (window.location.href = "/calendar/annadanam")}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white px-4 py-2.5 text-sm hover:bg-amber-500"
                >
                  <CalendarDays className="h-4 w-4" /> Annadanam Virtual Queue Booking
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-center gap-2 px-6 py-3 text-xs text-muted-foreground border-t">
              <a href="#" className="hover:underline">Privacy Policy</a>
              <span>•</span>
              <a href="/terms" className="hover:underline">Terms of Service</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
