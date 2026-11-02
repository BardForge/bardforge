import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './reference-theme.css';
import './workspace.css';

createRoot(document.getElementById('root')!).render(<App />);
