import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './site/App'
import { restoreAccent, restoreMode } from './theme'
import './styles/index.css'

// Before the first paint, so a remembered theme never flashes the default. The
// inline script in index.html sets the mode earlier still; this covers the
// accent, and any app that mounts without that script.
restoreMode()
restoreAccent()

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
