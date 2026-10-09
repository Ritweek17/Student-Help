import React, { useState, useEffect } from 'react';
import { Plus, Search, FileText, Pin, Filter } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { NoteCard } from '../../components/cards/NoteCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { getNotes, createNote, updateNote, deleteNote } from '../../services/noteApi';
import { useAuth } from '../../context/AuthContext';

export function NotesPage() {
  const { token, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [addModalOpen, setAddModalOpen] = useState(false);

  // New Note State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('React');
  const [content, setContent] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const categories = ['All', 'React', 'DSA', 'Backend', 'AI', 'Cloud', 'Career', 'Interview', 'General'];

  useEffect(() => {
    async function loadNotesData() {
      if (!token) return;
      try {
        const response = await getNotes({}, token);
        setNotes(response.notes || []);
      } catch (err) {
        console.error('Error fetching notes:', err);
        if (err.status === 401) logout();
      } finally {
        setLoading(false);
      }
    }
    loadNotesData();
  }, [token, logout]);

  const handleTogglePin = async (id) => {
    const note = notes.find((n) => n._id === id || n.id === id);
    if (!note) return;
    const realId = note._id || note.id;
    try {
      const newPin = !note.isPinned;
      setNotes((prev) =>
        prev.map((n) => ((n._id === id || n.id === id) ? { ...n, isPinned: newPin } : n))
      );
      await updateNote(realId, { isPinned: newPin }, token);
    } catch (err) {
      console.error('Error toggling pin:', err);
      if (err.status === 401) logout();
      setNotes((prev) =>
        prev.map((n) => ((n._id === id || n.id === id) ? { ...n, isPinned: note.isPinned } : n))
      );
    }
  };

  const handleDeleteNote = async (id) => {
    const note = notes.find((n) => n._id === id || n.id === id);
    if (!note) return;
    const realId = note._id || note.id;
    try {
      await deleteNote(realId, token);
      setNotes((prev) => prev.filter((n) => n._id !== id && n.id !== id));
    } catch (err) {
      console.error('Error deleting note:', err);
      if (err.status === 401) logout();
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);

    const newNotePayload = {
      title,
      category,
      content,
      tags,
      isPinned,
    };

    try {
      const response = await createNote(newNotePayload, token);
      setNotes([response.note, ...notes]);
      setTitle('');
      setContent('');
      setTagsStr('');
      setAddModalOpen(false);
    } catch (err) {
      console.error('Error creating note:', err);
      if (err.status === 401) logout();
    }
  };

  const filteredNotes = notes.filter((n) => {
    const matchesCategory = selectedCategory === 'All' || n.category === selectedCategory;
    const matchesSearch =
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned);
  const otherNotes = filteredNotes.filter((n) => !n.isPinned);

  if (loading) {
    return <LoadingState text="Loading Personal Notes Workspace..." />;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Personal Notes Workspace"
        subtitle="Keep code snippets, technical cheatsheets, interview preparation notes, and research."
        action={
          <Button icon={Plus} onClick={() => setAddModalOpen(true)}>
            New Note
          </Button>
        }
      />

      {/* Search & Category Filter */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:flex-1">
            <Input
              icon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes by title, content, or #tags..."
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-semibold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Pinned Notes Section */}
      {pinnedNotes.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
            <Pin className="w-3.5 h-3.5 fill-current" /> Pinned Notes ({pinnedNotes.length})
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinnedNotes.map((note) => (
              <NoteCard
                key={note._id || note.id}
                note={note}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Notes Section */}
      <div className="space-y-3">
        {pinnedNotes.length > 0 && (
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            All Notes ({otherNotes.length})
          </span>
        )}

        {otherNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherNotes.map((note) => (
              <NoteCard
                key={note._id || note.id}
                note={note}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        ) : (
          pinnedNotes.length === 0 && (
            <EmptyState
              icon={FileText}
              title="No notes found"
              description="Create a new note to store code snippets and study guides."
              actionLabel="Create Note"
              onAction={() => setAddModalOpen(true)}
            />
          )
        )}
      </div>

      {/* Add Note Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Create New Personal Note"
        subtitle="Notes live inside CareerOS and support code snippets and tags."
      >
        <form onSubmit={handleCreateNote} className="space-y-4">
          <Input
            label="Note Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. System Design Load Balancing Notes"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              options={['React', 'DSA', 'Backend', 'AI', 'Cloud', 'Career', 'Interview', 'General']}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <Input
              label="Tags (Comma separated)"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="e.g. React, Hooks, State"
            />
          </div>

          <Textarea
            label="Note Content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Write your note, code snippets, or key interview points..."
            required
          />

          <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <span>Pin note to top</span>
            </label>

            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Note</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
