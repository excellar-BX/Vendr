import { useState } from 'react'
import { Bell, Send, Users, Store, Megaphone } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { adminFetch } from '../lib/api'

type Audience = 'all' | 'buyers' | 'vendors'

export default function NotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      await adminFetch('/admin/notifications/broadcast', {
        method: 'POST',
        body: { title, body, audience },
      })
      setSuccess(true)
      setTitle('')
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification')
    } finally {
      setLoading(false)
    }
  }

  const audienceOptions: { value: Audience; label: string; desc: string; icon: typeof Users }[] = [
    { value: 'all', label: 'Everyone', desc: 'All users on Vendr', icon: Megaphone },
    { value: 'buyers', label: 'Buyers only', desc: 'Users who have made purchases', icon: Users },
    { value: 'vendors', label: 'Vendors only', desc: 'Registered vendor accounts', icon: Store },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Notifications"
        subtitle="Send broadcast push notifications to users"
      />

      <div className="max-w-2xl space-y-6">
        {/* Audience selector */}
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Target Audience</p>
          <div className="grid grid-cols-3 gap-3">
            {audienceOptions.map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setAudience(value)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  audience === value
                    ? 'border-orange bg-orange/5 text-cream'
                    : 'border-dark-5 bg-dark-2 text-muted hover:border-dark-4 hover:text-cream'
                }`}
              >
                <Icon size={18} className={audience === value ? 'text-orange mb-2' : 'text-muted mb-2'} />
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs mt-0.5 opacity-70">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Message form */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell size={15} className="text-orange" />
            <p className="text-sm font-semibold text-cream">Compose Notification</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New feature available"
              className="input"
              maxLength={100}
            />
            <p className="text-right text-xs text-muted">{title.length}/100</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your notification message here..."
              rows={4}
              className="input resize-none"
              maxLength={300}
            />
            <p className="text-right text-xs text-muted">{body.length}/300</p>
          </div>

          {/* Preview */}
          {(title || body) && (
            <div className="p-4 bg-dark-3 rounded-xl border border-dark-5">
              <p className="text-xs text-muted mb-3 uppercase tracking-wider">Preview</p>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange flex items-center justify-center shrink-0">
                  <Bell size={16} className="text-cream" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-cream">{title || 'Notification Title'}</p>
                  <p className="text-xs text-muted mt-1">{body || 'Notification body text...'}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="p-3 bg-brand-green/10 border border-brand-green/30 rounded-lg text-sm text-brand-greenLight">
              Notification sent successfully to {audience === 'all' ? 'all users' : audience}!
            </div>
          )}

          {error && (
            <div className="p-3 bg-brand-red/10 border border-brand-red/30 rounded-lg text-sm text-brand-red">
              {error}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={loading || !title.trim() || !body.trim()}
            className="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
          >
            <Send size={15} />
            {loading ? 'Sending...' : `Send to ${audience === 'all' ? 'Everyone' : audience}`}
          </button>
        </div>
      </div>
    </div>
  )
}