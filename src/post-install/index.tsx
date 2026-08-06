/**
 * @file Post-install page entry point rendering the page.
 */
import React from 'react';
import ReactDOM from 'react-dom';

import { App } from './components/App';

import '../shared/styles/main.pcss';

ReactDOM.render(
    <App />,
    document.getElementById('root'),
);
