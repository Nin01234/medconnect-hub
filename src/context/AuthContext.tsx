import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

/** Auto sign-out after this many milliseconds without user activity */
const INACTIVITY_SIGN_OUT_MS = 5 * 60 * 1000;
/** Max how often we reset the idle timer (keeps mousemove / scroll from resetting hundreds of timers per second) */
const IDLE_ARM_THROTTLE_MS = 750;

type AppRole = "admin" | "hospital_admin" | "hospital_staff" | "clinic_user" | "doctor";

interface Profile {
  id: string;
  unique_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: AppRole | null;
  status: string;
  clinic_id: string | null;
  hospital_id: string | null;
  clinics?: { name: string; region: string | null; city: string | null } | null;
  hospitals?: { name: string; region: string | null; city: string | null } | null;
  user_roles?: { role: AppRole }[];
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  /** Avoid duplicate concurrent profile fetches for the same user (e.g. getSession + onAuthStateChange). */
  const profileInflight = useRef<Promise<void> | null>(null);
  const profileInflightUid = useRef<string | null>(null);

  const loadProfile = useCallback(async (uid: string) => {
    if (profileInflightUid.current === uid && profileInflight.current) {
      await profileInflight.current;
      return;
    }
    profileInflightUid.current = uid;
    const run = (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*, clinics(name,region,city), hospitals(name,region,city)")
          .eq("id", uid)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      const rolesList = (r ?? []).map((x) => x.role as AppRole);
      if (!p) {
        setProfile(null);
        setRoles(rolesList);
        return;
      }
      const userRoles = (r ?? []).map((x) => ({ role: x.role as AppRole }));
      setProfile({
        id: p.id,
        unique_id: p.unique_id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        role: rolesList[0] ?? null,
        status: p.status,
        clinic_id: p.clinic_id,
        hospital_id: p.hospital_id,
        clinics: p.clinics,
        hospitals: p.hospitals,
        user_roles: userRoles,
      });
      setRoles(rolesList);
    })();
    profileInflight.current = run.finally(() => {
      if (profileInflightUid.current === uid) {
        profileInflight.current = null;
        profileInflightUid.current = null;
      }
    });
    await profileInflight.current;
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setLoading(true);
        void loadProfile(sess.user.id)
          .catch(() => {
            setProfile(null);
            setRoles([]);
          })
          .finally(() => setLoading(false));
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setLoading(true);
        loadProfile(sess.user.id)
          .catch(() => {
            setProfile(null);
            setRoles([]);
          })
          .finally(() => setLoading(false));
      }
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  }, []);

  useEffect(() => {
    if (!user) return;

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const clearIdle = () => {
      if (idleTimer != null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const armIdleSignOut = () => {
      clearIdle();
      idleTimer = window.setTimeout(() => {
        idleTimer = null;
        toast.info("You were signed out after 5 minutes of inactivity.");
        void signOut();
      }, INACTIVITY_SIGN_OUT_MS);
    };

    armIdleSignOut();

    let lastThrottle = 0;
    const bump = () => {
      const now = Date.now();
      if (now - lastThrottle < IDLE_ARM_THROTTLE_MS) return;
      lastThrottle = now;
      armIdleSignOut();
    };

    const listeners: [keyof DocumentEventMap, EventListener, AddEventListenerOptions?][] = [
      ["pointerdown", bump],
      ["keydown", bump],
      ["scroll", bump, { passive: true }],
      ["touchstart", bump, { passive: true }],
      ["wheel", bump, { passive: true }],
      ["visibilitychange", bump],
    ];

    for (const [evt, fn, opts] of listeners) {
      document.addEventListener(evt, fn as EventListener, opts);
    }

    return () => {
      clearIdle();
      for (const [evt, fn, opts] of listeners) {
        document.removeEventListener(evt, fn as EventListener, opts);
      }
    };
  }, [user, signOut]);

  const refresh = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  return <Ctx.Provider value={{ user, session, profile, roles, loading, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}

export function hasRole(roles: AppRole[], ...wanted: AppRole[]) {
  return roles.some((r) => wanted.includes(r));
}

export type { AppRole, Profile };
