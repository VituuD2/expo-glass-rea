import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import './styles.css';
import { App } from './App';
import { OpticalLab } from './OpticalLab';

createRoot(document.getElementById('root')!).render(<StrictMode>{location.pathname === '/lab' ? <OpticalLab /> : <App />}</StrictMode>);
