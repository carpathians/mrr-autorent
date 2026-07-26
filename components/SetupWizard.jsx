'use client';
import React, { useState } from 'react';
import { useActions } from '@/components/store';

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'keys', title: 'API keys' },
  { id: 'done', title: 'Ready' },
];

const btnPrimary =
  'min-h-[44px] px-5 rounded-lg bg-accent-teal text-dark-900 font-semibold text-sm ' +
  'hover:brightness-110 transition-colors cursor-pointer ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal focus-visible:ring-offset-2 focus-visible:ring-offset-dark-800';

const btnSecondary =
  'min-h-[44px] px-4 rounded-lg text-sm text-dark-100 border border-dark-400 ' +
  'hover:bg-dark-600 hover:text-white transition-colors cursor-pointer ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-dark-300';

export default function SetupWizard({ onComplete }) {
  const { saveConfig, fetchConfig, fetchAccount } = useActions();
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const current = STEPS[step];

  const saveKeys = async () => {
    setError(null);
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError('Paste both API key and secret.');
      return;
    }
    setSaving(true);
    try {
      await saveConfig({ api_key: apiKey.trim(), api_secret: apiSecret.trim() });
      await fetchConfig();
      await fetchAccount().catch(() => {});
      setStep(2);
    } catch (e) {
      setError(e.message || 'Could not save keys');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div
        className="w-full max-w-lg rounded-2xl border border-dark-400 bg-dark-800 shadow-2xl shadow-black/50 overflow-hidden animate-fade-up"
        role="dialog"
        aria-labelledby="setup-title"
        aria-modal="true"
      >
        <div className="relative px-6 pt-6 pb-4 border-b border-dark-500 bg-dark-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-teal/15 via-transparent to-accent-amber/10 pointer-events-none" />
          <div className="relative flex items-center gap-3 mb-3">
            <img
              src="/icon.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl ring-1 ring-accent-teal/40"
            />
            <p className="text-xs uppercase tracking-[0.2em] text-accent-teal font-semibold">
              First run
            </p>
          </div>
          <h2 id="setup-title" className="relative mt-1 text-2xl font-semibold text-white tracking-tight">
            {current.title}
          </h2>
          <div className="relative mt-4 flex gap-2" aria-hidden="true">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  i <= step ? 'bg-accent-teal' : 'bg-dark-500'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-6 space-y-4">
          {step === 0 && (
            <>
              <p className="text-base text-dark-100 leading-relaxed">
                MRR AutoRent needs your MiningRigRentals API credentials before it can scan deals or rent hashrate.
              </p>
              <ul className="text-sm text-dark-100 space-y-2.5 list-disc pl-5 marker:text-accent-teal">
                <li>Keys stay on this Umbrel — never leave your device</li>
                <li>
                  Enable <span className="text-white font-semibold">Rent = Write</span> on the MRR key
                </li>
                <li>You can change filters and pool profile after setup</li>
              </ul>
              <a
                href="https://www.miningrigrentals.com/account/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent-teal hover:text-white underline-offset-2 hover:underline cursor-pointer"
              >
                Open MRR API key page ↗
              </a>
            </>
          )}

          {step === 1 && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-white">API key</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste API key"
                  className="mt-1.5 w-full rounded-lg bg-dark-900 border border-dark-400 px-3 py-2.5 text-sm text-white placeholder:text-dark-300 focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-accent-teal"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-white">API secret</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Paste API secret"
                  className="mt-1.5 w-full rounded-lg bg-dark-900 border border-dark-400 px-3 py-2.5 text-sm text-white placeholder:text-dark-300 focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-accent-teal"
                />
                <span className="mt-1.5 block text-xs text-dark-200">
                  Rent permission must be Write, not Read-only.
                </span>
              </label>
              {error && (
                <p className="text-sm text-accent-red font-medium" role="alert">{error}</p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-base text-dark-100 leading-relaxed">
                Keys saved. Next: pick a pool profile in Settings, tune filters, then start the worker on Auto Rent when you’re ready.
              </p>
              <p className="text-sm text-accent-amber font-medium">
                The worker can spend MRR balance — leave it stopped until filters look right.
              </p>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-dark-500 flex justify-between gap-3 bg-dark-700/40">
          {step === 0 && (
            <>
              <span />
              <button type="button" onClick={() => setStep(1)} className={btnPrimary}>
                Continue
              </button>
            </>
          )}
          {step === 1 && (
            <>
              <button type="button" onClick={() => setStep(0)} className={btnSecondary}>
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveKeys}
                className={`${btnPrimary} disabled:opacity-50`}
              >
                {saving ? 'Saving…' : 'Save keys'}
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <span />
              <button
                type="button"
                onClick={onComplete}
                className="min-h-[44px] px-5 rounded-lg bg-accent-amber text-dark-900 font-semibold text-sm hover:brightness-110 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber focus-visible:ring-offset-2 focus-visible:ring-offset-dark-800"
              >
                Open Settings
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
