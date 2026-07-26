'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useStore, useActions } from '@/components/store';
import { api } from '@/lib/api';

const ALGOS = [
  { value: 'sha256ab', label: 'SHA256 Asicboost' },
  { value: 'sha256', label: 'SHA256' },
  { value: 'scrypt', label: 'Scrypt' },
  { value: 'kheavyhash', label: 'kHeavyHash' },
  { value: 'randomx', label: 'RandomX' },
  { value: 'etchash', label: 'ETCHash' },
  { value: 'equihash', label: 'Equihash' },
  { value: 'kawpow', label: 'KawPOW' },
];

const SECTIONS = [
  {
    id: 'api',
    title: 'API credentials',
    blurb: 'Connect to MiningRigRentals. Keys stay on this machine.',
    fields: [
      {
        key: 'api_key',
        label: 'API key',
        type: 'password',
        placeholder: 'Paste API key',
        hint: 'Rent must be Write (not Read-only)',
        secret: true,
      },
      {
        key: 'api_secret',
        label: 'API secret',
        type: 'password',
        placeholder: 'Paste API secret',
        hint: 'Shown masked after save',
        secret: true,
      },
    ],
  },
  {
    id: 'pool',
    title: 'Pool profile',
    blurb: 'Loaded from MRR. Pick one — hosts/workers come from the profile.',
    fields: [],
  },
  {
    id: 'autorent',
    title: 'Auto-rent rules',
    blurb: 'Candidates every 60s. Rent checks every 3 min; cooldown applies after a successful rent.',
    fields: [
      {
        key: 'autorent_algo',
        label: 'Algorithm',
        type: 'select',
        options: ALGOS,
        hint: 'Market scanned for deals',
        wide: true,
      },
      {
        key: 'rent_cooldown_min',
        label: 'Post-rent cooldown',
        type: 'number',
        placeholder: '30',
        step: '1',
        suffix: 'min',
        hint: 'No new autorent until this elapses (0 = off)',
      },
      {
        key: 'min_hashrate',
        label: 'Min hashrate',
        type: 'number',
        placeholder: '0',
        step: '0.1',
        suffix: 'TH',
      },
      {
        key: 'max_hashrate',
        label: 'Max hashrate',
        type: 'number',
        placeholder: '0 = no max',
        step: '0.1',
        suffix: 'TH',
      },
      {
        key: 'max_hours',
        label: 'Max rental length',
        type: 'number',
        placeholder: '24',
        step: '0.5',
        suffix: 'hours',
      },
      {
        key: 'max_price',
        label: 'Max price',
        type: 'number',
        placeholder: 'e.g. 0.00012',
        step: 'any',
        hint: 'Per hash-unit/day (same unit as MRR quote)',
        wide: true,
      },
      {
        key: 'discount_baseline',
        label: 'Discount vs',
        type: 'select',
        options: [
          { value: 'last_10', label: 'Average 10 (last_10)' },
          { value: 'last_20', label: 'Average 20 (last_20)' },
          { value: 'last_30', label: 'Average 30 (last_30)' },
          { value: 'last', label: 'Last rental' },
          { value: 'lowest', label: 'Lowest listed' },
          { value: 'suggested', label: 'MRR suggested' },
        ],
        hint: 'Baseline for discount % (from /info/algo)',
        wide: true,
      },
      {
        key: 'wait_ending_better_pct',
        label: 'Wait if ending-soon better by',
        type: 'number',
        placeholder: '5',
        step: '1',
        suffix: 'pp',
        hint: 'Hold off renting available if ending-soon beats it by this many % points',
      },
      {
        key: 'wait_ending_max_min',
        label: 'Wait only if frees within',
        type: 'number',
        placeholder: '30',
        step: '5',
        suffix: 'min',
        hint: '0 = never wait for ending-soon',
      },
      {
        key: 'ending_minutes',
        label: 'Ending-soon window',
        type: 'number',
        placeholder: '120',
        step: '5',
        suffix: 'min',
        hint: 'Rented rigs with this much time left (scan)',
      },
      {
        key: 'candidate_max_scan',
        label: 'Scan cap / currency',
        type: 'number',
        placeholder: '800',
        step: '10',
        hint: 'Same deal scan depth as Good Deals',
      },
      {
        key: 'candidates_top',
        label: 'Keep top N',
        type: 'number',
        placeholder: '10',
        step: '1',
        hint: 'Best deals kept for AutoRent (default 10)',
      },
    ],
  },
];

