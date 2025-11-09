/** @jsxImportSource nativewind */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Linking, Alert } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses, getCyberpunkClasses } from '../../utils/themeUtils';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const FAQView: React.FC = () => {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const cyberpunkClasses = getCyberpunkClasses();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const faqData: FAQItem[] = [
    {
      id: '1',
      question: 'How does anti cheating system work?',
      answer: 'It detects if you minimize the app during the test and sends this data with the results. Returning back to main dashboard during test also triggers anti-cheating system. When you start a test, you must finish it and submit it without minimizing the app or returning back to the dashboard.',
      category: 'Anti-Cheating'
    },
    {
      id: '2',
      question: 'How do I know if I have been caught cheating?',
      answer: 'You will be informed about that when results show.',
      category: 'Results'
    },
    {
      id: '3',
      question: 'What do I do if I was caught cheating?',
      answer: 'The teacher decides what to do with your score if you were caught cheating.',
      category: 'Results'
    },
    {
      id: '4',
      question: 'What do I do if I failed?',
      answer: 'Your teacher might appoint a retest for you. You will get a notification in the app if they do.',
      category: 'Results'
    },
    {
      id: '5',
      question: 'What do I do if I failed a retest?',
      answer: 'Unfortunately, there\'s nothing you can do if you have failed a retest.',
      category: 'Results'
    }
  ];

  const categories = ['All', 'Results', 'Anti-Cheating'];

  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const filteredFAQs = selectedCategory === 'All' 
    ? faqData 
    : faqData.filter(item => item.category === selectedCategory);

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getCategoryColor = (category: string): { bg: string; text: string; border: string } => {
    if (themeMode === 'cyberpunk') {
      const colors: Record<string, { bg: string; text: string; border: string }> = {
        'Results': { bg: 'bg-red-400', text: 'text-red-400', border: 'border-red-400' },
        'Anti-Cheating': { bg: 'bg-orange-400', text: 'text-orange-400', border: 'border-orange-400' }
      };
      return colors[category] || { bg: 'bg-cyan-400', text: 'text-cyan-400', border: 'border-cyan-400' };
    }
    return { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-500' };
  };

  return (
    <ScrollView className={`flex-1 ${themeClasses.background}`}>
      <View className="p-6">
        {/* Header */}
        <View className={`mb-8 ${themeMode === 'cyberpunk' ? 'border-b border-cyan-400/30 pb-4' : ''}`}>
          <Text className={`text-3xl font-bold ${themeClasses.text} mb-2 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'FAQ' : 'Frequently Asked Questions'}
          </Text>
          <Text className={`text-base ${themeClasses.textSecondary} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' 
              ? 'YOU CAN FIND ANSWERS TO FREQUENTLY ASKED QUESTIONS HERE'
              : 'You can find answers to frequently asked questions here'
            }
          </Text>
        </View>

        {/* Category Filter */}
        <View className="mb-6">
          <Text className={`text-lg font-semibold ${themeClasses.text} mb-3 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'CATEGORIES' : 'Categories'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {categories.map((category) => {
              const isSelected = selectedCategory === category;
              const colorClasses = getCategoryColor(category);
              return (
                <TouchableOpacity
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  activeOpacity={0.7}
                  className={`px-4 py-2 rounded-full mr-2 ${
                    isSelected
                      ? themeMode === 'cyberpunk'
                        ? `${colorClasses.bg} border-2 ${colorClasses.border}`
                        : 'bg-blue-500'
                      : `${themeClasses.surface} border ${themeClasses.border}`
                  }`}
                >
                  <Text className={`text-sm font-semibold ${
                    isSelected
                      ? themeMode === 'cyberpunk'
                        ? 'text-black'
                        : 'text-white'
                      : themeClasses.text
                  } ${themeMode === 'cyberpunk' && isSelected ? 'tracking-wider' : ''}`}>
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* FAQ Items */}
        <View className="space-y-4">
          {filteredFAQs.map((item, index) => {
            const isExpanded = expandedItems.has(item.id);
            const colorClasses = getCategoryColor(item.category);
            
            return (
              <View
                key={item.id}
                className={`rounded-xl border-2 ${
                  themeMode === 'cyberpunk'
                    ? 'bg-black border-purple-400'
                    : `${themeClasses.surface} ${themeClasses.border}`
                } overflow-hidden`}
              >
                <TouchableOpacity
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.7}
                  className="p-4"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center mb-2">
                        {themeMode === 'cyberpunk' && (
                          <View className={`w-2 h-2 ${colorClasses.bg} rounded-full mr-2`} />
                        )}
                        <Text className={`text-xs font-bold ${
                          themeMode === 'cyberpunk'
                            ? `${colorClasses.text} tracking-wider`
                            : 'text-blue-600'
                        }`}>
                          {item.category}
                        </Text>
                      </View>
                      <Text className={`text-lg font-semibold ${themeClasses.text} ${
                        themeMode === 'cyberpunk' ? 'tracking-wider' : ''
                      }`}>
                        {item.question}
                      </Text>
                    </View>
                    <Image
                      source={
                        isExpanded
                          ? themeMode === 'cyberpunk'
                            ? require('../../../assets/images/arrow-up-cyberpunk.png')
                            : require('../../../assets/images/arrow-up.png')
                          : themeMode === 'cyberpunk'
                            ? require('../../../assets/images/arrow-down-cyberpunk.png')
                            : require('../../../assets/images/arrow-down.png')
                      }
                      className="w-5 h-5"
                      resizeMode="contain"
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View className={`px-4 pb-4 ${
                    themeMode === 'cyberpunk'
                      ? 'border-t border-purple-400'
                      : 'border-t border-gray-200'
                  } pt-2`}>
                    <Text className={`text-base leading-6 ${
                      themeMode === 'cyberpunk' 
                        ? 'text-yellow-400 tracking-wide' 
                        : themeClasses.textSecondary
                    }`}>
                      {item.answer}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Contact & Legal Information Section */}
        <View className={`mt-8 pt-6 ${themeMode === 'cyberpunk' ? 'border-t border-cyan-400/30' : 'border-t border-gray-200'}`}>
          <Text className={`text-xl font-bold ${themeClasses.text} mb-4 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'CONTACT & INFORMATION' : 'Contact & Information'}
          </Text>

          {/* Developer/Contact */}
          <View className={`mb-4 p-4 rounded-xl ${themeClasses.surface} border ${themeClasses.border}`}>
            <Text className={`text-base font-semibold ${themeClasses.text} mb-2 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
              {themeMode === 'cyberpunk' ? 'DEVELOPER / CONTACT' : 'Developer / Contact'}
            </Text>
            <Text className={`text-sm ${themeClasses.textSecondary} mb-1`}>
              Email: <Text className="font-semibold">aleksandr.p@mws.ac.th</Text>
            </Text>
            <TouchableOpacity
              onPress={() => {
                Linking.openURL('mailto:aleksandr.p@mws.ac.th').catch(() => {
                  Alert.alert('Error', 'Unable to open email client');
                });
              }}
              activeOpacity={0.7}
            >
              <Text className={`text-sm underline ${themeMode === 'cyberpunk' ? 'text-cyan-400' : themeMode === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                {themeMode === 'cyberpunk' ? 'SEND EMAIL' : 'Send Email'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Website */}
          <View className={`mb-4 p-4 rounded-xl ${themeClasses.surface} border ${themeClasses.border}`}>
            <Text className={`text-base font-semibold ${themeClasses.text} mb-2 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
              {themeMode === 'cyberpunk' ? 'WEBSITE' : 'Website'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Linking.openURL('https://mathayomwatsing.netlify.app').catch(() => {
                  Alert.alert('Error', 'Unable to open website');
                });
              }}
              activeOpacity={0.7}
            >
              <Text className={`text-sm ${themeMode === 'cyberpunk' ? 'text-cyan-400' : themeMode === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                https://mathayomwatsing.netlify.app
              </Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Policy */}
          <View className={`mb-4 p-4 rounded-xl ${themeClasses.surface} border ${themeClasses.border}`}>
            <Text className={`text-base font-semibold ${themeClasses.text} mb-2 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
              {themeMode === 'cyberpunk' ? 'PRIVACY POLICY' : 'Privacy Policy'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Linking.openURL('https://mathayomwatsing.netlify.app/privacy').catch(() => {
                  Alert.alert('Error', 'Unable to open Privacy Policy');
                });
              }}
              activeOpacity={0.7}
            >
              <Text className={`text-sm ${themeMode === 'cyberpunk' ? 'text-cyan-400' : themeMode === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                {themeMode === 'cyberpunk' ? 'VIEW PRIVACY POLICY' : 'View Privacy Policy'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms of Service */}
          <View className={`mb-4 p-4 rounded-xl ${themeClasses.surface} border ${themeClasses.border}`}>
            <Text className={`text-base font-semibold ${themeClasses.text} mb-2 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
              {themeMode === 'cyberpunk' ? 'TERMS OF SERVICE' : 'Terms of Service'}
            </Text>
            <Text className={`text-sm ${themeClasses.textSecondary}`}>
              {themeMode === 'cyberpunk' 
                ? 'TERMS OF SERVICE ARE SHOWN ON FIRST LOGIN AND CAN BE VIEWED IN THE APP SETTINGS.'
                : 'Terms of Service are shown on first login and can be viewed in the app settings.'}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default FAQView;

