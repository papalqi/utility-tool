import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider initialTheme="dark">
    <App />
  </ThemeProvider>
)
