import { create } from 'storybook/theming';

const RitoTheme = create({
  base: 'dark',

  brandTitle: 'RitoSwap Storybook',
  brandUrl: 'https://ritoswap.com',
  brandTarget: '_self',

  colorPrimary: '#012035',
  colorSecondary: '#012035',

  appBg: '#012035',
  appContentBg: '#020617',
  appBorderColor: '#020617',
  appBorderRadius: 12,

  fontBase: 'var(--font-body, system-ui, sans-serif)',
  fontCode: 'Menlo, Monaco, "SF Mono", monospace',

  barBg: '#020617',
  barTextColor: '#e5e7eb',
  barSelectedColor: '#012035',
  barHoverColor: '#38bdf8',

  inputBg: '#020617',
  inputBorder: '#334155',
  inputTextColor: '#e5e7eb',
  inputBorderRadius: 8,
});

export default RitoTheme;

