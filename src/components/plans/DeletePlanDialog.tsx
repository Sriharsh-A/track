"use client";

import { useState } from "react";
import type { Plan } from "@/types/plan";

export function DeletePlanDialog({ plan, onClose, onDelete }: { plan: Plan; onClose: () => void; onDelete: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    setPending(true);
    setError("");
    try {
      await onDelete();
    } catch {
      setError("PLAN COULD NOT BE DELETED. PLEASE TRY AGAIN.");
      setPending(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !pending) onClose(); }}>
      <section aria-labelledby="delete-plan-title" aria-modal="true" className="confirm-plan-dialog" role="alertdialog">
        <p className="dialog-kicker"><span className="kicker-square" /> PLAN MANAGEMENT</p>
        <h2 id="delete-plan-title">DELETE PLAN?</h2>
        <p>This will permanently remove <strong>{plan.name}</strong> and its tracking data.</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="confirm-plan-actions"><button className="migration-dismiss" disabled={pending} onClick={onClose} type="button">CANCEL</button><button className="create-plan-button" disabled={pending} onClick={() => void confirmDelete()} type="button">{pending ? "DELETING..." : "DELETE"}</button></div>
      </section>
    </div>
  );
}
