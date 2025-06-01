import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAdvancedVoiceProps {
  language: 'en' | 'bn';
  onTranscript: (text: string, isFinal: boolean) => void;
  onConversationFlow: (flow: 'listening' | 'processing' | 'speaking' | 'idle') => void;
  enableContinuousMode: boolean;
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
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition && 'speechSynthesis' in window) {
        setIsSupported(true);
        synthRef.current = window.speechSynthesis;
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US';
        recognition.maxAlternatives = 1;

        let speechTimeout: NodeJS.Timeout | null = null;

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
              finalTranscript = transcript;
              setIsUserSpeaking(false);
              
              // Clear any existing speech timeout
              if (speechTimeout) {
                clearTimeout(speechTimeout);
              }
              
              // Process the final transcript
              if (finalTranscript.trim()) {
                onTranscript(finalTranscript.trim(), true);
              }
            } else {
              interimTranscript = transcript;
              setIsUserSpeaking(true);
              onTranscript(interimTranscript, false);
              
              // Reset speech timeout on interim results
              if (speechTimeout) {
                clearTimeout(speechTimeout);
              }
              
              // Set timeout to detect end of speech
              speechTimeout = setTimeout(() => {
                setIsUserSpeaking(false);
              }, 2000);
            }
          }
        };

        recognition.onstart = () => {
          setIsListening(true);
          setIsProcessing(false);
          onConversationFlow('listening');
          startVoiceLevelMonitoring();
        };

        recognition.onend = () => {
          setIsListening(false);
          setIsUserSpeaking(false);
          stopVoiceLevelMonitoring();
          
          // Clear speech timeout
          if (speechTimeout) {
            clearTimeout(speechTimeout);
          }
          
          // Restart if conversation is active and AI is not speaking
          if (conversationActive && !isSpeaking) {
            timeoutRef.current = setTimeout(() => {
              if (conversationActive && !isSpeaking) {
                startListening();
              }
            }, 1500);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setIsUserSpeaking(false);
          stopVoiceLevelMonitoring();
          
          if (event.error !== 'aborted' && event.error !== 'not-allowed') {
            if (conversationActive && !isSpeaking) {
              timeoutRef.current = setTimeout(() => {
                if (conversationActive && !isSpeaking) {
                  startListening();
                }
              }, 2000);
            }
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      stopVoiceLevelMonitoring();
    };
  }, [language, onTranscript, onConversationFlow, conversationActive, isSpeaking]);

  const startVoiceLevelMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current.fftSize = 256;
      microphoneRef.current.connect(analyserRef.current);
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateVoiceLevel = () => {
        if (analyserRef.current && isListening) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVoiceLevel(Math.min(average / 128, 1));
          animationFrameRef.current = requestAnimationFrame(updateVoiceLevel);
        }
      };
      
      updateVoiceLevel();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }, [isListening]);

  const stopVoiceLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    setVoiceLevel(0);
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && !isSpeaking && isSupported) {
      try {
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
      setIsUserSpeaking(false);
      stopVoiceLevelMonitoring();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [isListening, stopVoiceLevelMonitoring]);

  const speak = useCallback((text: string, options?: { priority?: 'high' | 'normal'; emotion?: 'excited' | 'calm' | 'professional' }) => {
    if (!synthRef.current || !text.trim()) return Promise.resolve();

    return new Promise<void>((resolve) => {
      // Stop listening when AI starts speaking
      if (isListening) {
        stopListening();
      }

      // Cancel any existing speech
      synthRef.current.cancel();
      
      setIsSpeaking(true);
      setIsProcessing(false);
      setIsUserSpeaking(false);
      onConversationFlow('speaking');

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'bn' ? 'bn-BD' : 'en-US';
      utterance.rate = language === 'bn' ? 0.8 : 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Adjust voice based on emotion
      if (options?.emotion === 'excited') {
        utterance.rate += 0.1;
        utterance.pitch += 0.1;
      } else if (options?.emotion === 'calm') {
        utterance.rate -= 0.1;
        utterance.pitch -= 0.1;
      }

      const voices = synthRef.current.getVoices();
      const preferredVoice = voices.find((voice: any) => 
        voice.lang.startsWith(language === 'bn' ? 'bn' : 'en')
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        
        // Resume listening after AI finishes speaking
        if (conversationActive) {
          timeoutRef.current = setTimeout(() => {
            onConversationFlow('listening');
            startListening();
          }, 1000);
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
  }, [language, isListening, stopListening, conversationActive, onConversationFlow, startListening]);

  const startConversation = useCallback(() => {
    if (!isSupported) return;
    
    setConversationActive(true);
    setIsProcessing(false);
    
    // Start listening immediately
    setTimeout(() => {
      if (!isSpeaking) {
        startListening();
      }
    }, 100);
  }, [isSupported, isSpeaking, startListening]);

  const stopConversation = useCallback(() => {
    setConversationActive(false);
    stopListening();
    
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    
    setIsSpeaking(false);
    setIsProcessing(false);
    setIsUserSpeaking(false);
    onConversationFlow('idle');
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
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
