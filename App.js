import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from './src/lib/ThemeContext';
import LearnScreen     from './src/screens/LearnScreen';
import ModulesScreen   from './src/screens/ModulesScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SettingsScreen  from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function AppTabs() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          },
          tabBarActiveTintColor:   colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          headerStyle: {
            backgroundColor: colors.surface,
            shadowColor: 'transparent',
            elevation: 0,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '700',
          },
        }}
      >
        <Tab.Screen
          name="Lernen"
          component={LearnScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📚</Text>,
            headerTitle: 'LSS Lern-App',
          }}
        />
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
          }}
        />
        <Tab.Screen
          name="Module"
          component={ModulesScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text>,
          }}
        />
        <Tab.Screen
          name="Einstellungen"
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
          }}
        />
      </Tab.Navigator>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <AppTabs />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
