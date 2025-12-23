/**
 * Vision UI-inspired theme system
 * Dark glassmorphism design with gradient accents
 *
 * Color palette inspired by Creative Tim's Vision UI Dashboard
 * https://www.creative-tim.com/product/vision-ui-dashboard-react
 */

// Core colors from Vision UI
export const colors = {
  // Primary gradient colors
  primary: {
    main: '#4318ff',
    light: '#9f7aea',
    gradient: 'linear-gradient(135deg, #4318ff 0%, #9f7aea 100%)',
  },

  // Info/accent
  info: {
    main: '#0075ff',
    light: '#21d4fd',
    gradient: 'linear-gradient(135deg, #0075ff 0%, #21d4fd 100%)',
  },

  // Success
  success: {
    main: '#01b574',
    light: '#c9fbd5',
    gradient: 'linear-gradient(135deg, #01b574 0%, #c9fbd5 100%)',
  },

  // Warning
  warning: {
    main: '#ffb547',
    light: '#ffd97a',
    gradient: 'linear-gradient(135deg, #ffb547 0%, #ffd97a 100%)',
  },

  // Error
  error: {
    main: '#e31a1a',
    light: '#f53c2b',
    gradient: 'linear-gradient(135deg, #e31a1a 0%, #f53c2b 100%)',
  },

  // Background colors (dark theme)
  background: {
    default: '#0f1535', // Main background
    paper: '#1a1f37',   // Card/elevated surfaces
    card: 'rgba(6, 11, 40, 0.94)', // Glass card
    cardHover: 'rgba(10, 14, 35, 0.98)',
  },

  // Text colors
  text: {
    primary: '#ffffff',
    secondary: '#a0aec0',
    muted: '#718096',
    disabled: '#4a5568',
  },

  // Border colors
  border: {
    default: 'rgba(255, 255, 255, 0.1)',
    light: 'rgba(255, 255, 255, 0.05)',
    accent: 'rgba(67, 24, 255, 0.5)',
  },
};

