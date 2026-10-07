import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  mode: ThemeMode;
  isDark: boolean;
  bg: string;
  bgSecondary: string;
  card: string;
  cardBorder: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  inputBg: string;
  inputBorder: string;
  navBg: string;
  navBorder: string;
  danger: string;
  success: string;
  modalOverlay: string;
  chipBg: string;
  chipActiveBg: string;
}

export const darkColors: ThemeColors = {
  mode: 'dark',
  isDark: true,
  bg: '#0F1210',
  bgSecondary: '#161B18',
  card: '#1A211D',
  cardBorder: '#29352E',
  text: '#F2F6F3',
  textSub: '#9EB0A5',
  textMuted: '#6D7E73',
  accent: '#39A900',
  accentHover: '#44C500',
  inputBg: '#151A17',
  inputBorder: '#2C3931',
  navBg: '#151A17',
  navBorder: '#27332C',
  danger: '#FF5B6E',
  success: '#00E5A3',
  modalOverlay: 'rgba(0, 0, 0, 0.75)',
  chipBg: '#212A24',
  chipActiveBg: '#39A900',
};

export const lightColors: ThemeColors = {
  mode: 'light',
  isDark: false,
  bg: '#F8FBF8',
  bgSecondary: '#EDF4EE',
  card: '#FFFFFF',
  cardBorder: '#E2EBE3',
  text: '#131B15',
  textSub: '#4E6153',
  textMuted: '#7E9183',
  accent: '#39A900',
  accentHover: '#2E8B00',
  inputBg: '#F3F7F4',
  inputBorder: '#D8E3DA',
  navBg: '#FFFFFF',
  navBorder: '#E4ECE5',
  danger: '#D91F38',
  success: '#0E7F5E',
  modalOverlay: 'rgba(0, 0, 0, 0.45)',
  chipBg: '#EDF5EE',
  chipActiveBg: '#39A900',
};

interface ThemeContextProps {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

const THEME_STORAGE_KEY = 'senamatch_theme_preference';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') {
          setThemeState(saved);
        } else if (systemScheme === 'light') {
          setThemeState('light');
        } else {
          setThemeState('dark');
        }
      } catch {
        setThemeState('dark');
      } finally {
        setIsLoaded(true);
      }
    };
    loadSavedTheme();
  }, [systemScheme]);

  const applyThemeSideEffects = (newTheme: ThemeMode) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        document.documentElement.setAttribute('data-theme', newTheme);
        document.documentElement.style.colorScheme = newTheme;
        const color = newTheme === 'light' ? lightColors.bg : darkColors.bg;
        document.body.style.backgroundColor = color;
      } catch (_) {}
    }
  };

  useEffect(() => {
    applyThemeSideEffects(theme);
  }, [theme]);

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    applyThemeSideEffects(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.error('Error guardando preferencia de tema:', e);
    }
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const colors = theme === 'light' ? lightColors : darkColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'dark' as ThemeMode,
      isDark: true,
      colors: darkColors,
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return context;
}
