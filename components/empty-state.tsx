import { Inbox } from "lucide-react";

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return <div className="empty"><div><Inbox size={28}/><strong>{title}</strong>{detail && <div style={{fontSize:12,marginTop:4}}>{detail}</div>}</div></div>;
}
