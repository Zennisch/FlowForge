'use client';

import { json, jsonParseLinter } from '@codemirror/lang-json';
import { lintGutter, linter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';

interface JsonCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string;
}

export function JsonCodeEditor({
  value,
  onChange,
  placeholder = '{\n  "key": "value"\n}',
  height = '220px',
}: JsonCodeEditorProps) {
  const editorExtensions = useMemo(() => [json(), linter(jsonParseLinter()), lintGutter()], []);

  const editorTheme = useMemo(
    () =>
      EditorView.theme({
        '&': {
          fontSize: '13px',
          backgroundColor: 'var(--color-surface-base)',
        },
        '.cm-scroller': {
          fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
        },
        '.cm-gutters': {
          borderRight: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-muted)',
          color: 'var(--color-text-secondary)',
        },
        '.cm-content': {
          padding: '10px 0',
        },
        '.cm-line': {
          padding: '0 10px',
        },
      }),
    []
  );

  return (
    <div className="overflow-hidden rounded-xl border border-(--color-border)">
      <CodeMirror
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        height={height}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          autocompletion: false,
          highlightActiveLineGutter: true,
        }}
        extensions={editorExtensions}
        theme={editorTheme}
      />
    </div>
  );
}
