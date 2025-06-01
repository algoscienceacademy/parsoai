import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceSettings {
  country: 'US' | 'UK' | 'AU' | 'CA' | 'IN' | 'BD';
  gender: 'male' | 'female';
  tone: 'professional' | 'friendly' | 'casual' | 'excited' | 'calm';
  speed: number; // 0.5 to 2.0
  pitch: number; // 0.5 to 2.0
}

interface UseAdvancedVoiceProps {
  language: 'en' | 'bn';
  onTranscript: (text: string, isFinal: boolean) => void;
  onConversationFlow: (flow: 'listening' | 'processing' | 'speaking' | 'idle') => void;
  enableContinuousMode: boolean;
  voiceSettings?: VoiceSettings;
}

export const useAdvancedVoice = ({ 
  language, 
  onTranscript, 
  onConversationFlow,
  enableContinuousMode = false,
  voiceSettings = {
    country: 'US',
    gender: 'female',
    tone: 'professional',
    speed: 1.0,
    pitch: 1.0
  }
}: UseAdvancedVoiceProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentVoiceSettings, setCurrentVoiceSettings] = useState<VoiceSettings>(voiceSettings);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const selectOptimalVoice = useCallback((voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (!voices.length) return null;

    const { country, gender } = currentVoiceSettings;
    const langCode = language === 'bn' ? 'bn' : 'en';
    
    // Country-specific language codes
    const countryLangMap: Record<string, string[]> = {
      'US': ['en-US'],
      'UK': ['en-GB'],
      'AU': ['en-AU'],
      'CA': ['en-CA'],
      'IN': ['en-IN', 'hi-IN'],
      'BD': ['bn-BD', 'bn-IN']
    };

    const preferredLangs = langCode === 'bn' ? ['bn-BD', 'bn-IN'] : countryLangMap[country] || ['en-US'];
    
    // Filter voices by language and gender preferences
    let filteredVoices = voices.filter(voice => {
      const matchesLanguage = preferredLangs.some(prefLang => voice.lang.startsWith(prefLang));
      const matchesGender = gender === 'female' ? 
        (voice.name.toLowerCase().includes('female') || 
         voice.name.toLowerCase().includes('woman') ||
         !voice.name.toLowerCase().includes('male')) :
        (voice.name.toLowerCase().includes('male') || 
         voice.name.toLowerCase().includes('man'));
      
      return matchesLanguage && matchesGender;
    });

    // Fallback to any voice in the preferred language
    if (!filteredVoices.length) {
      filteredVoices = voices.filter(voice => 
        preferredLangs.some(prefLang => voice.lang.startsWith(prefLang))
      );
    }

    // Fallback to any English voice if no specific match
    if (!filteredVoices.length && langCode === 'en') {
      filteredVoices = voices.filter(voice => voice.lang.startsWith('en'));
    }

    return filteredVoices[0] || voices[0];
  }, [currentVoiceSettings, language]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition && 'speechSynthesis' in window) {
        setIsSupported(true);
        synthRef.current = window.speechSynthesis;
        
        // Load available voices
        const loadVoices = () => {
          const voices = window.speechSynthesis.getVoices();
          setAvailableVoices(voices);
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        
        // ...existing recognition setup...
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        // Enhanced language selection based on country
        const getRecognitionLanguage = () => {
          if (language === 'bn') return 'bn-BD';
          
          const countryLangMap: Record<string, string> = {
            'US': 'en-US',
            'UK': 'en-GB',
            'AU': 'en-AU',
            'CA': 'en-CA',
            'IN': 'en-IN',
            'BD': 'en-US'
          };
          
          return countryLangMap[currentVoiceSettings.country] || 'en-US';
        };

        recognition.lang = getRecognitionLanguage();
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
  }, [language, onTranscript, onConversationFlow, conversationActive, isSpeaking, currentVoiceSettings]);

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
      
      // Enhanced voice selection
      const selectedVoice = selectOptimalVoice(availableVoices);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Apply voice settings
      const { tone, speed, pitch } = currentVoiceSettings;
      
      // Base settings
      utterance.rate = speed;
      utterance.pitch = pitch;
      utterance.volume = 1;

      // Tone adjustments
      switch (tone) {
        case 'excited':
          utterance.rate = Math.min(speed * 1.2, 2.0);
          utterance.pitch = Math.min(pitch * 1.2, 2.0);
          break;
        case 'calm':
          utterance.rate = Math.max(speed * 0.8, 0.5);
          utterance.pitch = Math.max(pitch * 0.9, 0.5);
          break;
        case 'friendly':
          utterance.pitch = Math.min(pitch * 1.1, 2.0);
          break;
        case 'casual':
          utterance.rate = Math.min(speed * 1.1, 2.0);
          break;
        case 'professional':
        default:
          // Use base settings
          break;
      }

      // Override with emotion if provided
      if (options?.emotion) {
        switch (options.emotion) {
          case 'excited':
            utterance.rate = Math.min(utterance.rate * 1.1, 2.0);
            utterance.pitch = Math.min(utterance.pitch * 1.1, 2.0);
            break;
          case 'calm':
            utterance.rate = Math.max(utterance.rate * 0.9, 0.5);
            utterance.pitch = Math.max(utterance.pitch * 0.95, 0.5);
            break;
        }
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
  }, [language, isListening, stopListening, conversationActive, onConversationFlow, startListening, availableVoices, selectOptimalVoice, currentVoiceSettings]);

  const updateVoiceSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setCurrentVoiceSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const getVoicePreview = useCallback(() => {
    const previewText = language === 'bn' ? 
      'আমি আপনার উন্নত এআই সহায়ক পার্সোএআই। আমি আপনাকে সাহায্য করতে এখানে আছি।' :
      'Hello! I am ParsoAI, your advanced AI assistant. I am here to help you with anything you need.';
    
    speak(previewText, { priority: 'high' });
  }, [language, speak]);

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
    toggleConversation,
    availableVoices,
    currentVoiceSettings,
    updateVoiceSettings,
    getVoicePreview,
    selectOptimalVoice
  };
};
