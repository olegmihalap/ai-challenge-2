import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, UserPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ROLES = [
  { value: "host", label: "Host" },
  { value: "checker", label: "Check-in staff" },
  { value: "user", label: "Member" },
];

const InviteHosts = () => {
  const [role, setRole] = useState<string>("host");
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => {
    const token = btoa(`${role}:${Date.now()}`).replace(/=+$/, "");
    return `${window.location.origin}/sign-up?invite=${token}&role=${role}`;
  }, [role]);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: "Link copied", description: "Share it with the person you want to invite." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserPlus className="h-6 w-6" /> Invite hosts</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate a copyable invite link and share it by role.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New invite link</CardTitle>
          <CardDescription>Pick a role, then copy the link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Invite link</Label>
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={copy} variant="secondary">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteHosts;
