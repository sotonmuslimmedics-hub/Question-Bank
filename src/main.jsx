import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import { AnnouncementReadsProvider } from './lib/announcementReads'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AnnouncementReadsProvider>
          <App />
        </AnnouncementReadsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
