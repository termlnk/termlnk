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
  'island-ui': {
    session: {
      'todo-summary': 'Tasks ({0} done, {1} active, {2} pending)',
      'user-prompt-prefix': 'You: ',
      done: 'Done',
      external: 'External',
      'empty-state': 'Waiting for sessions',
      'session-count': '{0} sessions',
    },
    permission: {
      'claude-asks': 'Claude asks',
      external: 'External',
      deny: 'Deny',
      'permission-request': 'Permission Request',
      allow: 'Allow',
      question: {
        next: 'Next',
        previous: 'Back',
        skip: 'Skip',
        submit: 'Submit',
        progress: '{0}/{1}',
        'other-placeholder': 'Other…',
        'other-input-placeholder': 'Type your answer…',
        'secret-placeholder': 'Type your answer',
        'select-all-that-apply': 'Select all that apply.',
        'select-at-least-one': 'Please pick at least one option.',
      },
    },
    'island-tab': {
      label: 'Island',
      description: 'Configure Dynamic Island notifications and sounds',
      enable: 'Enable Dynamic Island',
      'enable-description': 'Show a floating status overlay near the macOS notch for agent sessions',
      'sound-title': 'Sound',
      'sound-enable': 'Enable Sounds',
      'sound-volume': 'Volume',
      'category-session': 'Session',
      'category-interaction': 'Interaction',
      'category-system': 'System',
      'event-session-start': 'Session Start',
      'event-session-start-description': 'New Claude / Codex / Gemini session',
      'event-task-complete': 'Task Complete',
      'event-task-complete-description': 'AI finished its current response',
      'event-task-error': 'Task Error',
      'event-task-error-description': 'Tool failure or API error',
      'event-needs-approval': 'Needs Approval',
      'event-needs-approval-description': 'Waiting for permission or answering a question',
      'event-task-confirmed': 'Task Confirmed',
      'event-task-confirmed-description': 'You sent a message',
      'event-context-limit': 'Context Limit',
      'event-context-limit-description': 'Context window is compacting',
      'event-rapid-submit': 'Rapid Submit Detection',
      'event-rapid-submit-description': '3+ messages sent within 10 seconds',
    },
  },
};

export default locale;
