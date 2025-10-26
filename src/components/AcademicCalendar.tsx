import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { academicCalendarService } from '../services/AcademicCalendarService';
import { useApi } from '../hooks/useApi';
import { logger } from '../utils/logger';

interface AcademicCalendarProps {
  onEventPress?: (event: any) => void;
  onExportCalendar?: () => void;
}

export function AcademicCalendar({ onEventPress, onExportCalendar }: AcademicCalendarProps) {
  const [calendar, setCalendar] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [importantDates, setImportantDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'calendar' | 'events' | 'upcoming' | 'important'>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Load calendar data
  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const [calendarData, eventsData, upcomingData, importantData] = await Promise.all([
        academicCalendarService.getCurrentCalendar(),
        academicCalendarService.getAcademicEvents(),
        academicCalendarService.getUpcomingEvents(10),
        academicCalendarService.getImportantDates(),
      ]);
      
      setCalendar(calendarData);
      setEvents(eventsData);
      setUpcomingEvents(upcomingData);
      setImportantDates(importantData);
      
      logger.info('Academic calendar data loaded', 'academic-calendar', {
        events: eventsData.length,
        upcoming: upcomingData.length,
        important: importantData.length,
      });
    } catch (error) {
      logger.error('Failed to load academic calendar data', 'academic-calendar', error);
      Alert.alert('Error', 'Failed to load calendar data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCalendarData();
    } catch (error) {
      logger.error('Failed to refresh academic calendar data', 'academic-calendar', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadCalendarData]);

  // Load data on mount
  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Get event type color
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'test': return '#4f46e5';
      case 'exam': return '#ef4444';
      case 'holiday': return '#10b981';
      case 'break': return '#f59e0b';
      case 'event': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  // Get event type icon
  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'test': return '📝';
      case 'exam': return '📋';
      case 'holiday': return '🎉';
      case 'break': return '🏖️';
      case 'event': return '📅';
      default: return '📌';
    }
  };

  // Get importance color
  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Render calendar view
  const renderCalendar = () => {
    if (!calendar) return null;

    return (
      <View style={styles.calendarContainer}>
        {/* Current Academic Info */}
        <View style={styles.academicInfoCard}>
          <Text style={styles.academicInfoTitle}>Current Academic Period</Text>
          <View style={styles.academicInfoRow}>
            <Text style={styles.academicInfoLabel}>Academic Year:</Text>
            <Text style={styles.academicInfoValue}>{calendar.current_year.year}</Text>
          </View>
          <View style={styles.academicInfoRow}>
            <Text style={styles.academicInfoLabel}>Current Term:</Text>
            <Text style={styles.academicInfoValue}>{calendar.current_term.name}</Text>
          </View>
          <View style={styles.academicInfoRow}>
            <Text style={styles.academicInfoLabel}>Current Period:</Text>
            <Text style={styles.academicInfoValue}>{calendar.current_period.name}</Text>
          </View>
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <View style={styles.eventsList}>
            {calendar.upcoming_events.slice(0, 5).map((event: any, index: number) => (
              <TouchableOpacity
                key={index}
                style={styles.eventCard}
                onPress={() => onEventPress?.(event)}
              >
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={[
                    styles.eventTypeBadge,
                    { backgroundColor: getEventTypeColor(event.type) }
                  ]}>
                    <Text style={styles.eventTypeText}>
                      {getEventTypeIcon(event.type)} {event.type.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.eventDate}>
                  {formatDate(event.start_date)} at {formatTime(event.start_date)}
                </Text>
                {event.description && (
                  <Text style={styles.eventDescription} numberOfLines={2}>
                    {event.description}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Important Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Important Dates</Text>
          <View style={styles.importantDatesList}>
            {calendar.important_dates.slice(0, 5).map((date: any, index: number) => (
              <View key={index} style={styles.importantDateCard}>
                <View style={styles.importantDateHeader}>
                  <Text style={styles.importantDateTitle}>{date.title}</Text>
                  <View style={[
                    styles.importanceBadge,
                    { backgroundColor: getImportanceColor(date.importance) }
                  ]}>
                    <Text style={styles.importanceText}>{date.importance.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.importantDateDate}>
                  {formatDate(date.start_date)}
                </Text>
                {date.description && (
                  <Text style={styles.importantDateDescription}>
                    {date.description}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Render events view
  const renderEvents = () => {
    return (
      <View style={styles.eventsContainer}>
        <Text style={styles.sectionTitle}>All Events</Text>
        <View style={styles.eventsList}>
          {events.map((event, index) => (
            <TouchableOpacity
              key={index}
              style={styles.eventCard}
              onPress={() => onEventPress?.(event)}
            >
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <View style={[
                  styles.eventTypeBadge,
                  { backgroundColor: getEventTypeColor(event.type) }
                ]}>
                  <Text style={styles.eventTypeText}>
                    {getEventTypeIcon(event.type)} {event.type.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.eventDate}>
                {formatDate(event.start_date)} at {formatTime(event.start_date)}
              </Text>
              {event.description && (
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {event.description}
                </Text>
              )}
              {event.location && (
                <Text style={styles.eventLocation}>📍 {event.location}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Render upcoming view
  const renderUpcoming = () => {
    return (
      <View style={styles.upcomingContainer}>
        <Text style={styles.sectionTitle}>Upcoming Events</Text>
        <View style={styles.eventsList}>
          {upcomingEvents.map((event, index) => (
            <TouchableOpacity
              key={index}
              style={styles.eventCard}
              onPress={() => onEventPress?.(event)}
            >
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <View style={[
                  styles.eventTypeBadge,
                  { backgroundColor: getEventTypeColor(event.type) }
                ]}>
                  <Text style={styles.eventTypeText}>
                    {getEventTypeIcon(event.type)} {event.type.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.eventDate}>
                {formatDate(event.start_date)} at {formatTime(event.start_date)}
              </Text>
              {event.description && (
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {event.description}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Render important dates view
  const renderImportantDates = () => {
    return (
      <View style={styles.importantDatesContainer}>
        <Text style={styles.sectionTitle}>Important Dates</Text>
        <View style={styles.importantDatesList}>
          {importantDates.map((date, index) => (
            <View key={index} style={styles.importantDateCard}>
              <View style={styles.importantDateHeader}>
                <Text style={styles.importantDateTitle}>{date.title}</Text>
                <View style={[
                  styles.importanceBadge,
                  { backgroundColor: getImportanceColor(date.importance) }
                ]}>
                  <Text style={styles.importanceText}>{date.importance.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.importantDateDate}>
                {formatDate(date.start_date)}
              </Text>
              {date.description && (
                <Text style={styles.importantDateDescription}>
                  {date.description}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Academic Calendar</Text>
        <Text style={styles.subtitle}>
          Stay updated with important dates and events
        </Text>
      </View>

      {/* View Selector */}
      <View style={styles.viewSelector}>
        {[
          { key: 'calendar', label: 'Calendar' },
          { key: 'events', label: 'Events' },
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'important', label: 'Important' },
        ].map((view) => (
          <TouchableOpacity
            key={view.key}
            style={[
              styles.viewButton,
              selectedView === view.key && styles.activeViewButton
            ]}
            onPress={() => setSelectedView(view.key as any)}
          >
            <Text style={[
              styles.viewButtonText,
              selectedView === view.key && styles.activeViewButtonText
            ]}>
              {view.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading calendar data...</Text>
          </View>
        ) : (
          <>
            {selectedView === 'calendar' && renderCalendar()}
            {selectedView === 'events' && renderEvents()}
            {selectedView === 'upcoming' && renderUpcoming()}
            {selectedView === 'important' && renderImportantDates()}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4f46e5',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  viewButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  activeViewButton: {
    backgroundColor: '#4f46e5',
  },
  viewButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeViewButtonText: {
    color: 'white',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  calendarContainer: {
    padding: 16,
  },
  academicInfoCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  academicInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  academicInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  academicInfoLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  academicInfoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  eventsContainer: {
    padding: 16,
  },
  upcomingContainer: {
    padding: 16,
  },
  importantDatesContainer: {
    padding: 16,
  },
  eventsList: {
    gap: 12,
  },
  eventCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    marginRight: 12,
  },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  eventTypeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventDate: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  eventLocation: {
    fontSize: 12,
    color: '#9ca3af',
  },
  importantDatesList: {
    gap: 12,
  },
  importantDateCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  importantDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  importantDateTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    marginRight: 12,
  },
  importanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  importanceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  importantDateDate: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  importantDateDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});
