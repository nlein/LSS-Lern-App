import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import { loadJSON, saveJSON, KEYS } from './storage';
import { DARK_COLORS, LIGHT_COLORS } from './theme';

const ThemeCtx = createContext({
  colors: DARK_COLORS,
  mode: 'system',
  setMode: () => {},
  isDark: true,
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('system');
  const [systemScheme, setSystemScheme] = useState(
    Appearance.getColorScheme() ?? 'dark'
  );

  useEffect(() => {
    loadJSON(KEYS.THEME, 'system').then(setModeState);
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'dark');
    });
    return () => sub.remove();
  }, []);

  async function setMode(m) {
    setModeState(m);
    await saveJSON(KEYS.THEME, m);
  }

  const isDark =
    mode === 'dark' || (mode === 'system' && systemScheme !== 'light');
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeCtx.Provider value={{ colors, mode, setMode, isDark }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