// Tailwind class-based theme for easy component styling
export const visionTheme = {
  // Layout
  page: 'min-h-screen bg-[#0f1535]',
  pageGradient: 'min-h-screen bg-gradient-to-br from-[#0f1535] via-[#1a1f37] to-[#0f1535]',

  // Grid background overlay
  gridOverlay: 'fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none',

  // Header/Navigation
  header: 'sticky top-0 z-40 border-b border-white/5 bg-[#0f1535]/80 backdrop-blur-xl',
  headerContent: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',

  // Cards - glassmorphism style
  card: 'rounded-xl bg-[rgba(6,11,40,0.94)] border border-white/10 backdrop-blur-xl',
  cardHover: 'hover:bg-[rgba(10,14,35,0.98)] hover:border-white/20 transition-all duration-300',
  cardGlow: 'shadow-lg shadow-[#4318ff]/5',

  // Interactive cards
  cardInteractive: 'rounded-xl bg-[rgba(6,11,40,0.94)] border border-white/10 backdrop-blur-xl hover:border-[#4318ff]/50 hover:shadow-lg hover:shadow-[#4318ff]/10 transition-all duration-300 cursor-pointer',

  // Gradient cards
  cardGradient: {
    primary: 'rounded-xl bg-gradient-to-r from-[#4318ff]/20 to-[#9f7aea]/20 border border-[#4318ff]/30',
    info: 'rounded-xl bg-gradient-to-r from-[#0075ff]/20 to-[#21d4fd]/20 border border-[#0075ff]/30',
    success: 'rounded-xl bg-gradient-to-r from-[#01b574]/20 to-[#c9fbd5]/20 border border-[#01b574]/30',
    warning: 'rounded-xl bg-gradient-to-r from-[#ffb547]/20 to-[#ffd97a]/20 border border-[#ffb547]/30',
    error: 'rounded-xl bg-gradient-to-r from-[#e31a1a]/20 to-[#f53c2b]/20 border border-[#e31a1a]/30',
  },

  // Text
  text: {
    primary: 'text-white',
    secondary: 'text-[#a0aec0]',
    muted: 'text-[#718096]',
    gradient: 'bg-gradient-to-r from-[#4318ff] to-[#9f7aea] bg-clip-text text-transparent',
  },

  // Headings
  heading: {
    h1: 'text-3xl font-bold text-white',
    h2: 'text-2xl font-bold text-white',
    h3: 'text-xl font-semibold text-white',
    h4: 'text-lg font-semibold text-white',
    subtitle: 'text-sm text-[#718096]',
  },

  // Buttons
  button: {
    primary: 'px-4 py-2 rounded-lg bg-gradient-to-r from-[#4318ff] to-[#9f7aea] text-white font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#4318ff]/25',
    secondary: 'px-4 py-2 rounded-lg bg-[rgba(6,11,40,0.94)] border border-white/10 text-white font-medium hover:bg-white/5 transition-colors',
    ghost: 'px-4 py-2 rounded-lg text-[#a0aec0] hover:text-white hover:bg-white/5 transition-colors',
    success: 'px-4 py-2 rounded-lg bg-gradient-to-r from-[#01b574] to-[#01b574] text-white font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#01b574]/25',
    danger: 'px-4 py-2 rounded-lg bg-gradient-to-r from-[#e31a1a] to-[#f53c2b] text-white font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#e31a1a]/25',
  },

  // Inputs
  input: 'w-full px-4 py-3 rounded-lg bg-[rgba(6,11,40,0.94)] border border-white/10 text-white placeholder-[#718096] focus:border-[#4318ff]/50 focus:ring-2 focus:ring-[#4318ff]/20 focus:outline-none transition-all',

  // Badges
  badge: {
    primary: 'px-2 py-0.5 rounded-full bg-[#4318ff]/20 text-[#9f7aea] text-xs font-medium',
    info: 'px-2 py-0.5 rounded-full bg-[#0075ff]/20 text-[#21d4fd] text-xs font-medium',
    success: 'px-2 py-0.5 rounded-full bg-[#01b574]/20 text-[#01b574] text-xs font-medium',
    warning: 'px-2 py-0.5 rounded-full bg-[#ffb547]/20 text-[#ffb547] text-xs font-medium',
    error: 'px-2 py-0.5 rounded-full bg-[#e31a1a]/20 text-[#f53c2b] text-xs font-medium',
  },

  // Icon containers
  iconBox: {
    primary: 'p-3 rounded-xl bg-gradient-to-br from-[#4318ff] to-[#9f7aea] shadow-lg shadow-[#4318ff]/25',
    info: 'p-3 rounded-xl bg-gradient-to-br from-[#0075ff] to-[#21d4fd] shadow-lg shadow-[#0075ff]/25',
    success: 'p-3 rounded-xl bg-gradient-to-br from-[#01b574] to-[#01b574] shadow-lg shadow-[#01b574]/25',
    warning: 'p-3 rounded-xl bg-gradient-to-br from-[#ffb547] to-[#ffd97a] shadow-lg shadow-[#ffb547]/25',
  },

  // Dividers
  divider: 'border-t border-white/5',
  dividerLight: 'border-t border-white/10',

  // Sidebar
  sidebar: 'bg-[rgba(6,11,40,0.94)] border-r border-white/5',
  sidebarItem: 'px-4 py-3 rounded-lg text-[#a0aec0] hover:text-white hover:bg-white/5 transition-colors',
  sidebarItemActive: 'px-4 py-3 rounded-lg bg-gradient-to-r from-[#4318ff]/20 to-transparent text-white border-l-2 border-[#4318ff]',

  // Modal/Overlay
  overlay: 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50',
  modal: 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-xl bg-[#1a1f37] border border-white/10 shadow-2xl',

  // Tables
  table: 'w-full',
  tableHeader: 'text-left text-xs font-semibold text-[#718096] uppercase tracking-wider',
  tableRow: 'border-b border-white/5 hover:bg-white/5 transition-colors',
  tableCell: 'px-4 py-3 text-sm text-[#a0aec0]',

  // Stats/Metrics
  stat: {
    container: 'p-4 rounded-xl bg-[rgba(6,11,40,0.94)] border border-white/10',
    label: 'text-sm text-[#718096]',
    value: 'text-2xl font-bold text-white',
    change: {
      positive: 'text-[#01b574]',
      negative: 'text-[#e31a1a]',
    },
  },

  // Progress/Loading
  progress: {
    track: 'h-2 rounded-full bg-white/10',
    bar: 'h-2 rounded-full bg-gradient-to-r from-[#4318ff] to-[#9f7aea]',
  },

  // Links
  link: 'text-[#4318ff] hover:text-[#9f7aea] transition-colors',
  linkMuted: 'text-[#718096] hover:text-white transition-colors',
};

// Export type for TypeScript
export type VisionTheme = typeof visionTheme;
