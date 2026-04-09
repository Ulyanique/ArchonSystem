import { useParams, Outlet, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { universesApi } from '../api';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function UniverseDetailPage() {
  const { universeId } = useParams();

  const { data: universe, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.getById(parseInt(universeId!)),
    enabled: !!universeId,
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <LoadingSkeleton variant="list" lines={5} />
      </div>
    );
  }

  if (isError && error) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-red-600 dark:text-red-400 mb-2">Не удалось загрузить вселенную</p>
        <p className="text-sm text-dark-600 dark:text-dark-400 mb-4">{(error as Error)?.message}</p>
        <button type="button" onClick={() => refetch()} className="btn btn-primary">
          Повторить
        </button>
      </div>
    );
  }

  if (!universe) {
    return <Navigate to="/universes" replace />;
  }

  return (
    <div>
      <Outlet />
    </div>
  );
}
