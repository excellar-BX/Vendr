import { cn } from '../lib/utils'

type BadgeVariant = 'orange' | 'gold' | 'green' | 'red' | 'muted' | 'blue'

const variants: Record<BadgeVariant, string> = {
  orange: 'bg-orange-50 text-orange-700 border border-orange/20',
  gold: 'bg-gold-50 text-gold-600 border border-gold/20',
  green: 'bg-brand-green/10 text-brand-greenLight border border-brand-green/20',
  red: 'bg-brand-red/10 text-brand-red border border-brand-red/20',
  muted: 'bg-dark-3 text-muted border border-dark-5',
  blue: 'bg-blue-900/20 text-blue-400 border border-blue-800/30',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export default function Badge({ children, variant = 'muted', className }: BadgeProps) {
  return (
    <span className={cn('badge', variants[variant], className)}>
      {children}
    </span>
  )
}

// Status-specific badge helpers
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    // verification
    pending: 'gold',
    approved: 'green',
    rejected: 'red',
    // orders
    completed: 'green',
    cancelled: 'red',
    disputed: 'red',
    // transactions
    success: 'green',
    failed: 'red',
    processing: 'blue',
    // vendors
    active: 'green',
    suspended: 'red',
    flagged: 'red',
    // users
    verified: 'green',
    unverified: 'muted',
    deleted: 'red',
    // disputes
    open: 'orange',
    resolved: 'green',
    // escrow
    held: 'gold',
    released: 'green',
  }

  return (
    <Badge variant={map[status.toLowerCase()] ?? 'muted'}>
      {status}
    </Badge>
  )
}