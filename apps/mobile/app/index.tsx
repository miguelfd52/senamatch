import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Marca */}
        <View style={styles.brand}>
          <Text style={styles.logoBadge}>Comunidad SENA</Text>
          <Text style={styles.logo}>SENA Match</Text>
          <Text style={styles.slogan}>
            Descubre personas por afinidad{'\n'}y arma tu parche 🎯
          </Text>
        </View>

        {/* CTA principal */}
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push('/(auth)/registro')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Crear cuenta nueva</Text>
        </TouchableOpacity>

        {/* CTA secundario */}
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.8}
        >
          <Text style={styles.btnSecondaryText}>Ya tengo cuenta — Iniciar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Solo para la comunidad SENA 🇨🇴</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0C18',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    maxWidth: 480,
    width: '100%',
    backgroundColor: '#171324',
    padding: 40,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2D2640',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 6,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    backgroundColor: 'rgba(255,107,74,0.12)',
    color: '#FF6B4A',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,74,0.3)',
  },
  logo: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FF6B4A',
    letterSpacing: -1,
  },
  slogan: {
    fontSize: 16,
    color: '#8D83A0',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  btnPrimary: {
    backgroundColor: '#FF6B4A',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#FF6B4A',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: '#261F36',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3247',
  },
  btnSecondaryText: {
    color: '#B9B1C9',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    color: '#4E4461',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 28,
  },
});
