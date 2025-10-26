import { FlatList, RefreshControl, View, Text } from 'react-native';
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
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-header-blue shadow-md">
        <View className="px-4 py-4">
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">Results</Text>
              <Text className="text-blue-100 text-sm">Your test scores and performance</Text>
            </View>
          </View>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id ?? item.test_id)}
        renderItem={({ item }) => (
          <View className="bg-white mx-4 mb-3 p-4 rounded-lg shadow-sm border border-gray-200">
            <Text className="text-lg font-semibold text-gray-800 mb-2">{item.test_name}</Text>
            <Text className="text-base text-gray-600">Score: {item.score}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-12">
            <Text className="text-gray-500 text-lg">No results</Text>
            <Text className="text-gray-400 text-sm mt-2">Complete some tests to see your results here</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}




