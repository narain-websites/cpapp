import { useState, type ReactNode } from "react";

export function ConfirmDialog({
  open, title, message, confirmLabel = "Delete", danger = true, onConfirm, onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card text-card-foreground rounded-2xl shadow-2xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg hover:bg-accent text-sm font-medium">Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              danger ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean; title: string; message: string;
    onConfirm: () => void; confirmLabel?: string; danger?: boolean;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const confirm = (opts: { title: string; message: string; onConfirm: () => void; confirmLabel?: string; danger?: boolean }) => {
    setState({ ...opts, open: true });
  };

  const node: ReactNode = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      onConfirm={state.onConfirm}
      onClose={() => setState((s) => ({ ...s, open: false }))}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
    />
  );

  return { confirm, node };
}
