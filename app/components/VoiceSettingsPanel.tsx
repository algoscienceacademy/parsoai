'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Volume2, Globe, User, Sliders, Play } from 'lucide-react';

interface VoiceSettings {
  country: 'US' | 'UK' | 'AU' | 'CA' | 'IN' | 'BD';
  gender: 'male' | 'female';
  tone: 'professional' | 'friendly' | 'casual' | 'excited' | 'calm';
  speed: number;
  pitch: number;
}

interface VoiceSettingsPanelProps {
  settings: VoiceSettings;
  onSettingsChange: (settings: Partial<VoiceSettings>) => void;
  onPreview: () => void;
  language: 'en' | 'bn';
}

const countryOptions = [
  { value: 'US', label: 'United States', flag: '🇺🇸' },
  { value: 'UK', label: 'United Kingdom', flag: '🇬🇧' },
  { value: 'AU', label: 'Australia', flag: '🇦🇺' },
  { value: 'CA', label: 'Canada', flag: '🇨🇦' },
  { value: 'IN', label: 'India', flag: '🇮🇳' },
  { value: 'BD', label: 'Bangladesh', flag: '🇧🇩' }
];

const toneOptions = [
  { value: 'professional', label: 'Professional', icon: '🎯' },
  { value: 'friendly', label: 'Friendly', icon: '😊' },
  { value: 'casual', label: 'Casual', icon: '😎' },
  { value: 'excited', label: 'Excited', icon: '🚀' },
  { value: 'calm', label: 'Calm', icon: '🧘' }
];

export const VoiceSettingsPanel: React.FC<VoiceSettingsPanelProps> = ({
  settings,
  onSettingsChange,
  onPreview,
  language
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-dark rounded-3xl p-6"
    >
      <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
        <Volume2 className="w-6 h-6 mr-3 text-orange-400" />
        Voice Settings
      </h3>

      <div className="space-y-6">
        {/* Country Selection */}
        <div>
          <label className="text-sm font-medium text-orange-300 mb-3 flex items-center">
            <Globe className="w-4 h-4 mr-2" />
            Country & Accent
          </label>
          <div className="grid grid-cols-2 gap-2">
            {countryOptions.map((option) => (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSettingsChange({ country: option.value as any })}
                className={`p-3 rounded-xl text-sm transition-all ${
                  settings.country === option.value
                    ? 'glass-orange text-orange-200'
                    : 'glass text-gray-300 hover:text-orange-300'
                }`}
              >
                <span className="text-lg mr-2">{option.flag}</span>
                {option.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Gender Selection */}
        <div>
          <label className="text-sm font-medium text-orange-300 mb-3 flex items-center">
            <User className="w-4 h-4 mr-2" />
            Voice Gender
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'female', label: 'Female', icon: '👩' },
              { value: 'male', label: 'Male', icon: '👨' }
            ].map((option) => (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSettingsChange({ gender: option.value as any })}
                className={`p-3 rounded-xl text-sm transition-all ${
                  settings.gender === option.value
                    ? 'glass-orange text-orange-200'
                    : 'glass text-gray-300 hover:text-orange-300'
                }`}
              >
                <span className="text-lg mr-2">{option.icon}</span>
                {option.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Tone Selection */}
        <div>
          <label className="text-sm font-medium text-orange-300 mb-3 flex items-center">
            <Sliders className="w-4 h-4 mr-2" />
            Voice Tone
          </label>
          <div className="grid grid-cols-1 gap-2">
            {toneOptions.map((option) => (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSettingsChange({ tone: option.value as any })}
                className={`p-3 rounded-xl text-sm text-left transition-all ${
                  settings.tone === option.value
                    ? 'glass-orange text-orange-200'
                    : 'glass text-gray-300 hover:text-orange-300'
                }`}
              >
                <span className="text-lg mr-3">{option.icon}</span>
                {option.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Speed Control */}
        <div>
          <label className="text-sm font-medium text-orange-300 mb-3 block">
            Speaking Speed: {settings.speed.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.speed}
            onChange={(e) => onSettingsChange({ speed: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Slow</span>
            <span>Normal</span>
            <span>Fast</span>
          </div>
        </div>

        {/* Pitch Control */}
        <div>
          <label className="text-sm font-medium text-orange-300 mb-3 block">
            Voice Pitch: {settings.pitch.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.pitch}
            onChange={(e) => onSettingsChange({ pitch: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Low</span>
            <span>Normal</span>
            <span>High</span>
          </div>
        </div>

        {/* Preview Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onPreview}
          className="w-full btn-primary rounded-xl p-4 flex items-center justify-center space-x-2"
        >
          <Play className="w-5 h-5" />
          <span>Preview Voice</span>
        </motion.button>
      </div>
    </motion.div>
  );
};
