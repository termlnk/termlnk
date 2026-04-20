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

import { Button, useDependency } from '@termlnk/design';
import { ISFTPClientService } from '@termlnk/rpc-client';
import { Save, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface IInlineFileEditorProps {
  sessionId: string;
  remotePath: string;
  filename: string;
  onClose: () => void;
}

export function InlineFileEditor({ sessionId, remotePath, filename, onClose }: IInlineFileEditorProps) {
  const sftpService = useDependency(ISFTPClientService);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    sftpService.readFile(sessionId, remotePath)
      .then((base64) => {
        if (cancelled) return;
        const text = atob(base64);
        setContent(text);
        setOriginalContent(text);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, remotePath, sftpService]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const base64 = btoa(content);
      await sftpService.writeFile(sessionId, remotePath, base64);
      setOriginalContent(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
  }, [content, sessionId, remotePath, sftpService]);

  const isDirty = content !== originalContent;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (isDirty) handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }, [isDirty, handleSave, onClose]);

  return (
    <div className="tm:fixed tm:inset-0 tm:z-50 tm:flex tm:items-center tm:justify-center tm:bg-black/50">
      <div
        className={`
          tm:flex tm:h-[80vh] tm:w-[80vw] tm:max-w-3xl tm:flex-col tm:rounded-lg tm:border tm:border-line tm:bg-one-bg
        `}
      >
        {/* Header */}
        <div className="tm:flex tm:items-center tm:justify-between tm:border-b tm:border-line tm:px-4 tm:py-2">
          <div className="tm:flex tm:items-center tm:gap-2">
            <span className="tm:text-[13px] tm:font-medium tm:text-light-grey">{filename}</span>
            {isDirty && <span className="tm:text-[11px] tm:text-yellow">modified</span>}
          </div>
          <div className="tm:flex tm:items-center tm:gap-1">
            <Button variant="ghost" size="icon-sm" onClick={handleSave} disabled={!isDirty || saving} title="Save (Ctrl+S)">
              <Save size={14} />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close (Esc)">
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="tm:px-4 tm:py-2 tm:text-[12px] tm:text-red">{error}</div>
        )}

        {/* Editor */}
        {loading
          ? (
            <div className="tm:flex tm:flex-1 tm:items-center tm:justify-center tm:text-[12px] tm:text-grey-fg">
              Loading...
            </div>
          )
          : (
            <textarea
              className={`
                tm:flex-1 tm:resize-none tm:bg-one-bg2 tm:p-4 tm:font-mono tm:text-[13px] tm:leading-relaxed
                tm:text-light-grey tm:outline-hidden
              `}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
            />
          )}
      </div>
    </div>
  );
}
