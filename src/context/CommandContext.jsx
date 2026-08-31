import React, { createContext, useContext, useState, useEffect } from 'react';

const CommandContext = createContext({
  isOpen: false,
  openCommand: () => {},
  closeCommand: () => {},
  toggleCommand: () => {},
});

export function CommandProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const openCommand = () => setIsOpen(true);
  const closeCommand = () => setIsOpen(false);
  const toggleCommand = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommand();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <CommandContext.Provider value={{ isOpen, openCommand, closeCommand, toggleCommand }}>
      {children}
    </CommandContext.Provider>
  );
}

export function useCommand() {
  const context = useContext(CommandContext);
  if (!context) {
    throw new Error('useCommand must be used within a CommandProvider');
  }
  return context;
}
