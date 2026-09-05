import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { SavedOpportunityProvider } from './context/SavedOpportunityContext';
import { ApplicationProvider } from './context/ApplicationContext';
import { AppRoutes } from './routes';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <SavedOpportunityProvider>
            <ApplicationProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </ApplicationProvider>
          </SavedOpportunityProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}



