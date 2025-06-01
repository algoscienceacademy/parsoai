import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAdvancedVoiceProps {
  language: 'en' | 'bn';
  onTranscript: (text: string, isFinal: boolean) => void;
  onConversationFlow: (flow: 'listening' | 'processing' | 'speaking' | 'idle') => void;
  enableContinuousMode?: boolean;
}

export const useAdvancedVoice = ({ 
  language, 
  onTranscript, 
  onConversationFlow,
  enableContinuousMode = false 
}: UseAdvancedVoiceProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [isSupported, setIsSupported] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastUserSpeechTime, setLastUserSpeechTime] = useState<number>(0);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio context for voice level detection
  useEffect(() => {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition && 'speechSynthesis' in window) {
        setIsSupported(true);
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US';
        recognition.maxAlternatives = 3;

        let finalTranscript = '';
        let speechStartTime = 0;

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          setIsUserSpeaking(true);
          speechStartTime = Date.now();
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
              finalTranscript = transcript;
              setLastUserSpeechTime(Date.now());
              onTranscript(finalTranscript.trim(), true);
              
              // Clear any existing silence timer
              if (silenceTimer) {
                clearTimeout(silenceTimer);
                setSilenceTimer(null);
              }
              
              // Start silence detection for conversation flow
              if (enableContinuousMode && conversationActive) {
                const timer = setTimeout(() => {
                  setIsUserSpeaking(false);
                  if (!isSpeaking && isListening) {
                    setIsProcessing(true);
                    onConversationFlow('processing');
                  }
                }, 2500); // Wait 2.5 seconds of silence before processing
                
                setSilenceTimer(timer);
              }
            } else {
              interimTranscript = transcript;
              onTranscript(interimTranscript, false);
            }
          }
        };

        recognition.onstart = () => {
          setIsListening(true);
          onConversationFlow('listening');
          startVoiceLevelMonitoring();
        };

        recognition.onend = () => {
          setIsListening(false);
          setIsUserSpeaking(false);
          stopVoiceLevelMonitoring();
          
          // Only restart if conversation is active and AI is not speaking
          if (enableContinuousMode && conversationActive && !isSpeaking && !isProcessing) {
            setTimeout(() => {
              if (conversationActive && !isSpeaking && !isProcessing) {
                startListening();
              }
            }, 1000);
          } else if (!conversationActive) {
            onConversationFlow('idle');
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setIsUserSpeaking(false);
          stopVoiceLevelMonitoring();
          
          // Don't restart on abort or permission errors
          if (event.error !== 'aborted' && event.error !== 'not-allowed' && 
              enableContinuousMode && conversationActive && !isSpeaking) {
            setTimeout(() => {
              if (conversationActive && !isSpeaking) {
                startListening();
              }
            }, 2000);
          }
        };

        recognitionRef.current = recognition;
        synthRef.current = window.speechSynthesis;
      }
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (silenceTimer) clearTimeout(silenceTimer);
    };
  }, [language, onTranscript, onConversationFlow, enableContinuousMode, conversationActive, isSpeaking, isListening, isProcessing, silenceTimer]);

  const startVoiceLevelMonitoring = useCallback(async () => {
    if (!audioContextRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (analyserRef.current && isListening) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVoiceLevel(average / 255);
          requestAnimationFrame(updateLevel);
        }
      };
      
      updateLevel();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }, [isListening]);

  const stopVoiceLevelMonitoring = useCallback(() => {
    setVoiceLevel(0);
    analyserRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && !isSpeaking && isSupported) {
      try {
        setIsProcessing(false);
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    }
  }, [isListening, isSpeaking, isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      stopVoiceLevelMonitoring();
      
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    }
  }, [isListening, stopVoiceLevelMonitoring]);

  const speak = useCallback((text: string, options?: { priority?: 'high' | 'normal'; emotion?: 'excited' | 'calm' | 'professional' }) => {
    if (!synthRef.current || !text.trim()) return Promise.resolve();

    return new Promise<void>((resolve) => {
      // Stop listening while AI is speaking
      if (isListening) {
        stopListening();
      }

      // Clear any silence timers
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        setSilenceTimer(null);
      }

      setIsSpeaking(true);
      setIsProcessing(false);
      setIsUserSpeaking(false);
      onConversationFlow('speaking');

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'bn' ? 'bn-BD' : 'en-US';
      
      // Adjust speech parameters based on emotion
      switch (options?.emotion) {
        case 'excited':
          utterance.rate = 1.1;
          utterance.pitch = 1.2;
          break;
        case 'calm':
          utterance.rate = 0.8;
          utterance.pitch = 0.9;
          break;
        case 'professional':
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          break;
        default:
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
      }

      // Find appropriate voice
      const voices = synthRef.current.getVoices();
      const preferredVoice = voices.find((voice: any) => 
        voice.lang.startsWith(language === 'bn' ? 'bn' : 'en') && 
        (voice.name.includes('Google') || voice.name.includes('Microsoft'))
      ) || voices.find((voice: any) => 
        voice.lang.startsWith(language === 'bn' ? 'bn' : 'en')
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        
        // Wait for AI to finish speaking, then start listening again
        if (enableContinuousMode && conversationActive) {
          setTimeout(() => {
            onConversationFlow('listening');
            if (!isSpeaking && !isUserSpeaking) {
              startListening();
            }
          }, 1000); // Give 1 second pause after AI finishes speaking
        } else {
          onConversationFlow('idle');
        }
        
        resolve();
      };

      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        setIsSpeaking(false);
        onConversationFlow('idle');
        resolve();
      };

      synthRef.current.speak(utterance);
    });
  }, [language, isListening, stopListening, enableContinuousMode, conversationActive, isSpeaking, onConversationFlow, startListening, isUserSpeaking, silenceTimer]);

  const startConversation = useCallback(() => {
    setConversationActive(true);
    startListening();
  }, [startListening]);

  const stopConversation = useCallback(() => {
    setConversationActive(false);
    stopListening();
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
    setIsProcessing(false);
    onConversationFlow('idle');
  }, [stopListening, onConversationFlow]);

  const toggleConversation = useCallback(() => {
    if (conversationActive) {
      stopConversation();
    } else {
      startConversation();
    }
  }, [conversationActive, stopConversation, startConversation]);

  return {
    isListening,
    isSpeaking,
    isProcessing,
    conversationActive,
    isUserSpeaking,
    voiceLevel,
    isSupported,
    startListening,
    stopListening,
    speak,
    startConversation,
    stopConversation,
    toggleConversation
  };
};
