import { Platform } from 'react-native';

// Contract under test (release gate: push must work on the pilot devices):
// - simulator/emulator → 'unavailable', never touches permissions or the API
// - permission denied → 'denied', no token fetch, no API call
// - already-granted permission is NOT re-requested (no surprise prompt)
// - missing EAS projectId → 'unavailable' (the pre-`eas init` state)
// - happy path: Android channel exists, token fetched with projectId, POSTed once
// Platform.OS is forced per test (jest-expo runs a single platform), so both
// the Android and iOS branches actually execute instead of one being dead code.

const ANDROID_IMPORTANCE_MAX = 5;

const mockDevice = { isDevice: true };
jest.mock('expo-device', () => ({
  get isDevice() {
    return mockDevice.isDevice;
  },
}));

const mockConstants: { expoConfig: unknown; easConfig: unknown } = {
  expoConfig: null,
  easConfig: null,
};
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockConstants.expoConfig;
    },
    get easConfig() {
      return mockConstants.easConfig;
    },
  },
}));

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  AndroidImportance: { MAX: 5 },
}));

const mockApiPost = jest.fn();
jest.mock('@/lib/api', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

// Imported after the mock state above so the hoisted factories never hit the TDZ.
// eslint-disable-next-line import/first
import { registerForPushNotifications } from '@/lib/notifications';

const realPlatformOS = Platform.OS;

function forcePlatform(os: 'android' | 'ios') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDevice.isDevice = true;
  mockConstants.expoConfig = { extra: { eas: { projectId: 'proj-123' } } };
  mockConstants.easConfig = null;
  mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  mockApiPost.mockResolvedValue({ success: true, message: 'ok' });
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: realPlatformOS, configurable: true });
});

describe('registerForPushNotifications', () => {
  it('returns unavailable on simulators without touching permissions or the API', async () => {
    mockDevice.isDevice = false;

    const res = await registerForPushNotifications();

    expect(res.status).toBe('unavailable');
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('returns denied when the user refuses the permission prompt, and never fetches a token', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const res = await registerForPushNotifications();

    expect(res).toEqual({ status: 'denied' });
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('does not re-prompt when permission is already granted', async () => {
    await registerForPushNotifications();

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns unavailable when no EAS projectId is configured (pre-`eas init` state)', async () => {
    mockConstants.expoConfig = { extra: {} };
    mockConstants.easConfig = null;

    const res = await registerForPushNotifications();

    expect(res).toEqual({
      status: 'unavailable',
      reason: 'EAS project id is not configured.',
    });
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('falls back to easConfig.projectId when expoConfig has none', async () => {
    mockConstants.expoConfig = null;
    mockConstants.easConfig = { projectId: 'proj-from-eas-config' };

    const res = await registerForPushNotifications();

    expect(res.status).toBe('registered');
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'proj-from-eas-config',
    });
  });

  it('registers an Android device token with the literal android deviceType', async () => {
    forcePlatform('android');

    const res = await registerForPushNotifications();

    expect(res).toEqual({ status: 'registered', token: 'ExponentPushToken[abc]' });
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-123' });
    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/tokens',
      { token: 'ExponentPushToken[abc]', deviceType: 'android' },
      expect.anything()
    );
  });

  it('registers an iOS device token with the literal ios deviceType', async () => {
    forcePlatform('ios');

    const res = await registerForPushNotifications();

    expect(res).toEqual({ status: 'registered', token: 'ExponentPushToken[abc]' });
    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/tokens',
      { token: 'ExponentPushToken[abc]', deviceType: 'ios' },
      expect.anything()
    );
  });

  it('sets up the Android notification channel before asking for permission', async () => {
    forcePlatform('android');

    await registerForPushNotifications();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ importance: ANDROID_IMPORTANCE_MAX })
    );
    const channelOrder = mockSetNotificationChannelAsync.mock.invocationCallOrder[0];
    const permissionOrder = mockGetPermissionsAsync.mock.invocationCallOrder[0];
    expect(channelOrder).toBeLessThan(permissionOrder);
  });

  it('never touches the notification channel on iOS', async () => {
    forcePlatform('ios');

    await registerForPushNotifications();

    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('propagates a server registration failure instead of reporting registered', async () => {
    mockApiPost.mockRejectedValue(new Error('network down'));

    await expect(registerForPushNotifications()).rejects.toThrow('network down');
  });
});
