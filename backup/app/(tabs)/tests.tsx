import { StyleSheet, FlatList, RefreshControl, View, Text, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { api } from '../../src/services/apiClient';
import { Link } from 'expo-router';

type ActiveTest = { test_id: number; test_name: string; test_type: string; teacher_name: string; assigned_at: number; deadline?: number };

export default function TestsScreen() {
  const [tests, setTests] = useState<ActiveTest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/api/get-active-tests');
      setTests(res.data?.tests ?? []);
    } catch (e) {
      setTests([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tests</Text>
      <FlatList
        data={tests}
        keyExtractor={(item, idx) => String(item.test_id ?? idx)}
        renderItem={({ item }) => (
          <Link href={`/tests/${item.test_id}?type=${encodeURIComponent(item.test_type)}`} asChild>
            <TouchableOpacity style={styles.row} accessibilityRole="button" activeOpacity={0.7}>
              <Text style={styles.name}>{item.test_name}</Text>
              <Text style={styles.meta}>{item.test_type} • {item.teacher_name}</Text>
            </TouchableOpacity>
          </Link>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} />}
        ListEmptyComponent={<Text>No tests yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  row: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginBottom: 12 },
  name: { color: 'white', fontWeight: '700', marginBottom: 4 },
  meta: { color: '#d1d5db' },
});


