import { Component } from 'react'
import { btnDark } from './ui'

// Without this, any uncaught error while rendering (a bad prop, a null
// somewhere it wasn't expected, etc.) unmounts the entire app and leaves a
// blank page with no way back short of knowing to hit refresh. This catches
// that and offers a reload instead.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error, app crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-lg font-bold">Something went wrong.</p>
          <p className="max-w-sm text-sm text-stone-500">
            The page hit an unexpected error and had to stop. Reloading usually fixes it — your work up to
            this point (like a saved question) isn't affected.
          </p>
          <button type="button" className={btnDark} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
