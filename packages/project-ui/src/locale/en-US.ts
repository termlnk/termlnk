/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const locale = {
  'project-ui': {
    explorer: {
      title: 'Files',
      empty: 'Open a local terminal or ACP session to browse files.',
      filter: 'Filter files…',
      refresh: 'Refresh',
      'show-hidden': 'Show hidden files',
      'hide-hidden': 'Hide hidden files',
    },
    changes: {
      title: 'Changes',
      uncommitted: '{0} uncommitted',
      clean: 'No changes.',
      'no-diff': 'No textual diff.',
      'staged-count': '{0} staged',
      'switch-branch': 'Switch branch',
      'collapse-all': 'Collapse all',
      'expand-all': 'Expand all',
      'view-flat': 'Flat list',
      'view-tree': 'Tree',
    },
    git: {
      title: 'Git',
      empty: 'No project context.',
      'not-a-repo': 'Not a Git repository.',
      staged: 'Staged',
      changes: 'Changes',
      stage: 'Stage',
      unstage: 'Unstage',
      commit: 'Commit',
      'commit-message': 'Commit message',
      diff: 'Diff',
      'close-diff': 'Close',
    },
    shortcuts: {
      'toggle-explorer': 'Toggle Explorer',
      'toggle-git': 'Toggle Git',
    },
  },
};

export default locale;
