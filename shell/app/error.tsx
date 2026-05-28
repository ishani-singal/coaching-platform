'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('Page error:', error)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600">An error occurred while loading this page.</p>
        </div>

        {process.env.NODE_ENV !== 'production' && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm font-mono text-red-800 break-all">{error.message}</p>
            {error.digest && (
              <p className="text-xs text-red-600 mt-2">Digest: {error.digest}</p>
            )}
          </div>
        )}

        {process.env.NODE_ENV === 'production' && error.digest && (
          <div className="bg-gray-100 border border-gray-300 rounded p-3">
            <p className="text-xs text-gray-600 font-mono">Error ID: {error.digest}</p>
            <p className="text-xs text-gray-500 mt-1">
              Please contact support with this error ID if the problem persists.
            </p>
          </div>
        )}

        <button
          onClick={reset}
          className="w-full bg-indigo-600 text-white font-medium py-2 px-4 rounded hover:bg-indigo-700 transition-colors"
        >
          Try again
        </button>

        <a
          href="/"
          className="block w-full text-center text-indigo-600 hover:text-indigo-800 text-sm font-medium"
        >
          Return to home
        </a>
      </div>
    </div>
  )
}
