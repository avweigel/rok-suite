'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Shield, Package, Scan, ChevronRight } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { CommanderScanner } from '@/components/scanners/CommanderScanner';
import { EquipmentScanner } from '@/components/scanners/EquipmentScanner';
import { BagScanner } from '@/components/scanners/BagScanner';

type ScannerType = 'commander' | 'equipment' | 'bag' | null;

export default function ScannersPage() {
  const [activeScanner, setActiveScanner] = useState<ScannerType>(null);

  const scanners = [
    {
      id: 'commander' as const,
      name: 'Commander Scanner',
      description: 'Scan commander screenshots to extract level, skills, and stars',
      icon: Users,
      color: 'amber',
      status: 'stable' as const,
    },
    {
      id: 'equipment' as const,
      name: 'Equipment Scanner',
      description: 'Scan your equipment to build an inventory of your gear',
      icon: Shield,
      color: 'blue',
      status: 'beta' as const,
    },
    {
      id: 'bag' as const,
      name: 'Bag Scanner',
      description: 'Scan your bag to inventory resources, speedups, and items',
      icon: Package,
      color: 'green',
      status: 'beta' as const,
    },
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'amber':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30 hover:border-amber-500/60',
          icon: 'text-amber-500',
          badge: 'bg-amber-500/20 text-amber-400',
        };
      case 'blue':
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30 hover:border-blue-500/60',
          icon: 'text-blue-500',
          badge: 'bg-blue-500/20 text-blue-400',
        };
      case 'green':
        return {
          bg: 'bg-green-500/10',
          border: 'border-green-500/30 hover:border-green-500/60',
          icon: 'text-green-500',
          badge: 'bg-green-500/20 text-green-400',
        };
      default:
        return {
          bg: 'bg-stone-500/10',
          border: 'border-stone-500/30 hover:border-stone-500/60',
          icon: 'text-stone-500',
          badge: 'bg-stone-500/20 text-stone-400',
        };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-amber-600/20 bg-stone-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-stone-400 hover:text-amber-500 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">Back</span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg">
                  <Scan className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-purple-400">Scanners</h1>
                  <p className="text-xs text-stone-500">Screenshot Analysis Tools</p>
                </div>
              </div>
            </div>

            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Introduction */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-stone-100 mb-2">
            Rise of Kingdoms Scanners
          </h2>
          <p className="text-stone-400 max-w-2xl mx-auto">
            Use these tools to scan your in-game screenshots and build an inventory of your
            commanders, equipment, and bag items. Data is stored locally and synced when logged in.
          </p>
        </div>

        {/* Scanner Cards */}
        <div className="grid gap-4">
          {scanners.map((scanner) => {
            const colors = getColorClasses(scanner.color);
            const Icon = scanner.icon;

            return (
              <button
                key={scanner.id}
                onClick={() => setActiveScanner(scanner.id)}
                className={`w-full p-6 rounded-xl border-2 ${colors.border} ${colors.bg} transition-all text-left group`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-stone-800 ${colors.icon}`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-stone-100">
                        {scanner.name}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          scanner.status === 'stable'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {scanner.status === 'stable' ? 'Stable' : 'Beta'}
                      </span>
                    </div>
                    <p className="text-sm text-stone-400">{scanner.description}</p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-stone-600 group-hover:text-stone-400 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Tips Section */}
        <div className="mt-8 p-4 rounded-xl bg-stone-800/50 border border-stone-700">
          <h3 className="text-sm font-semibold text-stone-300 mb-3">Scanning Tips</h3>
          <ul className="text-sm text-stone-400 space-y-2">
            <li className="flex gap-2">
              <span className="text-purple-400">1.</span>
              Take clear screenshots with the item/commander info fully visible
            </li>
            <li className="flex gap-2">
              <span className="text-purple-400">2.</span>
              For best results, use screenshots at full resolution (no cropping)
            </li>
            <li className="flex gap-2">
              <span className="text-purple-400">3.</span>
              The scanner uses OCR - verify detected values before accepting
            </li>
            <li className="flex gap-2">
              <span className="text-purple-400">4.</span>
              You can manually adjust any incorrectly detected values
            </li>
          </ul>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-stone-800 text-center">
          <p className="text-xs text-stone-500">
            Angmar Nazgul Guards • Rise of Kingdoms
          </p>
        </footer>
      </main>

      {/* Scanner Modals */}
      {activeScanner === 'commander' && (
        <CommanderScanner onClose={() => setActiveScanner(null)} />
      )}
      {activeScanner === 'equipment' && (
        <EquipmentScanner onClose={() => setActiveScanner(null)} />
      )}
      {activeScanner === 'bag' && (
        <BagScanner onClose={() => setActiveScanner(null)} />
      )}
    </div>
  );
}
