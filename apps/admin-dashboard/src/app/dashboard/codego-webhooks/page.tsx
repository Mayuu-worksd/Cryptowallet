'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { RefreshCw, Activity, CheckCircle, XCircle } from 'lucide-react';

export default function ProviderWebhooksPage() {
  const { data: webhooks, isLoading, refetch } = useQuery({
    queryKey: ['admin-provider-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('codego_webhooks_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold font-display uppercase tracking-wider text-[var(--foreground)]">
            Provider Webhooks
          </h1>
          <p className="text-sm text-gray-500 font-mono mt-1">
            Incoming events from card provider
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--card-bg)] border-2 border-[var(--border-color)] shadow-[2px_2px_0px_0px_var(--border-color)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_var(--border-color)] transition-all font-bold text-sm uppercase tracking-wider"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Log
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 border-2 border-[var(--border-color)] bg-[var(--card-bg)] shadow-[4px_4px_0px_0px_var(--border-color)]">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-blue)]" />
        </div>
      ) : (
        <div className="grid gap-4">
          {webhooks?.map((webhook) => (
            <div key={webhook.id} className="border-2 border-[var(--border-color)] bg-[var(--card-bg)] shadow-[4px_4px_0px_0px_var(--border-color)] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b-2 border-[var(--border-color)] bg-[var(--background)]">
                <div className="flex items-center gap-3">
                  {webhook.processed ? (
                    <CheckCircle className="h-5 w-5 text-[var(--success)]" />
                  ) : webhook.error_message ? (
                    <XCircle className="h-5 w-5 text-[var(--accent-red)]" />
                  ) : (
                    <Activity className="h-5 w-5 text-[var(--accent-blue)] animate-pulse" />
                  )}
                  <div>
                    <h3 className="font-bold font-mono text-sm">{webhook.event_type}</h3>
                    <p className="text-xs text-gray-500">{new Date(webhook.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 text-xs font-bold font-mono border-2 ${
                    webhook.processed ? 'border-[var(--success)] text-[var(--success)]' : 
                    webhook.error_message ? 'border-[var(--accent-red)] text-[var(--accent-red)]' : 
                    'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                  }`}>
                    {webhook.processed ? 'PROCESSED' : webhook.error_message ? 'FAILED' : 'PENDING'}
                  </span>
                </div>
              </div>
              <div className="p-4 bg-[var(--card-bg)]">
                {webhook.error_message && (
                  <div className="mb-4 p-3 border-2 border-[var(--accent-red)] bg-red-50 text-[var(--accent-red)] text-sm font-bold">
                    Error: {webhook.error_message}
                  </div>
                )}
                <pre className="text-xs font-mono text-gray-600 bg-[var(--background)] p-4 border-2 border-[var(--border-color)] overflow-x-auto">
                  {JSON.stringify(webhook.payload, null, 2)}
                </pre>
              </div>
            </div>
          ))}
          {webhooks?.length === 0 && (
            <div className="p-12 text-center border-2 border-[var(--border-color)] bg-[var(--card-bg)] shadow-[4px_4px_0px_0px_var(--border-color)]">
              <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4 opacity-50" />
              <h3 className="text-lg font-bold font-display uppercase tracking-wider mb-2">No Webhooks Yet</h3>
              <p className="text-gray-500 font-mono text-sm">Listening for incoming provider events...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
