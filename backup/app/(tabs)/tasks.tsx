import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
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
    <TouchableOpacity style={styles.taskCard} activeOpacity={0.7}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
        </View>
      </View>
      
      <Text style={styles.taskDescription}>{item.description}</Text>
      
      <View style={styles.taskMeta}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Teacher:</Text>
          <Text style={styles.metaValue}>{item.teacher_name}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Subject:</Text>
          <Text style={styles.metaValue}>{item.subject}</Text>
        </View>
        {item.due_date && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Due:</Text>
            <Text style={styles.metaValue}>{formatDate(item.due_date)}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.taskFooter}>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
          <Text style={styles.priorityText}>{item.priority}</Text>
        </View>
        <Text style={styles.taskType}>{item.type}</Text>
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
    <View style={styles.container}>
      <Text style={styles.title}>Tasks & Assignments</Text>
      <Text style={styles.subtitle}>Track your academic progress</Text>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {filterButtons.map((button) => (
          <TouchableOpacity
            key={button.key}
            style={[
              styles.filterButton,
              filter === button.key && styles.filterButtonActive
            ]}
            onPress={() => setFilter(button.key)}
          >
            <Text style={[
              styles.filterButtonText,
              filter === button.key && styles.filterButtonTextActive
            ]}>
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
            <ActivityIndicator style={styles.loadingIndicator} />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tasks found</Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all' 
                  ? 'You have no tasks or assignments' 
                  : `No ${filter.replace('_', ' ')} tasks found`
                }
              </Text>
            </View>
          )
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  listContainer: {
    paddingBottom: 16,
  },
  taskCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize',
  },
  taskDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  taskMeta: {
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    width: 60,
  },
  metaValue: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize',
  },
  taskType: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'capitalize',
  },
  loadingIndicator: {
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
