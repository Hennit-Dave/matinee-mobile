import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navBarClearance } from './navBarLogic';

/**
 * Bottom padding a scrolling tab screen needs so its last content clears the floating NavBar. The
 * list itself still runs behind the pill (that is the point of the glass); only its end is padded.
 */
export function useNavBarClearance(): number {
  const { bottom } = useSafeAreaInsets();
  return navBarClearance(bottom);
}
