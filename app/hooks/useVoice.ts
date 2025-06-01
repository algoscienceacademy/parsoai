import { useState, useEffect, useCallback, useRef } from 'react';

interface UseVoiceProps {
  language: 'en' | 'bn';
  onTranscript: (text: string) => void;
  onVoiceCommand?: (command: string) => void;
  autoListen?: boolean;
}

export const useVoice = ({ language, onTranscript, onVoiceCommand, autoListen = false }: UseVoiceProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition && 'speechSynthesis' in window) {
        setIsSupported(true);
        
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript.trim()) {
            onTranscript(transcript.trim());
            
            const command = transcript.toLowerCase().trim();
            if (onVoiceCommand) {
              if (command.includes('stop listening')) {
                onVoiceCommand('stop_listening');
              } else if (command.includes('start screen share')) {
                onVoiceCommand('start_screen_share');
              } else if (command.includes('stop screen share')) {
                onVoiceCommand('stop_screen_share');
              }
            }
          }
        };

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
          setIsListening(false);
          if (autoListen && isVoiceActive && !isSpeaking) {
            timeoutRef.current = setTimeout(() => {
              if (isVoiceActive && !isSpeaking) {
                startListening();
              }
            }, 1000);
          }
        };
        recognition.onerror = () => setIsListening(false);

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [language, onTranscript, onVoiceCommand, autoListen, isVoiceActive, isSpeaking]);

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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [isListening]);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window && text.trim()) {
      window.speechSynthesis.cancel();
      
      if (isListening) {
        stopListening();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'bn' ? 'bn-BD' : 'en-US';
      utterance.rate = 0.8;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (autoListen && isVoiceActive) {
          setTimeout(() => {
            if (isVoiceActive && !isSpeaking) {
              startListening();
            }
          }, 500);
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  }, [language, isListening, stopListening, autoListen, isVoiceActive, isSpeaking, startListening]);

  const toggleVoiceMode = useCallback(() => {
    if (isVoiceActive) {
      setIsVoiceActive(false);
      stopListening();
    } else {
      setIsVoiceActive(true);
      startListening();
    }
  }, [isVoiceActive, stopListening, startListening]);

  return {
    isListening,
    isSpeaking,
    isVoiceActive,
    isSupported,
    startListening,
    stopListening,
    speak,
    toggleVoiceMode
  };
};
