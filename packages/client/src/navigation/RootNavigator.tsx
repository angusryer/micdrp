import { NavigationContainer, useNavigation } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp
} from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { useTranslation } from '../i18n';
import { Icon, type IconName } from '../components/Icon';
import Splash from '../screens/Splash';
import AccountScreen from '../screens/Account/AccountScreen';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import LoginScreen from '../screens/Login/LoginScreen';
import NoteDetailScreen from '../screens/Notes/NoteDetailScreen';
import NotesScreen from '../screens/Notes/NotesScreen';
import PracticeScreen from '../screens/Practice/PracticeScreen';
import PracticeSessionScreen from '../screens/Practice/PracticeSessionScreen';
import ResultsScreen from '../screens/Results/ResultsScreen';
import type {
  AuthStackParamList,
  MainTabParamList,
  RootStackParamList
} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/** Header button (top-right of every tab) that opens Account & Settings. */
function AccountHeaderButton() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const onPress = useCallback(
    () => navigation.navigate('Account'),
    [navigation]
  );
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('account.open')}
      style={styles.headerButton}
    >
      <Icon name="settings" size={24} color={colors.primary500} />
    </Pressable>
  );
}

/** Tab id → glyph for the bottom tab bar. */
const TAB_ICONS: Record<keyof MainTabParamList, IconName> = {
  Practice: 'practice',
  Notes: 'notes',
  Dashboard: 'dashboard'
};

function MainTabs() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: colors.neutral300 },
        headerTitleStyle: { color: colors.typography },
        headerShadowVisible: false,
        headerRight: () => <AccountHeaderButton />,
        tabBarActiveTintColor: colors.primary500,
        tabBarInactiveTintColor: colors.gray300,
        tabBarStyle: { backgroundColor: colors.neutral100 },
        tabBarIcon: ({ color, size }) => (
          <Icon name={TAB_ICONS[route.name]} size={size} color={color} />
        )
      })}
    >
      <Tab.Screen
        name="Practice"
        component={PracticeScreen}
        options={{ title: t('practice.title') }}
      />
      <Tab.Screen
        name="Notes"
        component={NotesScreen}
        options={{ title: t('notes.title') }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: t('dashboard.title') }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { session, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    // Initial session restore: show the branded splash instead of a blank frame.
    return <Splash />;
  }

  return (
    <NavigationContainer>
      {session ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="PracticeSession"
            component={PracticeSessionScreen}
          />
          <Stack.Screen
            name="Results"
            component={ResultsScreen}
            options={{
              headerShown: true,
              title: t('results.title'),
              presentation: 'modal'
            }}
          />
          <Stack.Screen
            name="NoteDetail"
            component={NoteDetailScreen}
            options={{ headerShown: true, title: t('notes.detailTitle') }}
          />
          <Stack.Screen
            name="Account"
            component={AccountScreen}
            options={{
              headerShown: true,
              title: t('account.title'),
              presentation: 'modal'
            }}
          />
        </Stack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerButton: { paddingHorizontal: 16 }
});
