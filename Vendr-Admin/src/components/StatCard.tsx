import { type LucideIcon, TrendingUp } from 'lucide-react'
import { cn } from '../lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: string; positive: boolean }
  accent?: 'orange' | 'gold' | 'green' | 'red' 
}

const accentMap = {
  orange: 'text-orange bg-orange/10 border-orange/20',
  gold: 'text-gold bg-gold/10 border-gold/20',
  green: 'text-brand-green bg-brand-green/10 border-brand-green/20',
  red: 'text-brand-red bg-brand-red/10 border-brand-red/20',
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accent = 'orange',
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-medium text-muted uppercase tracking-wider">{title}</p>
        <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center', accentMap[accent])}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold text-cream tabular-nums">{value}</p>
      {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
      {trend && (
        <div
          className={cn(
            'flex items-center gap-1 mt-3 text-xs font-medium',
            trend.positive ? 'text-brand-greenLight' : 'text-brand-red'
          )}
        >
          <TrendingUp size={12} />
          {trend.value}
        </div>
      )}
    </div>
  )
}