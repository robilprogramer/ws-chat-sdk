
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
export const ChatWidget = ({
  serverUrl,
  customerId,
  customerName,
  position = 'bottom-right',
  primaryColor = '#4F46E5'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatRoomId, setChatRoomId] = useState(null);
  const [chatStatus, setChatStatus] = useState('disconnected');
  const [csName, setCsName] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      socket.emit('start_chat', {
        customerId,
        customerName,
        initialMessage: ''
      });
    });

    socket.on('chat_started', (data) => {
      setChatRoomId(data.chatRoomId);
      setChatStatus(data.status);
      setCsName(data.csName);
      
      if (data.status === 'connected_to_cs') {
        setMessages(prev => [...prev, {
          id: `system_${Date.now()}`,
          text: data.message,
          sender: 'system',
          timestamp: new Date(),
          read: true
        }]);
      }
    });

    socket.on('customer_chat_history', (data) => {
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
        setChatRoomId(data.chatRoomId);
        setChatStatus(data.chatMode || 'ai_mode');
        setCsName(data.csName);
      }
    });

    socket.on('receive_message', (data) => {
      const newMessage = {
        id: data.id,
        text: data.text,
        sender: data.sender,
        timestamp: new Date(data.timestamp),
        read: data.read,
        senderName: data.senderName
      };
      
      setMessages(prev => [...prev, newMessage]);
      setIsTyping(false);
      
      if (isOpen && !isMinimized) {
        socket.emit('mark_message_read', {
          messageId: data.id,
          customerId
        });
      } else {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on('ai_typing', () => {
      setIsTyping(true);
    });

    socket.on('cs_assigned', (data) => {
      setCsName(data.csName);
      setChatStatus('connected_to_cs');
    });

    socket.on('messages_read_by_cs', (data) => {
      setMessages(prev => prev.map(msg => 
        data.messageIds.includes(msg.id) ? { ...msg, read: true } : msg
      ));
    });

    socket.on('error', (data) => {
      console.error('Socket error:', data.message);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setChatStatus('disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [isOpen, serverUrl, customerId, customerName, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
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

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !socketRef.current) return;

    socketRef.current.emit('customer_message', {
      customerId,
      message: inputMessage,
      chatRoomId
    });
    
    const newMessage = {
      id: `temp_${Date.now()}`,
      text: inputMessage,
      sender: 'customer',
      timestamp: new Date(),
      read: false
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusText = () => {
    if (chatStatus === 'disconnected') return 'Menghubungkan...';
    if (chatStatus === 'ai_mode') return 'AI Assistant';
    if (chatStatus === 'connected_to_cs' && csName) return csName;
    return 'Customer Service';
  };

  const getStatusColor = () => {
    if (chatStatus === 'disconnected') return 'bg-gray-400';
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
          className="relative p-4 rounded-full shadow-lg hover:scale-110 transition-transform"
          style={{ backgroundColor: primaryColor }}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
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
      } flex flex-col`}>
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 text-white rounded-t-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
            <div>
              <h3 className="font-semibold">{getStatusText()}</h3>
              <p className="text-xs opacity-90">
                {chatStatus === 'ai_mode' ? 'Online' : 'Customer Service'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="hover:bg-white/20 p-1 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 p-1 rounded transition-colors"
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
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%]`}>
                    {message.sender !== 'customer' && message.senderName && (
                      <p className="text-xs text-gray-600 mb-1">{message.senderName}</p>
                    )}
                    <div
                      className={`rounded-lg p-3 ${
                        message.sender === 'customer'
                          ? 'bg-indigo-600 text-white'
                          : message.sender === 'system'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-white text-gray-800 shadow'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.text}</p>
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
                            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-lg p-3 shadow">
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
              <div className="flex items-end space-x-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ketik pesan..."
                  rows={1}
                  className="flex-1 resize-none border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: inputMessage.trim() ? primaryColor : '#D1D5DB' }}
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