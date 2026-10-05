import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';

interface LogoProps {
  size?: number;
  showText?: boolean;
  textSize?: number;
  subtitle?: string;
  onPress?: () => void;
}

/**
 * SenaMatchLogo:
 * Logo visual 3D propio, ligero, original y alusivo a la comunidad SENA Match.
 * Emplea geometría isométrica vectorial con iluminación volumétrica y la paleta
 * institucional verde de SENA Match (#39A900, #1F6B00, #00E5A3, #DDF4D5).
 * No infringe marcas registradas de terceros ni depende de imágenes rasterizadas externas.
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
        filter: 'drop-shadow(0 6px 14px rgba(57, 169, 0, 0.4))',
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
          {/* Cara Superior (Luz Cenital Verde Lima Esmeralda) */}
          <linearGradient id="topFaceGreen" x1="50" y1="12" x2="50" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5FE0B4" />
            <stop offset="100%" stopColor="#39A900" />
          </linearGradient>

          {/* Cara Izquierda (Verde Institucional SENA Match) */}
          <linearGradient id="leftFaceGreen" x1="16" y1="31" x2="50" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#39A900" />
            <stop offset="100%" stopColor="#1F6B00" />
          </linearGradient>

          {/* Cara Derecha (Profundidad Esmeralda Oscuro) */}
          <linearGradient id="rightFaceGreen" x1="50" y1="50" x2="84" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2E8B00" />
            <stop offset="100%" stopColor="#144600" />
          </linearGradient>

          {/* Gradiente Núcleo de Encuentro Central */}
          <radialGradient id="centerCoreGreen" cx="50" cy="50" r="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#DDF4D5" />
            <stop offset="100%" stopColor="#39A900" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sombra de apoyo 3D */}
        <ellipse cx="50" cy="91" rx="34" ry="7" fill="rgba(0,0,0,0.4)" filter="blur(2px)" />

        {/* Cubo Isométrico 3D - Cara Izquierda */}
        <path d="M50 50L16 31V69L50 88V50Z" fill="url(#leftFaceGreen)" />

        {/* Cubo Isométrico 3D - Cara Derecha */}
        <path d="M50 50L84 31V69L50 88V50Z" fill="url(#rightFaceGreen)" />

        {/* Cubo Isométrico 3D - Cara Superior */}
        <path d="M50 12L84 31L50 50L16 31L50 12Z" fill="url(#topFaceGreen)" />

        {/* Arco de Conexión / Comunidad */}
        <path
          d="M26 36L50 49L74 36"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Núcleo de chispa / encuentro interactivo */}
        <circle cx="50" cy="49" r="7" fill="#FFFFFF" />
        <circle cx="50" cy="49" r="14" fill="url(#centerCoreGreen)" />
        <circle cx="50" cy="49" r="3.5" fill="#39A900" />

        {/* Destello cenital */}
        <circle cx="50" cy="18" r="2.5" fill="rgba(255,255,255,0.95)" />
      </svg>
    </div>
  ) : (
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
    color: '#39A900',
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
    backgroundColor: '#161B22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#39A900',
    shadowColor: '#39A900',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  nativeCubeTop: {
    borderRadius: 6,
    backgroundColor: '#39A900',
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
