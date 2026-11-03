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
  'acp-ui': {
    'new-session': {
      'local-terminal': 'New Local Terminal',
      agents: 'AI Agent',
      'on-demand': 'on-demand',
      'manage-agents': 'Manage Agents…',
    },
    session: {
      stop: 'Stop',
      connecting: 'Connecting…',
      'message-placeholder': 'Message the agent…',
    },
    launch: {
      'failed-title': 'Could not start {0}',
      'failed-body-title': 'The agent failed to start',
      retry: 'Retry',
    },
    settings: {
      tab: 'Agents',
      'tab-description': 'Coding agents that speak the Agent Client Protocol.',
      providers: 'Providers',
      'no-providers': 'No providers configured.',
      'add-provider': 'Add Provider',
      'search-providers': 'Search providers',
      'no-matches': 'Nothing matches that search.',
      'install-guide': 'Install guide',
      add: 'Add',
      remove: 'Remove',
      'model-count': '{0} models',
      status: {
        available: 'Available',
        'on-demand': 'Downloads on first run',
        'not-installed': 'Not installed',
        disabled: 'Disabled',
      },
      'search-models': 'Search models',
      discovered: 'Discovered',
      'no-models': 'This agent advertises no models.',
      'not-probed': 'Refresh to ask this agent what it supports.',
      'add-model': 'Add Model',
      'model-id-placeholder': 'e.g. anthropic/claude-opus-5',
      diagnose: 'Diagnose',
      refresh: 'Refresh',
      'updated-at': 'Updated {0}',
      'just-now': 'just now',
      'minutes-ago': '{0}m ago',
      'hours-ago': '{0}h ago',
      'days-ago': '{0}d ago',
    },
  },
};

export default locale;
