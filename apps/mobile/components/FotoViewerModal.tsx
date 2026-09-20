import { Modal, View, Image, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';

interface FotoViewerModalProps {
  visible: boolean;
  fotoUrl: string | null;
  onClose: () => void;
}

export default function FotoViewerModal({ visible, fotoUrl, onClose }: FotoViewerModalProps) {
  if (!visible || !fotoUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Fondo interactivo para cerrar al tocar fuera */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Botón cerrar */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Contenedor de la foto */}
        <View style={styles.imageContainer} pointerEvents="box-none">
          <Image
            source={{ uri: fotoUrl }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 24 : 48,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  closeText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  imageContainer: {
    width: '94%',
    height: '88%',
    maxWidth: 950,
    maxHeight: 900,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
