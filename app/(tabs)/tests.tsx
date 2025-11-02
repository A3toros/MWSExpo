import { FlatList, RefreshControl, View, Text, TouchableOpacity } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/services/apiClient';
import { Link } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { processRetestAvailability } from '../../src/utils/retestUtils';

type ActiveTest = { 
  test_id: number; 
  test_name: string; 
  test_type: string; 
  teacher_name: string; 
  assigned_at: number; 
  deadline?: number;
  retest_available?: boolean;
  retest_attempts_left?: number;
  retest_assignment_id?: number;
};

export default function TestsScreen() {
  const [tests, setTests] = useState<ActiveTest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      console.log('=== TESTS TAB DEBUG START ===');
      console.log('Tests tab: Loading active tests...');
      console.log('Tests tab: Timestamp:', new Date().toISOString());
      
      const res = await api.get('/api/get-active-tests', { params: { cb: Date.now() } });
      console.log('Tests tab: API response status:', res.status);
      console.log('Tests tab: API response data:', JSON.stringify(res.data, null, 2));
      console.log('Tests tab: Tests array length:', res.data?.tests?.length || 0);
      
      if (res.data?.tests) {
        console.log('Tests tab: Sample test:', res.data.tests[0]);
      }
      
      const testsData: ActiveTest[] = res.data?.tests ?? [];
      setTests(testsData);
      
      // Process retest_available flag (web app pattern) using helper
      try {
        const userData = await AsyncStorage.getItem('user_data');
        const studentId = userData ? JSON.parse(userData).student_id : null;
        
        if (studentId) {
          for (const test of testsData) {
            if (test.retest_available) {
              await processRetestAvailability(test, studentId);
            }
          }
        }
      } catch (retestError) {
        console.warn('Tests tab: Error processing retest keys:', retestError);
      }
      
      console.log('Tests tab: State updated with', testsData.length, 'tests');
      console.log('=== TESTS TAB DEBUG END ===');
    } catch (e: any) {
      console.error('=== TESTS TAB ERROR ===');
      console.error('Tests tab: Error loading tests:', e);
      console.error('Tests tab: Error response:', e.response?.data);
      console.error('Tests tab: Error status:', e.response?.status);
      setTests([]);
      console.error('=== TESTS TAB ERROR END ===');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-header-blue shadow-md">
        <View className="px-4 py-4">
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">Tests</Text>
              <Text className="text-blue-100 text-sm">Available tests and assignments</Text>
            </View>
          </View>
        </View>
      </View>
      <FlatList
        data={tests}
        keyExtractor={(item, idx) => String(item.test_id ?? idx)}
        renderItem={({ item }) => (
          <Link href={`/tests/${item.test_id}?type=${encodeURIComponent(item.test_type)}`} asChild>
            <TouchableOpacity className="bg-white mx-4 mb-3 p-4 rounded-lg shadow-sm border border-gray-200" accessibilityRole="button" activeOpacity={0.7}>
              <Text className="text-lg font-semibold text-gray-800 mb-2">{item.test_name}</Text>
              <Text className="text-base text-gray-600">{item.test_type} • {item.teacher_name}</Text>
            </TouchableOpacity>
          </Link>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { 
          console.log('=== TESTS TAB REFRESH TRIGGERED ===');
          console.log('Tests tab: Pull to refresh activated at:', new Date().toISOString());
          setRefreshing(true); 
          load().finally(() => {
            console.log('Tests tab: Refresh completed at:', new Date().toISOString());
            setRefreshing(false);
          }); 
        }} />}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-12">
            <Text className="text-gray-500 text-lg">No tests yet</Text>
            <Text className="text-gray-400 text-sm mt-2">Check back later for new assignments</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}




