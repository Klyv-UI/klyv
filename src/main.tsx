import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './site/App'
import { installThemePersistence } from './site/lib/theme'
import { restoreMode, restoreTheme } from './theme'
import './styles/index.css'

// Before the first paint, so a remembered theme never flashes the default. The
// inline script in index.html has already written the mode and the saved
// theme's properties; this re-derives the theme properly (and folds in an
// accent saved by the older accent-only API), and covers any app that mounts
// without that script.
restoreMode()
restoreTheme()
// Links the theme's font and keeps the copy the boot script reads in step.
installThemePersistence()

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
