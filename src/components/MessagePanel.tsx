import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface Msg { id: string; sender_id: string | null; message: string; created_at: string; }

export function MessagePanel({ referralId }: { referralId: string }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");

  const load = async () => {
    const { data } = await supabase.from("referral_messages").select("*").eq("referral_id", referralId).order("created_at");
    setMsgs((data ?? []) as Msg[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`msgs-${referralId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "referral_messages", filter: `referral_id=eq.${referralId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [referralId]);

  const send = async () => {
    if (!text.trim() || !user) return;
    const t = text;
    setText("");
    await supabase.from("referral_messages").insert({ referral_id: referralId, sender_id: user.id, message: t });
  };

  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <h3 className="font-display text-lg font-semibold mb-3">Messages</h3>
        <div className="space-y-2 max-h-72 overflow-y-auto mb-3">
          {msgs.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
          {msgs.map(m => (
            <div key={m.id} className={`p-3 rounded-lg text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground ml-auto max-w-[80%]" : "bg-secondary max-w-[80%]"}`}>
              <p>{m.message}</p>
              <p className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…" onKeyDown={e => e.key === "Enter" && send()} />
          <Button onClick={send} variant="hero"><Send className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
