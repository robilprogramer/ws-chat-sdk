# 💬 AI-Powered Customer Service Chat Widget

A comprehensive real-time chat widget system with AI assistance and seamless customer service handover, built with React, TypeScript, Socket.IO, and Next.js.

## ✨ Features

### Customer Widget
- 🤖 **AI-Powered Responses** - Instant automated replies using AI
- 👤 **Human CS Handover** - Seamless transfer to human agents when needed
- 📱 **Responsive Design** - Works perfectly on desktop and mobile
- 🔔 **Real-time Notifications** - Unread message badges and alerts
- 💬 **Message Read Receipts** - Know when your messages are read
- 📜 **Chat History** - Persistent conversation history
- 🎨 **Customizable Theme** - Adjust colors and positioning

### CS Dashboard
- 📊 **Multi-Chat Management** - Handle multiple conversations simultaneously
- 🔄 **Real-time Updates** - Instant message delivery and status updates
- 🤖 **AI Summary** - View AI conversation summaries before taking over
- 🔔 **Desktop Notifications** - Browser notifications for new messages
- ✅ **Message Read Tracking** - See when customers read your messages
- 🎯 **Smart Room Sorting** - Auto-sorted by latest activity
- 📱 **Responsive Layout** - Optimized for different screen sizes

## 🚀 Quick Start

### Installation

```bash
npm install ws-chat-sdk
# or
yarn add ws-chat-sdk
# or
pnpm add ws-chat-sdk
```

### Basic Usage

#### Customer Chat Widget

```tsx
"use client";
import 'ws-chat-sdk/dist/index.css';
import { ChatWidget } from 'ws-chat-sdk';

export default function HomePage() {
  return (
    <div>
      <h1>Welcome to Our Store</h1>
      
      <ChatWidget
        serverUrl="http://localhost:3001"
        customerId="customer_123"
        customerName="John Doe"
        position="bottom-right"
        primaryColor="#4F46E5"
      />
    </div>
  );
}
```

#### CS Dashboard

```tsx
"use client";
import 'ws-chat-sdk/dist/index.css';
import { CSChatPanel } from 'ws-chat-sdk';

export default function CSDashboard() {
  return (
    <div>
      <h1>Customer Service Dashboard</h1>
      
      <CSChatPanel
        serverUrl="http://localhost:3001"
        csUserId="cs_001"
        csName="Agent Sarah"
        position="bottom-right"
        primaryColor="#10B981"
      />
    </div>
  );
}
```

## 📦 Component Props

### ChatWidget Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `serverUrl` | string | ✅ | - | WebSocket server URL |
| `customerId` | string | ✅ | - | Unique customer identifier |
| `customerName` | string | ✅ | - | Customer display name |
| `position` | 'bottom-right' \| 'bottom-left' | ❌ | 'bottom-right' | Widget position |
| `primaryColor` | string | ❌ | '#4F46E5' | Primary theme color (hex) |

### CSChatPanel Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `serverUrl` | string | ✅ | - | WebSocket server URL |
| `csUserId` | string | ✅ | - | Unique CS agent identifier |
| `csName` | string | ✅ | - | CS agent display name |
| `position` | 'bottom-right' \| 'bottom-left' | ❌ | 'bottom-right' | Panel position |
| `primaryColor` | string | ❌ | '#10B981' | Primary theme color (hex) |

## 🔧 Backend Requirements

This widget requires a Socket.IO server with the following events:

### Customer Events
- `start_chat` - Initialize chat session
- `customer_message` - Send customer message
- `get_customer_chat_history` - Request chat history
- `mark_message_read` - Mark message as read

### CS Events
- `cs_login` - CS agent login
- `cs_logout` - CS agent logout
- `cs_select_room` - Select chat room
- `cs_send_message` - Send CS message
- `cs_get_all_rooms` - Get all chat rooms
- `cs_mark_messages_read` - Mark messages as read

### Server Response Events
- `chat_started` - Chat session created
- `receive_message` - New message received
- `ai_typing` - AI is typing indicator
- `cs_assigned` - CS agent assigned
- `messages_read_by_cs` - Messages read by CS
- `customer_chat_history` - Chat history data
- `cs_chat_rooms` - Available chat rooms
- `cs_chat_history` - Room chat history
- `customer_message_to_cs` - Customer message notification
- `new_customer_chat` - New chat notification
- `cs_message_sent` - Message sent confirmation
- `message_read_by_customer` - Read receipt

## 🎨 Customization

### Custom Colors

```tsx
<ChatWidget
  serverUrl="http://localhost:3001"
  customerId="customer_123"
  customerName="John Doe"
  primaryColor="#FF6B6B" // Custom red
/>
```

### Custom Position

```tsx
<ChatWidget
  serverUrl="http://localhost:3001"
  customerId="customer_123"
  customerName="John Doe"
  position="bottom-left" // Left side
/>
```

## 📱 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🔒 Security Notes

- Always use HTTPS in production
- Implement proper authentication for CS dashboard
- Validate all user inputs on the server
- Use environment variables for sensitive data
- Implement rate limiting on the server

## 🐛 Troubleshooting

### Widget not connecting
```
Check console for errors
Verify serverUrl is correct
Ensure Socket.IO server is running
Check CORS settings on server
```

### Messages not appearing
```
Check socket connection status
Verify customerId/csUserId are unique
Check browser console for errors
Ensure event names match server implementation
```

### Styles not loading
```
Ensure Tailwind CSS is properly configured
Check for CSS conflicts
Verify component is client-side rendered ("use client")
```

## 📄 TypeScript Support

Full TypeScript support with type definitions included:

```typescript
import type { ChatWidgetProps, CSChatPanelProps, Message, ChatRoom } from 'ws-chat-sdk';
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 📞 Support

For issues and questions:
- 🐛 [Report bugs](https://github.com/robilprogramer/ws-chat-sdk/issues)
- 💬 [Discussions](https://github.com/robilprogramer/ws-chat-sdk/discussions)
- 📧 Email: robilputra19@gmail.com

## 🗺️ Roadmap

- [ ] File upload support
- [ ] Voice message support
- [ ] Video call integration
- [ ] Chat analytics dashboard
- [ ] Multi-language support
- [ ] Emoji picker
- [ ] Message reactions
- [ ] Typing indicators for customers

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Socket.IO](https://socket.io/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Powered by [React](https://react.dev/)
- Type-safe with [TypeScript](https://www.typescriptlang.org/)

---

Made with ❤️ by Intelsysdata

**Version:** 1.1.5  
**Last Updated:** November 2025