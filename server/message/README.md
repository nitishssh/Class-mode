# MessagePal - Real-time Messaging System

MessagePal is a high-performance, real-time messaging service built specifically for educational environments. It provides secure, fast communication between students, teachers, parents, and administrators.

## Features

### 🚀 Core Features

- **Real-time Messaging**: WebSocket-powered instant messaging
- **User Roles**: Student, Teacher, Parent, Admin role-based communication
- **Secure Authentication**: Session-based authentication with role validation
- **Message Persistence**: Cassandra-backed message storage
- **Read Receipts**: Track message read status
- **Typing Indicators**: Real-time typing notifications
- **Conversation History**: Unlimited message history with pagination
- **Unread Counters**: Track unread messages per conversation

### 🎯 Educational Features

- **Role-aware Communication**: Teachers can message students, parents can contact teachers
- **Class-based Filtering**: Messages organized by classes and subjects
- **Homework Integration**: Direct homework assignment and submission
- **Parent Portal Access**: Parents can monitor student communications
- **Administrative Oversight**: Principals can oversee school-wide communications

## Architecture

### Backend Services

- **WebSocket Gateway**: Real-time message delivery (`/messagepal` endpoint)
- **REST API**: HTTP fallback and administrative operations
- **Cassandra Storage**: Scalable message persistence
- **Session Management**: Express-session based authentication

### Frontend Components

- **React Hooks**: `useMessagePalWebSocket` for WebSocket management
- **UI Components**: Pre-built messaging interface
- **TypeScript**: Full type safety throughout

## API Endpoints

### WebSocket Events

**Client → Server:**

- `send_message` - Send a new message
- `typing` - Indicate typing activity
- `mark_read` - Mark message as read
- `fetch_history` - Request conversation history
- `subscribe` - Subscribe to conversation updates
- `unsubscribe` - Unsubscribe from conversation

**Server → Client:**

- `connected` - Connection established
- `message_received` - New message received
- `user_typing` - User is typing
- `message_read` - Message marked as read
- `history_response` - Conversation history response
- `error` - Error occurred

### REST API Routes

```
GET    /api/messagepal/conversations/:userId          # Get user's conversations
GET    /api/messagepal/conversations/:conversationId/history  # Get conversation history
GET    /api/messagepal/messages/:messageId            # Get specific message
POST   /api/messagepal/messages                       # Send message (HTTP fallback)
PATCH  /api/messagepal/messages/:messageId/read       # Mark message as read
DELETE /api/messagepal/conversations/:conversationId/users/:userId  # Delete conversation
GET    /api/messagepal/users/:userId/unread-count     # Get unread message count
POST   /api/messagepal/conversations/between-users    # Create/get conversation between users
```

## Database Schema

### Cassandra Tables

**messages** - Individual message storage

```
conversation_id text,
message_id timeuuid,
sender_id int,
sender_name text,
sender_role text,
recipient_id int,
content text,
timestamp timestamp,
read_by set<int>,
is_read boolean,
message_type text,
file_url text,
PRIMARY KEY (conversation_id, message_id)
```

**user_conversations** - User conversation tracking

```
user_id int,
conversation_id text,
participant_ids set<int>,
participant_names map<int, text>,
participant_roles map<int, text>,
last_message_timestamp timestamp,
unread_count int,
is_archived boolean,
PRIMARY KEY (user_id, conversation_id)
```

**conversations** - Conversation metadata

```
conversation_id text PRIMARY KEY,
participant_ids set<int>,
created_at timestamp,
updated_at timestamp,
is_group boolean
```

## Getting Started

### Prerequisites

- Node.js 18+
- Cassandra/Astra DB
- Existing PersonalLearningPro setup

### Installation

1. **Database Setup**

```bash
# Execute the Cassandra schema
cqlsh -f server/messagepal/cassandra-schema.cql
```

2. **Environment Variables**

```env
# Add to your .env file
ASTRA_DB_SECURE_BUNDLE_PATH=./config/secure-connect-chat-db.zip
ASTRA_DB_APPLICATION_TOKEN=your_token_here
ASTRA_DB_KEYSPACE=chat_db
```

3. **Start the Service**

```bash
npm run dev
```

The MessagePal service will be available at:

- WebSocket: `ws://localhost:5001/messagepal`
- HTTP API: `http://localhost:5001/api/messagepal`

### Usage Example

```typescript
import { useMessagePalWebSocket } from '@/components/messagepal/use-messagepal-ws';

function MyMessagingComponent() {
  const {
    isConnected,
    conversations,
    messages,
    sendMessage,
    sendTyping
  } = useMessagePalWebSocket();

  const handleSendMessage = () => {
    sendMessage(recipientId, "Hello!");
  };

  return (
    <div>
      {isConnected ? "Connected" : "Connecting..."}
      {/* Your UI here */}
    </div>
  );
}
```

## Security Features

- **Session-based Authentication**: Validates user sessions before message delivery
- **Role-based Access Control**: Ensures users can only communicate with appropriate roles
- **Message Encryption**: Content secured in transit and at rest
- **Rate Limiting**: Prevents message spamming
- **Input Validation**: Sanitizes all message content

## Performance Optimizations

- **WebSocket Connections**: Persistent connections reduce latency
- **Cassandra Clustering**: Time-based clustering for efficient message retrieval
- **Connection Pooling**: Reuses database connections
- **Message Batching**: Groups messages for efficient transmission
- **Lazy Loading**: Loads conversation history on demand

## Monitoring & Logging

The service includes comprehensive logging:

- Connection events
- Message delivery status
- Error tracking
- Performance metrics

## Future Enhancements

- [ ] Group messaging support
- [ ] File attachment sharing
- [ ] Message reactions and emojis
- [ ] Voice/video messaging
- [ ] Message scheduling
- [ ] Advanced search capabilities
- [ ] Mobile push notifications
- [ ] End-to-end encryption

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if port 5001 is available
   - Verify session authentication
   - Ensure Cassandra is running

2. **Messages Not Persisting**
   - Verify Cassandra connection
   - Check Astra DB credentials
   - Review database schema

3. **Authentication Errors**
   - Confirm user session is active
   - Verify role permissions
   - Check session store configuration

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open a GitHub issue or contact the development team.
