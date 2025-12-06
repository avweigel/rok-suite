'use client';

import { useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Quote,
  Code,
  Minus,
  Eye,
  Edit3,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Theme } from '@/lib/guide/theme';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme: Theme;
  darkMode: boolean;
  placeholder?: string;
  minHeight?: string;
}

interface ToolbarButton {
  icon: React.ReactNode;
  label: string;
  action: 'wrap' | 'prefix' | 'insert';
  before?: string;
  after?: string;
  prefix?: string;
  insert?: string;
}

const toolbarButtons: ToolbarButton[] = [
  { icon: <Bold size={16} />, label: 'Bold', action: 'wrap', before: '**', after: '**' },
  { icon: <Italic size={16} />, label: 'Italic', action: 'wrap', before: '*', after: '*' },
  { icon: <Heading2 size={16} />, label: 'Heading 2', action: 'prefix', prefix: '## ' },
  { icon: <Heading3 size={16} />, label: 'Heading 3', action: 'prefix', prefix: '### ' },
  { icon: <List size={16} />, label: 'Bullet List', action: 'prefix', prefix: '- ' },
  { icon: <ListOrdered size={16} />, label: 'Numbered List', action: 'prefix', prefix: '1. ' },
  { icon: <Quote size={16} />, label: 'Quote', action: 'prefix', prefix: '> ' },
  { icon: <Code size={16} />, label: 'Code', action: 'wrap', before: '`', after: '`' },
  { icon: <LinkIcon size={16} />, label: 'Link', action: 'wrap', before: '[', after: '](url)' },
  { icon: <Minus size={16} />, label: 'Divider', action: 'insert', insert: '\n\n---\n\n' },
];

export function MarkdownEditor({
  value,
  onChange,
  theme,
  darkMode,
  placeholder = 'Write your content here...',
  minHeight = '300px',
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);

  const handleToolbarAction = useCallback(
    (button: ToolbarButton) => {
      if (!textareaRef) return;

      const start = textareaRef.selectionStart;
      const end = textareaRef.selectionEnd;
      const selectedText = value.substring(start, end);

      let newValue: string;
      let newCursorPos: number;

      if (button.action === 'wrap') {
        const before = button.before || '';
        const after = button.after || '';
        newValue =
          value.substring(0, start) +
          before +
          selectedText +
          after +
          value.substring(end);
        newCursorPos = selectedText
          ? start + before.length + selectedText.length + after.length
          : start + before.length;
      } else if (button.action === 'prefix') {
        const prefix = button.prefix || '';
        // Find the start of the current line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        newValue =
          value.substring(0, lineStart) + prefix + value.substring(lineStart);
        newCursorPos = start + prefix.length;
      } else {
        // insert
        const insert = button.insert || '';
        newValue = value.substring(0, start) + insert + value.substring(end);
        newCursorPos = start + insert.length;
      }

      onChange(newValue);

      // Restore cursor position after React re-render
      setTimeout(() => {
        if (textareaRef) {
          textareaRef.focus();
          textareaRef.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [value, onChange, textareaRef]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle Tab key for indentation
      if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        }, 0);
      }

      // Handle keyboard shortcuts
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'b') {
          e.preventDefault();
          handleToolbarAction(toolbarButtons[0]); // Bold
        } else if (e.key === 'i') {
          e.preventDefault();
          handleToolbarAction(toolbarButtons[1]); // Italic
        }
      }
    },
    [value, onChange, handleToolbarAction]
  );

  return (
    <div className={`border rounded-lg overflow-hidden ${theme.border}`}>
      {/* Toolbar */}
      <div
        className={`flex items-center justify-between p-2 border-b ${theme.border} ${
          darkMode ? 'bg-zinc-800' : 'bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-1">
          {toolbarButtons.map((button, index) => (
            <button
              key={index}
              onClick={() => handleToolbarAction(button)}
              className={`p-1.5 rounded hover:bg-zinc-700 transition-colors ${theme.textMuted} hover:${theme.text}`}
              title={button.label}
              type="button"
            >
              {button.icon}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className={`flex items-center gap-1 p-1 rounded-lg ${darkMode ? 'bg-zinc-900' : 'bg-gray-200'}`}>
          <button
            onClick={() => setMode('edit')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              mode === 'edit'
                ? `${darkMode ? 'bg-zinc-700' : 'bg-white'} ${theme.text}`
                : theme.textMuted
            }`}
            type="button"
          >
            <Edit3 size={12} />
            Edit
          </button>
          <button
            onClick={() => setMode('split')}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              mode === 'split'
                ? `${darkMode ? 'bg-zinc-700' : 'bg-white'} ${theme.text}`
                : theme.textMuted
            }`}
            type="button"
          >
            Split
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              mode === 'preview'
                ? `${darkMode ? 'bg-zinc-700' : 'bg-white'} ${theme.text}`
                : theme.textMuted
            }`}
            type="button"
          >
            <Eye size={12} />
            Preview
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      <div className={`${mode === 'split' ? 'grid grid-cols-2 divide-x' : ''} ${theme.border}`}>
        {/* Editor */}
        {(mode === 'edit' || mode === 'split') && (
          <textarea
            ref={setTextareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full p-4 resize-none font-mono text-sm ${theme.input} focus:outline-none focus:ring-0 border-0`}
            style={{ minHeight }}
          />
        )}

        {/* Preview */}
        {(mode === 'preview' || mode === 'split') && (
          <div
            className={`p-4 overflow-auto ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}
            style={{ minHeight }}
          >
            {value ? (
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold mb-4">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold mb-3 mt-6">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className={`mb-3 ${theme.textMuted}`}>{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
                  ),
                  li: ({ children }) => <li className={theme.textMuted}>{children}</li>,
                  strong: ({ children }) => (
                    <strong className={theme.text}>{children}</strong>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className={`border-l-4 border-emerald-500 pl-4 my-4 ${theme.textMuted} italic`}>
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className={`px-1.5 py-0.5 rounded text-sm ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                      {children}
                    </code>
                  ),
                  hr: () => <hr className={`my-6 ${theme.border}`} />,
                }}
              >
                {value}
              </ReactMarkdown>
            ) : (
              <p className={theme.textMuted}>Nothing to preview</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
