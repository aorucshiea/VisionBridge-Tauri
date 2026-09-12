import React from 'react'
import ReactDOM from 'react-dom/client'
// Installs `window.ipcRenderer` (Tauri-backed) before any component mounts.
import './lib/ipc'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
