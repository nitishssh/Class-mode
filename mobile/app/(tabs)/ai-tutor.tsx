import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import api from '../../lib/api';
import ReactMarkdown from 'react-native-markdown-display';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AITutorScreen() {
  const params = useLocalSearchParams();
  const initialMessage = params.initialMessage as string | undefined;
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI tutor. Ask me anything about your subjects, and I\'ll help you learn!',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const hasProcessedInitialMessage = useRef(false);

  // Handle initial message from OCR or other sources
  useEffect(() => {
    if (initialMessage && !hasProcessedInitialMessage.current) {
      hasProcessedInitialMessage.current = true;
      setInput(initialMessage);
      // Auto-send after a short delay
      setTimeout(() => {
        handleSendMessage(initialMessage);
      }, 500);
    }
  }, [initialMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await api.post('/api/ai-chat', {
        messages: [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => handleSendMessage();

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';

    return (
      <View
        className={`mb-4 ${isUser ? 'items-end' : 'items-start'}`}
      >
        <View
          className={`max-w-[85%] rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-primary-600 rounded-tr-sm'
              : 'bg-gray-100 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <Text className="text-white text-base">{item.content}</Text>
          ) : (
            <ReactMarkdown
              style={{
                body: { color: '#374151', fontSize: 15, lineHeight: 22 },
                paragraph: { marginTop: 0, marginBottom: 8 },
                code_inline: {
                  backgroundColor: '#E5E7EB',
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  borderRadius: 4,
                },
              }}
            >
              {item.content}
            </ReactMarkdown>
          )}
        </View>
        <Text className="text-xs text-gray-500 mt-1 px-2">
          {item.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  const renderTypingIndicator = () => (
    <View className="mb-4 items-start">
      <View className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
        <View className="flex-row gap-1">
          <View className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
          <View
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <View
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
      keyboardVerticalOffset={100}
    >
      {/* Header */}
      <View className="bg-primary-600 px-6 py-4 border-b border-primary-700">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
            <Ionicons name="sparkles" size={20} color="white" />
          </View>
          <View>
            <Text className="text-white font-semibold text-lg">AI Tutor</Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <View className="w-2 h-2 rounded-full bg-green-400" />
              <Text className="text-white/80 text-xs">Active</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListFooterComponent={isTyping ? renderTypingIndicator : null}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* Input Area */}
      <View className="px-4 py-3 bg-white border-t border-gray-200">
        <View className="flex-row items-end gap-2">
          <View className="flex-1 bg-gray-100 rounded-2xl border border-gray-200">
            <TextInput
              className="px-4 py-3 text-base text-gray-900 max-h-24"
              placeholder="Ask me anything..."
              placeholderTextColor="#9CA3AF"
              value={input}
              onChangeText={setInput}
              multiline
              editable={!isTyping}
            />
          </View>
          <Pressable
            className={`w-12 h-12 rounded-full items-center justify-center ${
              input.trim() && !isTyping
                ? 'bg-primary-600'
                : 'bg-gray-300'
            }`}
            onPress={handleSend}
            disabled={!input.trim() || isTyping}
          >
            {isTyping ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={input.trim() ? 'white' : '#9CA3AF'}
              />
            )}
          </Pressable>
        </View>
        <Text className="text-center text-xs text-gray-500 mt-2">
          AI-powered learning assistant
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
