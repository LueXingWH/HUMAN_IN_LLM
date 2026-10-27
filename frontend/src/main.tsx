import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntApp } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.tsx'
import { AntdAppBridge } from './lib/antdApp.tsx'
import { ThemeProvider } from './theme/ThemeProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AntApp>
          <AntdAppBridge />
          <App />
        </AntApp>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
