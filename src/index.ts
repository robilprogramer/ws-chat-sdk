// src/index.ts
import './tailwind.css';

export { ChatWidget } from './components/ChatWidget';
export { CSChatPanel } from './components/CSChatPanel';

// TypeScript types
export interface Message {
  id: string;
  text: string;
  sender: 'customer' | 'cs' | 'ai' | 'system';
  timestamp: Date;
  read: boolean;
  senderName?: string;
}

export interface ChatRoom {
  id: string;
  customerId: string;
  customerName: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  status: string;
  csAssigned?: string;
  csName?: string;
  aiSummary?: string;
}

export interface ChatWidgetProps {
  serverUrl: string;
  customerId: string;
  customerName: string;
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
}

export interface CSChatPanelProps {
  serverUrl: string;
  csUserId: string;
  csName: string;
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
}