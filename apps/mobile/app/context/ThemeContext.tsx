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
  bg: '#0F0C18',
  bgSecondary: '#16121D',
  card: '#161B22',
  cardBorder: '#263238',
  text: '#F0ECF6',
  textSub: '#8D83A0',
  textMuted: '#625975',
  accent: '#39A900',
  accentHover: '#45C200',
  inputBg: '#1E1A2B',
  inputBorder: '#2D2640',
  navBg: '#161B22',
  navBorder: '#263238',
  danger: '#FF5B6E',
  success: '#00E5A3',
  modalOverlay: 'rgba(0, 0, 0, 0.75)',
  chipBg: '#282234',
  chipActiveBg: '#39A900',
};

export const lightColors: ThemeColors = {
  mode: 'light',
  isDark: false,
  bg: '#F5F3F8',
  bgSecondary: '#EDE8F5',
  card: '#FFFFFF',
  cardBorder: '#DCD5E8',
  text: '#16121D',
  textSub: '#5A516B',
  textMuted: '#847B96',
  accent: '#2E8B00',
  accentHover: '#39A900',
  inputBg: '#F0ECF6',
  inputBorder: '#D0C8DE',
  navBg: '#FFFFFF',
  navBorder: '#DCD5E8',
  danger: '#D91F38',
  success: '#0E7F5E',
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
  chipBg: '#E8E2F2',
  chipActiveBg: '#2E8B00',
};

interface ThemeContextProps {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

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
