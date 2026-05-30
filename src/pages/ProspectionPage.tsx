import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import {
  Bell,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Eye,
  Flame,
  MapPinned,
  Megaphone,
  Radar,
  RefreshCcw,
  Search,
  Target,
  Zap,
} from 'lucide-react';
import EmptyState from '../components/UI/EmptyState';
import { useAuth } from '../hooks/useAuth';
import {
  DPEFilters,
  DPERecord,
  DPESortOption,
  useDPEProspection,
} from '../hooks/useDPEProspection';
import { normalizeDepartmentCode } from '../utils/pigeScope';

type DPEMapPoint = DPERecord & {
  latitude: number;
  longitude: number;
};

type OpportunitySignal = {
  label: string;
  description: string;
  tone: 'red' | 'orange' | 'green' | 'slate';
};

type ScoredDPEPoint = DPEMapPoint & {
  opportunityScore: number;
  opportunitySignals: OpportunitySignal[];
};

const AUBE_CENTER: [number, number] = [48.2973, 4.0744];
const dpeLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const categoryOptions = ['logement', 'tertiaire', 'neuf', 'existant'];
const periodOptions = ['avant_2021', 'apres_2021'];

const sortOptions: Array<DPESortOption & { label: string }> = [
  { field: 'date_etablissement_dpe', direction: 'desc', label: 'Date récente' },
  { field: 'date_etablissement_dpe', direction: 'asc', label: 'Date ancienne' },
  { field: 'ville', direction: 'asc', label: 'Ville A-Z' },
  { field: 'ville', direction: 'desc', label: 'Ville Z-A' },
  { field: 'etiquette_dpe', direction: 'asc', label: 'DPE A-G' },
  { field: 'etiquette_dpe', direction: 'desc', label: 'DPE G-A' },
  { field: 'surface', direction: 'desc', label: 'Surface décroissante' },
  { field: 'surface', direction: 'asc', label: 'Surface croissante' },
];

const tabs = [
  { label: 'Vue opérationnelle', icon: Radar, active: false },
  { label: 'Carte', icon: MapPinned, active: true },
  { label: 'Liste', icon: ClipboardList, active: false },
  { label: 'Campagnes', icon: Megaphone, active: false },
  { label: 'Alertes', icon: Bell, active: false },
];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR').format(date);
};

const formatSurface = (value?: number | null) =>
  typeof value === 'number' ? `${Math.round(value)} m²` : '-';

const formatOptionLabel = (value: string) =>
  value
    .replace('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());

const getDateNDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const getDaysSince = (value?: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
};

const calculateOpportunity = (row: DPEMapPoint): { score: number; signals: OpportunitySignal[] } => {
  const dpe = (row.etiquette_dpe || '').toUpperCase();
  const surface = row.surface || 0;
  const heating = (row.energie_chauffage || '').toLowerCase();
  const category = (row.categorie_dpe || '').toLowerCase();
  const signals: OpportunitySignal[] = [];
  let score = 36;

  if (dpe === 'G') {
    score += 42;
    signals.push({ label: 'DPE G', description: 'Passoire énergétique prioritaire', tone: 'red' });
  } else if (dpe === 'F') {
    score += 38;
    signals.push({ label: 'DPE F', description: 'Passoire énergétique à traiter', tone: 'red' });
  } else if (dpe === 'E') {
    score += 26;
    signals.push({ label: 'DPE E', description: 'Performance énergétique fragile', tone: 'orange' });
  } else if (dpe === 'D') {
    score += 14;
  } else if (['A', 'B', 'C'].includes(dpe)) {
    score += 4;
  }

  if (getDaysSince(row.date_etablissement_dpe) <= 90) {
    score += 10;
    signals.push({ label: 'DPE récent', description: `Diagnostic réalisé le ${formatDate(row.date_etablissement_dpe)}`, tone: 'green' });
  }

  if (surface >= 120) {
    score += 8;
    signals.push({ label: 'Grande surface', description: `${formatSurface(row.surface)} à analyser`, tone: 'orange' });
  }

  if (heating.includes('élect') || heating.includes('elect')) {
    score += 7;
    signals.push({ label: 'Chauffage électrique', description: 'Énergie chauffage déclarée', tone: 'orange' });
  }

  if (category.includes('tertiaire')) {
    score += 7;
    signals.push({ label: 'Tertiaire', description: 'Catégorie DPE tertiaire', tone: 'slate' });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    signals,
  };
};

const getScoreColor = (score: number) => {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#fb923c';
  return '#ef4444';
};

const getEnergyBadgeClass = (label?: string | null) => {
  switch ((label || '').toUpperCase()) {
    case 'A':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'B':
      return 'bg-lime-100 text-lime-800 border-lime-200';
    case 'C':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'D':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'E':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'F':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'G':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const getSignalClasses = (tone: OpportunitySignal['tone']) => {
  if (tone === 'red') return 'bg-red-50 text-red-700 border-red-100';
  if (tone === 'orange') return 'bg-orange-50 text-orange-700 border-orange-100';
  if (tone === 'green') return 'bg-green-50 text-green-700 border-green-100';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const createScoreIcon = (score: number) => {
  const color = getScoreColor(score);

  return L.divIcon({
    className: 'prospection-score-marker',
    html: `
      <div style="
        align-items:center;
        background:white;
        border:3px solid ${color};
        border-radius:9999px;
        box-shadow:0 14px 34px rgba(15,23,42,0.26);
        color:#0f172a;
        display:flex;
        font-size:15px;
        font-weight:900;
        height:46px;
        justify-content:center;
        width:46px;
      ">${score}</div>
    `,
    iconAnchor: [23, 23],
    popupAnchor: [0, -24],
  });
};

const MapAutoFit: React.FC<{ points: ScoredDPEPoint[] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(AUBE_CENTER, 12);
      return;
    }

    const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude]));
    map.fitBounds(bounds, {
      maxZoom: 15,
      padding: [52, 52],
    });
  }, [map, points]);

  return null;
};

