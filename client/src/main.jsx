import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontSize: '13px', borderRadius: '8px', fontFamily: 'inherit' },
            success: { iconTheme: { primary: '#1D9E75', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#D85A30', secondary: '#fff' } }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);