function SecretInput({ value, onChange, placeholder, configured }) {
  const [show, setShow] = useState(false);
  const masked = !value || String(value).includes('•');

  return (
    <div className="relative">
      <input
        type={show && !masked ? 'text' : 'password'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={configured && masked ? '••••••••  (leave blank to keep)' : placeholder}
        autoComplete="off"
        className="w-full bg-dark-800 border border-dark-400 rounded-md pl-3 pr-20 py-2.5 text-sm text-white placeholder:text-dark-300 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/40 transition"
      />
      <div className="absolute inset-y-0 right-1 flex items-center gap-1">
        {configured && (
          <span className="text-[10px] uppercase tracking-wide text-accent-green px-1.5">Set</span>
        )}
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="text-xs text-dark-200 hover:text-white px-2 py-1 rounded"
          tabIndex={-1}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}

function Field({ field, value, onChange, configured }) {
  const inputClass =
    'w-full bg-dark-800 border border-dark-400 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-dark-300 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/40 transition';

  return (
    <div className={field.wide ? 'sm:col-span-2' : ''}>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label className="text-xs font-medium text-dark-100">{field.label}</label>
        {field.suffix && <span className="text-[10px] text-dark-300 uppercase">{field.suffix}</span>}
      </div>
      {field.secret ? (
        <SecretInput
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
          configured={configured}
        />
      ) : field.type === 'select' ? (
        <select value={value || field.options?.[0]?.value || ''} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          step={field.step}
          className={inputClass}
        />
      )}
      {field.hint && <p className="mt-1 text-[11px] text-dark-300 leading-snug">{field.hint}</p>}
    </div>
  );
}

function ProfilePicker({ value, onChange, profiles, loading, error, onRefresh }) {
  const selected = profiles.find((p) => String(p.id) === String(value));
  const inputClass =
    'w-full bg-dark-800 border border-dark-400 rounded-md px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/40 transition';

  return (
    <div className="sm:col-span-2 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-dark-100">Pool profile</label>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-[11px] text-accent-blue hover:underline disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        disabled={loading || !profiles.length}
      >
        <option value="">
          {loading ? 'Loading profiles…' : profiles.length ? 'Select a profile…' : 'No profiles found'}
        </option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} (#{p.id}){p.algo_display || p.algo ? ` · ${p.algo_display || p.algo}` : ''}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-accent-red">{error}</p>}
      {!error && (
        <p className="text-[11px] text-dark-300">
          From MRR Account → Profiles. Used for every rent / auto-rent.
        </p>
      )}
      {selected && (
        <div className="rounded-lg border border-dark-500 bg-dark-800/60 p-3">
          <div className="text-xs text-dark-200 mb-2">
            <span className="text-white font-medium">{selected.name}</span>
            <span className="text-dark-300 ml-2">#{selected.id}</span>
            {(selected.algo_display || selected.algo) && (
              <span className="ml-2 text-accent-yellow">{selected.algo_display || selected.algo}</span>
            )}
          </div>
          {selected.pools?.length > 0 ? (
            <ul className="space-y-1.5">
              {selected.pools.map((pool) => (
                <li key={pool.id} className="text-[11px] text-dark-200 font-mono truncate">
                  <span className="text-dark-300 mr-2">P{pool.priority ?? 0}</span>
                  {pool.host}:{pool.port}
                  {pool.user && <span className="text-dark-300"> · {pool.user}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-dark-300">No pools on this profile</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { state } = useStore();
  const { fetchConfig, saveConfig, fetchAccount } = useActions();
  const [form, setForm] = useState({});
  const [baseline, setBaseline] = useState({});
  const [active, setActive] = useState('api');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState(null);

  const loadProfiles = async () => {
    setProfilesLoading(true);
    setProfilesError(null);
    try {
      const res = await api.getProfiles();
      setProfiles(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setProfilesError(e.message);
      setProfiles([]);
    } finally {
      setProfilesLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchAccount();
    loadProfiles();
  }, []);
  useEffect(() => {
    const cfg = state.config || {};
    setForm(cfg);
    setBaseline(cfg);
  }, [state.config]);

  const dirty = useMemo(() => {
    const keys = new Set([...Object.keys(form), ...Object.keys(baseline)]);
    for (const k of keys) {
      if (k.endsWith('_set')) continue;
      if (String(form[k] ?? '') !== String(baseline[k] ?? '')) return true;
    }
    return false;
  }, [form, baseline]);

  const updateField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const scrollTo = (id) => {
    setActive(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="max-w-5xl pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-dark-300 mt-1">
          API, pool profile, and auto-rent thresholds for deal scanning.
        </p>
      </div>

      {state.account && state.account.can_rent === false && (
        <div className="mb-4 rounded-md border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          API key has <span className="font-semibold">rent:read</span> only — renting will fail.
          On MRR → Account → API, set <span className="font-semibold">Rent = Write</span>, then paste the key here again.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Section nav */}
        <aside className="lg:w-52 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:sticky lg:top-4">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className={`text-left px-3 py-2 rounded-md text-sm whitespace-nowrap transition ${
                  active === s.id
                    ? 'bg-dark-500 text-white font-medium'
                    : 'text-dark-200 hover:bg-dark-700 hover:text-white'
                }`}
              >
                {s.title}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 space-y-5 min-w-0">
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={`settings-${section.id}`}
              className="bg-dark-700/80 border border-dark-500 rounded-xl overflow-hidden scroll-mt-4"
            >
              <div className="px-5 py-4 border-b border-dark-500 bg-dark-800/50">
                <h2 className="text-sm font-semibold text-white">{section.title}</h2>
                <p className="text-xs text-dark-300 mt-1 leading-relaxed">{section.blurb}</p>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                {section.id === 'pool' && (
                  <ProfilePicker
                    value={form.pool_profile_id}
                    onChange={(v) => updateField('pool_profile_id', v)}
                    profiles={profiles}
                    loading={profilesLoading}
                    error={profilesError}
                    onRefresh={loadProfiles}
                  />
                )}
                {section.fields.map((f) => (
                  <Field
                    key={f.key}
                    field={f}
                    value={form[f.key]}
                    onChange={(v) => updateField(f.key, v)}
                    configured={!!form[`${f.key}_set`]}
                  />
                ))}
              </div>
            </section>
          ))}

          <div className="rounded-xl border border-dark-500 bg-dark-700/40 px-5 py-4 text-xs text-dark-200 leading-relaxed">
            <span className="text-dark-100 font-medium">Security · </span>
            Keys are stored in local SQLite and never returned in clear text after save.
            Create keys at{' '}
            <a
              href="https://www.miningrigrentals.com/account/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-accent-blue hover:underline"
            >
              miningrigrentals.com/account/apikey
            </a>
            .
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-56 border-t border-dark-500 bg-dark-800/95 backdrop-blur px-6 py-3 z-20">
        <div className="max-w-5xl flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-dark-300">
            {saved ? (
              <span className="text-accent-green">Saved</span>
            ) : dirty ? (
              <span className="text-accent-yellow">Unsaved changes</span>
            ) : (
              <span>All changes saved</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => setForm(baseline)}
              className="px-4 py-2 rounded-md text-sm border border-dark-400 text-dark-100 hover:bg-dark-600 disabled:opacity-40 transition"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={handleSave}
              className={`px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-40 ${
                saved
                  ? 'bg-accent-green text-black'
                  : 'bg-accent-blue hover:bg-blue-600 text-white'
              }`}
            >
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
