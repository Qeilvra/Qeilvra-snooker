export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden />
      {!compact && <div><div className="brand-name">Qeilvra</div><div className="brand-subtitle">Snooker Club Management</div></div>}
    </div>
  );
}
