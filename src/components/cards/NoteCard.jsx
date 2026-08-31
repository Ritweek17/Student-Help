import React from 'react';
import { Pin, Trash2, Calendar, Tag } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export function NoteCard({ note, onTogglePin, onDelete }) {
  return (
    <Card hoverEffect padding="md" className="flex flex-col justify-between h-full relative group">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="primary" size="sm">{note.category}</Badge>
          <button
            onClick={() => onTogglePin(note.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              note.isPinned
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
            title={note.isPinned ? 'Unpin Note' : 'Pin Note'}
          >
            <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-current' : ''}`} />
          </button>
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 font-heading">
          {note.title}
        </h3>

        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line line-clamp-4 leading-relaxed">
          {note.content}
        </p>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {note.tags.map((tag, idx) => (
              <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200/60 dark:border-slate-800">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
        <span>Updated {note.updatedDate || note.createdDate}</span>
        {onDelete && (
          <button
            onClick={() => onDelete(note.id)}
            className="text-slate-400 hover:text-rose-500 transition-colors p-1"
            title="Delete Note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </Card>
  );
}
