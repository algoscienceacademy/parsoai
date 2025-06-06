import { useState, useCallback, useRef, useEffect } from 'react';

interface DetectedCode {
  id: string;
  content: string;
  language: string;
  confidence: number;
  analysis: {
    complexity: 'low' | 'medium' | 'high';
    issues: string[];
    suggestions: string[];
  };
  timestamp: Date;
  screenshot?: string;
}

interface ScreenMetrics {
  resolution: string;
  fps: number;
  bandwidth: string;
}

export const useEnhancedScreenShare = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detectedCodes, setDetectedCodes] = useState<DetectedCode[]>([]);
  const [activeCode, setActiveCode] = useState<DetectedCode | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [currentScreenshot, setCurrentScreenshot] = useState<string>('');
  const [realTimeAnalysis, setRealTimeAnalysis] = useState(true);
  const [screenMetrics, setScreenMetrics] = useState<ScreenMetrics>({
    resolution: '0x0',
    fps: 0,
    bandwidth: '0MB/s'
  });
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [streamQuality, setStreamQuality] = useState<'HD' | 'FHD' | '4K'>('HD');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);

  const mockCodeDatabase: DetectedCode[] = [
    {
      id: '1',
      content: `function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

const cart = [
  { price: 10.99, quantity: 2 },
  { price: 5.50, quantity: 1 }
];
console.log('Total:', calculateTotal(cart));`,
      language: 'javascript',
      confidence: 0.95,
      analysis: {
        complexity: 'low',
        issues: ['No input validation'],
        suggestions: ['Add type checking', 'Handle edge cases']
      },
      timestamp: new Date()
    },
    {
      id: '2',
      content: `import React, { useState, useEffect } from 'react';

const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(\`/api/users/\${userId}\`);
        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="user-profile">
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
};

export default UserProfile;`,
      language: 'typescript',
      confidence: 0.89,
      analysis: {
        complexity: 'medium',
        issues: ['Missing TypeScript types', 'No error handling UI'],
        suggestions: ['Add proper types', 'Implement error boundary', 'Add loading skeleton']
      },
      timestamp: new Date()
    }
  ];

  // Enhanced screen capture with better quality
  const captureFullScreen = useCallback(async (): Promise<string> => {
    if (!videoRef.current || !canvasRef.current || !isVideoReady) return '';

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true,
      preserveDrawingBuffer: true
    }) as CanvasRenderingContext2D;

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return '';

    try {
      // Set canvas to match video dimensions exactly
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Clear and draw with better quality settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to high-quality image
      const imageData = canvas.toDataURL('image/jpeg', 0.95);
      setCurrentScreenshot(imageData);
      
      return imageData;
    } catch (error) {
      console.error('Error capturing screen:', error);
      return '';
    }
  }, [isVideoReady]);

  const analyzeScreenContent = useCallback(async () => {
    if (!isSharing || !realTimeAnalysis) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      const screenshot = await captureFullScreen();
      
      if (!screenshot) {
        setIsAnalyzing(false);
        return;
      }

      const progressSteps = [20, 40, 60, 80, 100];
      
      for (let i = 0; i < progressSteps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setAnalysisProgress(progressSteps[i]);
      }

      if (Math.random() > 0.2) {
        const detectedCode = {
          ...mockCodeDatabase[Math.floor(Math.random() * mockCodeDatabase.length)],
          id: Date.now().toString(),
          screenshot: screenshot,
          timestamp: new Date(),
          confidence: Math.max(0.8, Math.random() * 0.2 + 0.8)
        };
        
        setDetectedCodes(prev => {
          const updated = [detectedCode, ...prev.slice(0, 4)];
          return updated;
        });
        
        setActiveCode(detectedCode);
      }

    } catch (error) {
      console.error('Error analyzing screen content:', error);
      setError('Failed to analyze screen content');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [isSharing, realTimeAnalysis, captureFullScreen]);

  const updateScreenMetrics = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const currentTime = performance.now();
    
    frameCountRef.current++;
    
    if (lastTimeRef.current > 0) {
      const deltaTime = currentTime - lastTimeRef.current;
      if (deltaTime >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / deltaTime);
        
        setScreenMetrics({
          resolution: `${video.videoWidth}x${video.videoHeight}`,
          fps: fps || 30,
          bandwidth: `${Math.round((video.videoWidth * video.videoHeight * (fps || 30) * 3) / 1024 / 1024 * 100) / 100}MB/s`
        });
        
        frameCountRef.current = 0;
        lastTimeRef.current = currentTime;
      }
    } else {
      lastTimeRef.current = currentTime;
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      setError('');
      setIsVideoReady(false);
      
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing not supported in this browser. Please use Chrome, Firefox, or Edge.');
      }

      // Enhanced display media constraints for better quality
      let videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 },
        frameRate: { ideal: 30, max: 60 }
      };

      // Adjust quality based on setting
      if (streamQuality === 'FHD') {
        videoConstraints = {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        };
      } else if (streamQuality === '4K') {
        videoConstraints = {
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
          frameRate: { ideal: 30, max: 60 }
        };
      }

      const constraints: DisplayMediaStreamOptions = {
        video: videoConstraints,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        }
      };

      const mediaStream = await navigator.mediaDevices.getDisplayMedia(constraints);

      setStream(mediaStream);
      setIsSharing(true);
      setRealTimeAnalysis(true);
      frameCountRef.current = 0;
      lastTimeRef.current = 0;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Enhanced video setup
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            // Set video properties for better display
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.setAttribute('webkit-playsinline', 'true');
            
            videoRef.current.play().then(() => {
              setIsVideoReady(true);
              console.log('Video dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
              
              // Start metrics monitoring with more frequent updates
              const metricsInterval = setInterval(updateScreenMetrics, 500);
              
              // Start analysis after video is ready
              setTimeout(() => {
                analyzeScreenContent();
                intervalRef.current = setInterval(analyzeScreenContent, 6000);
              }, 1500);

              // Enhanced cleanup function
              const cleanup = () => {
                clearInterval(metricsInterval);
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = null;
                }
                setIsVideoReady(false);
              };

              // Handle stream end
              mediaStream.getVideoTracks().forEach(track => {
                track.onended = () => {
                  cleanup();
                  setIsSharing(false);
                  setStream(null);
                  setDetectedCodes([]);
                  setActiveCode(null);
                  setIsAnalyzing(false);
                  setCurrentScreenshot('');
                  setAnalysisProgress(0);
                };
              });
            }).catch((playError) => {
              console.error('Video play error:', playError);
              setError('Failed to start video playback. Please try again.');
            });
          }
        };
        
        videoRef.current.onloadstart = () => {
          console.log('Video loading started...');
        };

        videoRef.current.oncanplay = () => {
          console.log('Video can start playing...');
        };
        
        videoRef.current.onerror = (error) => {
          console.error('Video error:', error);
          setError('Error loading video stream. Please try sharing again.');
          setIsVideoReady(false);
        };

        // Force video to load
        videoRef.current.load();
      }

    } catch (error) {
      console.error('Screen share error:', error);
      setIsVideoReady(false);
      
      if (error instanceof Error) {
        if (error.message.includes('Permission denied') || error.name === 'NotAllowedError') {
          setError('Screen sharing permission denied. Please allow screen sharing and try again.');
        } else if (error.name === 'AbortError') {
          setError('Screen sharing was cancelled.');
        } else if (error.name === 'NotSupportedError') {
          setError('Screen sharing is not supported on this device or browser.');
        } else {
          setError('Failed to start screen sharing. Please check your browser settings and try again.');
        }
      }
    }
  }, [analyzeScreenContent, updateScreenMetrics, streamQuality]);

  const stopScreenShare = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    setIsSharing(false);
    setDetectedCodes([]);
    setActiveCode(null);
    setIsAnalyzing(false);
    setCurrentScreenshot('');
    setAnalysisProgress(0);
    setError('');
    setRealTimeAnalysis(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [stream]);

  const selectCode = useCallback((code: DetectedCode) => {
    setActiveCode(code);
  }, []);

  const analyzeCodeManually = useCallback(() => {
    if (isSharing) {
      analyzeScreenContent();
    }
  }, [isSharing, analyzeScreenContent]);

  const setStreamQualityLevel = useCallback((quality: 'HD' | 'FHD' | '4K') => {
    setStreamQuality(quality);
  }, []);

  const getCurrentScreenData = useCallback(() => {
    return {
      isSharing,
      isVideoReady,
      screenshot: currentScreenshot,
      activeCode,
      detectedCodes,
      screenMetrics,
      analysisInProgress: isAnalyzing,
      streamQuality
    };
  }, [isSharing, isVideoReady, currentScreenshot, activeCode, detectedCodes, screenMetrics, isAnalyzing, streamQuality]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return {
    isSharing,
    isAnalyzing,
    analysisProgress,
    error,
    screenMetrics,
    detectedCodes,
    activeCode,
    currentScreenshot,
    realTimeAnalysis,
    isVideoReady,
    streamQuality,
    startScreenShare,
    stopScreenShare,
    selectCode,
    analyzeCodeManually,
    setStreamQualityLevel,
    getCurrentScreenData,
    captureFullScreen,
    videoRef,
    canvasRef,
    setRealTimeAnalysis
  };
};
