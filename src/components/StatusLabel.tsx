import { AlertCircle, CalendarClock, CheckCircle2, Clock } from 'lucide-react';
import type { PayoutStatus } from '../types/payroll';

interface StatusLabelProps {
  status: PayoutStatus;
}

export function StatusLabel({ status }: StatusLabelProps) {
  switch (status) {
    case 'Paid':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Paid</span>
        </span>
      );
    case 'Scheduled':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
          <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Scheduled</span>
        </span>
      );
    case 'Pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Pending</span>
        </span>
      );
    case 'On Hold':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>On Hold</span>
        </span>
      );
  }
}
