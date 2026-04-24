import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { registerWithEmail, UserRole } from '../../lib/firebase';
import { ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await registerWithEmail(email, password, displayName, role);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-8">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-4xl font-bold text-gray-900 mb-2">
              Create Account
            </Text>
            <Text className="text-lg text-gray-600">
              Join PersonalLearningPro today
            </Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Full Name
              </Text>
              <TextInput
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                placeholder="Enter your full name"
                value={displayName}
                onChangeText={setDisplayName}
                editable={!isLoading}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Email
              </Text>
              <TextInput
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Password
              </Text>
              <TextInput
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                placeholder="Create a password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isLoading}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                I am a...
              </Text>
              <View className="border border-gray-300 rounded-lg bg-white">
                <Picker
                  selectedValue={role}
                  onValueChange={(value) => setRole(value as UserRole)}
                  enabled={!isLoading}
                >
                  <Picker.Item label="Student" value="student" />
                  <Picker.Item label="Teacher" value="teacher" />
                  <Picker.Item label="Parent" value="parent" />
                  <Picker.Item label="School Admin" value="school_admin" />
                  <Picker.Item label="Principal" value="principal" />
                </Picker>
              </View>
            </View>

            <Pressable
              className="bg-primary-600 rounded-lg py-4 mt-6"
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-semibold text-lg">
                  Create Account
                </Text>
              )}
            </Pressable>

            <Pressable
              className="mt-4"
              onPress={() => router.back()}
              disabled={isLoading}
            >
              <Text className="text-center text-primary-600">
                Already have an account? Sign In
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
