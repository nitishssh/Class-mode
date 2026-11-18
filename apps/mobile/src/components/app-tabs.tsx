import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { getTabsForRole } from '@/lib/role-navigation';
import { useSessionUser } from '@/lib/session';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { user } = useSessionUser();
  const tabs = getTabsForRole(user.role);

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.route} name={tab.route}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.iosIcon} md={tab.androidIcon} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
