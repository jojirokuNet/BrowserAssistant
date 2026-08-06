/**
 * @file Options page entry point rendering the page.
 */
import React from 'react';
import ReactDOM from 'react-dom';

import { OptionsUi } from './components/OptionsUi';

ReactDOM.render(
    <OptionsUi />,
    document.getElementById('root'),
);
