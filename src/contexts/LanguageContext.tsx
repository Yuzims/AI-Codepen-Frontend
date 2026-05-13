import React, { createContext, useContext, useState } from 'react';

interface LanguageContextType {
    jsLanguage: 'js' | 'react' | 'vue' | 'ts';
    setJsLanguage: (language: 'js' | 'react' | 'vue' | 'ts') => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [jsLanguage, setJsLanguage] = useState<'js' | 'react' | 'vue' | 'ts'>('js');

    return (
        <LanguageContext.Provider value={{ jsLanguage, setJsLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}; 