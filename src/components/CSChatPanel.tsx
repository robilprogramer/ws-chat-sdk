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

interface ChatRoom {
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

interface CSChatPanelProps {
  serverUrl: string;
  csUserId: string;
  csName: string;
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
}

export const CSChatPanel: React.FC<CSChatPanelProps> = ({
  serverUrl,
  csUserId,
  csName,
  position = 'bottom-right',
  primaryColor = '#10B981'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedRoomIdRef = useRef<string | null>(null);
  const hasLoggedInRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const total = chatRooms.reduce((sum, room) => sum + room.unreadCount, 0);
    setTotalUnread(total);
  }, [chatRooms]);

  // Request notification permission
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [isOpen]);

  // Socket connection management - Following HTML test.html pattern
  useEffect(() => {
    if (!isOpen) {
      // Cleanup when closing
      if (socketRef.current) {
        console.log('🔌 CS Panel closed, disconnecting...');
        socketRef.current.emit('cs_logout', { csUserId });
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      hasLoggedInRef.current = false;
      selectedRoomIdRef.current = null;
      return;
    }

    // Prevent multiple connections
    if (socketRef.current?.connected) {
      console.log('✅ Already connected');
      return;
    }

    console.log('🔌 Connecting CS to server...');
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    // 1. CONNECT EVENT
    socket.on('connect', () => {
      console.log('✅ CS connected:', socket.id);
      setIsConnected(true);
      
      // 2. AUTO LOGIN setelah connect (seperti di HTML test)
      if (!hasLoggedInRef.current) {
        console.log('🔐 Auto logging in as:', csName);
        socket.emit('cs_login', {
          userId: csUserId,
          name: csName
        });
        hasLoggedInRef.current = true;
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      setIsConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
      setIsConnected(false);
      hasLoggedInRef.current = false;
    });

    // 3. SETELAH LOGIN, SERVER AKAN KIRIM cs_chat_rooms OTOMATIS
    socket.on('cs_chat_rooms', (rooms) => {
      console.log('📋 Received chat rooms:', rooms.length);
      const sortedRooms = rooms.map((room: any) => ({
        ...room,
        timestamp: new Date(room.timestamp)
      })).sort((a: ChatRoom, b: ChatRoom) => 
        b.timestamp.getTime() - a.timestamp.getTime()
      );
      setChatRooms(sortedRooms);
    });

    // 4. NEW CUSTOMER CHAT
    socket.on('new_customer_chat', (data) => {
      console.log('🆕 New customer chat:', data.customerName);
      
      const newRoom: ChatRoom = {
        id: data.chatRoomId,
        customerId: data.customerId,
        customerName: data.customerName,
        lastMessage: data.lastMessage || 'Memulai chat',
        timestamp: new Date(data.timestamp),
        unreadCount: data.unreadCount || 1,
        status: data.status || 'waiting',
        csAssigned: data.csAssigned,
        csName: data.csName,
        aiSummary: data.aiSummary
      };

      setChatRooms(prev => {
        const exists = prev.find(r => r.id === data.chatRoomId);
        if (exists) {
          return prev.map(r => r.id === data.chatRoomId ? { ...r, ...newRoom } : r)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        }
        return [newRoom, ...prev].sort((a, b) => 
          b.timestamp.getTime() - a.timestamp.getTime()
        );
      });

      // Notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Customer Baru', {
          body: `${data.customerName}: ${data.lastMessage || 'Memulai chat'}`,
          tag: data.chatRoomId
        });
      }
    });

    // 5. CHAT HISTORY - Hanya update jika room yang dipilih
    socket.on('cs_chat_history', (data) => {
      console.log('📜 Chat history received for room:', data.chatRoomId);
      console.log('    Messages:', data.messages?.length || 0);
      console.log('    Current selected:', selectedRoomIdRef.current);
      
      // Validasi: hanya load jika ini room yang sedang dipilih
      if (selectedRoomIdRef.current === data.chatRoomId) {
        if (data.messages && data.messages.length > 0) {
          const formattedMessages = data.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          console.log('    ✅ Loading messages to UI');
          setMessages(formattedMessages);
        } else {
          console.log('    ℹ️ No messages, clearing UI');
          setMessages([]);
        }
      } else {
        console.log('    ⚠️ Ignoring - not current room');
      }
    });

    // 6. INCOMING MESSAGES
    socket.on('customer_message_to_cs', (data) => {
      console.log('💬 New message from:', data.customerName);
      
      // Update room list
      setChatRooms(prev => prev.map(room => {
        if (room.id === data.chatRoomId) {
          const isCurrentRoom = selectedRoomIdRef.current === data.chatRoomId;
          return {
            ...room,
            lastMessage: data.message.text,
            timestamp: new Date(data.message.timestamp),
            unreadCount: isCurrentRoom ? 0 : room.unreadCount + 1
          };
        }
        return room;
      }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));

      // Add to messages if this is current room
      if (selectedRoomIdRef.current === data.chatRoomId) {
        const newMessage: Message = {
          id: data.message.id,
          text: data.message.text,
          sender: data.message.sender,
          timestamp: new Date(data.message.timestamp),
          read: false,
          senderName: data.customerName
        };
        
        setMessages(prev => {
          const exists = prev.some(m => m.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });

        // Auto mark as read
        setTimeout(() => {
          socket.emit('cs_mark_messages_read', {
            chatRoomId: data.chatRoomId,
            csUserId
          });
        }, 500);
      } else {
        // Notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(data.customerName, {
            body: data.message.text,
            tag: data.chatRoomId
          });
        }
      }
    });

    socket.on('cs_message_sent', (data) => {
      console.log('✅ Message sent successfully:', data.messageId);
    });

    socket.on('message_read_by_customer', (data) => {
      console.log('✓✓ Customer read message:', data.messageId);
      setMessages(prev => prev.map(msg =>
        msg.id === data.messageId ? { ...msg, read: true } : msg
      ));
    });

    socket.on('error', (data) => {
      console.error('⚠️ Socket error:', data);
    });

    return () => {
      console.log('🧹 Cleaning up socket');
      if (socket.connected) {
        socket.emit('cs_logout', { csUserId });
      }
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [isOpen, serverUrl, csUserId, csName]);

  // SELECT ROOM - Sama seperti selectRoom() di HTML test
  const handleSelectRoom = useCallback((room: ChatRoom) => {
    console.log('📂 Selecting room:', room.customerName, '(', room.id, ')');
    
    // Update selected room immediately
    selectedRoomIdRef.current = room.id;
    setSelectedRoom(room);
    setMessages([]); // Clear messages dulu
    
    // Request chat history
    if (socketRef.current?.connected) {
      console.log('📨 Emitting cs_select_room');
      socketRef.current.emit('cs_select_room', {
        chatRoomId: room.id,
        csUserId
      });
    } else {
      console.error('❌ Cannot select room - socket not connected');
    }

    // Clear unread count
    setChatRooms(prev => prev.map(r =>
      r.id === room.id ? { ...r, unreadCount: 0 } : r
    ));
  }, [csUserId]);

  const handleSendMessage = useCallback(() => {
    if (!inputMessage.trim() || !selectedRoom || !socketRef.current?.connected) {
      console.log('❌ Cannot send - missing requirements');
      return;
    }

    console.log('📤 Sending message:', inputMessage);

    // Optimistic UI update
    const tempMessage: Message = {
      id: `temp_${Date.now()}`,
      text: inputMessage,
      sender: 'cs',
      timestamp: new Date(),
      read: false,
      senderName: csName
    };

    setMessages(prev => [...prev, tempMessage]);
    
    // Send to server
    socketRef.current.emit('cs_send_message', {
      chatRoomId: selectedRoom.id,
      message: inputMessage,
      csUserId
    });

    setInputMessage('');

    // Update room last message
    setChatRooms(prev => prev.map(room =>
      room.id === selectedRoom.id
        ? { ...room, lastMessage: inputMessage, timestamp: new Date() }
        : room
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  }, [inputMessage, selectedRoom, csUserId, csName]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleRefresh = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('🔄 Manually refreshing rooms');
      socketRef.current.emit('cs_get_all_rooms', { csUserId });
    }
  }, [csUserId]);

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
          aria-label="Open CS Dashboard"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed ${positionClasses} z-50`}>
      <div className={`bg-white rounded-lg shadow-2xl transition-all duration-300 ${
        isMinimized ? 'w-96 h-14' : 'w-[900px] h-[600px]'
      } flex flex-col overflow-hidden`}>
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 text-white rounded-t-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-white' : 'bg-red-300 animate-pulse'}`}></div>
            <div>
              <h3 className="font-semibold">CS Dashboard - {csName}</h3>
              <p className="text-xs opacity-90">
                {isConnected ? 
                  `${chatRooms.length} Chat${chatRooms.length !== 1 ? 's' : ''}` : 
                  'Menghubungkan...'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={!isConnected}
              className="hover:bg-white/20 p-1 rounded transition-colors disabled:opacity-50"
              title="Refresh"
              aria-label="Refresh rooms"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
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
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="flex flex-1 overflow-hidden">
            {/* Rooms List */}
            <div className="w-80 border-r bg-gray-50 overflow-y-auto">
              {!isConnected && (
                <div className="p-4 text-center text-sm text-red-600 bg-red-50 border-b">
                  Koneksi terputus. Mencoba menghubungkan kembali...
                </div>
              )}
              
              {chatRooms.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm font-medium">Belum ada chat</p>
                  <p className="text-xs text-gray-400 mt-1">Menunggu customer...</p>
                </div>
              ) : (
                chatRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => handleSelectRoom(room)}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-100 transition-colors ${
                      selectedRoom?.id === room.id ? 'bg-green-50 border-l-4 border-green-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-gray-800 truncate flex-1">{room.customerName}</h4>
                      {room.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center ml-2">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{room.lastMessage || 'Tidak ada pesan'}</p>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-xs text-gray-500">
                        {room.timestamp.toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        room.status === 'ai_mode' ? 'bg-blue-100 text-blue-800' :
                        room.status === 'connected_to_cs' ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {room.status === 'ai_mode' ? 'AI Mode' : 
                         room.status === 'connected_to_cs' ? 'CS Active' : 
                         room.status}
                      </span>
                    </div>
                    {room.aiSummary && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                        <span className="font-semibold">AI:</span> {room.aiSummary}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {selectedRoom ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b bg-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-800">{selectedRoom.customerName}</h3>
                        <p className="text-sm text-gray-600">ID: {selectedRoom.customerId}</p>
                      </div>
                      {selectedRoom.aiSummary && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          Handover dari AI
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 mt-8">
                        <div className="animate-pulse">
                          <div className="w-12 h-12 bg-gray-300 rounded-full mx-auto mb-4"></div>
                          <p className="text-sm">Memuat riwayat chat...</p>
                        </div>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender === 'cs' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                        >
                          <div className="max-w-[75%]">
                            {message.sender !== 'cs' && message.sender !== 'system' && (
                              <p className="text-xs text-gray-600 mb-1 px-1">
                                {message.senderName || 
                                 (message.sender === 'customer' ? selectedRoom.customerName : 
                                  message.sender === 'ai' ? 'AI Assistant' : 
                                  message.sender)}
                              </p>
                            )}
                            <div
                              className={`rounded-lg p-3 ${
                                message.sender === 'cs'
                                  ? 'bg-green-600 text-white rounded-br-none'
                                  : message.sender === 'system'
                                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                  : message.sender === 'ai'
                                  ? 'bg-blue-100 text-blue-800 rounded-bl-none'
                                  : 'bg-white text-gray-800 shadow-md rounded-bl-none'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                              <div className="flex items-center justify-end mt-1 space-x-1">
                                <p className={`text-xs ${
                                  message.sender === 'cs' ? 'text-green-200' : 'text-gray-500'
                                }`}>
                                  {message.timestamp.toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                {message.sender === 'cs' && (
                                  <svg
                                    className={`w-4 h-4 ${message.read ? 'text-blue-300' : 'text-green-300'}`}
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
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 bg-white border-t">
                    <div className="flex items-end space-x-2">
                      <textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ketik balasan..."
                        rows={2}
                        disabled={!isConnected}
                        className="flex-1 resize-none border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim() || !isConnected}
                        className="p-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                        style={{ backgroundColor: inputMessage.trim() && isConnected ? primaryColor : '#D1D5DB' }}
                        aria-label="Send message"
                      >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50">
                  <div className="text-center">
                    <svg className="w-20 h-20 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p className="text-lg font-medium">Pilih chat untuk memulai</p>
                    <p className="text-sm text-gray-400 mt-1">Klik salah satu chat di sebelah kiri</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};