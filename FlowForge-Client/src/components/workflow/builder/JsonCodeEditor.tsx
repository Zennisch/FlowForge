'use client';

import { json, jsonParseLinter } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, linter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { tags } from '@lezer/highlight';
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
  const jsonHighlightStyle = useMemo(
    () =>
      HighlightStyle.define([
        { tag: tags.propertyName, color: 'var(--json-keyword)' },
        { tag: tags.string, color: 'var(--json-string)' },
        { tag: tags.number, color: 'var(--json-number)' },
        { tag: tags.bool, color: 'var(--json-boolean)' },
        { tag: tags.null, color: 'var(--json-null)' },
        { tag: [tags.brace, tags.squareBracket, tags.separator], color: 'var(--json-brace)' },
      ]),
    []
  );

  const editorExtensions = useMemo(
    () => [
      json(),
      linter(jsonParseLinter()),
      lintGutter(),
      syntaxHighlighting(jsonHighlightStyle),
    ],
    [jsonHighlightStyle]
  );

  const editorTheme = useMemo(
    () =>
      EditorView.theme({
        '&': {
          fontSize: '13px',
          color: 'var(--json-brace)',
          backgroundColor: 'var(--json-bg)',
        },
        '.cm-scroller': {
          fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
        },
        '.cm-content': {
          caretColor: 'var(--json-caret)',
          padding: '10px 0',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: 'var(--json-caret)',
        },
        '.cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: 'var(--json-selection)',
        },
        '.cm-gutters': {
          borderRight: '1px solid var(--json-border)',
          backgroundColor: 'var(--json-gutter-bg)',
          color: 'var(--json-gutter-text)',
        },
        '.cm-line': {
          padding: '0 10px',
        },
        '.cm-activeLine, .cm-activeLineGutter': {
          backgroundColor: 'var(--json-active-line)',
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
