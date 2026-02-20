import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { Tag, WikiLink } from "../extensions";

interface EditorProps {
  content: string;
  onSave: (content: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onLinkClick?: (target: string) => void;
  onTagClick?: (tag: string) => void;
  className?: string;
  placeholder?: string;
  autoSaveDelay?: number;
}

export function Editor({
  content,
  onSave,
  onDirtyChange,
  onLinkClick,
  onTagClick,
  className,
  placeholder = "Write something...",
  autoSaveDelay = 3000,
}: EditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const debouncedContent = useDebounce(localContent, autoSaveDelay);
  const isInitialMount = useRef(true);
  const lastSavedContent = useRef(content);
  const lastDirtyState = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      WikiLink.configure({
        onLinkClick: (target) => onLinkClick?.(target),
        HTMLAttributes: {
          class:
            "text-primary underline decoration-primary/50 cursor-pointer hover:decoration-primary",
        },
      }),
      Tag.configure({
        onTagClick: (tag) => onTagClick?.(tag),
        HTMLAttributes: {
          class:
            "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50",
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "focus:outline-none",
          "min-h-[calc(100vh-8rem)]",
          "px-8 py-6"
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setLocalContent(html);
    },
  });

  // Note: 노트 전환은 key={activeNote.path}로 컴포넌트가 리마운트되어 처리됨
  // content prop 변경 시 sync하지 않음 (saveNote 후 롤백 방지)

  // Notify parent when dirty state changes
  useEffect(() => {
    const isDirty = localContent !== lastSavedContent.current;
    if (isDirty !== lastDirtyState.current) {
      lastDirtyState.current = isDirty;
      onDirtyChange?.(isDirty);
    }
  }, [localContent, onDirtyChange]);

  // Auto-save after debounce delay
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (debouncedContent !== lastSavedContent.current) {
      onSave(debouncedContent);
      lastSavedContent.current = debouncedContent;
      lastDirtyState.current = false;
      onDirtyChange?.(false);
    }
  }, [debouncedContent, onSave, onDirtyChange]);

  // Manual save with Cmd/Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (editor) {
          const currentContent = editor.getHTML();
          if (currentContent !== lastSavedContent.current) {
            onSave(currentContent);
            lastSavedContent.current = currentContent;
            lastDirtyState.current = false;
            onDirtyChange?.(false);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, onSave, onDirtyChange]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <EditorContent editor={editor} className="flex-1 overflow-auto" />
    </div>
  );
}
