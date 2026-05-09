import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Phone,
  RefreshCw,
  Sparkles,
  Target,
  TimerReset,
} from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { useReminders } from '../hooks/useReminders';
import { ReminderFilters, ProcessedReminder, ReminderFromSuivi } from '../types/reminder';
import ReminderFiltersComponent from '../components/Reminders/ReminderFilters';
import ReminderCard from '../components/Reminders/ReminderCard';
import ReminderEditModal from '../components/Reminders/ReminderEditModal';
import SurfacePanel from '../components/UI/SurfacePanel';
import EmptyState from '../components/UI/EmptyState';
import LoadingSkeleton from '../components/UI/LoadingSkeleton';
import { gsap } from '../lib/animations';

const reminderTypeLabels: Record<ProcessedReminder['type'], string> = {
  to_process: 'À traiter',
  to_call: 'À rappeler',
  called: 'Appelé',
  rdv: 'RDV',
};

const Reminders: React.FC = () => {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<ReminderFilters>({});
  const [selectedReminder, setSelectedReminder] = useState<ProcessedReminder | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const {
    reminders,
    loading,
    error,
    updateReminder,
    deleteReminder,
    markAsCompleted,
    fetchReminders,
  } = useReminders(filters);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          desktop: '(min-width: 1024px)',
        },
        (context) => {
          const reduce = context.conditions?.reduce;
          const distance = context.conditions?.desktop ? 28 : 16;

          if (reduce) {
            gsap.set('[data-reminders-intro], [data-reminders-kpi], [data-reminders-panel], [data-reminders-card]', {
              autoAlpha: 1,
              y: 0,
              scale: 1,
            });
            return;
          }

          const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
          tl.fromTo(
            '[data-reminders-intro]',
            { autoAlpha: 0, y: distance },
            { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.06 }
          )
            .fromTo(
              '[data-reminders-kpi]',
              { autoAlpha: 0, y: 18, scale: 0.97 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.46, stagger: 0.07 },
              '-=0.28'
            )
            .fromTo(
              '[data-reminders-panel]',
              { autoAlpha: 0, y: 20 },
              { autoAlpha: 1, y: 0, duration: 0.48, stagger: 0.08 },
              '-=0.18'
            )
            .fromTo(
              '[data-reminders-card]',
              { autoAlpha: 0, y: 22, scale: 0.98 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, stagger: { each: 0.055, from: 'start' } },
              '-=0.16'
            );
        }
      );

      return () => mm.revert();
    },
    {
      scope: pageRef,
      dependencies: [loading, reminders.length, filters.type, filters.status, filters.period],
      revertOnUpdate: true,
    }
  );

  const handleClearFilters = () => setFilters({});

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

  const stats = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const thisWeekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return {
      total: reminders.length,
      pending: reminders.filter((reminder) => reminder.status === 'pending').length,
      overdue: reminders.filter((reminder) => reminder.status === 'overdue').length,
      completed: reminders.filter((reminder) => reminder.status === 'completed').length,
      today: reminders.filter((reminder) => {
        const date = new Date(reminder.scheduled_date);
        return reminder.status !== 'completed' && date <= todayEnd;
      }).length,
      week: reminders.filter((reminder) => {
        const date = new Date(reminder.scheduled_date);
        return reminder.status !== 'completed' && date <= thisWeekEnd;
      }).length,
    };
  }, [reminders]);

  const pipelineCounts = useMemo(
    () =>
      reminders.reduce<Record<ProcessedReminder['type'], number>>(
        (acc, reminder) => {
          acc[reminder.type] += 1;
          return acc;
        },
        { to_process: 0, to_call: 0, called: 0, rdv: 0 }
      ),
    [reminders]
  );

  const activeFiltersCount = Object.values(filters).filter((value) => value !== undefined && value !== '').length;

  const nextReminder = reminders
    .filter((reminder) => reminder.status !== 'completed')
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0];

  return (
    <div ref={pageRef} className="space-y-6">
      <section
        data-reminders-intro
        className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-secondary-950 p-6 text-white shadow-2xl shadow-secondary-900/15 lg:p-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,183,77,0.30),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(95,130,255,0.20),transparent_32%)]" />
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/5 blur-sm" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary-100">
              <Sparkles className="h-3.5 w-3.5" />
              Pipeline de suivi
            </div>
            <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Rappels commerciaux, priorisés pour votre prochaine action.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-secondary-200 sm:text-base">
              Suivez les relances, RDV et annonces à traiter dans une timeline claire, avec les retards et actions du jour visibles immédiatement.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary-300">Prochaine action</p>
            {nextReminder ? (
              <>
                <p className="mt-2 line-clamp-2 text-lg font-black text-white">{nextReminder.annonce_title}</p>
                <p className="mt-2 text-sm font-medium text-secondary-200">
                  {reminderTypeLabels[nextReminder.type]} · {new Intl.DateTimeFormat('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(nextReminder.scheduled_date))}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm font-semibold text-secondary-200">Aucune action ouverte pour le moment.</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'À faire', value: stats.pending, icon: Clock, tone: 'from-primary-500 to-orange-500' },
          { label: "Aujourd'hui", value: stats.today, icon: TimerReset, tone: 'from-amber-500 to-primary-500' },
          { label: 'En retard', value: stats.overdue, icon: AlertCircle, tone: 'from-red-500 to-orange-500' },
          { label: 'Terminés', value: stats.completed, icon: CheckCircle, tone: 'from-emerald-500 to-teal-600' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              data-reminders-kpi
              className="overflow-hidden rounded-3xl border border-white bg-white p-5 shadow-sm ring-1 ring-secondary-100 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary-500">{metric.label}</p>
                  <p className="mt-3 text-3xl font-black text-secondary-950">{metric.value}</p>
                </div>
                <div className={`rounded-2xl bg-gradient-to-br ${metric.tone} p-3 text-white shadow-lg`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SurfacePanel data-reminders-panel className="overflow-hidden p-0">
        <div className="border-b border-secondary-100 bg-white/80 p-5 backdrop-blur lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary-500">Pilotage</p>
              <h2 className="text-xl font-black text-secondary-950">Pipeline de relance</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-secondary-50 px-3 py-2 text-xs font-semibold text-secondary-600">
                {reminders.length} rappel{reminders.length > 1 ? 's' : ''}
                {activeFiltersCount > 0 ? ` · ${activeFiltersCount} filtre${activeFiltersCount > 1 ? 's' : ''}` : ''}
              </div>
              <button
                type="button"
                onClick={fetchReminders}
                disabled={loading}
                className="inline-flex items-center rounded-2xl border border-secondary-200 bg-white px-4 py-2.5 text-sm font-bold text-secondary-700 shadow-sm transition hover:border-primary-200 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualiser
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { type: 'to_process' as const, icon: Target },
              { type: 'to_call' as const, icon: Phone },
              { type: 'called' as const, icon: CheckCircle },
              { type: 'rdv' as const, icon: Calendar },
            ].map((item) => {
              const Icon = item.icon;
              const selected = filters.type === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setFilters({ ...filters, type: selected ? undefined : item.type })}
                  className={`rounded-3xl border p-4 text-left transition ${
                    selected
                      ? 'border-secondary-950 bg-secondary-950 text-white shadow-xl shadow-secondary-900/15'
                      : 'border-secondary-100 bg-secondary-50/80 text-secondary-700 hover:border-primary-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-2xl p-2.5 ${selected ? 'bg-white/10 text-white' : 'bg-white text-primary-600'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={`text-2xl font-black ${selected ? 'text-white' : 'text-secondary-950'}`}>
                      {pipelineCounts[item.type]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-black">{reminderTypeLabels[item.type]}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 bg-gradient-to-b from-white to-secondary-50/70 p-5 lg:p-6">
          <ReminderFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={handleClearFilters}
          />

          {error && (
            <div data-reminders-panel className="rounded-2xl border border-error-200 bg-error-50 p-4 text-sm font-semibold text-error-700">
              Erreur : {error}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary-500">Timeline</p>
              <h2 className="text-xl font-black text-secondary-950">Actions à suivre</h2>
            </div>
            <p className="text-sm font-medium text-secondary-600">
              {stats.week} action{stats.week > 1 ? 's' : ''} ouverte{stats.week > 1 ? 's' : ''} dans les 7 jours
            </p>
          </div>

          {loading ? (
            <LoadingSkeleton itemClassName="h-80 rounded-3xl" />
          ) : reminders.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-2 hidden h-full w-px bg-gradient-to-b from-primary-300 via-secondary-200 to-transparent lg:block" />
              <div className="space-y-4 lg:pl-10">
                {reminders.map((reminder) => (
                  <div key={reminder.id} data-reminders-card className="relative">
                    <span className="absolute -left-[2.08rem] top-8 hidden h-3 w-3 rounded-full border-2 border-white bg-primary-500 shadow-lg shadow-primary-500/30 lg:block" />
                    <ReminderCard
                      reminder={reminder}
                      onEdit={handleEditReminder}
                      onDelete={deleteReminder}
                      onMarkCompleted={markAsCompleted}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
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
                    type="button"
                    onClick={handleClearFilters}
                    className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-500/20 hover:bg-primary-700"
                  >
                    Effacer les filtres
                  </button>
                ) : null
              }
            />
          )}
        </div>
      </SurfacePanel>

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
