import { useState, useCallback, useRef, useEffect } from 'react';

export const useScreenShare = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detectedCode, setDetectedCode] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const mockCodeSamples = [
    {
      code: `function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}`,
      language: 'javascript'
    },
    {
      code: `const handleClick = () => {
  console.log('Button clicked');
  setCount(count + 1);
};`,
      language: 'javascript'
    }
  ];

  const simulateCodeDetection = useCallback(() => {
    if (!isSharing) return;
    
    setIsAnalyzing(true);
    
    setTimeout(() => {
      if (Math.random() > 0.5) {
        const randomSample = mockCodeSamples[Math.floor(Math.random() * mockCodeSamples.length)];
        setDetectedCode(randomSample.code);
        setDetectedLanguage(randomSample.language);
      }
      setIsAnalyzing(false);
    }, 2000);
  }, [isSharing]);

  const startScreenShare = useCallback(async () => {
    try {
      setError('');
      
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing not supported');
      }

      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      setStream(mediaStream);
      setIsSharing(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
          simulateCodeDetection();
          intervalRef.current = setInterval(simulateCodeDetection, 10000);
        };
      }

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setIsSharing(false);
          setStream(null);
          setDetectedCode('');
          setDetectedLanguage('');
          setIsAnalyzing(false);
          
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        };
      }

    } catch (error) {
      console.error('Screen share error:', error);
      setError(error instanceof Error ? error.message : 'Screen sharing failed');
    }
  }, [simulateCodeDetection]);

  const stopScreenShare = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsSharing(false);
      setDetectedCode('');
      setDetectedLanguage('');
      setIsAnalyzing(false);
      setError('');
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [stream]);

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
    error,
    startScreenShare,
    stopScreenShare,
    detectedCode,
    detectedLanguage,
    videoRef,
    canvasRef
  };
};
