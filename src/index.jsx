import React from 'react';
import {createRoot} from 'react-dom/client';
import {setAppElement} from '@scratch/scratch-gui';
import App from './app.jsx';
import {initTrialToken} from './agent/agent-loop';

initTrialToken();

const appTarget = document.getElementById('app');
setAppElement(appTarget);
createRoot(appTarget).render(<App />);
