import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
}

const useThemeStore = create<ThemeState>((set) => ({
  isDark: localStorage.getItem('intellmeet_theme') === 'dark',
  toggleTheme: () => set((state) => {
    const newTheme = !state.isDark;
    localStorage.setItem('intellmeet_theme', newTheme ? 'dark' : 'light');
    if (newTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { isDark: newTheme };
  })
}));

export default useThemeStore;