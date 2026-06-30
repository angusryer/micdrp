import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useAuth } from '../auth';
import LibraryScreen from '../screens/Library/LibraryScreen';
import LoginScreen from '../screens/Login/LoginScreen';
import RecordScreen from '../screens/Record/RecordScreen';
import ResultsScreen from '../screens/Results/ResultsScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import type {
  AuthStackParamList,
  MainTabParamList,
  RootStackParamList
} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
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
  const { session, loading } = useAuth();

  if (loading) {
    return null; // initial session restore; a splash can replace this later
  }

  return (
    <NavigationContainer>
      {session ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name='Main' component={MainTabs} />
          <Stack.Screen
            name='Results'
            component={ResultsScreen}
            options={{
              headerShown: true,
              title: 'Results',
              presentation: 'modal'
            }}
          />
        </Stack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name='Login' component={LoginScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
