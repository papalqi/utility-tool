/**
 * Navigation Context - 导航状态管理
 * 独立管理 activeWidget，避免与其他状态耦合
 */

import { createContext, useContext, useState, ReactNode } from 'react'

interface NavigationContextType {
  activeWidget: string
  setActiveWidget: (widget: string) => void
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

/* eslint-disable react/prop-types */
export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeWidget, setActiveWidget] = useState<string>('dashboard')

  return (
    <NavigationContext.Provider
      value={{
        activeWidget,
        setActiveWidget,
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}

export const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}
