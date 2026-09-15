import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';

interface LogoProps {
  size?: number; // size of the 3D mark (e.g. 36 for nav, 52 for headers, 64 for auth)
  showText?: boolean;
  textSize?: number;
  subtitle?: string;
  onPress?: () => void;
}

/**
 * SenaMatchLogo:
 * Logo visual 3D ligero, original y alusivo al aprendizaje y la comunidad colombiana.
 * Creado con geometría isométrica vectorial (SVG / HTML / CSS) con iluminación 3D
 * y gradientes cálidos (ámbar, coral y esmeralda).
 * No utiliza marcas registradas de terceros ni recursos pesados externos.
 */
export default function SenaMatchLogo({
  size = 40,
  showText = true,
  textSize = 22,
  subtitle,
  onPress,
}: LogoProps) {
  const isWeb = Platform.OS === 'web';

  const mark = isWeb ? (
    <div
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'drop-shadow(0 6px 14px rgba(255, 107, 74, 0.45))',
        transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: onPress ? 'pointer' : 'default',
      }}
      className="sena-match-logo-mark"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          {/* Gradiente Cara Superior (Luz Cenital) */}
          <linearGradient id="topFace" x1="50" y1="12" x2="50" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFA654" />
            <stop offset="100%" stopColor="#FF7A50" />
          </linearGradient>

          {/* Gradiente Cara Izquierda (Sombra Media Coral Cálida) */}
          <linearGradient id="leftFace" x1="16" y1="31" x2="50" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF5E3A" />
            <stop offset="100%" stopColor="#D9381E" />
          </linearGradient>

          {/* Gradiente Cara Derecha (Profundidad Esmeralda Innovación) */}
          <linearGradient id="rightFace" x1="50" y1="50" x2="84" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E5A3" />
            <stop offset="100%" stopColor="#008A5E" />
          </linearGradient>

          {/* Gradiente Núcleo de Aprendizaje Central */}
          <radialGradient id="centerCore" cx="50" cy="50" r="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#FFE066" />
            <stop offset="100%" stopColor="#FF8F3D" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sombra de apoyo 3D */}
        <ellipse cx="50" cy="91" rx="34" ry="7" fill="rgba(0,0,0,0.35)" filter="blur(2px)" />

        {/* Cubo Isométrico 3D - Cara Izquierda */}
        <path
          d="M50 50L16 31V69L50 88V50Z"
          fill="url(#leftFace)"
        />

        {/* Cubo Isométrico 3D - Cara Derecha */}
        <path
          d="M50 50L84 31V69L50 88V50Z"
          fill="url(#rightFace)"
        />

        {/* Cubo Isométrico 3D - Cara Superior */}
        <path
          d="M50 12L84 31L50 50L16 31L50 12Z"
          fill="url(#topFace)"
        />

        {/* Acento geométrico: Arco de Comunidad / Alianza */}
        <path
          d="M26 36L50 49L74 36"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Núcleo de chispa / conocimiento interactivo */}
        <circle cx="50" cy="49" r="7" fill="#FFFFFF" />
        <circle cx="50" cy="49" r="14" fill="url(#centerCore)" />
        <circle cx="50" cy="49" r="3.5" fill="#FF5E3A" />

        {/* Destello sutil superior */}
        <circle cx="50" cy="18" r="2.5" fill="rgba(255,255,255,0.9)" />
      </svg>
    </div>
  ) : (
    // Fallback nativo universal usando componentes estándar de React Native
    <View style={[styles.nativeMark, { width: size, height: size }]}>
      <View style={[styles.nativeCubeTop, { width: size * 0.7, height: size * 0.7 }]} />
      <View style={styles.nativeSpark} />
    </View>
  );

  const content = (
    <View style={styles.container}>
      {mark}
      {showText && (
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={[styles.brandSena, { fontSize: textSize }]}>SENA</Text>
            <Text style={[styles.brandMatch, { fontSize: textSize }]}> Match</Text>
            <View style={styles.glowDot} />
          </View>
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  touchable: {
    alignSelf: 'flex-start',
  },
  textWrap: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandSena: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  brandMatch: {
    fontWeight: '900',
    color: '#FF6B4A',
    letterSpacing: -0.5,
  },
  glowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5A3',
    marginLeft: 4,
    marginTop: -4,
  },
  subtitle: {
    fontSize: 12,
    color: '#8D83A0',
    fontWeight: '600',
    marginTop: 1,
  },
  nativeMark: {
    borderRadius: 10,
    backgroundColor: '#1E1A2B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF6B4A',
    shadowColor: '#FF6B4A',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  nativeCubeTop: {
    borderRadius: 6,
    backgroundColor: '#FF7A50',
    transform: [{ rotate: '45deg' }],
  },
  nativeSpark: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E5A3',
  },
});
