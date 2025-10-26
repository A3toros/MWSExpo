/** @jsxImportSource nativewind */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, TouchableOpacity, View, Text } from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../src/services/apiClient';

type Task = {
  id: number;
  title: string;
  description: string;
  type: 'test' | 'assignment' | 'deadline';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  due_date?: string;
  assigned_at: string;
  teacher_name: string;
  subject: string;
  priority: 'low' | 'medium' | 'high';
};

export default function TasksScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  const fetchTasks = useCallback(async () => {
    setError(null);
    try {
      // For now, we'll use the active tests endpoint as a proxy for tasks
      // In a real implementation, this would be a dedicated tasks endpoint
      const response = await api.get('/api/get-student-active-tests');
      const testsData = response.data?.tests ?? response.data?.data ?? [];
      
      // Transform tests into task format
      const tasksData: Task[] = testsData.map((test: any) => ({
        id: test.test_id,
        title: test.test_name,
        description: `Complete the ${test.test_type} test`,
        type: 'test' as const,
        status: 'pending' as const,
        due_date: test.deadline ? new Date(test.deadline * 1000).toISOString() : undefined,
        assigned_at: test.assigned_at ? new Date(test.assigned_at * 1000).toISOString() : new Date().toISOString(),
        teacher_name: test.teacher_name || 'Unknown Teacher',
        subject: 'General',
        priority: 'medium' as const,
      }));
      
      setTasks(tasksData);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchTasks();
    } finally {
      setRefreshing(false);
    }
  }, [fetchTasks]);

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#f59e0b';
      case 'overdue': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity className="bg-white mx-4 mb-3 p-4 rounded-lg shadow-sm border border-gray-200" activeOpacity={0.7}>
      <View className="flex-row justify-between items-start mb-3">
        <Text className="text-lg font-semibold text-gray-800 flex-1 mr-2">{item.title}</Text>
        <View className="px-3 py-1 rounded-full" style={{ backgroundColor: getStatusColor(item.status) }}>
          <Text className="text-white text-xs font-medium">{item.status.replace('_', ' ')}</Text>
        </View>
      </View>
      
      <Text className="text-gray-600 mb-4">{item.description}</Text>
      
      <View className="mb-4">
        <View className="flex-row justify-between items-center py-1">
          <Text className="text-gray-500 text-sm">Teacher:</Text>
          <Text className="text-gray-800 text-sm font-medium">{item.teacher_name}</Text>
        </View>
        <View className="flex-row justify-between items-center py-1">
          <Text className="text-gray-500 text-sm">Subject:</Text>
          <Text className="text-gray-800 text-sm font-medium">{item.subject}</Text>
        </View>
        {item.due_date && (
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-gray-500 text-sm">Due:</Text>
            <Text className="text-gray-800 text-sm font-medium">{formatDate(item.due_date)}</Text>
          </View>
        )}
      </View>
      
      <View className="flex-row justify-between items-center">
        <View className="px-3 py-1 rounded-full" style={{ backgroundColor: getPriorityColor(item.priority) }}>
          <Text className="text-white text-xs font-medium">{item.priority}</Text>
        </View>
        <Text className="text-gray-500 text-sm">{item.type}</Text>
      </View>
    </TouchableOpacity>
  );

  const filterButtons = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
  ] as const;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-header-blue shadow-md">
        <View className="px-4 py-4">
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">Tasks & Assignments</Text>
              <Text className="text-blue-100 text-sm">Track your academic progress</Text>
            </View>
          </View>
        </View>
      </View>

      {error ? (
        <View className="bg-red-50 border border-red-200 rounded-lg p-4 mx-4 mb-4">
          <Text className="text-red-600 text-center">{error}</Text>
        </View>
      ) : null}

      {/* Filter Buttons */}
      <View className="flex-row px-4 mb-4">
        {filterButtons.map((button) => (
          <TouchableOpacity
            key={button.key}
            className={`flex-1 py-2 px-4 mx-1 rounded-lg ${
              filter === button.key ? 'bg-header-blue' : 'bg-gray-200'
            }`}
            onPress={() => setFilter(button.key)}
          >
            <Text className={`text-center font-medium ${
              filter === button.key ? 'text-white' : 'text-gray-700'
            }`}>
              {button.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTask}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View className="flex-1 justify-center items-center py-12">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <View className="flex-1 justify-center items-center py-12">
              <Text className="text-gray-500 text-lg">No tasks found</Text>
              <Text className="text-gray-400 text-sm mt-2 text-center">
                {filter === 'all' 
                  ? 'You have no tasks or assignments' 
                  : `No ${filter.replace('_', ' ')} tasks found`
                }
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

