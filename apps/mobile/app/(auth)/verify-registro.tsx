import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SenaMatchLogo from '../../components/SenaMatchLogo';

export default function VerifyRegistroScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const handleVerify = async () => {
    if (!codigo.trim() || codigo.trim().length < 6) {
      setError('Por favor introduce el código de 6 dígitos');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await api.post('/auth/verify-registration', {
        email: (email || '').trim().toLowerCase(),
        codigo: codigo.trim(),
      });

      if (response.token && response.user) {
        await signIn(response.token, response.user);
        // Redirección manejada por _layout.tsx
      } else {
        setError('No se pudo validar el código. Inténtalo de nuevo.');
      }
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

  const handleResend = async () => {
    if (!email) return;
    setError('');
    setMessage('');
    setResending(true);

    try {
      const res = await api.post('/auth/resend-code', {
        email: email.trim().toLowerCase(),
      });
      setMessage(res.message || 'Código reenviado exitosamente a tu correo.');
    } catch (e: any) {
      setError(e?.message || 'Error al reenviar el código. Intenta nuevamente.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <SenaMatchLogo size={48} textSize={24} subtitle="Verificación de Cuenta" />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.title, { color: colors.text }]}>Revisa tu correo</Text>
          <Text style={[styles.subtitle, { color: colors.textSub }]}>
            Enviamos un código de verificación a{'\n'}
            <Text style={{ fontWeight: '700', color: colors.accent }}>{email}</Text>
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.text,
              },
            ]}
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            value={codigo}
            onChangeText={(text) => {
              setCodigo(text.replace(/[^0-9]/g, ''));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}
          {message ? <Text style={styles.successText}>✅ {message}</Text> : null}

          <TouchableOpacity
            style={[styles.verifyBtn, { backgroundColor: colors.accent }, loading && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyBtnText}>Confirmar y Continuar</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <TouchableOpacity onPress={handleResend} disabled={resending} activeOpacity={0.7}>
              <Text style={[styles.resendText, { color: colors.accent }]}>
                {resending ? 'Reenviando...' : '¿No recibiste el código? Reenviar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace('/(auth)/registro')}
              style={{ marginTop: 14 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.backText, { color: colors.textSub }]}>← Corregir correo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.credit, { color: colors.textMuted }]}>
          Creado por Miguel Toncel Herrera
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF5B6E',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: '500',
  },
  successText: {
    color: '#00E5A3',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: '500',
  },
  verifyBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  backText: {
    fontSize: 13,
    fontWeight: '500',
  },
  credit: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 11,
    fontStyle: 'italic',
  },
});
