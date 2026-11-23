const config = {
  '**/*.{js,jsx,mjs,ts,tsx}': [
    'oxlint --fix',
    'oxfmt --no-error-on-unmatched-pattern',
    // A function entry runs the command once, without the staged file list.
    () => 'tsc --noEmit',
  ],
  '**/*.css': [
    'stylelint --cache --fix',
    'oxfmt --no-error-on-unmatched-pattern',
  ],
  '**/*.{md,json,yml,yaml,html,svg}': 'oxfmt --no-error-on-unmatched-pattern',
}

export default config
