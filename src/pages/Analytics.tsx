import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Download,
  Eye,
  Home,
  Phone,
  Radio,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { useAnalytics } from '../hooks/useAnalytics';
import { AnalyticsFilters } from '../types/analytics';
import KPICard from '../components/Analytics/KPICard';
import EvolutionChart from '../components/Analytics/EvolutionChart';
import DonutChart from '../components/Analytics/DonutChart';
import ActivityTimeline from '../components/Analytics/ActivityTimeline';
import CityAutocomplete from '../components/Analytics/CityAutocomplete';
import { gsap } from '../lib/animations';

const periodOptions = [
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
  { value: 'custom', label: 'Personnalisé' },
];

const Analytics: React.FC = () => {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: '7',
    city: undefined,
    startDate: undefined,
    endDate: undefined,
  });

  const {
    kpis,
    evolution,
    propertyTypesPro,
    propertyTypesParticulier,
    statusDistribution,
    recentActivity,
    loading,
    error,
    exportData,
  } = useAnalytics(filters);

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
          const distance = context.conditions?.desktop ? 30 : 16;

          if (reduce) {
            gsap.set('[data-analytics-intro], [data-analytics-kpi], [data-analytics-panel]', {
              autoAlpha: 1,
              y: 0,
              scale: 1,
            });
            return;
          }

          const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
          tl.fromTo(
            '[data-analytics-intro]',
            { autoAlpha: 0, y: distance },
            { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.06 }
          )
            .fromTo(
              '[data-analytics-kpi]',
              { autoAlpha: 0, y: 20, scale: 0.97 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.48, stagger: 0.07 },
              '-=0.28'
            )
            .fromTo(
              '[data-analytics-panel]',
              { autoAlpha: 0, y: 24, scale: 0.985 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08 },
              '-=0.18'
            );
        }
      );

      return () => mm.revert();
    },
    {
      scope: pageRef,
      dependencies: [filters.period, filters.city, filters.startDate, filters.endDate, loading],
      revertOnUpdate: true,
    }
  );

  const handlePeriodChange = (period: string) => {
    if (period === 'custom') {
      setFilters((prev) => ({ ...prev, period: 'custom' }));
      return;
    }

    setFilters((prev) => ({
      ...prev,
      period,
      startDate: undefined,
      endDate: undefined,
    }));
  };

  const handleCityChange = (city: string | undefined) => {
    setFilters((prev) => ({ ...prev, city }));
  };

  const handleExport = async () => {
    try {
      await exportData();
    } catch (exportError) {
      console.error("Erreur lors de l'export:", exportError);
    }
  };

  const periodLabel = useMemo(() => {
    if (filters.period === 'custom') {
      if (filters.startDate && filters.endDate) {
        return `Du ${filters.startDate} au ${filters.endDate}`;
      }
      return 'Période personnalisée';
    }
    return `${filters.period} derniers jours`;
  }, [filters]);

  const totalEvolution = useMemo(
    () =>
      evolution.reduce(
        (acc, item) => ({
          particuliers: acc.particuliers + (item.annoncesParticulier || 0),
          pros: acc.pros + (item.annoncesPro || 0),
          appels: acc.appels + item.appels,
        }),
        { particuliers: 0, pros: 0, appels: 0 }
      ),
    [evolution]
  );

  return (
    <div ref={pageRef} className="space-y-6">
      <section
        data-analytics-intro
        className="relative overflow-hidden rounded-[2rem] border border-primary-100 bg-gradient-to-br from-white via-orange-50 to-blue-50 p-6 text-secondary-950 shadow-2xl shadow-secondary-900/10 ring-1 ring-white/80 lg:p-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,183,77,0.22),transparent_34%),radial-gradient(circle_at_82%_8%,rgba(29,78,216,0.14),transparent_34%)]" />
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-blue-200/50 bg-white/45 blur-sm" />

        <div className="relative z-10 grid gap-6 xl:grid-cols-[1fr_440px] xl:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white/85 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Cockpit business
            </div>
            <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Analytics GetFlaire pour piloter la performance commerciale.
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-secondary-600 sm:text-base">
              Suivez le volume d'annonces, les appels, la conversion, les relances et la surveillance depuis une vue plus claire et décisionnelle.
            </p>
          </div>

          <div className="rounded-3xl border border-white bg-white/85 p-4 shadow-xl shadow-secondary-900/10 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Lecture active</p>
            <p className="mt-2 text-2xl font-black text-secondary-950">{periodLabel}</p>
            <p className="mt-2 text-sm font-semibold text-secondary-600">
              {filters.city ? `Ville filtrée : ${filters.city}` : 'Toutes les villes'} · données commerciales en temps réel
            </p>
          </div>
        </div>
      </section>

      <section data-analytics-intro className="rounded-3xl border border-white bg-white p-4 shadow-sm ring-1 ring-secondary-100 lg:p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto] xl:items-center">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Filtres</p>
            <CityAutocomplete value={filters.city || ''} onChange={handleCityChange} placeholder="Filtrer par ville..." />
          </div>

          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Période</p>
            <div className="flex flex-wrap gap-2">
              {periodOptions.map((option) => {
                const selected = filters.period === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handlePeriodChange(option.value)}
                    className={`rounded-2xl px-3 py-3 text-sm font-black ring-1 transition ${
                      selected
                        ? 'bg-secondary-950 text-white ring-secondary-950'
                        : 'bg-secondary-50 text-secondary-700 ring-secondary-100 hover:bg-secondary-100'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-primary-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-700 xl:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {filters.period === 'custom' && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-secondary-100 bg-secondary-50/70 p-3 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Début</span>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
                className="w-full rounded-2xl border border-secondary-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Fin</span>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
                className="w-full rounded-2xl border border-secondary-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
              />
            </label>
          </div>
        )}
      </section>

      {error && (
        <div data-analytics-panel className="rounded-2xl border border-error-200 bg-error-50 p-4 text-sm font-semibold text-error-700">
          Erreur : {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: 'Annonces particulier',
            value: kpis.totalAnnonces,
            variation: kpis.totalAnnoncesVariation,
            icon: Home,
            color: 'primary' as const,
            description: 'Stock particulier actif',
          },
          {
            title: 'Appels passés',
            value: kpis.appelsPasses,
            variation: kpis.appelsPassesVariation,
            icon: Phone,
            color: 'success' as const,
            description: 'Actions commerciales',
          },
          {
            title: 'Conversion',
            value: kpis.conversionRate || 0,
            variation: kpis.conversionRateVariation,
            icon: Target,
            color: 'warning' as const,
            suffix: '%',
            description: 'Appels / annonces',
          },
          {
            title: 'Surveillances',
            value: kpis.surveillancesActives,
            variation: kpis.surveillancesActivesVariation,
            icon: Eye,
            color: 'secondary' as const,
            description: 'Biens sous suivi',
          },
        ].map((item) => (
          <div key={item.title} data-analytics-kpi>
            <KPICard {...item} loading={loading} />
          </div>
        ))}
      </div>

      <section data-analytics-panel className="overflow-hidden rounded-[2rem] border border-white bg-white shadow-sm ring-1 ring-secondary-100">
        <div className="border-b border-secondary-100 bg-gradient-to-r from-white via-primary-50/40 to-white p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Évolution</p>
              <h2 className="mt-1 text-2xl font-black text-secondary-950">Annonces et appels dans le temps</h2>
              <p className="mt-2 max-w-2xl text-sm font-medium text-secondary-500">
                Les courbes restent interactives : cliquez sur une légende pour isoler un signal.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-secondary-100">
                <p className="text-lg font-black text-primary-700">{totalEvolution.particuliers}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary-400">Part.</p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-secondary-100">
                <p className="text-lg font-black text-blue-700">{totalEvolution.pros}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary-400">Pro</p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-secondary-100">
                <p className="text-lg font-black text-emerald-700">{totalEvolution.appels}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary-400">Appels</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-3 lg:p-5">
          <EvolutionChart data={evolution} loading={loading} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div data-analytics-kpi>
          <KPICard
            title="Rappels à faire"
            value={kpis.rappelsAFaire}
            variation={kpis.rappelsAFaireVariation}
            icon={Calendar}
            color="danger"
            loading={loading}
            description="Relances ouvertes"
          />
        </div>
        <div data-analytics-kpi>
          <KPICard
            title="À traiter"
            value={kpis.toProcessReminders}
            variation={kpis.toProcessRemindersVariation}
            icon={Radio}
            color="warning"
            loading={loading}
            description="Actions non traitées"
          />
        </div>
        <div data-analytics-kpi>
          <KPICard
            title="Annonces pro"
            value={kpis.totalAnnoncesPro}
            variation={kpis.totalAnnoncesProVariation}
            icon={BarChart3}
            color="secondary"
            loading={loading}
            description="Volume professionnel"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section data-analytics-panel className="rounded-[2rem] border border-white bg-white p-5 shadow-sm ring-1 ring-secondary-100">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Typologie</p>
              <h2 className="text-lg font-black text-secondary-950">Professionnels</h2>
            </div>
            <Activity className="h-5 w-5 text-primary-500" />
          </div>
          <DonutChart data={propertyTypesPro} loading={loading} />
        </section>

        <section data-analytics-panel className="rounded-[2rem] border border-white bg-white p-5 shadow-sm ring-1 ring-secondary-100">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Typologie</p>
              <h2 className="text-lg font-black text-secondary-950">Particuliers</h2>
            </div>
            <TrendingUp className="h-5 w-5 text-primary-500" />
          </div>
          <DonutChart data={propertyTypesParticulier} loading={loading} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section data-analytics-panel className="rounded-[2rem] border border-white bg-white p-5 shadow-sm ring-1 ring-secondary-100 xl:col-span-2">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Activité</p>
            <h2 className="text-lg font-black text-secondary-950">Derniers signaux commerciaux</h2>
          </div>
          <ActivityTimeline activities={recentActivity} loading={loading} />
        </section>

        <section data-analytics-panel className="rounded-[2rem] border border-white bg-white p-5 shadow-sm ring-1 ring-secondary-100">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Répartition</p>
            <h2 className="text-lg font-black text-secondary-950">Statuts des annonces</h2>
          </div>
          <DonutChart data={statusDistribution} loading={loading} />
        </section>
      </div>
    </div>
  );
};

export default Analytics;
