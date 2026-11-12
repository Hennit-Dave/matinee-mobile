import { Tabs } from 'expo-router';
import { useTheme } from '../../theme';

/**
 * Expo Router's own tab bar, coloured from tokens. The foundation brief's floating rounded-pill nav has no
 * Figma frame yet (DESIGN-STUDY.md / FOUNDATION-BRIEF.md: screen design is the next step) — this proves the
 * three routes and reads as the right theme in the meantime, not the final nav component.
 */
export default function TabsLayout() {
  const { colors, text } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors['primary/default'],
        tabBarInactiveTintColor: colors['text/secondary'],
        tabBarStyle: {
          backgroundColor: colors['surface/raised'],
          borderTopColor: colors['border/default'],
        },
        tabBarLabelStyle: { fontFamily: text['type/caption'].fontFamily, fontSize: text['type/caption'].fontSize },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
