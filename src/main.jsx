import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import tabLogo from './assets/IMAGE/DumbReader.png'

const faviconLink = document.querySelector("link[rel~='icon']")
if (faviconLink) {
  faviconLink.setAttribute('href', tabLogo)
  faviconLink.setAttribute('type', 'image/png')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
