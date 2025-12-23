'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Swords,
  Shield,
  Target,
  Upload,
  ChevronRight,
  Check,
  ArrowRight,
} from 'lucide-react';
import { getTheme } from '@/lib/guide/theme';

type TroopPath = 'infantry' | 'cavalry' | 'archer' | null;
type SpendingType = 'f2p' | 'low-spender' | 'whale' | null;

interface WizardStep {
  id: number;
  title: string;
  description: string;
}

const steps: WizardStep[] = [
  { id: 1, title: 'Choose Your Path', description: 'Infantry, Cavalry, or Archer focus' },
  { id: 2, title: 'Spending Level', description: 'F2P, Low Spender, or Whale' },
  { id: 3, title: 'Your Commanders', description: 'Upload screenshots or select manually' },
  { id: 4, title: 'Recommendations', description: 'Personalized strategy guide' },
];

export default function CommanderStrategyPage() {
  const [darkMode, setDarkMode] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [troopPath, setTroopPath] = useState<TroopPath>(null);
  const [spendingType, setSpendingType] = useState<SpendingType>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  const theme = getTheme();

  const troopPaths = [
    {
      id: 'infantry' as const,
      name: 'Infantry',
      icon: <Shield size={32} />,
      description: 'Tanky front-line fighters. Great for rallies and garrison.',
      color: 'blue',
      commanders: ['Guan Yu', 'Alexander', 'Leonidas', 'Richard I'],
    },
    {
      id: 'cavalry' as const,
      name: 'Cavalry',
      icon: <Swords size={32} />,
      description: 'Fast and mobile. Excellent for field fights and chasing.',
      color: 'red',
      commanders: ['Attila', 'Takeda', 'Genghis Khan', 'Saladin'],
    },
    {
      id: 'archer' as const,
      name: 'Archer',
      icon: <Target size={32} />,
      description: 'High damage from range. Best for AOE and support.',
      color: 'green',
      commanders: ['Yi Seong-Gye', 'Ramesses', 'Nebuchadnezzar', 'Tomyris'],
    },
  ];

  const spendingTypes = [
    {
      id: 'f2p' as const,
      name: 'F2P',
      description: 'No spending. Focus on efficiency and free resources.',
      tips: 'Focus on 1 troop type, use gold heads wisely, maximize events',
    },
    {
      id: 'low-spender' as const,
      name: 'Low Spender',
      description: '$5-50/month. Strategic purchases for maximum value.',
      tips: 'Growth fund, gem supply, targeted bundles during events',
    },
    {
      id: 'whale' as const,
      name: 'Whale',
      description: 'Significant spending. Optimize for speed and power.',
      tips: 'Max value bundles, spinning events, multiple troop types',
    },
  ];

  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    blue: {
      bg: darkMode ? 'bg-blue-500/10' : 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-400',
    },
    red: {
      bg: darkMode ? 'bg-red-500/10' : 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-400',
    },
    green: {
      bg: darkMode ? 'bg-green-500/10' : 'bg-green-50',
      border: 'border-green-500',
      text: 'text-green-400',
    },
  };

  const canProceed = () => {
    if (currentStep === 1) return troopPath !== null;
    if (currentStep === 2) return spendingType !== null;
    return true;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
            <Sparkles size={24} className="text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold">Commander Strategy</h1>
        </div>
        <p className={theme.textMuted}>
          Get personalized commander recommendations based on your playstyle, spending level,
          and current roster. Optimize your path to KvK success.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    currentStep > step.id
                      ? 'bg-emerald-500 text-white'
                      : currentStep === step.id
                      ? 'bg-amber-500 text-white'
                      : `${theme.card} border ${theme.border} ${theme.textMuted}`
                  }`}
                >
                  {currentStep > step.id ? <Check size={18} /> : step.id}
                </div>
                <div className="mt-2 text-center hidden sm:block">
                  <p className={`text-xs font-medium ${currentStep >= step.id ? theme.text : theme.textMuted}`}>
                    {step.title}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-full h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-emerald-500' : darkMode ? 'bg-zinc-700' : 'bg-gray-200'
                  }`}
                  style={{ minWidth: '2rem', maxWidth: '6rem' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className={`${theme.card} border rounded-xl p-6`}>
        {/* Step 1: Choose Path */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Choose Your Troop Focus</h2>
            <p className={`${theme.textMuted} mb-6`}>
              This determines which commanders to prioritize. You can always adjust later.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {troopPaths.map((path) => {
                const colors = colorClasses[path.color];
                const isSelected = troopPath === path.id;
                return (
                  <button
                    key={path.id}
                    onClick={() => setTroopPath(path.id)}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? `${colors.bg} ${colors.border}`
                        : `${theme.card} border-transparent hover:border-zinc-600`
                    }`}
                  >
                    <div className={`mb-4 ${isSelected ? colors.text : theme.textMuted}`}>
                      {path.icon}
                    </div>
                    <h3 className={`font-semibold mb-2 ${isSelected ? colors.text : ''}`}>
                      {path.name}
                    </h3>
                    <p className={`text-sm ${theme.textMuted} mb-4`}>{path.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {path.commanders.slice(0, 3).map((cmd) => (
                        <span
                          key={cmd}
                          className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${theme.textMuted}`}
                        >
                          {cmd}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Spending Level */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">What&apos;s Your Spending Level?</h2>
            <p className={`${theme.textMuted} mb-6`}>
              This affects which commanders and strategies are realistic for your account.
            </p>

            <div className="grid gap-4">
              {spendingTypes.map((type) => {
                const isSelected = spendingType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSpendingType(type.id)}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? `${darkMode ? 'bg-amber-500/10' : 'bg-amber-50'} border-amber-500`
                        : `${theme.card} border-transparent hover:border-zinc-600`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className={`font-semibold ${isSelected ? 'text-amber-400' : ''}`}>
                          {type.name}
                        </h3>
                        <p className={`text-sm ${theme.textMuted} mt-1`}>{type.description}</p>
                        <p className={`text-xs ${theme.textMuted} mt-2 italic`}>{type.tips}</p>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-amber-500 bg-amber-500' : theme.border
                        }`}
                      >
                        {isSelected && <Check size={14} className="text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Upload/Select Commanders */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Your Current Commanders</h2>
            <p className={`${theme.textMuted} mb-6`}>
              Upload screenshots of your commanders or select them manually to get personalized recommendations.
            </p>

            <div className="grid gap-4 md:grid-cols-2 mb-6">
              {/* Upload Option */}
              <div
                className={`${theme.card} border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-amber-500/50 transition-colors`}
              >
                <Upload size={32} className={`mx-auto mb-3 ${theme.textMuted}`} />
                <h3 className="font-semibold mb-1">Upload Screenshots</h3>
                <p className={`text-sm ${theme.textMuted}`}>
                  Upload commander screenshots and we&apos;ll detect levels, skills, and stars
                </p>
                <button className={`mt-4 ${theme.buttonPrimary} px-4 py-2 rounded-lg text-sm`}>
                  Upload Images
                </button>
              </div>

              {/* Manual Option */}
              <Link href="/sunset-canyon">
                <div
                  className={`${theme.card} border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-amber-500/50 transition-colors h-full`}
                >
                  <Swords size={32} className={`mx-auto mb-3 ${theme.textMuted}`} />
                  <h3 className="font-semibold mb-1">Use Sunset Canyon Scanner</h3>
                  <p className={`text-sm ${theme.textMuted}`}>
                    Already scanned your commanders? Import from your Sunset Canyon roster
                  </p>
                  <span className={`mt-4 inline-block ${theme.textAccent} text-sm`}>
                    Go to Scanner →
                  </span>
                </div>
              </Link>
            </div>

            <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800/50' : 'bg-gray-100'}`}>
              <p className={`text-sm ${theme.textMuted}`}>
                <strong className={theme.text}>Coming Soon:</strong> Full commander analysis integration
                with your existing scanner data. For now, we&apos;ll provide general recommendations
                based on your path and spending level.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Recommendations */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Your Personalized Strategy</h2>
            <p className={`${theme.textMuted} mb-6`}>
              Based on your selections: <strong className={theme.text}>{troopPath}</strong> focus,{' '}
              <strong className={theme.text}>{spendingType}</strong> spending
            </p>

            <div className={`p-6 rounded-lg ${darkMode ? 'bg-amber-500/10' : 'bg-amber-50'} mb-6`}>
              <h3 className="font-semibold text-amber-400 mb-3">Coming Soon</h3>
              <p className={theme.textMuted}>
                Full personalized commander recommendations are being developed. This will include:
              </p>
              <ul className={`mt-3 space-y-2 ${theme.textMuted}`}>
                <li className="flex items-center gap-2">
                  <Check size={16} className="text-emerald-500" />
                  Commander unlock priority order
                </li>
                <li className="flex items-center gap-2">
                  <Check size={16} className="text-emerald-500" />
                  Skill upgrade recommendations (5-1-1-1 vs 5-5-1-1, etc.)
                </li>
                <li className="flex items-center gap-2">
                  <Check size={16} className="text-emerald-500" />
                  Optimal pairings for your troop type
                </li>
                <li className="flex items-center gap-2">
                  <Check size={16} className="text-emerald-500" />
                  Resource allocation strategy
                </li>
                <li className="flex items-center gap-2">
                  <Check size={16} className="text-emerald-500" />
                  KvK preparation timeline
                </li>
              </ul>
            </div>

            {/* Quick Tips based on selections */}
            <div className={`${theme.card} border rounded-lg p-5`}>
              <h3 className="font-semibold mb-3">Quick Tips for {troopPath} {spendingType}</h3>
              {troopPath === 'infantry' && spendingType === 'f2p' && (
                <ul className={`space-y-2 ${theme.textMuted}`}>
                  <li>• Focus on Richard I first (free from events)</li>
                  <li>• Save gold heads for Guan Yu</li>
                  <li>• Use Sun Tzu as early game primary</li>
                  <li>• Martel is great for garrison</li>
                </ul>
              )}
              {troopPath === 'cavalry' && spendingType === 'f2p' && (
                <ul className={`space-y-2 ${theme.textMuted}`}>
                  <li>• Pelagius is excellent early game</li>
                  <li>• Save gold heads for cavalry legendaries</li>
                  <li>• Belisarius for mobility</li>
                  <li>• Consider Saladin from wheel</li>
                </ul>
              )}
              {troopPath === 'archer' && spendingType === 'f2p' && (
                <ul className={`space-y-2 ${theme.textMuted}`}>
                  <li>• YSG is must-have - prioritize from wheel</li>
                  <li>• Use El Cid early game</li>
                  <li>• Hermann is solid epic archer</li>
                  <li>• Ramesses from MGE if possible</li>
                </ul>
              )}
              {!troopPath || !spendingType ? (
                <p className={theme.textMuted}>
                  Complete the wizard to see personalized tips.
                </p>
              ) : (
                <p className={`text-sm ${theme.textMuted} mt-4 italic`}>
                  More detailed recommendations coming in the full version.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-zinc-800">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className={`px-4 py-2 rounded-lg ${theme.button} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Back
          </button>

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${theme.buttonPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Continue
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={() => {
                setCurrentStep(1);
                setTroopPath(null);
                setSpendingType(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${theme.button}`}
            >
              Start Over
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
