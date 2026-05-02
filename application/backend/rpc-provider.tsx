import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Worklet } from 'react-native-bare-kit';
import HRPC from '@/generated/spec/hrpc';
import bundle from '@/generated/app.bundle';
import { Paths } from 'expo-file-system';
const FramedStream = require('framed-stream');

interface RPCContextType {
  rpc: HRPC | null;
  isBackendReady: boolean;
}

const RPCContext = createContext<RPCContextType | null>(null);

/**
 * RPCProvider — starts the Bare worklet and provides the HRPC client.
 * Does NOT depend on the database; database-dependent initialization is in RPCServicesProvider.
 */
export function RPCProvider({ children }: { children: ReactNode }) {
  const [rpc, setRpc] = useState<HRPC | null>(null);
  const [isBackendReady, setIsBackendReady] = useState(false);
  const workletRef = useRef<Worklet | null>(null);

  useEffect(() => {
    const worklet = new Worklet();
    workletRef.current = worklet;

    worklet.start('/app.bundle', bundle, [Paths.document.uri]);

    const { IPC } = worklet;
    const hrpc = new HRPC(new FramedStream(IPC));

    hrpc.onBackendReady(async () => {
      console.log('[RPC] Backend worklet is ready');
      setIsBackendReady(true);
      return {};
    });

    setRpc(hrpc);

    return () => {
      worklet.terminate();
      workletRef.current = null;
    };
  }, []);

  return (
    <RPCContext.Provider value={{ rpc, isBackendReady }}>
      {children}
    </RPCContext.Provider>
  );
}

export function useRPC(): RPCContextType {
  const context = useContext(RPCContext);
  if (!context) {
    throw new Error('useRPC must be used within a RPCProvider');
  }
  return context;
}

