import ErrorBoundary from '../../components/ErrorBoundary';
import ProfileScreen from '../../components/ProfileScreen';

export default function PerfilPage() {
  return (
    <ErrorBoundary fallbackTitle="Error en Perfil">
      <ProfileScreen />
    </ErrorBoundary>
  );
}
