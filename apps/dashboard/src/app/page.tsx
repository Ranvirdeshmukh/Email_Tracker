'use client';

import { useEffect, useState } from 'react';

type HealthStatus = 'loading' | 'ok' | 'error';

export default function Home() {
  const [status, setStatus] = useState<HealthStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/health`);
        const data = await res.json();
        if (data.ok) {
          setStatus('ok');
        } else {
          setStatus('error');
          setError('Server responded but health check failed');
        }
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to connect to server');
      }
    };

    checkHealth();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Email Tracker Dashboard</h1>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-lg font-medium text-gray-700 mb-4">Server Health Check</h2>

          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              <span>Checking server...</span>
            </div>
          )}

          {status === 'ok' && (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <span className="text-2xl">✓</span>
              <span className="font-semibold">Server OK</span>
            </div>
          )}

          {status === 'error' && (
            <div className="text-red-600">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">✗</span>
                <span className="font-semibold">Server Error</span>
              </div>
              {error && <p className="text-sm">{error}</p>}
            </div>
          )}
        </div>

        <p className="mt-6 text-sm text-gray-500">
          API: {process.env.NEXT_PUBLIC_API_BASE}
        </p>
      </div>
    </main>
  );
}
