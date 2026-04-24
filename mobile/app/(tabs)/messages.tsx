import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { wsClient } from '../../lib/websocket';
import { useRouter } from 'expo-router';

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar: string;
  userId?: number;
}

export default function MessagesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const router = useRouter();

  // Fetch conversations
  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await api.get('/api/chat/conversations');
      return response.data.map((conv: any) => ({
        id: conv.id,
        name: conv.name || 'Conversation',
        lastMessage: conv.lastMessage || 'No messages yet',
        time: conv.lastMessageTime
          ? new Date(conv.lastMessageTime).toLocaleDateString()
          : 'New',
        unread: conv.unreadCount || 0,
        avatar: conv.avatar || '💬',
        userId: conv.userId,
      }));
    },
  });

  // Setup WebSocket
  useEffect(() => {
    wsClient.connect();

    const unsubMessage = wsClient.onMessage((message) => {
      // Refetch conversations when new message arrives
      refetch();
    });

    const unsubTyping = wsClient.onTyping((userId, isTyping) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    });

    return () => {
      unsubMessage();
      unsubTyping();
    };
  }, [refetch]);

  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConversationPress = (conversation: Conversation) => {
    // TODO: Navigate to conversation detail screen
    Alert.alert('Coming Soon', `Opening conversation with ${conversation.name}`);
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search Bar */}
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-2 text-gray-900"
            placeholder="Search messages..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Connection Status */}
      {!wsClient.isConnected() && (
        <View className="bg-yellow-50 px-4 py-2 border-b border-yellow-200">
          <View className="flex-row items-center">
            <Ionicons name="warning" size={16} color="#F59E0B" />
            <Text className="text-yellow-800 text-xs ml-2">
              Connecting to real-time messaging...
            </Text>
          </View>
        </View>
      )}

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <View className="flex-1 justify-center items-center p-6">
          <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
          <Text className="text-gray-900 font-semibold text-lg mt-4">
            No conversations yet
          </Text>
          <Text className="text-gray-600 text-center mt-2">
            Start a conversation to connect with others
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1">
          {filteredConversations.map((conversation) => (
            <Pressable
              key={conversation.id}
              className="bg-white border-b border-gray-200 px-4 py-4"
              onPress={() => handleConversationPress(conversation)}
            >
              <View className="flex-row items-center">
                {/* Avatar */}
                <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mr-3">
                  <Text className="text-2xl">{conversation.avatar}</Text>
                </View>

                {/* Content */}
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-gray-900 font-semibold text-base">
                      {conversation.name}
                    </Text>
                    <Text className="text-gray-500 text-xs">
                      {conversation.time}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    {typingUsers.has(conversation.userId || 0) ? (
                      <Text className="text-primary-600 text-sm italic">
                        typing...
                      </Text>
                    ) : (
                      <Text
                        className="text-gray-600 text-sm flex-1"
                        numberOfLines={1}
                      >
                        {conversation.lastMessage}
                      </Text>
                    )}
                    {conversation.unread > 0 && (
                      <View className="bg-primary-600 rounded-full w-5 h-5 items-center justify-center ml-2">
                        <Text className="text-white text-xs font-bold">
                          {conversation.unread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* New Message Button */}
      <Pressable className="absolute bottom-6 right-6 bg-primary-600 rounded-full w-14 h-14 items-center justify-center shadow-lg">
        <Ionicons name="create" size={24} color="white" />
      </Pressable>
    </View>
  );
}
