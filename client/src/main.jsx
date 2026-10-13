import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'
import './index.css'
import HitDadUIProvider from './components/ui/Provider.jsx'
import './components/ui/theme.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HitDadUIProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HitDadUIProvider>
  </StrictMode>,
)
