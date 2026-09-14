import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../context/AuthContext';

export default function OtpScreen() {
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
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Error al verificar el código');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ingresa tu Código</Text>
      <Text style={styles.subtitle}>Enviado a {email}</Text>
      
      <TextInput
        style={styles.input}
        placeholder="000000"
        placeholderTextColor="#786E8A"
        value={token}
        onChangeText={setToken}
        keyboardType="number-pad"
        maxLength={6}
      />
      
      {error ? <Text style={styles.error}>{error}</Text> : null}
      
      {loading ? (
        <ActivityIndicator color="#FF6B4A" />
      ) : (
        <Button title="Verificar e Ingresar" onPress={handleVerify} color="#FF6B4A" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#16121D',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    color: '#F0ECF6',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#B9B1C9',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#282234',
    color: '#F0ECF6',
    borderWidth: 1,
    borderColor: '#3A3247',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 5,
  },
  error: {
    color: '#FF5B6E',
    marginBottom: 15,
  }
});
