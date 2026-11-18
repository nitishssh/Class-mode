import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiPost } from '@/lib/api';
import { actionSuccessResponseSchema, type ActionSuccessResponse } from '@/shared/mobile-api';

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'denied' };

export async function registerDevicePushToken(
  token: string,
  deviceType = Platform.OS
): Promise<ActionSuccessResponse> {
  return apiPost('/api/tokens', { token, deviceType }, actionSuccessResponseSchema);
}

function easProjectId(): string | null {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    return { status: 'unavailable', reason: 'Push notifications need a physical device.' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F6C945',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing.status === 'granted'
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== 'granted') {
    return { status: 'denied' };
  }

  const projectId = easProjectId();
  if (!projectId) {
    return { status: 'unavailable', reason: 'EAS project id is not configured.' };
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId,
    })
  ).data;
  await registerDevicePushToken(token);
  return { status: 'registered', token };
}
