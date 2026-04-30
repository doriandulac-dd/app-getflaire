import React, { useState } from 'react';
import { 
  Calendar, 
  AlertCircle,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { useReminders } from '../hooks/useReminders';
import { ReminderFilters, ProcessedReminder, ReminderFromSuivi } from '../types/reminder';
import ReminderFiltersComponent from '../components/Reminders/ReminderFilters';
import ReminderCard from '../components/Reminders/ReminderCard';
import ReminderEditModal from '../components/Reminders/ReminderEditModal';
import PageHeader from '../components/UI/PageHeader';
import MetricCard from '../components/UI/MetricCard';
import SurfacePanel from '../components/UI/SurfacePanel';
import EmptyState from '../components/UI/EmptyState';
import LoadingSkeleton from '../components/UI/LoadingSkeleton';
import { useGsapReveal } from '../hooks/useGsapReveal';

const Reminders: React.FC = () => {
  const [filters, setFilters] = useState<ReminderFilters>({});
  const [selectedReminder, setSelectedReminder] = useState<ProcessedReminder | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { 
    reminders, 
    loading, 
    error, 
    updateReminder, 
    deleteReminder, 
    markAsCompleted 
  } = useReminders(filters);
  const remindersRef = useGsapReveal<HTMLDivElement>([loading, reminders.length], {
    selector: '[data-gsap-reveal]',
    y: 16,
    stagger: 0.05,
  });

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleEditReminder = (reminder: ProcessedReminder) => {
    setSelectedReminder(reminder);
    setShowEditModal(true);
  };

  const handleSaveReminder = async (id: string, updates: Partial<ReminderFromSuivi>) => {
    const success = await updateReminder(id, updates);
    return success;
  };

  const handleCloseEditModal = () => {
    setSelectedReminder(null);
    setShowEditModal(false);
  };

  // Statistics
  const stats = {
    total: reminders.length,
    pending: reminders.filter(r => r.status === 'pending').length,
    overdue: reminders.filter(r => r.status === 'overdue').length,
    completed: reminders.filter(r => r.status === 'completed').length,
  };

  return (
    <div ref={remindersRef} className="space-y-6">
      {/* Page Header */}
      <PageHeader
        eyebrow="Relances"
        title="Rappels"
        description="Gérez les rappels, appels et rendez-vous liés aux annonces à traiter."
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total" value={stats.total} icon={Calendar} tone="primary" />
        <MetricCard title="À faire" value={stats.pending} icon={Clock} tone="warning" />
        <MetricCard title="En retard" value={stats.overdue} icon={AlertCircle} tone="danger" />
        <MetricCard title="Terminés" value={stats.completed} icon={CheckCircle} tone="success" />
      </div>

      {/* Filters */}
      <SurfacePanel className="p-6">
        <ReminderFiltersComponent
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={handleClearFilters}
        />
      </SurfacePanel>

      {/* Results count */}
      <SurfacePanel className="flex items-center justify-between p-4">
        <p className="text-sm text-secondary-600">
          {reminders.length} rappel{reminders.length > 1 ? 's' : ''} trouvé{reminders.length > 1 ? 's' : ''}
        </p>
      </SurfacePanel>

      {/* Error state */}
      {error && (
        <div className="bg-error-50 border border-error-200 rounded-xl p-4" data-gsap-reveal>
          <p className="text-error-700">Erreur : {error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <LoadingSkeleton />
      ) : reminders.length > 0 ? (
        /* Reminders grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-gsap-reveal>
          {reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onEdit={handleEditReminder}
              onDelete={deleteReminder}
              onMarkCompleted={markAsCompleted}
            />
          ))}
        </div>
      ) : (
        /* Empty state */
        <EmptyState
          icon={Calendar}
          title="Aucun rappel trouvé"
          description={
            Object.keys(filters).length > 0
              ? 'Essayez de modifier vos critères de recherche.'
              : 'Vos rappels créés depuis les annonces apparaîtront ici.'
          }
          action={
            Object.keys(filters).length > 0 ? (
            <button
              onClick={handleClearFilters}
              className="rounded-xl bg-primary-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-primary-700"
            >
              Effacer les filtres
            </button>
            ) : null
          }
        />
      )}

      {/* Edit Modal */}
      <ReminderEditModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        reminder={selectedReminder}
        onSave={handleSaveReminder}
      />
    </div>
  );
};

export default Reminders;
