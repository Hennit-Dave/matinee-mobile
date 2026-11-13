import { BlurTargetView } from 'expo-blur';
import { Tabs, usePathname, useRouter, type Href } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { NAV_ITEMS, NavBar, useReduceTransparency, type NavBarProps, type NavItemKey } from '../../components';
import { ANDROID_GLASS_ENABLED, activeNavItem } from '../../components/navBarLogic';

/**
 * Connects the presentational NavBar to Expo Router: the active item comes from the URL path and a
 * press navigates to that item's path.
 */
function TabNavBar({ blurTarget }: Pick<NavBarProps, 'blurTarget'>) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceTransparency = useReduceTransparency();
  const active = activeNavItem(pathname) ?? 'home';

  const onNavigate = (item: NavItemKey) => {
    const spec = NAV_ITEMS.find((candidate) => candidate.key === item);
    if (spec && spec.key !== active) router.navigate(spec.href as Href);
  };

  return <NavBar active={active} reduceTransparency={reduceTransparency} onNavigate={onNavigate} blurTarget={blurTarget} />;
}

/**
 * The three tabs, drawn by the floating glass NavBar instead of Expo Router's default tab bar. Seat
 * selection and Checkout will be stack screens outside this group, so they naturally do not show it
 * (nothing to build for that yet).
 *
 * Why the NavBar is not the navigator's own `tabBar`: Android's backdrop blur reads from a
 * BlurTargetView, and the BlurView must be a sibling of that target, not inside it (inside, it blurs
 * itself and the renderer crashes). Expo Router draws the tab bar inside the navigator next to the
 * screens, with no way to wrap only the screens, so the default bar is switched off and the NavBar is
 * drawn here, beside the target that holds the Tabs. On iOS the target is a plain View.
 */
// Only wrap the screens in the native blur target when Android glass is actually on: otherwise it is an
// extra native view for nothing. (On iOS BlurTargetView is a plain View, so this costs nothing there.)
const ScreensTarget = ANDROID_GLASS_ENABLED ? BlurTargetView : View;

export default function TabsLayout() {
  const blurTarget = useRef<ComponentRef<typeof View>>(null);

  return (
    <View style={styles.fill}>
      <ScreensTarget ref={blurTarget} style={styles.fill}>
        <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
          <Tabs.Screen name="account" options={{ title: 'Account' }} />
        </Tabs>
      </ScreensTarget>
      <TabNavBar blurTarget={blurTarget} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
