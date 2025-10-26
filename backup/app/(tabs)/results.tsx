import { StyleSheet, FlatList, RefreshControl, View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { api } from '../../src/services/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

type StudentResult = { id: number | string; test_id: number; test_name: string; score: number; taken_at?: number };

export default function ResultsScreen() {
  const [items, setItems] = useState<StudentResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      // Get student_id from auth state
      const authUser = await AsyncStorage.getItem('auth_user');
      const user = authUser ? JSON.parse(authUser) : null;
      const studentId = user?.student_id;
      
      if (!studentId) {
        console.error('Student ID not found');
        setItems([]);
        return;
      }
      
      const res = await api.get('/api/get-student-test-results', { params: { student_id: studentId, limit: 20 } });
      setItems(res.data?.results ?? []);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Results</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id ?? item.test_id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.test_name}</Text>
            <Text style={styles.meta}>Score: {item.score}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>No results</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} />}
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


