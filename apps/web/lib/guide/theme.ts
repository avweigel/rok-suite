// Shared theme configuration for the guide section

export function getTheme(darkMode: boolean) {
  return {
    bg: darkMode ? 'bg-zinc-950' : 'bg-gray-50',
    bgSecondary: darkMode ? 'bg-zinc-900' : 'bg-white',
    card: darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200',
    cardHover: darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-50',
    text: darkMode ? 'text-zinc-100' : 'text-gray-900',
    textMuted: darkMode ? 'text-zinc-400' : 'text-gray-500',
    textAccent: darkMode ? 'text-emerald-400' : 'text-emerald-600',
    border: darkMode ? 'border-zinc-800' : 'border-gray-200',
    borderAccent: darkMode ? 'border-emerald-500' : 'border-emerald-500',
    button: darkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900',
    buttonPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    buttonDanger: 'bg-red-600 hover:bg-red-700 text-white',
    input: darkMode ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
    sidebar: darkMode ? 'bg-zinc-900/50' : 'bg-gray-100/50',
    sidebarActive: darkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500' : 'bg-emerald-50 text-emerald-700 border-emerald-500',
    sidebarHover: darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-200',
    badge: {
      solo: darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700',
      alliance: darkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700',
      'coop-pve': darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
      pvp: darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700',
      continuous: darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700',
    } as Record<string, string>,
    checkbox: {
      unchecked: darkMode ? 'border-zinc-600 bg-zinc-800' : 'border-gray-300 bg-white',
      checked: 'border-emerald-500 bg-emerald-500',
    },
  };
}

export type Theme = ReturnType<typeof getTheme>;
