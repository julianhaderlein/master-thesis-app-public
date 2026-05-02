import { type ReactNode } from 'react';
import { useRPC } from '@/backend/rpc-provider';
import { useDatabase } from '@/db/db-provider';
import { P2PProvider } from '@/services/p2p-provider';

/**
 * Bridges RPCProvider and DatabaseProvider into P2PProvider.
 * Must be rendered inside both DatabaseProvider and RPCProvider.
 */
export function P2PBridge({ children }: { children: ReactNode }) {
  const { rpc, isBackendReady } = useRPC();
  const { db } = useDatabase();
  return <P2PProvider rpc={rpc} isBackendReady={isBackendReady} db={db}>{children}</P2PProvider>;
}
