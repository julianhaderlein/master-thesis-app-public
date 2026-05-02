import { Stack } from 'expo-router';

export const unstable_settings = {
    initialRouteName: 'accounts',
    spaces: {
        initialRouteName: 'spaces',
    },
};

export default function SharedLayout({ segment }: { segment: string }) {

    if (segment === '(accounts)') {
        return (
            <Stack screenOptions={{ headerShown: true }}>
                <Stack.Screen name="index" options={{ title: 'Accounts' }} />
                <Stack.Screen name="accounts/[accountId]" />
                <Stack.Screen
                    name="accounts/add-transaction"
                    options={{
                        title: 'Add Transaction',
                        presentation: 'modal'
                    }}
                />
                <Stack.Screen
                    name="accounts/create"
                    options={{
                        title: 'Create Account',
                        presentation: 'modal'
                    }}
                />
            </Stack>
        );
    }

    if (segment === '(spaces)') {
        return (
            <Stack screenOptions={{ headerShown: true }}>
                <Stack.Screen name="spaces" options={{ title: 'Spaces' }} />
                <Stack.Screen name="spaces/[spaceId]" />
                <Stack.Screen name="spaces/settings" />
                <Stack.Screen
                    name="spaces/create"
                    options={{
                        title: 'Create Space',
                        presentation: 'modal'
                    }}
                />
                <Stack.Screen
                    name="spaces/invite"
                    options={{
                        title: 'Invite Member',
                        presentation: 'modal'
                    }}
                />
                <Stack.Screen
                    name="spaces/join"
                    options={{
                        title: 'Join Space',
                        presentation: 'modal'
                    }}
                />
                <Stack.Screen
                    name="transactions/[transactionId]"
                    options={{
                        title: 'Transaction Details'
                    }}
                />
            </Stack>
        );
    }
}