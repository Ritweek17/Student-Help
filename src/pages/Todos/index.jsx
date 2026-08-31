import React, { useState, useEffect } from 'react';
import { Plus, CheckSquare, Calendar, Filter } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';
import { TodoItemRow } from '../../components/cards/TodoItemRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchTodos, fetchGoals, fetchOpportunities } from '../../services/mockApi';

export function TodosPage() {
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState([]);
  const [goals, setGoals] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [activeTab, setActiveTab] = useState('Today');
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Add todo state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('High');
  const [category, setCategory] = useState('Learning');
  const [dueDate, setDueDate] = useState('2026-08-31');
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedOppId, setSelectedOppId] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [todoData, goalData, oppData] = await Promise.all([
          fetchTodos(),
          fetchGoals(),
          fetchOpportunities()
        ]);
        setTodos(todoData);
        setGoals(goalData);
        setOpportunities(oppData);
      } catch (err) {
        console.error('Error fetching todos:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleToggleComplete = (id) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t))
    );
  };

  const handleDeleteTodo = (id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCreateTodo = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTodo = {
      id: `todo-${Date.now()}`,
      title,
      description,
      priority,
      category,
      dueDate,
      status: 'pending',
      relatedGoalId: selectedGoalId || null,
      relatedOpportunityId: selectedOppId || null
    };

    setTodos([newTodo, ...todos]);
    setTitle('');
    setDescription('');
    setAddModalOpen(false);
  };

  const tabs = [
    { id: 'Today', label: 'Today', count: todos.filter((t) => t.dueDate === '2026-08-31' && t.status !== 'completed').length },
    { id: 'Upcoming', label: 'Upcoming', count: todos.filter((t) => t.dueDate > '2026-08-31' && t.status !== 'completed').length },
    { id: 'Completed', label: 'Completed', count: todos.filter((t) => t.status === 'completed').length },
    { id: 'All', label: 'All Todos', count: todos.length }
  ];

  const filteredTodos = todos.filter((todo) => {
    if (activeTab === 'Today') return todo.dueDate === '2026-08-31' && todo.status !== 'completed';
    if (activeTab === 'Upcoming') return todo.dueDate > '2026-08-31' && todo.status !== 'completed';
    if (activeTab === 'Completed') return todo.status === 'completed';
    return true;
  });

  if (loading) {
    return <LoadingState text="Loading Todo Manager..." />;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Todo List"
        subtitle="Manage daily action items linked to your career goals and opportunity deadlines."
        action={
          <Button icon={Plus} onClick={() => setAddModalOpen(true)}>
            Add Todo
          </Button>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {filteredTodos.length > 0 ? (
        <div className="space-y-2.5">
          {filteredTodos.map((todo) => (
            <TodoItemRow
              key={todo.id}
              todo={todo}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTodo}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CheckSquare}
          title="No todos in this view"
          description="You are all caught up! Create a new todo to track your daily progress."
          actionLabel="Add New Todo"
          onAction={() => setAddModalOpen(true)}
        />
      )}

      {/* Add Todo Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Create New Todo"
        subtitle="Add a task with optional links to career goals or opportunities."
      >
        <form onSubmit={handleCreateTodo} className="space-y-4">
          <Input
            label="Todo Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Master React 19 useEffect Hook"
            required
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add context, links, or notes..."
          />

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Priority"
              options={['High', 'Medium', 'Low']}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
            <Select
              label="Category"
              options={['Learning', 'Application', 'DSA', 'Backend', 'Hackathon', 'General']}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Link to Career Goal (Optional)"
              options={[
                { value: '', label: 'None' },
                ...goals.map((g) => ({ value: g.id, label: g.title }))
              ]}
              value={selectedGoalId}
              onChange={(e) => setSelectedGoalId(e.target.value)}
            />

            <Select
              label="Link to Opportunity (Optional)"
              options={[
                { value: '', label: 'None' },
                ...opportunities.map((o) => ({ value: o.id, label: o.title }))
              ]}
              value={selectedOppId}
              onChange={(e) => setSelectedOppId(e.target.value)}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Todo</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
