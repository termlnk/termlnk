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

export default {
  'sync-ui': {
    status: {
      title: '클라우드 동기화',
      'toggle-label': '동기화',
      'sync-now': '지금 동기화',
      'never-synced': '동기화한 적 없음',
      'just-now': '방금 전 동기화됨',
      'minutes-ago': '{0}분 전 동기화',
      'hours-ago': '{0}시간 전 동기화',
      'days-ago': '{0}일 전 동기화',
      pending: '보낼 변경 {0}개',
    },
    state: {
      idle: '최신 상태',
      syncing: '동기화 중',
      offline: '오프라인',
      error: '오류',
      disabled: '비활성화됨',
      'pending-push': '보낼 변경 대기 중({0}개)',
    },
    error: {
      unauthenticated: '동기화하려면 로그인하세요',
      master_key_locked: '마스터 키가 잠겨 있습니다',
      network: '네트워크 오류',
      rate_limited: '서버에 의해 속도가 제한되었습니다',
      protocol_mismatch: '클라이언트/서버 스키마가 일치하지 않습니다',
      cipher_mismatch: '복호화에 실패했습니다',
      server_error: '서버 오류',
      unknown: '알 수 없는 오류',
    },
    backup: {
      title: '암호화 백업',
      description: '호스트, 설정, AI Provider, MCP 서버, Skill을 하나의 암호화된 파일로 내보내고 복원합니다. 마스터 키가 필요합니다.',
      'locked-hint': '먼저 로그인하세요. 암호화 백업은 비밀번호에서 파생된 마스터 키가 필요합니다.',
      export: '내보내기…',
      import: '복원…',
      exporting: '백업을 암호화하고 쓰는 중…',
      importing: '백업을 읽고 복호화하는 중…',
      'export-success': '백업이 작성되었습니다.',
      'import-success': '백업이 복원되었습니다.',
      'counts-summary': '{0}개의 레코드 포함',
      'import-confirm-title': '암호화 백업에서 복원하시겠습니까?',
      'import-confirm-description': '현재의 모든 호스트, 설정, AI Provider, MCP 서버, Skill이 백업 파일의 내용으로 대체됩니다. 이 작업은 되돌릴 수 없습니다.',
      'import-confirm-action': '대체하고 복원',
      cancel: '취소',
    },
  },
};
