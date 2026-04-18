import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

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

  const loadProfile = async (uid: string) => {
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
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadProfile(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null); setRoles([]);
  };

  const refresh = async () => { if (user) await loadProfile(user.id); };

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
