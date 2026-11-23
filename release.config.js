const config = {
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { breaking: true, release: 'major' },
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'ui', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'build', release: 'patch' },
          { type: 'ci', release: 'patch' },
          { type: 'revert', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'docs', release: false },
          { type: 'chore', release: false },
          { type: 'style', release: false },
          { type: 'test', release: false },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          // Shown types default to effect: 'bump'; releaseRules above decide
          // the version either way
          types: [
            { type: 'breaking', section: '❗ Breaking Changes' },
            { type: 'feat', section: '🚀 Features' },
            { type: 'fix', section: '🐛 Bug fixes' },
            { type: 'ui', section: '🎨 UI changes' },
            { type: 'perf', section: '⚡ Performance improvements' },
            { type: 'build', section: '🚧 Build' },
            { type: 'ci', section: '⚙️ CI' },
            { type: 'revert', section: '⏪ Reverts' },
            { type: 'refactor', section: '🔧 Refactor' },
            {
              type: 'docs',
              section: '📝 Documentation',
              effect: 'changelog',
            },
            { type: 'test', effect: 'hidden' },
            { type: 'chore', effect: 'hidden' },
            { type: 'style', effect: 'hidden' },
          ],
        },
      },
    ],
    '@semantic-release/github',
    [
      '@semantic-release/exec',
      {
        verifyReleaseCmd:
          'echo NEXT_VERSION_TAG=${nextRelease.version} >> $GITHUB_ENV',
      },
    ],
    [
      '@saithodev/semantic-release-backmerge',
      {
        backmergeBranches: [{ from: 'main', to: 'develop' }],
        message: 'chore(release): backmerge [skip ci]',
      },
    ],
  ],
  branches: [
    'main',
    {
      name: 'develop',
      prerelease: 'develop',
    },
  ],
}

export default config
