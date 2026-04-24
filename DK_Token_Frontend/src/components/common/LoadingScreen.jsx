import LoadingSpinner from '../ui/LoadingSpinner';

function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <LoadingSpinner className="size-10 border-[5px]" />
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}

export default LoadingScreen;
