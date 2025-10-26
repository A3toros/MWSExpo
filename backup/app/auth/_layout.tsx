import { Redirect, Stack } from 'expo-router';
import { useAppSelector } from '../../src/store';

export default function AuthLayout() {
  const token = useAppSelector((s) => s.auth.token);
  const initialized = useAppSelector((s) => s.auth.initialized);

  if (initialized && token) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack>
      <Stack.Screen name="login" options={{ title: 'Login' }} />
    </Stack>
  );
}


