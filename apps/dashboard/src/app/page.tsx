'use client';

import { useEffect, useState, useCallback } from 'react';

// Types matching the server
interface Email {
  id: string;
  recipient: string;
  subject: string | null;
  sender: string | null;
  created_at: string;
  open_count: number;
}

interface EmailWithOpens extends Email {
  opens: {
    id: number;
    email_id: string;
    opened_at: string;
    ip_address: string | null;
    user_agent: string | null;
  }[];
}

interface Stats {
  total_emails: number;
  total_opens: number;
  emails_opened: number;
  open_rate: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

export default function Dashboard() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailWithOpens | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'most_opens' | 'last_opened'>('recent');

  const fetchData = useCallback(async () => {
    try {
      const [emailsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/emails`),
        fetch(`${API_BASE}/api/stats`),
      ]);

      if (!emailsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const emailsData = await emailsRes.json();
      const statsData = await statsRes.json();

      setEmails(emailsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fetchEmailDetails = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/emails/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEmail(data);
      }
    } catch {
      console.error('Failed to fetch email details');
    }
  };

  const sortedEmails = [...emails].sort((a, b) => {
    switch (sortBy) {
      case 'most_opens':
        return b.open_count - a.open_count;
      case 'last_opened':
        // For now, sort by open_count as proxy (would need last_open field)
        return b.open_count - a.open_count;
      case 'recent':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
          <p className="text-[var(--muted)]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <div className="rounded-xl bg-white p-8 shadow-lg text-center max-w-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Connection Error</h2>
          <p className="mb-6 text-gray-600">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-white font-medium hover:bg-[var(--primary-hover)] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[var(--border)] flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-semibold text-lg text-gray-900">MailTracker</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="mb-2 px-3 text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
            Email
          </div>
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-50 text-[var(--primary)] font-medium"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Email Tracking
          </a>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-medium text-sm">
              R
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Ranvir</p>
              <p className="text-xs text-[var(--muted)] truncate">Free Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-[var(--border)] flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-gray-900">Email Tracking</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-[var(--muted)]"
              title="Refresh"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-4 gap-6 mb-8">
              <StatCard
                label="Total Emails"
                value={stats.total_emails}
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
              <StatCard
                label="Total Opens"
                value={stats.total_opens}
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              />
              <StatCard
                label="Emails Opened"
                value={stats.emails_opened}
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                  </svg>
                }
              />
              <StatCard
                label="Open Rate"
                value={`${stats.open_rate}%`}
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                highlight
              />
            </div>
          )}

          {/* Email List */}
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm">
            {/* Table Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-4">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                >
                  <option value="recent">Most Recent</option>
                  <option value="most_opens">Most Opens</option>
                </select>
              </div>
              <p className="text-sm text-[var(--muted)]">
                {emails.length} tracked email{emails.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Table */}
            {sortedEmails.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-medium text-gray-900">No tracked emails yet</h3>
                <p className="text-[var(--muted)] max-w-sm mx-auto">
                  Install the Chrome extension and start sending tracked emails to see them here.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-gray-50/50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
                      Activity
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sortedEmails.map((email) => (
                    <tr key={email.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                          {email.recipient}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-xs">
                            {email.subject || '(No subject)'}
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            Sent on {formatDate(email.created_at)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className={`font-medium ${email.open_count > 0 ? 'text-[var(--primary)]' : 'text-gray-500'}`}>
                            {email.open_count > 0 ? (
                              <>
                                {email.open_count} open{email.open_count !== 1 ? 's' : ''}
                              </>
                            ) : (
                              'Not opened'
                            )}
                          </p>
                          {email.open_count > 0 && (
                            <p className="text-sm text-[var(--muted)]">
                              Tracking active
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => fetchEmailDetails(email.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--primary)] hover:bg-emerald-50 transition-colors"
                        >
                          View Details
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Detail Slide-over */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedEmail(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                <h2 className="text-lg font-semibold text-gray-900">Email Details</h2>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6">
                {/* Email Info */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    {selectedEmail.subject || '(No subject)'}
                  </h3>
                  <p className="text-[var(--muted)]">
                    To: {selectedEmail.recipient}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    Sent: {formatDate(selectedEmail.created_at)}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                    <p className="text-2xl font-bold text-[var(--primary)]">{selectedEmail.open_count}</p>
                    <p className="text-sm text-emerald-700">Total Opens</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-2xl font-bold text-gray-900">
                      {selectedEmail.opens.length > 0 ? formatRelativeTime(selectedEmail.opens[0].opened_at) : '—'}
                    </p>
                    <p className="text-sm text-gray-600">Last Opened</p>
                  </div>
                </div>

                {/* Open History */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                    Open History
                  </h4>
                  {selectedEmail.opens.length === 0 ? (
                    <p className="text-[var(--muted)] text-sm py-4">
                      This email hasn&apos;t been opened yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedEmail.opens.map((open) => (
                        <div key={open.id} className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                {formatDate(open.opened_at)}
                              </p>
                              <p className="text-sm text-[var(--muted)] mt-1">
                                IP: {open.ip_address || 'Unknown'}
                              </p>
                            </div>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              Opened
                            </span>
                          </div>
                          {open.user_agent && (
                            <p className="text-xs text-[var(--muted-light)] mt-2 truncate">
                              {open.user_agent}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tracking Pixel Info */}
                <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex gap-3">
                    <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-amber-800">Tracking ID</p>
                      <code className="text-xs text-amber-700 font-mono">{selectedEmail.id}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`p-6 rounded-xl border ${highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-[var(--border)]'} shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2 rounded-lg ${highlight ? 'bg-emerald-100 text-[var(--primary)]' : 'bg-gray-100 text-[var(--muted)]'}`}>
          {icon}
        </span>
      </div>
      <p className={`text-3xl font-bold ${highlight ? 'text-[var(--primary)]' : 'text-gray-900'}`}>{value}</p>
      <p className={`text-sm mt-1 ${highlight ? 'text-emerald-700' : 'text-[var(--muted)]'}`}>{label}</p>
    </div>
  );
}
