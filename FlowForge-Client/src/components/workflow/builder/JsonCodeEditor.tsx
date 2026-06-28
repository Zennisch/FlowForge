'use client';

import { json, jsonParseLinter } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, linter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { tags } from '@lezer/highlight';
import MonacoEditor from '@monaco-editor/react';
import { Maximize2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import ZButton from '@/components/primary/ZButton';
import ZModal from '@/components/primary/ZModal';

interface JsonCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string;
  modalTitle?: string;
}

export function JsonCodeEditor({
  value,
  onChange,
  placeholder = '{\n  "key": "value"\n}',
  height = '220px',
  modalTitle = 'Edit JSON',
}: JsonCodeEditorProps) {
  const [expanded, setExpanded] = useState(false);
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
      EditorView.lineWrapping,
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

  const editor = (editorHeight: string) => (
    <CodeMirror
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      height={editorHeight}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        autocompletion: false,
        highlightActiveLineGutter: true,
      }}
      extensions={editorExtensions}
      theme={editorTheme}
    />
  );

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-(--color-border)">
        <div className="flex items-center justify-between border-b border-(--color-border) bg-(--color-surface-muted) px-2 py-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-(--color-text-secondary)">
            JSON
          </span>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-(--color-text-secondary) transition-colors hover:bg-(--color-surface-base) hover:text-(--color-primary)"
            aria-label="Expand JSON editor"
            title="Expand editor"
            onClick={() => {
              setExpanded(true);
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {editor(height)}
      </div>

      <ZModal
        isOpen={expanded}
        onClose={() => {
          setExpanded(false);
        }}
        header={modalTitle}
        size="full"
        bodyClassName="p-3"
        containerClassName="max-h-[calc(100vh-2rem)]"
        footer={
          <ZButton
            size="sm"
            onClick={() => {
              setExpanded(false);
            }}
          >
            Done
          </ZButton>
        }
      >
        <div className="overflow-hidden rounded-xl border border-(--color-border)">
          <MonacoEditor
            value={value}
            language="json"
            height="min(72vh, 760px)"
            theme="light"
            onChange={(nextValue) => {
              onChange(nextValue ?? '');
            }}
            options={{
              automaticLayout: true,
              formatOnPaste: true,
              formatOnType: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              tabSize: 2,
              wordWrap: 'on',
            }}
          />
        </div>
      </ZModal>
    </>
  );
}
