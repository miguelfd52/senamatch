import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function OtpScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { email } = useLocalSearchParams<{ email: string }>();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    
    try {
      const response = await api.post('/auth/verify', { email, token });
      await signIn(response.token, response.user);
      // El _layout.tsx redirigirá automáticamente a la pantalla correspondiente
    } catch (e: any) {
      if (e instanceof ApiError || e?.name === 'ApiError') {
        setError(e.message);
      } else {
        setError(e?.message || 'Error al verificar el código');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Ingresa tu Código</Text>
      <Text style={[styles.subtitle, { color: colors.textSub }]}>Enviado a {email}</Text>
      
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
        placeholder="000000"
        placeholderTextColor={colors.textMuted}
        value={token}
        onChangeText={setToken}
        keyboardType="number-pad"
        maxLength={6}
      />
      
      {error ? <Text style={styles.error}>{error}</Text> : null}
      
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Button title="Verificar e Ingresar" onPress={handleVerify} color={colors.accent} />
      )}
    </View>
  );
}

function makeStyles(colors: import('../context/ThemeContext').ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    color: colors.text,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.textSub,
    marginBottom: 30,
  },
  input: {
    backgroundColor: colors.chipBg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 5,
  },
  error: {
    color: colors.danger,
    marginBottom: 15,
  }
  });
}
