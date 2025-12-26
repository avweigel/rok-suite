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

interface BagInventory {
  bagInventory: {
    chests?: Record<string, number>;
    equipment?: Record<string, Array<{ id: string; slot: string; type: string; craftable: boolean }>>;
    blueprints?: Record<string, Array<{ name: string; quantity: number }>>;
    materials?: Record<string, Record<string, number>>;
  };
  metadata?: {
    lastUpdated?: string;
    source?: string;
    version?: string;
    playerPower?: number;
    vipLevel?: number;
  };
}

export default function ScannersPage() {
  const [activeScanner, setActiveScanner] = useState<ScannerType>(null);
  const [importedCommanders, setImportedCommanders] = useState<Commander[]>([]);
  const [importedBagInventory, setImportedBagInventory] = useState<BagInventory | null>(null);
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  const [showBagImportSuccess, setShowBagImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bagFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleBagJsonImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        // Support both wrapped and unwrapped formats
        const bagData: BagInventory = json.bagInventory ? json : { bagInventory: json };
        if (bagData.bagInventory) {
          setImportedBagInventory(bagData);
          setShowBagImportSuccess(true);
          setTimeout(() => setShowBagImportSuccess(false), 3000);
          // Store in localStorage for persistence
          localStorage.setItem('rok-bag-inventory', JSON.stringify(bagData));
        }
      } catch {
        alert('Invalid JSON file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  // Count bag items for display
  const getBagItemCount = () => {
    if (!importedBagInventory?.bagInventory) return 0;
    const bag = importedBagInventory.bagInventory;
    let count = 0;
    if (bag.chests) count += Object.keys(bag.chests).length;
    if (bag.equipment) {
      Object.values(bag.equipment).forEach(items => {
        count += items.length;
      });
    }
    if (bag.blueprints) {
      Object.values(bag.blueprints).forEach(items => {
        count += items.length;
      });
    }
    if (bag.materials) {
      Object.values(bag.materials).forEach(tier => {
        count += Object.keys(tier).length;
      });
    }
    return count;
  };

  const scanners = [
    {
      id: 'commander' as const,
      name: 'Commander Scanner',
      description: 'Extract commander stats from screenshots using OCR',
      icon: Users,
      gradient: 'from-[#ffb547]/10 to-[#ffb547]/5',
      iconBg: 'bg-gradient-to-br from-[#ffb547] to-[#ff9f1c]',
      status: 'stable' as const,
      stats: importedCommanders.length > 0 ? `${importedCommanders.length} loaded` : null,
    },
    {
      id: 'equipment' as const,
      name: 'Equipment Scanner',
      description: 'Build your gear inventory from equipment screenshots',
      icon: Shield,
      gradient: 'from-[#0075ff]/10 to-[#21d4fd]/5',
      iconBg: 'bg-gradient-to-br from-[#0075ff] to-[#21d4fd]',
      status: 'beta' as const,
      stats: null,
    },
    {
      id: 'bag' as const,
      name: 'Bag Scanner',
      description: 'Inventory resources, speedups, and items',
      icon: Package,
      gradient: 'from-[#01b574]/10 to-[#01b574]/5',
      iconBg: 'bg-gradient-to-br from-[#01b574] to-[#00a86b]',
      status: 'beta' as const,
      stats: getBagItemCount() > 0 ? `${getBagItemCount()} items loaded` : null,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f1535]">
      {/* Grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Gradient orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#4318ff]/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-[#01b574]/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0f1535]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-2 text-[#718096] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4318ff] to-[#9f7aea] flex items-center justify-center shadow-lg shadow-[#4318ff]/25">
                  <Scan className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-white">Scanners</h1>
                  <p className="text-xs text-[#718096]">Screenshot Analysis</p>
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
            <Sparkles className="w-4 h-4 text-[#9f7aea]" />
            <span className="text-xs font-medium text-[#9f7aea] uppercase tracking-wider">Analysis Tools</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            Screenshot Scanners
          </h2>
          <p className="text-[#a0aec0] max-w-xl">
            Extract data from your Rise of Kingdoms screenshots. Build inventories of commanders, equipment, and resources.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {/* Commander JSON Import Card */}
          <div className="group relative p-5 rounded-xl bg-[rgba(6,11,40,0.94)] backdrop-blur-xl border border-white/5 hover:border-[#4318ff]/30 transition-all">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-[#4318ff]/10">
                <FileJson className="w-5 h-5 text-[#9f7aea]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-1">Import Commanders</h3>
                <p className="text-xs text-[#718096] mb-3">
                  Load commanders from a JSON file
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
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#4318ff]/10 hover:bg-[#4318ff]/20 text-[#9f7aea] text-xs font-medium transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Choose File
                </button>
                {showImportSuccess && (
                  <span className="ml-3 text-xs text-emerald-400">
                    {importedCommanders.length} imported!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bag Inventory JSON Import Card */}
          <div className="group relative p-5 rounded-xl bg-[rgba(6,11,40,0.94)] backdrop-blur-xl border border-white/5 hover:border-[#01b574]/30 transition-all">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-[#01b574]/10">
                <Package className="w-5 h-5 text-[#01b574]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-1">Import Bag Inventory</h3>
                <p className="text-xs text-[#718096] mb-3">
                  Load bag items from a JSON file
                </p>
                <input
                  ref={bagFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleBagJsonImport}
                  className="hidden"
                />
                <button
                  onClick={() => bagFileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#01b574]/10 hover:bg-[#01b574]/20 text-[#01b574] text-xs font-medium transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Choose File
                </button>
                {showBagImportSuccess && (
                  <span className="ml-3 text-xs text-emerald-400">
                    {getBagItemCount()} items imported!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* OCR Info Card */}
          <div className="group relative p-5 rounded-xl bg-[rgba(6,11,40,0.94)] backdrop-blur-xl border border-white/5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-1">OCR Scanning</h3>
                <p className="text-xs text-[#718096]">
                  Uses Tesseract OCR to extract text. For best results, use high-resolution screenshots.
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
                              ? 'bg-[#01b574]/20 text-[#01b574]'
                              : 'bg-[#ffb547]/20 text-[#ffb547]'
                          }`}
                        >
                          {scanner.status}
                        </span>
                        {scanner.stats && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#4318ff]/20 text-[#9f7aea]">
                            {scanner.stats}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#a0aec0]">{scanner.description}</p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-[#718096] group-hover:text-[#a0aec0] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tips Section */}
        <div className="mt-10 p-5 rounded-xl bg-[rgba(6,11,40,0.94)] backdrop-blur-xl border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-[#a0aec0]" />
            <h3 className="text-sm font-semibold text-white">Tips for Better Results</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#4318ff]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[#9f7aea]">1</span>
              </div>
              <p className="text-sm text-[#a0aec0]">
                Use full-resolution screenshots without cropping
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#4318ff]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[#9f7aea]">2</span>
              </div>
              <p className="text-sm text-[#a0aec0]">
                Ensure all text and stats are fully visible
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#4318ff]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[#9f7aea]">3</span>
              </div>
              <p className="text-sm text-[#a0aec0]">
                Review and adjust detected values before saving
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#4318ff]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[#9f7aea]">4</span>
              </div>
              <p className="text-sm text-[#a0aec0]">
                Or import commanders directly via JSON file
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-[#718096]">
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
        <BagScanner
          onClose={() => setActiveScanner(null)}
          preloadedInventory={importedBagInventory || undefined}
        />
      )}
    </div>
  );
}
