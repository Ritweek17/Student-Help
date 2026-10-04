import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { SavedOpportunityProvider } from './context/SavedOpportunityContext';
import { ApplicationProvider } from './context/ApplicationContext';
import { CalendarProvider } from './context/CalendarContext';
import { AppRoutes } from './routes';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <SavedOpportunityProvider>
            <ApplicationProvider>
              <CalendarProvider>
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </CalendarProvider>
            </ApplicationProvider>
          </SavedOpportunityProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}



