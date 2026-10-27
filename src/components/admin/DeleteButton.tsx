import { useI18n } from "@/lib/i18n";
import { useState } from "react";
export default function DeleteButton({ action, label = "Delete", message }: { action: () => void | Promise<void>; label?: string; message: string }) {
  const [busy, setBusy] = useState(false); const { t } = useI18n();
  return (<button type="button" disabled={busy} onClick={async () => { if (!confirm(message)) return; setBusy(true); try { await action(); } finally { setBusy(false); } }} className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{t(label)}</button>);
}
