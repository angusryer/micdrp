import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import LibraryScreen from '../screens/Library/LibraryScreen';
import RecordScreen from '../screens/Record/RecordScreen';
import ResultsScreen from '../screens/Results/ResultsScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name='Record' component={RecordScreen} />
      <Tab.Screen name='Library' component={LibraryScreen} />
      <Tab.Screen name='Settings' component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name='Main' component={MainTabs} />
        <Stack.Screen
          name='Results'
          component={ResultsScreen}
          options={{ headerShown: true, title: 'Results', presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
