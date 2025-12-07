import { Stack } from 'expo-router';

export default function ExamsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[examId]" options={{ headerShown: false }} />
    </Stack>
  );
}

