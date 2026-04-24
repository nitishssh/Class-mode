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
import { loginWithEmail } from '../../lib/firebase';
import { validateEmail, validatePassword } from '../../lib/validation';
import { ActivityIndicator } from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const router = useRouter();

  const handleLogin = async () => {
    // Validate inputs
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);

    if (!emailValidation.isValid || !passwordValidation.isValid) {
      setErrors({
        email: emailValidation.error || '',
        password: passwordValidation.error || '',
      });
      return;
    }

    setErrors({ email: '', password: '' });
    setIsLoading(true);

    try {
      await loginWithEmail(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
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
        <View className="flex-1 justify-center px-6">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-4xl font-bold text-gray-900 mb-2">
              Welcome Back
            </Text>
            <Text className="text-lg text-gray-600">
              Sign in to continue learning
            </Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Email
              </Text>
              <TextInput
                className={`w-full px-4 py-3 border rounded-lg bg-white ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
                accessibilityLabel="Email input"
                accessibilityHint="Enter your email address"
              />
              {errors.email ? (
                <Text className="text-red-500 text-sm mt-1">{errors.email}</Text>
              ) : null}
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Password
              </Text>
              <TextInput
                className={`w-full px-4 py-3 border rounded-lg bg-white ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                secureTextEntry
                editable={!isLoading}
                accessibilityLabel="Password input"
                accessibilityHint="Enter your password"
              />
              {errors.password ? (
                <Text className="text-red-500 text-sm mt-1">{errors.password}</Text>
              ) : null}
            </View>

            <Pressable
              className="bg-primary-600 rounded-lg py-4 mt-6"
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityLabel="Sign in button"
              accessibilityRole="button"
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-semibold text-lg">
                  Sign In
                </Text>
              )}
            </Pressable>

            <Pressable
              className="mt-4"
              onPress={() => router.push('/(auth)/register')}
              disabled={isLoading}
              accessibilityLabel="Go to sign up"
              accessibilityRole="button"
            >
              <Text className="text-center text-primary-600">
                Don't have an account? Sign Up
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
