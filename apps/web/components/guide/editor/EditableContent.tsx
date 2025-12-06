'use client';

import { useState, useEffect } from 'react';
import { Edit3, Save, X, Loader2 } from 'lucide-react';
import { MarkdownEditor } from './MarkdownEditor';
import { Theme } from '@/lib/guide/theme';
import ReactMarkdown from 'react-markdown';

interface EditableContentProps {
  content: string;
  onSave: (content: string) => Promise<boolean>;
  canEdit: boolean;
  theme: Theme;
  darkMode: boolean;
  title?: string;
  placeholder?: string;
}

export function EditableContent({
  content,
  onSave,
  canEdit,
  theme,
  darkMode,
  title,
  placeholder = 'Add content...',
}: EditableContentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync with prop changes
  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const success = await onSave(editedContent);
      if (success) {
        setIsEditing(false);
      } else {
        setError('Failed to save. Please try again.');
      }
    } catch (err) {
      setError('An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditing(false);
    setError(null);
  };

  if (isEditing) {
    return (
      <div className={`${theme.card} border rounded-lg overflow-hidden`}>
        {title && (
          <div className={`flex items-center justify-between p-4 border-b ${theme.border}`}>
            <h3 className="font-semibold">{title}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${theme.button} disabled:opacity-50`}
              >
                <X size={16} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${theme.buttonPrimary} disabled:opacity-50`}
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save
              </button>
            </div>
          </div>
        )}
        <div className="p-4">
          <MarkdownEditor
            value={editedContent}
            onChange={setEditedContent}
            theme={theme}
            darkMode={darkMode}
            placeholder={placeholder}
          />
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${theme.card} border rounded-lg`}>
      {(title || canEdit) && (
        <div className={`flex items-center justify-between p-4 border-b ${theme.border}`}>
          {title && <h3 className="font-semibold">{title}</h3>}
          {canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${theme.button}`}
            >
              <Edit3 size={16} />
              Edit
            </button>
          )}
        </div>
      )}
      <div className="p-6">
        {content ? (
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold mb-3 mt-8 first:mt-0 pb-2 border-b border-zinc-800">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-medium mt-6 mb-2">{children}</h3>
              ),
              p: ({ children }) => (
                <p className={`mb-4 ${theme.textMuted} leading-relaxed`}>{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside mb-4 space-y-2 ml-2">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside mb-4 space-y-2 ml-2">{children}</ol>
              ),
              li: ({ children }) => <li className={theme.textMuted}>{children}</li>,
              strong: ({ children }) => <strong className={theme.text}>{children}</strong>,
              em: ({ children }) => <em className="text-emerald-400">{children}</em>,
              blockquote: ({ children }) => (
                <blockquote className={`border-l-4 border-emerald-500 pl-4 my-4 ${theme.textMuted} italic`}>
                  {children}
                </blockquote>
              ),
              hr: () => <hr className={`my-8 ${theme.border}`} />,
              code: ({ children }) => (
                <code className={`px-1.5 py-0.5 rounded text-sm ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                  {children}
                </code>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <p className={theme.textMuted}>
            {canEdit ? 'No content yet. Click Edit to add content.' : 'No content available.'}
          </p>
        )}
      </div>
    </div>
  );
}