const MapZoomControls: React.FC = () => {
  const map = useMap();

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control mt-4 overflow-hidden rounded-2xl bg-white shadow-lg">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          className="block h-11 w-11 border-b border-gray-100 text-2xl font-light text-secondary-800 hover:bg-secondary-50"
          aria-label="Zoomer"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          className="block h-11 w-11 text-2xl font-light text-secondary-800 hover:bg-secondary-50"
          aria-label="Dézoomer"
        >
          -
        </button>
      </div>
    </div>
  );
};

const InfoCell: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-2xl border border-gray-100 bg-white px-3 py-3 text-center">
    <p className="text-xs font-semibold text-secondary-400">{label}</p>
    <p className="mt-1 text-sm font-bold text-secondary-900">{value || '-'}</p>
  </div>
);

const getEmptyMapDescription = (
  reason: ReturnType<typeof useDPEProspection>['diagnostic']['zeroResultReason']
) => {
  if (reason === 'no_coordinates') {
    return 'Des DPE sont visibles avec vos accès, mais aucun ne possède encore de latitude et longitude pour être affiché sur la carte.';
  }

  if (reason === 'no_visible_rows') {
    return 'Supabase ne renvoie aucun DPE pour vos départements et filtres actuels. Vérifiez la RLS, le format du département et les données de la table public.dpe.';
  }

  if (reason === 'department_out_of_scope') {
    return "Le département filtré n'est pas inclus dans vos accès GetFlaire.";
  }

  return 'Le fond de carte reste disponible, mais aucun diagnostic avec coordonnées ne correspond à cette recherche.';
};

const MapLoadingState: React.FC = () => (
  <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="flex h-[26rem] min-h-[420px] items-center justify-center bg-slate-100 md:h-[32rem] lg:h-[calc(100vh-13rem)] lg:min-h-[520px]">
      <div className="text-center">
        <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-primary-100 border-t-primary-500" />
        <p className="mt-4 text-sm font-bold text-secondary-600">Chargement de la carte...</p>
      </div>
    </div>
  </section>
);

