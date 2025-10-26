import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ResultsTable } from '../ResultsTable';
import { TestResult } from '../../types';

type Props = {
  results: TestResult[];
  loading: boolean;
  showAllResults: boolean;
  onToggleShowAll: () => void;
};

export function ResultsView({ results, loading, showAllResults, onToggleShowAll }: Props) {
  const skeletonItems = Array.from({ length: 3 }).map((_, i) => i);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Test Results</Text>
      <View style={styles.card}>
        {loading ? (
          skeletonItems.map((i) => (
            <View key={`r-skel-${i}`} style={styles.cardSkeleton} />
          ))
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Results Yet</Text>
            <Text style={styles.emptyText}>Complete some tests to see your results here.</Text>
          </View>
        ) : (
          <ResultsTable
            results={results}
            showAll={showAllResults}
            onToggleShowAll={onToggleShowAll}
            maxInitial={3}
            compact={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  cardSkeleton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    height: 60,
    marginBottom: 8,
  },
});
