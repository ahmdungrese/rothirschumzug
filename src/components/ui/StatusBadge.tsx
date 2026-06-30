"use client";

const STATUS_MAP: Record<string, [string, string]> = {
  draft:             ['bg-structure text-text-muted',                        'Entwurf'],
  clarification:     ['bg-yellow-500/20 text-yellow-500',                    'In Klärung'],
  quote:             ['bg-blue-500/20 text-blue-400',                        'Angebot'],
  confirmed:         ['bg-primary/20 text-primary',                          'Bestätigt'],
  completed:         ['bg-green-500/20 text-green-400',                      'Erledigt'],
  invoice_open:      ['bg-orange-500/20 text-orange-400',                    'Offen'],
  invoice_paid:      ['bg-green-500/20 text-green-400',                      'Bezahlt'],
  invoice_overdue:   ['bg-red-500/20 text-red-400',                          'Mahnung'],
  invoice_cancelled: ['bg-red-900/30 text-red-500 line-through',             'Storniert'],
  canceled:          ['bg-red-900/30 text-red-500 line-through',             'Storniert'],
  rejected:          ['bg-red-900/30 text-red-400 line-through',             'Abgelehnt'],
  archived:          ['bg-white/5 text-text-muted',                          'Archiviert'],
};

export function StatusBadge({ status, payments, totals, calcInput }: {
  status: string;
  payments?: { amount: number }[];
  totals?: { gross: number };
  calcInput?: { gross: number };
}) {
  if (status === 'invoice_open' && payments?.length) {
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    const gross = totals?.gross ?? calcInput?.gross ?? 0;
    if (paid > 0 && paid < gross) {
      return (
        <span className="px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider bg-yellow-500/20 text-yellow-500">
          Teilweise bezahlt
        </span>
      );
    }
  }

  const [cls, label] = STATUS_MAP[status] ?? ['bg-structure text-text-muted', status];
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}