const ProspectionPage: React.FC = () => {
  const { appUser } = useAuth();
  const [filters, setFilters] = useState<DPEFilters>({});
  const [sort, setSort] = useState<DPESortOption>({
    field: 'date_etablissement_dpe',
    direction: 'desc',
  });
  const [selectedDpe, setSelectedDpe] = useState<ScoredDPEPoint | null>(null);
  const [showZones, setShowZones] = useState(true);

  const authorizedDepartments = appUser?.departements_autorises || [];
  const {
    dpeRows,
    loading,
    error,
    hasMore,
    totalCount,
    scopedDepartments,
    selectedDepartmentOutOfScope,
    diagnostic,
    refresh,
    loadMore,
  } = useDPEProspection({
    filters,
    sort,
    authorizedDepartments,
    limit: 100,
    mapOnly: true,
  });

  const mapPoints = useMemo(
    () =>
      dpeRows
        .filter(
          (row): row is DPEMapPoint =>
            typeof row.latitude === 'number' && typeof row.longitude === 'number'
        )
        .map((row): ScoredDPEPoint => {
          const opportunity = calculateOpportunity(row);
          return {
            ...row,
            opportunityScore: opportunity.score,
            opportunitySignals: opportunity.signals,
          };
        }),
    [dpeRows]
  );

  useEffect(() => {
    setSelectedDpe((current) => {
      if (!current) return mapPoints[0] || null;
      return mapPoints.some((point) => point.id === current.id) ? current : mapPoints[0] || null;
    });
  }, [mapPoints]);

  const activeFiltersCount = useMemo(
    () =>
      Object.values(filters).filter((value) =>
        value !== undefined &&
        value !== '' &&
        (Array.isArray(value) ? value.length > 0 : true)
      ).length,
    [filters]
  );

  const updateFilter = <K extends keyof DPEFilters>(key: K, value: DPEFilters[K] | undefined) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value === '' ? undefined : value,
    }));
  };

  const toggleLabelFilter = (key: 'etiquette_dpe' | 'etiquette_ges', label: string) => {
    setFilters((previous) => {
      const current = previous[key] || [];
      const next = current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label];

      return {
        ...previous,
        [key]: next.length ? next : undefined,
      };
    });
  };

  const resetFilters = () => setFilters({});

  const quickFilters = [
    {
      label: 'Passoires F/G',
      icon: Flame,
      active: filters.etiquette_dpe?.includes('F') && filters.etiquette_dpe?.includes('G'),
      onClick: () => updateFilter('etiquette_dpe', ['F', 'G']),
    },
    {
      label: 'DPE récents',
      icon: CalendarClock,
      active: filters.date_min === getDateNDaysAgo(90),
      onClick: () => updateFilter('date_min', getDateNDaysAgo(90)),
    },
    {
      label: 'Chauffage électrique',
      icon: Zap,
      active: filters.energie_chauffage === 'Électricité',
      onClick: () => updateFilter('energie_chauffage', 'Électricité'),
    },
    {
      label: 'Tertiaire',
      icon: Building2,
      active: filters.categorie_dpe === 'tertiaire',
      onClick: () => updateFilter('categorie_dpe', 'tertiaire'),
    },
  ];

  const hasNoAuthorizedDepartments = Boolean(appUser) && scopedDepartments.length === 0;
  const selectedSortValue = `${sort.field}-${sort.direction}`;
  const emptyMapDescription = getEmptyMapDescription(diagnostic.zeroResultReason);

  return (
    <div className="-m-4 min-h-[calc(100vh-5.5rem)] bg-slate-50 lg:-m-6">
      <div className="border-b border-gray-200 bg-white px-4 py-4 shadow-sm lg:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-secondary-950">Prospection</h1>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
                <Zap className="h-3.5 w-3.5" />
                Nouvelle interface
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1 sm:gap-4">
              {tabs.map(({ label, icon: Icon, active }) => (
                <button
                  key={label}
                  type="button"
                  className={`inline-flex items-center gap-2 border-b-2 px-2 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-primary-500 text-secondary-950'
                      : 'border-transparent text-secondary-500 hover:text-secondary-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="relative block w-full xl:w-[28rem]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(event) => updateFilter('search', event.target.value || undefined)}
              placeholder="Rechercher une adresse, une ville..."
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
            />
          </label>
        </div>
      </div>

      <div className="prospection-cockpit-grid">
        <aside className="prospection-filters-panel rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <h2 className="text-xl font-black text-secondary-950">Filtres</h2>
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-bold text-primary-600 hover:text-primary-700"
            >
              Réinitialiser
            </button>
          </div>

          <div className="space-y-5 py-5">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Localisation</p>
              <label className="mb-3 block">
                <span className="mb-2 block text-sm font-medium text-secondary-500">Département</span>
                <select
                  value={normalizeDepartmentCode(filters.departement) || ''}
                  onChange={(event) => updateFilter('departement', event.target.value || undefined)}
                  className="h-12 w-full rounded-xl border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
                >
                  <option value="">Tous autorisés</option>
                  {scopedDepartments.map((department) => (
                    <option key={department} value={department}>
                      {department === '10' ? 'Aube (10)' : department}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-3 block">
                <span className="mb-2 block text-sm font-medium text-secondary-500">Commune</span>
                <input
                  type="text"
                  value={filters.ville || ''}
                  onChange={(event) => updateFilter('ville', event.target.value || undefined)}
                  placeholder="Troyes"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-secondary-500">Code postal</span>
                <input
                  type="text"
                  value={filters.code_postal || ''}
                  onChange={(event) => updateFilter('code_postal', event.target.value || undefined)}
                  placeholder="10000"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
                />
              </label>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Signaux</p>
              <div className="space-y-2">
                {quickFilters.map(({ label, icon: Icon, active, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1.5 text-left text-sm font-semibold text-secondary-700 transition hover:bg-primary-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-md ${active ? 'bg-primary-500 text-white' : 'bg-primary-100 text-primary-700'}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {label}
                    </span>
                    {active && <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">actif</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Étiquettes DPE</p>
              <div className="flex flex-wrap gap-2">
                {dpeLabels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleLabelFilter('etiquette_dpe', label)}
                    className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-black transition ${
                      filters.etiquette_dpe?.includes(label)
                        ? getEnergyBadgeClass(label)
                        : 'border-gray-200 bg-white text-secondary-600 hover:bg-primary-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Étiquettes GES</p>
              <div className="flex flex-wrap gap-2">
                {dpeLabels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleLabelFilter('etiquette_ges', label)}
                    className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-black transition ${
                      filters.etiquette_ges?.includes(label)
                        ? getEnergyBadgeClass(label)
                        : 'border-gray-200 bg-white text-secondary-600 hover:bg-primary-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Détails DPE</p>
              <div className="space-y-3">
                <select
                  value={filters.categorie_dpe || ''}
                  onChange={(event) => updateFilter('categorie_dpe', event.target.value || undefined)}
                  className="h-12 w-full rounded-xl border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
                >
                  <option value="">Toutes catégories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{formatOptionLabel(category)}</option>
                  ))}
                </select>
                <select
                  value={filters.periode_dpe || ''}
                  onChange={(event) => updateFilter('periode_dpe', event.target.value || undefined)}
                  className="h-12 w-full rounded-xl border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
                >
                  <option value="">Toutes périodes</option>
                  {periodOptions.map((period) => (
                    <option key={period} value={period}>{formatOptionLabel(period)}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={filters.energie_chauffage || ''}
                  onChange={(event) => updateFilter('energie_chauffage', event.target.value || undefined)}
                  placeholder="Énergie chauffage"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Score d'opportunité</p>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="h-2 rounded-full bg-gradient-to-r from-red-400 via-orange-400 to-green-400" />
                <div className="mt-2 flex justify-between text-xs font-semibold text-secondary-500">
                  <span>0</span>
                  <span>100</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Période et surface</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.date_min || ''}
                  onChange={(event) => updateFilter('date_min', event.target.value || undefined)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-2 text-xs shadow-sm focus:border-primary-400 focus:ring-primary-500"
                />
                <input
                  type="date"
                  value={filters.date_max || ''}
                  onChange={(event) => updateFilter('date_max', event.target.value || undefined)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-2 text-xs shadow-sm focus:border-primary-400 focus:ring-primary-500"
                />
                <input
                  type="number"
                  min="0"
                  value={filters.surface_min ?? ''}
                  onChange={(event) => updateFilter('surface_min', event.target.value ? Number(event.target.value) : undefined)}
                  placeholder="Min."
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
                />
                <input
                  type="number"
                  min="0"
                  value={filters.surface_max ?? ''}
                  onChange={(event) => updateFilter('surface_max', event.target.value ? Number(event.target.value) : undefined)}
                  placeholder="Max."
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 text-sm font-black text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-600 disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            Appliquer les filtres
          </button>

          <p className="mt-4 text-center text-sm font-bold text-primary-600">
            {mapPoints.length} point{mapPoints.length > 1 ? 's' : ''} chargé{mapPoints.length > 1 ? 's' : ''}
            {totalCount ? ` / ${totalCount}` : ''}
          </p>
        </aside>

        <main className="prospection-map-panel space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedSortValue}
                onChange={(event) => {
                  const [field, direction] = event.target.value.split('-');
                  setSort({
                    field: field as DPESortOption['field'],
                    direction: direction as DPESortOption['direction'],
                  });
                }}
                className="h-12 rounded-xl border-gray-200 bg-white px-4 text-sm font-semibold shadow-sm focus:border-primary-400 focus:ring-primary-500"
              >
                {sortOptions.map((option) => (
                  <option key={`${option.field}-${option.direction}`} value={`${option.field}-${option.direction}`}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value="all"
                disabled
                className="h-12 rounded-xl border-gray-200 bg-white px-4 text-sm font-semibold text-secondary-500 shadow-sm"
              >
                <option>Tous les DPE</option>
              </select>
              <button
                type="button"
                onClick={() => setShowZones((previous) => !previous)}
                className="inline-flex h-12 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-secondary-700 shadow-sm"
              >
                <span className={`h-5 w-9 rounded-full p-0.5 transition ${showZones ? 'bg-primary-500' : 'bg-gray-200'}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white transition ${showZones ? 'translate-x-4' : ''}`} />
                </span>
                Afficher les zones
                <ChevronDown className="h-4 w-4 text-secondary-400" />
              </button>
            </div>
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-bold text-primary-700">
                {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {selectedDepartmentOutOfScope && (
            <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900">
              Ce département n'est pas inclus dans vos accès GetFlaire.
            </div>
          )}

          {hasNoAuthorizedDepartments && !loading && !error && (
            <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900">
              Aucun département actif dans votre abonnement.
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Erreur Supabase lors du chargement des DPE : {error}
            </div>
          )}

          {loading && mapPoints.length === 0 ? (
            <MapLoadingState />
          ) : (
            !hasNoAuthorizedDepartments && !error && (
              <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="h-[26rem] min-h-[420px] overflow-hidden md:h-[32rem] lg:h-[calc(100vh-13rem)] lg:min-h-[520px]">
                  <MapContainer
                    center={AUBE_CENTER}
                    zoom={12}
                    scrollWheelZoom
                    zoomControl={false}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapAutoFit points={mapPoints} />
                    <MapZoomControls />
                    {showZones && mapPoints.map((point) => (
                      <Circle
                        key={`zone-${point.id}`}
                        center={[point.latitude, point.longitude]}
                        radius={650}
                        pathOptions={{
                          color: getScoreColor(point.opportunityScore),
                          fillColor: getScoreColor(point.opportunityScore),
                          fillOpacity: 0.11,
                          opacity: 0.16,
                          weight: 1,
                        }}
                      />
                    ))}
                    {mapPoints.map((point) => (
                      <Marker
                        key={point.id}
                        position={[point.latitude, point.longitude]}
                        icon={createScoreIcon(point.opportunityScore)}
                        eventHandlers={{
                          click: () => setSelectedDpe(point),
                        }}
                      >
                        <Popup>
                          <div className="min-w-64 space-y-3 p-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-secondary-950">
                                  {point.type_batiment || 'Bien'} - {formatSurface(point.surface)}
                                </p>
                                <p className="mt-1 text-sm text-secondary-500">
                                  {[point.adresse, point.code_postal, point.ville].filter(Boolean).join(', ') || '-'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedDpe(point)}
                                className="rounded-lg p-1 text-secondary-400 hover:bg-secondary-50"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-secondary-400">Score d'opportunité</p>
                              <p className="text-3xl font-black text-green-600">
                                {point.opportunityScore}<span className="text-base font-bold text-green-500">/100</span>
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`rounded-full border px-2 py-1 text-xs font-bold ${getEnergyBadgeClass(point.etiquette_dpe)}`}>
                                DPE {point.etiquette_dpe || '-'}
                              </span>
                              <span className={`rounded-full border px-2 py-1 text-xs font-bold ${getEnergyBadgeClass(point.etiquette_ges)}`}>
                                GES {point.etiquette_ges || '-'}
                              </span>
                              {point.energie_chauffage && (
                                <span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700">
                                  {point.energie_chauffage}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedDpe(point)}
                              className="h-10 w-full rounded-xl bg-primary-500 text-sm font-black text-white hover:bg-primary-600"
                            >
                              Voir le détail
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>

                {mapPoints.length === 0 && !loading && (
                  <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/78 p-6 backdrop-blur-[2px]">
                    <EmptyState
                      icon={MapPinned}
                      title="Aucun DPE géocodé visible pour vos accès actuels."
                      description={emptyMapDescription}
                      action={
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="inline-flex items-center gap-2 rounded-xl bg-secondary-900 px-5 py-3 text-sm font-black text-white transition hover:bg-secondary-800"
                        >
                          Réinitialiser les filtres
                        </button>
                      }
                      className="border-0 bg-transparent"
                    />
                  </div>
                )}

                <div className="absolute bottom-4 left-4 z-[450] rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-secondary-600">
                    <span className="font-black text-secondary-900">Score d'opportunité</span>
                    <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-red-500" />0-39</span>
                    <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-orange-400" />40-59</span>
                    <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />60-79</span>
                    <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-green-500" />80-100</span>
                  </div>
                </div>

              </section>
            )
          )}

          {hasMore && !loading && mapPoints.length > 0 && (
            <div className="text-center">
              <button
                type="button"
                onClick={loadMore}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-3 font-black text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-600"
              >
                Charger plus de points
              </button>
            </div>
          )}
        </main>

        <aside className="prospection-detail-panel rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-secondary-950">Détail du bien</h2>
            <button
              type="button"
              onClick={() => setSelectedDpe(null)}
              className="rounded-xl p-2 text-secondary-400 hover:bg-secondary-50 hover:text-secondary-700"
            >
              ×
            </button>
          </div>

          {selectedDpe ? (
            <div className="space-y-5">
              <div className="relative overflow-hidden rounded-2xl bg-secondary-900 p-5 text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,178,63,0.32),transparent_13rem)]" />
                <div className="relative">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-200">Diagnostic énergétique</p>
                  <div className="mt-7 flex items-end justify-between">
                    <div>
                      <p className="text-5xl font-black">{selectedDpe.etiquette_dpe || '-'}</p>
                      <p className="mt-1 text-sm text-white/70">Classe DPE</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black">{selectedDpe.etiquette_ges || '-'}</p>
                      <p className="mt-1 text-sm text-white/70">GES</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-green-100 bg-green-50 p-3">
                <div>
                  <p className="text-xs font-bold text-green-700">Score d'opportunité</p>
                  <p className="mt-1 text-sm text-green-800">Calculé à partir du DPE</p>
                </div>
                <p className="text-3xl font-black text-green-700">
                  {selectedDpe.opportunityScore}<span className="text-base">/100</span>
                </p>
              </div>

              <div>
                <h3 className="text-lg font-black text-secondary-950">
                  {selectedDpe.adresse || 'Adresse non renseignée'}
                </h3>
                <p className="mt-1 text-sm font-medium text-secondary-500">
                  {[selectedDpe.code_postal, selectedDpe.ville].filter(Boolean).join(' ') || '-'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <InfoCell label="Type" value={selectedDpe.type_batiment || selectedDpe.categorie_dpe || '-'} />
                <InfoCell label="Surface" value={formatSurface(selectedDpe.surface)} />
                <InfoCell label="Date DPE" value={formatDate(selectedDpe.date_etablissement_dpe)} />
                <InfoCell label="Période" value={selectedDpe.periode_dpe || '-'} />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-black text-secondary-950">Signaux détectés</h4>
                {selectedDpe.opportunitySignals.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {selectedDpe.opportunitySignals.map((signal) => (
                      <div key={signal.label} className={`rounded-2xl border px-3 py-3 ${getSignalClasses(signal.tone)}`}>
                        <p className="font-black">{signal.label}</p>
                        <p className="mt-1 text-sm opacity-80">{signal.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm text-secondary-500">
                    Aucun signal fort déduit des champs DPE disponibles.
                  </p>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-black text-secondary-950">Informations DPE</h4>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-secondary-400">Catégorie</dt>
                    <dd className="font-bold text-secondary-900">{selectedDpe.categorie_dpe || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-secondary-400">Chauffage</dt>
                    <dd className="font-bold text-secondary-900">{selectedDpe.energie_chauffage || '-'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-secondary-400">Source</dt>
                    <dd className="break-words font-bold text-secondary-900">{selectedDpe.source_fichier || '-'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-secondary-400">Numéro DPE</dt>
                    <dd className="break-words font-bold text-secondary-900">{selectedDpe.numero_dpe || '-'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Target}
              title="Sélectionnez un point"
              description="Cliquez sur un marqueur de la carte pour afficher le détail DPE réel."
              className="border-0 bg-transparent"
            />
          )}
        </aside>
      </div>
    </div>
  );
};

export default ProspectionPage;
