'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Shield,
  Package,
  Scan,
  ChevronRight,
  Upload,
  FileJson,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { CommanderScanner } from '@/components/scanners/CommanderScanner';
import { EquipmentScanner } from '@/components/scanners/EquipmentScanner';
import { BagScanner } from '@/components/scanners/BagScanner';

type ScannerType = 'commander' | 'equipment' | 'bag' | null;

interface Commander {
  id: string;
  name: string;
  title?: string;
  rarity: string;
  types: string[];
  level: number;
  skills: number[];
  stars?: number;
  power?: number;
  unitCapacity?: number;
}

export default function ScannersPage() {
  const [activeScanner, setActiveScanner] = useState<ScannerType>(null);
  const [importedCommanders, setImportedCommanders] = useState<Commander[]>([]);
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleJsonImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const commanders = json.commanders || json;
        if (Array.isArray(commanders)) {
          setImportedCommanders(commanders);
          setShowImportSuccess(true);
          setTimeout(() => setShowImportSuccess(false), 3000);
          // Store in localStorage for persistence
          localStorage.setItem('rok-commanders', JSON.stringify(commanders));
        }
      } catch {
        alert('Invalid JSON file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const scanners = [
    {
      id: 'commander' as const,
      name: 'Commander Scanner',
      description: 'Extract commander stats from screenshots using OCR',
      icon: Users,
      gradient: 'from-amber-500/20 to-orange-600/20',
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
      status: 'stable' as const,
      stats: importedCommanders.length > 0 ? `${importedCommanders.length} loaded` : null,
    },
    {
      id: 'equipment' as const,
      name: 'Equipment Scanner',
      description: 'Build your gear inventory from equipment screenshots',
      icon: Shield,
      gradient: 'from-blue-500/20 to-cyan-600/20',
      iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
      status: 'beta' as const,
      stats: null,
    },
    {
      id: 'bag' as const,
      name: 'Bag Scanner',
      description: 'Inventory resources, speedups, and items',
      icon: Package,
      gradient: 'from-emerald-500/20 to-teal-600/20',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      status: 'beta' as const,
      stats: null,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Scan className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-white">Scanners</h1>
                  <p className="text-xs text-zinc-500">Screenshot Analysis</p>
                </div>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-medium text-violet-400 uppercase tracking-wider">Analysis Tools</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            Screenshot Scanners
          </h2>
          <p className="text-zinc-400 max-w-xl">
            Extract data from your Rise of Kingdoms screenshots. Build inventories of commanders, equipment, and resources.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {/* JSON Import Card */}
          <div className="group relative p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-violet-500/30 transition-all">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-violet-500/10">
                <FileJson className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-1">Import Commanders</h3>
                <p className="text-xs text-zinc-500 mb-3">
                  Load commanders from a JSON file to skip scanning
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleJsonImport}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-xs font-medium transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Choose File
                </button>
                {showImportSuccess && (
                  <span className="ml-3 text-xs text-emerald-400">
                    {importedCommanders.length} commanders imported!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* OCR Info Card */}
          <div className="group relative p-5 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-1">OCR Scanning</h3>
                <p className="text-xs text-zinc-500">
                  Uses Tesseract OCR to extract text from screenshots. For best results, use high-resolution screenshots with clear text.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scanner Cards */}
        <div className="grid gap-3">
          {scanners.map((scanner) => {
            const Icon = scanner.icon;

            return (
              <button
                key={scanner.id}
                onClick={() => setActiveScanner(scanner.id)}
                className="group relative w-full text-left"
              >
                {/* Card */}
                <div className={`relative p-5 rounded-xl bg-gradient-to-r ${scanner.gradient} border border-white/5 hover:border-white/10 transition-all overflow-hidden`}>
                  {/* Subtle glow on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative flex items-center gap-5">
                    {/* Icon */}
                    <div className={`p-3 rounded-xl ${scanner.iconBg} shadow-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-semibold text-white">
                          {scanner.name}
                        </h3>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            scanner.status === 'stable'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {scanner.status}
                        </span>
                        {scanner.stats && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                            {scanner.stats}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400">{scanner.description}</p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tips Section */}
        <div className="mt-10 p-5 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-white">Tips for Better Results</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-violet-400">1</span>
              </div>
              <p className="text-sm text-zinc-400">
                Use full-resolution screenshots without cropping
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-violet-400">2</span>
              </div>
              <p className="text-sm text-zinc-400">
                Ensure all text and stats are fully visible
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-violet-400">3</span>
              </div>
              <p className="text-sm text-zinc-400">
                Review and adjust detected values before saving
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-violet-400">4</span>
              </div>
              <p className="text-sm text-zinc-400">
                Or import commanders directly via JSON file
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-zinc-600">
            Angmar Nazgul Guards • Rise of Kingdoms
          </p>
        </footer>
      </main>

      {/* Scanner Modals */}
      {activeScanner === 'commander' && (
        <CommanderScanner
          onClose={() => setActiveScanner(null)}
          preloadedCommanders={importedCommanders.length > 0 ? importedCommanders : undefined}
        />
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
