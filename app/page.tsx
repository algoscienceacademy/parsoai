'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Monitor, MonitorOff, Send, Volume2, 
  VolumeX, Globe, Code, Sparkles, Brain, Zap, 
  Settings, User, Bot, AlertCircle, Eye, Activity,
  MessageSquare, Cpu, WifiOff, Wifi
} from 'lucide-react';
import { useAdvancedVoice } from './hooks/useAdvancedVoice';
import { useEnhancedScreenShare } from './hooks/useEnhancedScreenShare';
import { VoiceSettingsPanel } from './components/VoiceSettingsPanel';

type ConversationFlow = 'listening' | 'processing' | 'speaking' | 'idle';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isVoice?: boolean;
  isInterim?: boolean;
  emotion?: 'excited' | 'calm' | 'professional';
}

interface VoiceSettings {
  country: 'US' | 'UK' | 'AU' | 'CA' | 'IN' | 'BD';
  gender: 'male' | 'female';
  tone: 'professional' | 'friendly' | 'casual' | 'excited' | 'calm';
  speed: number;
  pitch: number;
}

export default function ParsoAI() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m ParsoAI, your advanced personal assistant. I can analyze code from your screen in real-time and have natural voice conversations with you. Try speaking to me or sharing your screen!',
      sender: 'ai',
      timestamp: new Date(),
      emotion: 'excited'
    }
  ]);
  
  const [inputText, setInputText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [language, setLanguage] = useState<'en' | 'bn'>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationFlow, setConversationFlow] = useState<ConversationFlow>('idle');
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'connecting'>('online');
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    country: 'US',
    gender: 'female',
    tone: 'professional',
    speed: 1.0,
    pitch: 1.0
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUtteranceRef = useRef<string>('');

  // Advanced voice hook
  const {
    isListening,
    isSpeaking,
    isProcessing,
    conversationActive,
    isUserSpeaking,
    voiceLevel,
    isSupported,
    speak,
    toggleConversation,
    updateVoiceSettings,
    getVoicePreview
  } = useAdvancedVoice({
    language,
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        setInterimText('');
        setWaitingForUser(false);
        if (text.trim()) {
          handleVoiceInput(text);
        }
      } else {
        setInterimText(text);
        setWaitingForUser(true);
      }
    },
    onConversationFlow: setConversationFlow,
    enableContinuousMode: true,
    voiceSettings
  });

  // Enhanced screen sharing hook
  const {
    isSharing,
    isAnalyzing,
    analysisProgress,
    error: screenShareError,
    screenMetrics,
    detectedCodes,
    activeCode,
    isVideoReady,
    streamQuality,
    startScreenShare,
    stopScreenShare,
    selectCode,
    analyzeCodeManually,
    setStreamQualityLevel,
    videoRef,
    canvasRef,
    getCurrentScreenData,
    captureFullScreen,
    currentScreenshot
  } = useEnhancedScreenShare();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleVoiceInput = useCallback(async (text: string) => {
    // Don't process if AI is speaking
    if (isSpeaking) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
      isVoice: true
    };

    setMessages(prev => [...prev, userMessage]);
    await sendToAI(text, true);
  }, [isSpeaking]);

  const sendToAI = useCallback(async (text: string, isVoice = false) => {
    // Don't send if AI is currently speaking
    if (isSpeaking) {
      return;
    }

    setIsLoading(true);
    setConnectionStatus('connecting');

    try {
      const screenData = isSharing ? getCurrentScreenData() : null;
      
      const contextData = {
        message: text,
        language,
        isVoiceRequest: isVoice,
        conversationFlow,
        screenSharing: isSharing,
        screenData: screenData ? {
          screenshot: screenData.screenshot,
          detectedCode: screenData.activeCode,
          allDetectedCodes: screenData.detectedCodes,
          screenMetrics: screenData.screenMetrics,
          analysisInProgress: screenData.analysisInProgress
        } : null,
        conversationContext: {
          isUserSpeaking,
          voiceLevel,
          waitingForUser,
          conversationActive
        }
      };

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData)
      });

      const data = await response.json();
      setConnectionStatus('online');

      if (data.success) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          sender: 'ai',
          timestamp: new Date(),
          isVoice,
          emotion: data.emotion || 'professional'
        };

        setMessages(prev => [...prev, aiMessage]);

        // Speak if in voice mode and not already speaking
        if ((isVoice || conversationActive) && !isSpeaking) {
          currentUtteranceRef.current = data.response;
          await speak(data.response, { 
            priority: 'high', 
            emotion: data.emotion || 'professional' 
          });
        }
      } else {
        throw new Error(data.error || 'AI service error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setConnectionStatus('offline');

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'I apologize, but I\'m having trouble connecting right now. Please check your internet connection and try again.',
        sender: 'ai',
        timestamp: new Date(),
        emotion: 'calm'
      };

      setMessages(prev => [...prev, errorMessage]);

      if (conversationActive && !isSpeaking) {
        await speak(errorMessage.text, { emotion: 'calm' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [language, conversationFlow, isSharing, getCurrentScreenData, conversationActive, speak, isUserSpeaking, waitingForUser, voiceLevel, isSpeaking]);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
      isVoice: false
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText;
    setInputText('');
    
    await sendToAI(messageText, false);
  }, [inputText, sendToAI]);

  const handleCodeSelection = useCallback((code: any) => {
    selectCode(code);
  }, [selectCode]);

  const handleVoiceSettingsChange = useCallback((newSettings: Partial<VoiceSettings>) => {
    const updatedSettings = { ...voiceSettings, ...newSettings };
    setVoiceSettings(updatedSettings);
    updateVoiceSettings(updatedSettings);
  }, [voiceSettings, updateVoiceSettings]);

  const handleVoicePreview = useCallback(() => {
    getVoicePreview();
  }, [getVoicePreview]);

  return (
    <div className="min-h-screen relative">
      {/* Neural Network Background */}
      <div className="neural-network-bg">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="neural-connection"
            style={{
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              height: Math.random() * 200 + 100 + 'px',
              transform: `rotate(${Math.random() * 360}deg)`,
              animationDelay: Math.random() * 4 + 's'
            }}
          />
        ))}
      </div>

      <div className="max-w-8xl mx-auto relative z-10 p-6">
        {/* Enhanced Header with voice settings toggle */}
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="glass-dark rounded-3xl p-8 mb-8 relative overflow-hidden"
        >
          <div className="aurora-effect"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-6">
              {/* AI Avatar and Status */}
              <motion.div 
                className="relative"
                animate={conversationActive ? { 
                  scale: isUserSpeaking ? [1, 1.15, 1] : [1, 1.05, 1],
                  rotate: [0, 2, -2, 0]
                } : {}}
                transition={{ duration: isUserSpeaking ? 1.5 : 3, repeat: conversationActive ? Infinity : 0 }}
              >
                <div className={`w-24 h-24 rounded-full flex items-center justify-center relative ${
                  conversationActive ? 'voice-orb' : 'glass-orange'
                }`}>
                  <Brain className="w-12 h-12 text-orange-400 z-10" />
                  {voiceLevel > 0 && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-orange-400"
                      animate={{ 
                        scale: 1 + voiceLevel * 0.8,
                        opacity: voiceLevel 
                      }}
                    />
                  )}
                  {waitingForUser && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-blue-400"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.8, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </div>
              </motion.div>

              <div>
                <h1 className="text-6xl font-bold gradient-text mb-3">
                  ParsoAI
                </h1>
                <p className="text-orange-300/90 text-xl mb-3">Advanced AI Assistant with Real-time Code Analysis</p>
                
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <motion.div 
                      className={`w-3 h-3 rounded-full ${
                        connectionStatus === 'online' ? 'bg-green-400' :
                        connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
                      }`}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <span className="text-sm text-gray-300 capitalize font-medium">{connectionStatus}</span>
                    {connectionStatus === 'online' ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-orange-400 font-medium capitalize">{conversationFlow}</span>
                  </div>

                  {isSharing && isVideoReady && (
                    <div className="flex items-center space-x-2">
                      <Eye className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-blue-400 font-medium">
                        Live screen visible to AI ({streamQuality})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Voice Settings Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className={`btn-primary rounded-2xl p-4 transition-all duration-300 ${
                  showVoiceSettings ? 'glass-orange' : 'glass'
                }`}
                title="Voice Settings"
              >
                <Settings className={`w-6 h-6 ${showVoiceSettings ? 'text-orange-300' : 'text-orange-500'}`} />
              </motion.button>

              {/* Conversation Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleConversation}
                disabled={!isSupported}
                className={`btn-primary rounded-2xl p-4 transition-all duration-300 ${
                  conversationActive ? 'glass-orange' : 'glass'
                } disabled:opacity-50 relative`}
                title={conversationActive ? 'End Conversation' : 'Start Conversation'}
              >
                <MessageSquare className={`w-6 h-6 ${conversationActive ? 'text-orange-300' : 'text-orange-500'}`} />
                {conversationActive && (
                  <motion.div
                    className="absolute -inset-1 rounded-2xl border-2 border-orange-400"
                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.button>

              {/* Language Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="btn-primary rounded-2xl p-4 flex items-center space-x-2"
              >
                <Globe className="w-5 h-5 text-orange-400" />
                <span className="text-lg font-bold text-orange-300">
                  {language === 'en' ? 'EN' : 'বাং'}
                </span>
              </motion.button>

              {/* Enhanced Screen Share Toggle with quality indicator */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={isSharing ? stopScreenShare : startScreenShare}
                className={`btn-primary rounded-2xl p-4 relative ${
                  isSharing ? 'glass-orange' : 'glass'
                }`}
                title={isSharing ? 'Stop Screen Share' : 'Start Screen Share'}
              >
                {isSharing ? 
                  <Monitor className="w-6 h-6 text-orange-300" /> : 
                  <MonitorOff className="w-6 h-6 text-orange-500" />
                }
                {isAnalyzing && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400 rounded-full"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
                {isSharing && (
                  <div className="absolute -bottom-1 -right-1 text-xs bg-blue-500 text-white px-1 rounded">
                    {streamQuality}
                  </div>
                )}
              </motion.button>

              {/* Voice Status Indicator */}
              <div className="flex items-center space-x-2 p-4 glass rounded-2xl">
                {isListening && (
                  <div className="listening-indicator">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="sound-wave" />
                    ))}
                  </div>
                )}
                {isSpeaking && <Volume2 className="w-6 h-6 text-orange-400" />}
                {isProcessing && <Cpu className="w-6 h-6 text-blue-400 animate-spin" />}
                {conversationFlow === 'idle' && <VolumeX className="w-6 h-6 text-gray-500" />}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error Display */}
        {screenShareError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-dark rounded-2xl p-6 mb-6 border border-red-500/30 bg-red-500/5"
          >
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <span className="text-red-300 text-lg">{screenShareError}</span>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Enhanced Main Chat Area */}
          <div className="xl:col-span-3 space-y-8">
            {/* Messages Container */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass-dark rounded-3xl p-8 h-[700px] overflow-y-auto relative"
            >
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 30, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -30, scale: 0.9 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className={`mb-8 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}
                  >
                    <div className={`inline-flex items-start space-x-4 max-w-4xl ${
                      message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}>
                      <motion.div 
                        className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center relative ${
                          message.sender === 'user' ? 'glass-orange' : 'glass'
                        }`}
                        whileHover={{ scale: 1.1 }}
                      >
                        {message.sender === 'user' ? 
                          <User className="w-7 h-7 text-orange-300" /> : 
                          <Bot className="w-7 h-7 text-orange-400" />
                        }
                        {message.isVoice && (
                          <motion.div
                            className="absolute -top-1 -right-1 w-5 h-5 bg-orange-400 rounded-full"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        )}
                      </motion.div>
                      
                      <motion.div 
                        className={`message-bubble p-6 rounded-3xl relative ${
                          message.sender === 'user' ? 'user' : 'ai'
                        }`}
                        whileHover={{ y: -3 }}
                      >
                        <p className="text-white leading-relaxed text-lg">{message.text}</p>
                        <div className="flex items-center justify-between mt-4">
                          <p className="text-xs text-orange-300/60">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                          <div className="flex items-center space-x-3">
                            {message.isVoice && (
                              <div className="flex items-center space-x-2">
                                <Volume2 className="w-4 h-4 text-orange-400" />
                                <span className="text-xs text-orange-400 font-medium">Voice</span>
                              </div>
                            )}
                            {message.emotion && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                message.emotion === 'excited' ? 'bg-yellow-500/20 text-yellow-400' :
                                message.emotion === 'calm' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {message.emotion}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Interim Text Display */}
              {interimText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-right mb-8"
                >
                  <div className="inline-flex items-center space-x-4">
                    <div className="message-bubble user p-6 rounded-3xl opacity-60">
                      <p className="text-white leading-relaxed text-lg italic">{interimText}...</p>
                    </div>
                    <div className="w-14 h-14 rounded-full glass-orange flex items-center justify-center">
                      <User className="w-7 h-7 text-orange-300" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Loading State */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-left mb-8"
                >
                  <div className="inline-flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-full glass flex items-center justify-center">
                      <Bot className="w-7 h-7 text-orange-400" />
                    </div>
                    <div className="message-bubble ai p-6 rounded-3xl ai-thinking">
                      <div className="flex items-center space-x-3">
                        <Sparkles className="w-5 h-5 text-orange-400 animate-spin" />
                        <span className="text-orange-300 text-lg">AI is thinking...</span>
                        <div className="flex space-x-1">
                          {[...Array(3)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="w-2 h-2 bg-orange-400 rounded-full"
                              animate={{ scale: [1, 1.5, 1] }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </motion.div>

            {/* Enhanced Input Area */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="glass-dark rounded-3xl p-8 relative overflow-hidden"
            >
              <div className="aurora-effect"></div>
              
              <div className="flex space-x-6 relative z-10">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder={
                      conversationActive
                        ? (language === 'en' ? 'Voice conversation active - speak or type...' : 'ভয়েস কথোপকথন সক্রিয় - বলুন বা টাইপ করুন...')
                        : (language === 'en' ? 'Type your message or start voice conversation...' : 'আপনার বার্তা টাইপ করুন বা ভয়েস কথোপকথন শুরু করুন...')
                    }
                    className="w-full bg-transparent border-2 border-orange-500/30 rounded-2xl px-8 py-6 text-white text-xl placeholder-orange-300/50 focus:outline-none focus:border-orange-400 transition-all duration-300"
                    disabled={isLoading}
                  />
                  
                  {conversationActive && (
                    <div className="absolute right-6 top-1/2 transform -translate-y-1/2 flex items-center space-x-3">
                      <motion.div
                        className="text-orange-400 text-sm font-medium"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        Listening...
                      </motion.div>
                      <Zap className="w-5 h-5 text-orange-400" />
                    </div>
                  )}
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={sendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className="btn-primary rounded-2xl px-8 py-6 disabled:opacity-50 transition-all duration-300"
                >
                  {isLoading ? (
                    <Sparkles className="w-8 h-8 text-orange-300 animate-spin" />
                  ) : (
                    <Send className="w-8 h-8 text-orange-300" />
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Enhanced Side Panel */}
          <div className="xl:col-span-2 space-y-8">
            {/* Voice Settings Panel */}
            {showVoiceSettings && (
              <VoiceSettingsPanel
                settings={voiceSettings}
                onSettingsChange={handleVoiceSettingsChange}
                onPreview={handleVoicePreview}
                language={language}
              />
            )}

            {/* Enhanced Screen Share Preview */}
            {isSharing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-dark rounded-3xl p-6 relative overflow-hidden"
              >
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center justify-between">
                  <div className="flex items-center">
                    <Monitor className="w-6 h-6 mr-3 text-orange-400" />
                    Live Screen Share
                    {isVideoReady && (
                      <span className="ml-2 text-sm bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                        ● LIVE
                      </span>
                    )}
                  </div>
                  {isAnalyzing && (
                    <div className="flex items-center space-x-2">
                      <motion.div
                        className="w-3 h-3 bg-blue-400 rounded-full"
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <span className="text-sm text-blue-400 font-medium">
                        Analyzing... {analysisProgress}%
                      </span>
                    </div>
                  )}
                </h3>
                
                <div className="screen-preview mb-4">
                  {!isVideoReady && (
                    <div className="w-full h-48 bg-gray-800 rounded-xl flex items-center justify-center border border-orange-500/30">
                      <div className="text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full mx-auto mb-3"></div>
                        <p className="text-gray-400">Loading screen share...</p>
                      </div>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full rounded-xl bg-black border border-orange-500/30 transition-opacity ${
                      isVideoReady ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ 
                      maxHeight: '300px', 
                      width: '100%',
                      objectFit: 'contain',
                      backgroundColor: '#000'
                    }}
                  />
                  <div className="mt-2 text-xs text-gray-400 text-center">
                    {screenMetrics.resolution} • {screenMetrics.fps} FPS • {screenMetrics.bandwidth}
                  </div>
                </div>
                
                {/* Quality Controls */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-orange-300 mb-2 block">
                    Stream Quality
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['HD', 'FHD', '4K'] as const).map((quality) => (
                      <motion.button
                        key={quality}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setStreamQualityLevel(quality)}
                        disabled={isSharing}
                        className={`p-2 rounded-lg text-xs transition-all ${
                          streamQuality === quality
                            ? 'glass-orange text-orange-200'
                            : 'glass text-gray-300 hover:text-orange-300'
                        } disabled:opacity-50`}
                      >
                        {quality}
                      </motion.button>
                    ))}
                  </div>
                </div>
                
                {/* Analysis Progress */}
                {analysisProgress > 0 && (
                  <div className="mb-4">
                    <div className="glass rounded-lg p-2">
                      <motion.div
                        className="h-2 bg-gradient-to-r from-orange-500 to-orange-300 rounded"
                        initial={{ width: 0 }}
                        animate={{ width: `${analysisProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="text-xs text-center text-gray-400 mt-1">
                      AI is analyzing your screen content...
                    </div>
                  </div>
                )}
                
                <canvas ref={canvasRef} className="hidden" />
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={analyzeCodeManually}
                  className="w-full mt-3 btn-primary rounded-xl p-3 text-orange-300"
                  disabled={isAnalyzing || !isVideoReady}
                >
                  <Eye className="w-4 h-4 mr-2 inline" />
                  {isAnalyzing ? 'Analyzing...' : !isVideoReady ? 'Starting...' : 'Analyze Screen Now'}
                </motion.button>
              </motion.div>
            )}

            {/* Detected Code Analysis */}
            {detectedCodes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-dark rounded-3xl p-6"
              >
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                  <Code className="w-6 h-6 mr-3 text-orange-400" />
                  Code Analysis ({detectedCodes.length})
                </h3>
                
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {detectedCodes.map((code, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleCodeSelection(code)}
                      className={`cursor-pointer p-4 rounded-xl transition-all duration-300 ${
                        activeCode === code ? 'code-detected' : 'glass'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-orange-300 bg-orange-500/20 px-2 py-1 rounded-full">
                          {code.language}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-400">
                            {Math.round(code.confidence * 100)}% confidence
                          </span>
                          <div className={`w-2 h-2 rounded-full ${
                            code.analysis.complexity === 'high' ? 'bg-red-400' :
                            code.analysis.complexity === 'medium' ? 'bg-yellow-400' :
                            'bg-green-400'
                          }`} />
                        </div>
                      </div>
                      
                      <pre className="text-xs text-orange-200 overflow-hidden max-h-32">
                        {code.content.substring(0, 200)}...
                      </pre>
                      
                      <div className="mt-3 flex flex-wrap gap-2">
                        {code.analysis.issues.slice(0, 2).map((issue, i) => (
                          <span key={i} className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">
                            {issue}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={analyzeCodeManually}
                  className="w-full mt-4 btn-primary rounded-xl p-3 text-orange-300"
                >
                  <Eye className="w-4 h-4 mr-2 inline" />
                  Analyze Code Again
                </motion.button>
              </motion.div>
            )}

            {/* Enhanced Voice Conversation Status */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-dark rounded-3xl p-6"
            >
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                <Settings className="w-6 h-6 mr-3 text-orange-400" />
                System Status
              </h3>
              
              <div className="space-y-4">
                {[
                  { 
                    label: 'Voice Conversation', 
                    active: conversationActive, 
                    icon: MessageSquare,
                    description: conversationActive ? 
                      (isSpeaking ? 'AI is speaking...' : 
                       isListening ? 'Listening for your voice...' : 
                       'Ready to listen') : 'Voice conversation disabled'
                  },
                  { 
                    label: 'Screen Analysis', 
                    active: isSharing, 
                    icon: Monitor,
                    description: isSharing ? 'AI can see your screen' : 'Screen sharing disabled'
                  },
                  { 
                    label: 'Voice Recognition', 
                    active: isListening, 
                    icon: Mic,
                    description: isListening ? 'Actively listening...' : 'Not listening'
                  },
                  { 
                    label: 'AI Speaking', 
                    active: isSpeaking, 
                    icon: Volume2,
                    description: isSpeaking ? 'AI is responding...' : 'AI is silent'
                  },
                  { 
                    label: 'Code Processing', 
                    active: isAnalyzing, 
                    icon: Cpu,
                    description: isAnalyzing ? 'Analyzing screen content...' : 'No analysis running'
                  }
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center justify-between p-4 glass rounded-xl"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex items-center space-x-4">
                      <item.icon className={`w-5 h-5 ${item.active ? 'text-orange-400' : 'text-gray-500'}`} />
                      <div>
                        <span className="text-gray-300 font-medium block">{item.label}</span>
                        <span className="text-xs text-gray-500">{item.description}</span>
                      </div>
                    </div>
                    <motion.div
                      className={`w-3 h-3 rounded-full ${item.active ? 'bg-orange-400' : 'bg-gray-600'}`}
                      animate={item.active ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 1, repeat: item.active ? Infinity : 0 }}
                    />
                  </motion.div>
                ))}
                
                <motion.div 
                  className="mt-6 p-4 glass-orange rounded-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-orange-300 text-sm font-medium block">Language</span>
                      <span className="text-lg font-bold text-orange-200">
                        {language === 'en' ? 'English' : 'বাংলা'}
                      </span>
                    </div>
                    <div>
                      <span className="text-orange-300 text-sm font-medium block">Voice Level</span>
                      <div className="mt-1 glass rounded-full h-2 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-orange-500 to-orange-300"
                          animate={{ width: `${voiceLevel * 100}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="glass-dark rounded-3xl p-6"
            >
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                <Zap className="w-6 h-6 mr-3 text-orange-400" />
                Quick Actions
              </h3>
              
              <div className="grid grid-cols-1 gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInputText('Analyze the code on my screen')}
                  className="btn-primary rounded-xl p-4 text-left"
                >
                  <Code className="w-5 h-5 mr-3 inline text-orange-400" />
                  Analyze Current Code
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInputText('Help me debug this code')}
                  className="btn-primary rounded-xl p-4 text-left"
                >
                  <AlertCircle className="w-5 h-5 mr-3 inline text-orange-400" />
                  Debug Help
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInputText('Explain this code to me')}
                  className="btn-primary rounded-xl p-4 text-left"
                >
                  <Brain className="w-5 h-5 mr-3 inline text-orange-400" />
                  Code Explanation
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
