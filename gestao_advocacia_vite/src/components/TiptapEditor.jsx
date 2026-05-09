/**
 * TiptapEditor — editor WYSIWYG para o conteúdo HTML dos modelos de documento.
 *
 * Resolve a decisão 3a do Epic #9 (#196): substitui o textarea simples por
 * editor com toolbar (negrito, itálico, headings, listas, alinhamento) que
 * gera HTML válido. Output é o mesmo formato consumido pelo backend Jinja2.
 *
 * Por que TipTap (e não TinyMCE/Quill):
 * - MIT (sem GPL nem proprietário)
 * - ~80KB minified (TinyMCE community = 2MB)
 * - API React-first, sem hacks de ref
 * - Permite escrever placeholders {{cliente.nome}} no plain text sem escape
 *
 * Limitações intencionais nesta v1:
 * - Sem inserção de imagens (não precisamos pra procurações/contratos)
 * - Sem tabelas (precisaria @tiptap/extension-table; adicionar quando preciso)
 */

import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const ToolbarButton = ({ onClick, ativo, children, title }) => (
  <button
    type="button"
    className={`btn btn-sm ${ativo ? 'btn-primary' : 'btn-outline-secondary'}`}
    onClick={onClick}
    title={title}
    style={{ padding: '2px 8px', fontSize: '0.78rem' }}
  >
    {children}
  </button>
)

export default function TiptapEditor({ value, onChange, ariaLabel = 'Editor de documento' }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content form-control',
        'aria-label': ariaLabel,
        style: 'min-height: 320px; font-family: Times New Roman, Times, serif; font-size: 11pt;',
        'data-testid': 'tiptap-editor',
      },
    },
  })

  // Sincroniza valor externo (ex: ao trocar de modelo) sem quebrar cursor
  // quando o user está digitando.
  useEffect(() => {
    if (!editor) return
    const atual = editor.getHTML()
    if (value !== undefined && value !== null && value !== atual) {
      editor.commands.setContent(value, false)
    }
  }, [editor, value])

  if (!editor) {
    return (
      <div className="form-control" style={{ minHeight: 320 }}>
        Carregando editor...
      </div>
    )
  }

  return (
    <div className="border rounded">
      {/* Toolbar */}
      <div
        className="d-flex flex-wrap gap-1 p-2 border-bottom bg-light"
        role="toolbar"
        aria-label="Formatação"
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          ativo={editor.isActive('bold')}
          title="Negrito (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          ativo={editor.isActive('italic')}
          title="Itálico (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          ativo={editor.isActive('strike')}
          title="Tachado"
        >
          <s>S</s>
        </ToolbarButton>
        <span className="border-start mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          ativo={editor.isActive('heading', { level: 2 })}
          title="Título"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          ativo={editor.isActive('heading', { level: 3 })}
          title="Subtítulo"
        >
          H3
        </ToolbarButton>
        <span className="border-start mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          ativo={editor.isActive('bulletList')}
          title="Lista com marcadores"
        >
          • Lista
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          ativo={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          1. Lista
        </ToolbarButton>
        <span className="border-start mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          ativo={editor.isActive('blockquote')}
          title="Citação"
        >
          ❝
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          ativo={false}
          title="Linha horizontal"
        >
          ―
        </ToolbarButton>
        <span className="border-start mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          ativo={false}
          title="Desfazer (Ctrl+Z)"
        >
          ↶
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          ativo={false}
          title="Refazer (Ctrl+Y)"
        >
          ↷
        </ToolbarButton>
      </div>

      {/* Área de edição */}
      <div className="p-3" style={{ background: '#fff' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
