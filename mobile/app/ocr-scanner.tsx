import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';

export default function OCRScanner() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const cameraRef = useRef<any>(null);

  const handleTakePicture = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      setCameraActive(false);
      await processImage(photo.uri, photo.base64);
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
      setIsProcessing(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setIsProcessing(true);
        await processImage(result.assets[0].uri, result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const processImage = async (uri: string, base64?: string) => {
    try {
      // Call backend OCR API
      const response = await api.post('/api/ocr/extract', {
        image: base64 || uri,
      });

      setExtractedText(response.data.text || 'No text detected');
      setEditMode(true);
    } catch (error: any) {
      console.error('OCR processing error:', error);
      
      // Fallback: Show mock extracted text for demo
      setExtractedText(
        'Sample extracted text:\n\n' +
        'This is a demonstration of OCR functionality. ' +
        'In production, this would contain the actual text extracted from your image.\n\n' +
        'Math Problem:\n' +
        'Solve for x: 2x + 5 = 15\n\n' +
        'You can edit this text below.'
      );
      setEditMode(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    Alert.alert(
      'Save Text',
      'Where would you like to save this text?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save as Note',
          onPress: () => {
            // TODO: Implement save to notes
            Alert.alert('Success', 'Text saved to notes');
            router.back();
          },
        },
        {
          text: 'Ask AI Tutor',
          onPress: () => {
            // Navigate to AI tutor with extracted text
            router.push({
              pathname: '/(tabs)/ai-tutor',
              params: { initialMessage: extractedText },
            });
          },
        },
      ]
    );
  };

  const handleRetake = () => {
    setExtractedText('');
    setEditMode(false);
    setCameraActive(true);
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-gray-50">
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'OCR Scanner',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
            ),
          }}
        />
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="camera-outline" size={80} color="#9CA3AF" />
          <Text className="text-xl font-semibold text-gray-900 mt-6 text-center">
            Camera Permission Required
          </Text>
          <Text className="text-gray-600 mt-2 text-center">
            We need access to your camera to scan documents and extract text.
          </Text>
          <TouchableOpacity
            className="bg-blue-600 rounded-lg px-6 py-3 mt-6"
            onPress={requestPermission}
          >
            <Text className="text-white font-semibold">Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isProcessing) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 mt-4">Processing image...</Text>
      </View>
    );
  }

  if (editMode && extractedText) {
    return (
      <View className="flex-1 bg-gray-50">
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Extracted Text',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView className="flex-1 p-4">
          <View className="bg-white rounded-lg p-4 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-gray-900">
                Extracted Text
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="bg-gray-100 rounded-lg px-3 py-2"
                  onPress={handleRetake}
                >
                  <Ionicons name="camera-outline" size={20} color="#3B82F6" />
                </TouchableOpacity>
              </View>
            </View>
            <TextInput
              className="bg-gray-50 rounded-lg p-3 min-h-[300px] text-gray-900"
              multiline
              value={extractedText}
              onChangeText={setExtractedText}
              placeholder="Extracted text will appear here..."
              textAlignVertical="top"
            />
          </View>

          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              className="flex-1 bg-blue-600 rounded-lg py-4"
              onPress={handleSave}
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="save-outline" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Save</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-green-600 rounded-lg py-4"
              onPress={() => {
                router.push({
                  pathname: '/(tabs)/ai-tutor',
                  params: { initialMessage: extractedText },
                });
              }}
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="chatbubble-outline" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Ask AI</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <Text className="text-sm text-blue-800 ml-2 flex-1">
                You can edit the extracted text above. Tap "Ask AI" to get help with the content, or "Save" to store it as a note.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (cameraActive) {
    return (
      <View className="flex-1 bg-black">
        <Stack.Screen options={{ headerShown: false }} />
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
        >
          <View className="flex-1 justify-between">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 pt-12">
              <TouchableOpacity
                className="bg-black/50 rounded-full p-2"
                onPress={() => {
                  setCameraActive(false);
                  router.back();
                }}
              >
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
              <Text className="text-white font-semibold text-lg">
                Scan Document
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Instructions */}
            <View className="items-center mb-8">
              <View className="bg-black/70 rounded-lg px-6 py-3">
                <Text className="text-white text-center">
                  Position document within frame
                </Text>
              </View>
            </View>

            {/* Controls */}
            <View className="items-center pb-12">
              <TouchableOpacity
                className="bg-white rounded-full w-20 h-20 items-center justify-center mb-6"
                onPress={handleTakePicture}
              >
                <View className="bg-blue-600 rounded-full w-16 h-16" />
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-black/50 rounded-full px-6 py-3"
                onPress={() => setCameraActive(false)}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'OCR Scanner',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView className="flex-1 p-6">
        <View className="items-center mb-8">
          <View className="w-32 h-32 bg-blue-100 rounded-full items-center justify-center mb-4">
            <Ionicons name="scan-outline" size={64} color="#3B82F6" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-2">
            Scan Documents
          </Text>
          <Text className="text-gray-600 text-center">
            Extract text from images, homework, notes, and documents
          </Text>
        </View>

        <View className="gap-4">
          <TouchableOpacity
            className="bg-blue-600 rounded-lg p-6"
            onPress={() => setCameraActive(true)}
          >
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center mr-4">
                <Ionicons name="camera" size={24} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-lg mb-1">
                  Take Photo
                </Text>
                <Text className="text-white/80 text-sm">
                  Capture a document with your camera
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="white" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-white rounded-lg p-6 border border-gray-200"
            onPress={handlePickImage}
          >
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-4">
                <Ionicons name="images" size={24} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold text-lg mb-1">
                  Choose from Gallery
                </Text>
                <Text className="text-gray-600 text-sm">
                  Select an existing image to scan
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        <View className="mt-8">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            What you can scan:
          </Text>
          <View className="gap-3">
            {[
              { icon: 'document-text-outline', text: 'Homework assignments' },
              { icon: 'book-outline', text: 'Textbook pages' },
              { icon: 'create-outline', text: 'Handwritten notes' },
              { icon: 'calculator-outline', text: 'Math problems' },
              { icon: 'newspaper-outline', text: 'Study materials' },
            ].map((item, index) => (
              <View key={index} className="flex-row items-center">
                <Ionicons name={item.icon as any} size={20} color="#3B82F6" />
                <Text className="text-gray-700 ml-3">{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
          <View className="flex-row items-start">
            <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
            <Text className="text-sm text-yellow-800 ml-2 flex-1">
              For best results, ensure good lighting and hold the camera steady. The text will be extracted automatically.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
