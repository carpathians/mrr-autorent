'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StoreProvider, useStore, useActions } from '@/components/store';
import Layout from '@/components/Layout';
import SetupWizard from '@/components/SetupWizard';

function Shell({ children }: { children: React.ReactNode }) {
  const { state } = useStore() as { state: { config?: { setup_complete?: boolean } } };
  const { fetchConfig } = useActions() as { fetchConfig: () => Promise<void> };
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchConfig().finally(() => setReady(true));
  }, [fetchConfig]);

  const setupComplete = state.config?.setup_complete === true;
  const showWizard = ready && !setupComplete;

  return (
    <>
      {showWizard && (
        <SetupWizard
          onComplete={() => {
            router.push('/settings');
          }}
        />
      )}
      <Layout>{children}</Layout>
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <Shell>{children}</Shell>
    </StoreProvider>
  );
}
