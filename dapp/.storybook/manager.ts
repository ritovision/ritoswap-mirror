import { addons } from 'storybook/manager-api';
import RitoTheme from './RitoTheme';

import './fonts.css';
import '../styles/globals.css';

addons.setConfig({
  theme: RitoTheme,
});

