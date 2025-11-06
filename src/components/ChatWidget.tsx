
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  text: string;
  sender: 'customer' | 'cs' | 'ai' | 'system';
  timestamp: Date;
  read: boolean;
  senderName?: string;
}

interface ChatWidgetProps {
  serverUrl: string;
  customerId: string;
  customerName: string;
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  serverUrl,
  customerId,
  customerName,
  position = 'bottom-right',
  primaryColor = '#4F46E5'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<'ai_mode' | 'connected_to_cs' | 'disconnected'>('disconnected');
  const [csName, setCsName] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Mark messages as read when opened
  useEffect(() => {
    if (isOpen && !isMinimized && socketRef.current?.connected) {
      setUnreadCount(0);
      
      const unreadMessages = messages.filter(m => 
        !m.read && (m.sender === 'cs' || m.sender === 'ai')
      );
      
      unreadMessages.forEach(msg => {
        socketRef.current?.emit('mark_message_read', {
          messageId: msg.id,
          customerId
        });
      });
    }
  }, [isOpen, isMinimized, customerId, messages]);

  // Socket connection management
  useEffect(() => {
    if (!isOpen) {
      // Cleanup socket when closed
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    setIsConnecting(true);

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to server:', socket.id);
      setIsConnecting(false);
      setChatStatus('ai_mode');
      
      // Request chat history first
      socket.emit('get_customer_chat_history', {
        customerId,
        chatRoomId: chatRoomId
      });

      // Then start/continue chat
      socket.emit('start_chat', {
        customerId,
        customerName,
        initialMessage: ''
      });
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setIsConnecting(false);
      setChatStatus('disconnected');
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
      setChatStatus('disconnected');
      setIsConnecting(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected after', attemptNumber, 'attempts');
      // Request history again after reconnect
      socket.emit('get_customer_chat_history', {
        customerId,
        chatRoomId: chatRoomId
      });
    });

    socket.on('chat_started', (data) => {
      console.log('💬 Chat started:', data);
      setChatRoomId(data.chatRoomId);
      setChatStatus(data.status);
      setCsName(data.csName || null);
      
      if (data.status === 'connected_to_cs' && data.message) {
        setMessages(prev => {
          // Avoid duplicate system messages
          const exists = prev.some(m => m.text === data.message && m.sender === 'system');
          if (exists) return prev;
          
          return [...prev, {
            id: `system_${Date.now()}`,
            text: data.message,
            sender: 'system',
            timestamp: new Date(),
            read: true
          }];
        });
      }
    });

    socket.on('customer_chat_history', (data) => {
      console.log('📜 Chat history received:', data);
      
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
        setChatRoomId(data.chatRoomId);
        setChatStatus(data.chatMode || data.status || 'ai_mode');
        setCsName(data.csName || null);
      } else {
        // No history, start fresh
        setMessages([]);
      }
    });

    socket.on('receive_message', (data) => {
      console.log('📨 Received message:', data);
      
      const newMessage: Message = {
        id: data.id,
        text: data.text,
        sender: data.sender,
        timestamp: new Date(data.timestamp),
        read: data.read || false,
        senderName: data.senderName
      };
      
      setMessages(prev => {
        // Avoid duplicates
        const exists = prev.some(m => m.id === data.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });
      
      setIsTyping(false);
      
      // Auto mark as read if window is open
      if (isOpen && !isMinimized) {
        setTimeout(() => {
          socket.emit('mark_message_read', {
            messageId: data.id,
            customerId
          });
        }, 500);
      } else {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on('ai_typing', () => {
      setIsTyping(true);
    });

    socket.on('cs_assigned', (data) => {
      console.log('👤 CS assigned:', data);
      setCsName(data.csName);
      setChatStatus('connected_to_cs');
    });

    socket.on('messages_read_by_cs', (data) => {
      console.log('✓✓ Messages read by CS:', data);
      setMessages(prev => prev.map(msg => 
        data.messageIds.includes(msg.id) ? { ...msg, read: true } : msg
      ));
    });

    socket.on('error', (data) => {
      console.error('⚠️ Socket error:', data);
    });

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socket.disconnect();
    };
  }, [isOpen, serverUrl, customerId, customerName, isMinimized, chatRoomId]);

  const handleSendMessage = useCallback(() => {
    if (!inputMessage.trim() || !socketRef.current?.connected) return;

    const tempMessage: Message = {
      id: `temp_${Date.now()}`,
      text: inputMessage,
      sender: 'customer',
      timestamp: new Date(),
      read: false
    };
    
    setMessages(prev => [...prev, tempMessage]);
    
    socketRef.current.emit('customer_message', {
      customerId,
      message: inputMessage,
      chatRoomId
    });
    
    setInputMessage('');
  }, [inputMessage, customerId, chatRoomId]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const getStatusText = () => {
    if (isConnecting) return 'Menghubungkan...';
    if (chatStatus === 'disconnected') return 'Tidak Terhubung';
    if (chatStatus === 'ai_mode') return 'AI Assistant';
    if (chatStatus === 'connected_to_cs' && csName) return csName;
    return 'Customer Service';
  };

  const getStatusColor = () => {
    if (isConnecting || chatStatus === 'disconnected') return 'bg-gray-400';
    if (chatStatus === 'ai_mode') return 'bg-blue-500';
    return 'bg-green-500';
  };

  const positionClasses = position === 'bottom-right' 
    ? 'right-4 bottom-4' 
    : 'left-4 bottom-4';

  if (!isOpen) {
    return (
      <div className={`fixed ${positionClasses} z-50`}>
        <button
          onClick={() => setIsOpen(true)}
          className="relative p-4 rounded-full shadow-lg hover:scale-110 transition-transform duration-200"
          style={{ backgroundColor: primaryColor }}
          aria-label="Open chat"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed ${positionClasses} z-50`}>
      <div className={`bg-white rounded-lg shadow-2xl transition-all duration-300 ${
        isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]'
      } flex flex-col overflow-hidden`}>
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 text-white rounded-t-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${isConnecting ? 'animate-pulse' : ''}`}></div>
            <div>
              <h3 className="font-semibold text-sm">{getStatusText()}</h3>
              <p className="text-xs opacity-90">
                {chatStatus === 'ai_mode' ? 'Selalu Siap Membantu' : 
                 chatStatus === 'connected_to_cs' ? 'Terhubung dengan CS' : 
                 'Offline'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="hover:bg-white/20 p-1 rounded transition-colors"
              aria-label={isMinimized ? "Maximize" : "Minimize"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
              </svg>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 p-1 rounded transition-colors"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 && !isConnecting && (
                <div className="text-center text-gray-500 mt-8">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm">Mulai percakapan baru</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'customer' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  <div className="max-w-[75%]">
                    {message.sender !== 'customer' && message.sender !== 'system' && (
                      <p className="text-xs text-gray-600 mb-1 px-1">
                        {message.senderName || (message.sender === 'ai' ? 'AI Assistant' : 'CS')}
                      </p>
                    )}
                    <div
                      className={`rounded-lg p-3 ${
                        message.sender === 'customer'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : message.sender === 'system'
                          ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                          : 'bg-white text-gray-800 shadow-md rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                      <div className="flex items-center justify-end mt-1 space-x-1">
                        <p className={`text-xs ${
                          message.sender === 'customer' ? 'text-indigo-200' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString('id-ID', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                        {message.sender === 'customer' && (
                          <svg 
                            className={`w-4 h-4 ${message.read ? 'text-blue-300' : 'text-indigo-300'}`} 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            {message.read ? (
                              <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z M13.707 5.293l-8 8"/>
                            ) : (
                              <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                            )}
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start animate-fadeIn">
                  <div className="bg-white rounded-lg p-3 shadow-md">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t">
              {chatStatus === 'disconnected' && (
                <div className="mb-2 text-center text-xs text-red-600 bg-red-50 py-1 px-2 rounded">
                  Koneksi terputus. Mencoba menghubungkan kembali...
                </div>
              )}
              <div className="flex items-end space-x-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ketik pesan..."
                  rows={1}
                  disabled={!socketRef.current?.connected}
                  className="flex-1 resize-none border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || !socketRef.current?.connected}
                  className="p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                  style={{ backgroundColor: inputMessage.trim() && socketRef.current?.connected ? primaryColor : '#D1D5DB' }}
                  aria-label="Send message"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};