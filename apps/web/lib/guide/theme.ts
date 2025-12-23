// Vision UI theme configuration for the guide section

export function getTheme() {
  return {
    bg: 'bg-[#0f1535]',
    bgSecondary: 'bg-[#1a1f37]',
    card: 'bg-[rgba(6,11,40,0.94)] border-white/10 backdrop-blur-xl',
    cardHover: 'hover:bg-white/5',
    text: 'text-white',
    textMuted: 'text-[#a0aec0]',
    textAccent: 'text-[#01b574]',
    border: 'border-white/10',
    borderAccent: 'border-[#01b574]',
    button: 'bg-white/5 hover:bg-white/10 text-white border border-white/10',
    buttonPrimary: 'bg-gradient-to-r from-[#01b574] to-[#01b574] hover:opacity-90 text-white',
    buttonDanger: 'bg-gradient-to-r from-[#e31a1a] to-[#f53c2b] hover:opacity-90 text-white',
    input: 'bg-[rgba(6,11,40,0.94)] border-white/10 text-white placeholder-[#718096]',
    sidebar: 'bg-[rgba(6,11,40,0.94)]',
    sidebarActive: 'bg-[#01b574]/10 text-[#01b574] border-[#01b574]',
    sidebarHover: 'hover:bg-white/5',
    badge: {
      solo: 'bg-[#0075ff]/20 text-[#21d4fd]',
      alliance: 'bg-[#9f7aea]/20 text-[#9f7aea]',
      'coop-pve': 'bg-[#01b574]/20 text-[#01b574]',
      pvp: 'bg-[#e31a1a]/20 text-[#f53c2b]',
      continuous: 'bg-[#ffb547]/20 text-[#ffb547]',
    } as Record<string, string>,
    checkbox: {
      unchecked: 'border-white/20 bg-white/5',
      checked: 'border-[#01b574] bg-[#01b574]',
    },
  };
}

export type Theme = ReturnType<typeof getTheme>;
