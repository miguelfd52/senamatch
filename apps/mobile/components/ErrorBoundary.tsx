import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || 'Esta pantalla tuvo un error';
      const msg = this.state.error?.message || 'Error desconocido';
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>\u26A0\uFE0F</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{msg}</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>\uD83D\uDD04 Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16121D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: {
    fontSize: 20, fontWeight: '700', color: '#F0ECF6',
    marginBottom: 8, textAlign: 'center',
  },
  subtitle: {
    fontSize: 14, color: '#786E8A', textAlign: 'center',
    lineHeight: 22, maxWidth: 320, marginBottom: 24,
  },
  btn: {
    backgroundColor: '#FF6B4A',
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
