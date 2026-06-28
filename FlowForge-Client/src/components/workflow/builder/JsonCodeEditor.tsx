'use client';

import MonacoEditor from '@monaco-editor/react';
import { Maximize2 } from 'lucide-react';
import { useState } from 'react';

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

  const editor = (editorHeight: string) => (
    <div className="relative bg-(--json-bg)">
      {!value.trim() ? (
        <pre className="pointer-events-none absolute left-[62px] top-3 z-10 whitespace-pre-wrap text-xs leading-5 text-(--color-text-placeholder)">
          {placeholder}
        </pre>
      ) : null}
      <MonacoEditor
      value={value}
      language="json"
      height={editorHeight}
      theme="light"
      onChange={(nextValue) => {
        onChange(nextValue ?? '');
      }}
      options={{
        automaticLayout: true,
        folding: false,
        formatOnPaste: true,
        formatOnType: true,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
        wordWrap: 'on',
      }}
      />
    </div>
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
          {editor('min(72vh, 760px)')}
        </div>
      </ZModal>
    </>
  );
}
