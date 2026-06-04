import React from 'react';
import {createRoot} from 'react-dom/client';
import {setAppElement} from '@scratch/scratch-gui';
import App from './app.jsx';

const appTarget = document.getElementById('app');
setAppElement(appTarget);
createRoot(appTarget).render(<App />);
