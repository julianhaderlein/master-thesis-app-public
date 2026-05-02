import { RPCProvider } from '@/backend/rpc-provider';
import { UsernameProvider } from '@/services/username-provider';
import { AuthProvider } from '@/services/auth-provider';
import { AppAuth } from '@/services/auth/AppAuth';

export default function RootLayout() {
  return (
    <RPCProvider>
      <AuthProvider>
        <UsernameProvider>
          <AppAuth />
        </UsernameProvider>
      </AuthProvider>
    </RPCProvider>
  );
}

