import ErrorBoundary from '../../components/ErrorBoundary';
import DiscoverScreen from '../../components/DiscoverScreen';

export default function DescubrirPage() {
  return (
    <ErrorBoundary fallbackTitle="Error en Descubrir">
      <DiscoverScreen />
    </ErrorBoundary>
  );
}
