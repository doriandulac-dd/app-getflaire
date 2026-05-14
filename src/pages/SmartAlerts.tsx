import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowUpDown,
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Heart,
  Home,
  Mail,
  MapPin,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Radar,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/UI/PageHeader';
import SurfacePanel from '../components/UI/SurfacePanel';
import SegmentedTabs from '../components/UI/SegmentedTabs';
import MetricCard from '../components/UI/MetricCard';
import EmptyState from '../components/UI/EmptyState';
import LoadingSkeleton from '../components/UI/LoadingSkeleton';
import { useGsapReveal } from '../hooks/useGsapReveal';
import {
  defaultSmartAlertCriteria,
  defaultScoreWeights,
  getSmartAlertBadge,
  parseNaturalLanguageCriteria,
  thresholdForMode,
  useSmartAlerts,
} from '../hooks/useSmartAlerts';
import { AlertMatchResult, ScoreBreakdown, ScoreWeights, SmartAlert, SmartAlertFormData, WeightedKeyword } from '../types/smartAlerts';

type SmartAlertTab = 'new' | 'results' | 'saved' | 'history';

const initialForm: SmartAlertFormData = {
  nom_alerte: 'Maison jardin Troyes',
  type_recherche: 'résidence_principale',
  statut: 'active',
  priorite: 'normal',
  ville: 'Troyes',
  postal_codes: ['10000'],
  radius_km: 10,
  type_de_bien: 'Maison',
  prix_max: 230000,
  surface_min: 100,
  rooms_min: 4,
  bedrooms_min: 3,
  matching_threshold: 65,
  frequence_analyse: 'realtime',
  options_avancees: {
    ...defaultSmartAlertCriteria,
    propertyTypes: ['Maison'],
    exterior: 'required',
    exteriorImportance: 'required',
    positiveKeywords: [
      { value: 'jardin', importance: 'required' },
      { value: 'garage', importance: 'medium' },
      { value: 'proche écoles', importance: 'medium' },
    ],
    negativeKeywords: [
      { value: 'gros travaux', importance: 'high' },
      { value: 'viager', importance: 'required' },
    ],
  },
};

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-secondary-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-secondary-500';
const dpeOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const parseList = (value: string) =>
  value.split(',').map(item => item.trim()).filter(Boolean);

const formatPrice = (value?: number | null) =>
  typeof value === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
    : 'Non défini';

const formatDate = (value?: string | null) => {
  if (!value) return 'Jamais';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const keywordString = (keywords: WeightedKeyword[]) =>
  keywords.map(keyword => keyword.value).join(', ');

const keywordList = (value: string, importance: WeightedKeyword['importance'] = 'medium'): WeightedKeyword[] =>
  parseList(value).map(item => ({ value: item, importance }));

const scoreWeightItems: Array<{ key: keyof ScoreWeights; label: string; helper: string }> = [
  { key: 'localisation', label: 'Localisation', helper: 'Ville, communes, rayon' },
  { key: 'budget', label: 'Budget', helper: 'Prix min/max et tolerance' },
  { key: 'type', label: 'Type', helper: 'Maison, appartement, secondaire' },
  { key: 'surface', label: 'Surface / pieces', helper: 'm², pieces, chambres' },
  { key: 'exterieur', label: 'Exterieur', helper: 'Jardin, terrasse, balcon' },
  { key: 'etat', label: 'Etat / travaux', helper: 'Travaux exclus ou acceptes' },
  { key: 'dpe', label: 'DPE', helper: 'Classes energetiques' },
  { key: 'motsCles', label: 'Mots-cles', helper: 'Termes recherches/exclus' },
];

const resultStatusLabels: Record<string, string> = {
  new: 'Nouveau',
  viewed: 'Consulté',
  sent: 'Envoyé',
  ignored: 'Ignoré',
  favorite: 'Favori',
  followed: 'Suivi',
};

const scoreBreakdownLabels: Array<{ key: keyof ScoreBreakdown; label: string }> = [
  { key: 'localisation', label: 'Localisation' },
  { key: 'budget', label: 'Budget' },
  { key: 'type', label: 'Type' },
  { key: 'surface', label: 'Surface' },
  { key: 'exterieur', label: 'Extérieur' },
  { key: 'etat', label: 'État' },
  { key: 'dpe', label: 'DPE' },
  { key: 'motsCles', label: 'Mots-clés' },
];

const alertToForm = (alert: SmartAlert): SmartAlertFormData => ({
  nom_alerte: alert.nom_alerte,
  type_recherche: alert.type_recherche,
  client_id: alert.client_id || undefined,
  statut: alert.statut,
  priorite: alert.priorite,
  ville: alert.ville || '',
  postal_codes: alert.postal_codes || [],
  radius_km: alert.radius_km,
  type_de_bien: alert.type_de_bien || '',
  prix_min: alert.prix_min ?? undefined,
  prix_max: alert.prix_max ?? undefined,
  surface_min: alert.surface_min ?? undefined,
  surface_max: alert.surface_max ?? undefined,
  rooms_min: alert.rooms_min ?? undefined,
  bedrooms_min: alert.bedrooms_min ?? undefined,
  matching_threshold: alert.matching_threshold,
  frequence_analyse: alert.frequence_analyse,
  options_avancees: {
    ...defaultSmartAlertCriteria,
    ...alert.options_avancees,
    scoreWeights: {
      ...defaultScoreWeights,
      ...(alert.options_avancees?.scoreWeights || {}),
    },
  },
});

const SmartAlerts: React.FC = () => {
  const {
    clients,
    alerts,
    selectedAlert,
    selectedAlertId,
    setSelectedAlertId,
    results,
    notifications,
    loading,
    matching,
    error,
    createClient,
    saveAlert,
    updateAlertStatus,
    deleteAlert,
    duplicateAlert,
    runMatching,
    updateResultStatus,
    addFavorite,
    addToFollowUp,
    markNotificationRead,
    toggleNotificationRead,
    prepareOutreachMessage,
    toNumber,
  } = useSmartAlerts();
  const [activeTab, setActiveTab] = useState<SmartAlertTab>('new');
  const [form, setForm] = useState<SmartAlertFormData>(initialForm);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({ first_name: '', last_name: '', email: '', phone: '', notes: '' });
  const [showClientForm, setShowClientForm] = useState(false);
  const [resultFilter, setResultFilter] = useState({ minScore: 0, city: '', status: 'all', type: '', budgetMax: '', sort: 'score' });
  const [showIgnoredResults, setShowIgnoredResults] = useState(false);
  const [generatingMessageId, setGeneratingMessageId] = useState<string | null>(null);
  const [generatedSummary, setGeneratedSummary] = useState<string[]>([]);
  const scoreWeights = form.options_avancees.scoreWeights || defaultScoreWeights;
  const scoreWeightTotal = Object.values(scoreWeights).reduce((sum, value) => sum + value, 0);

  const pageRef = useGsapReveal<HTMLDivElement>(
    [activeTab, results.length, alerts.length],
    { selector: '[data-gsap-reveal]', y: 18, stagger: 0.05 }
  );

  const filteredResults = useMemo(() => {
    const budgetMax = toNumber(resultFilter.budgetMax);
    const filtered = results.filter(result => {
      const cityOk = !resultFilter.city || result.annonce?.city?.toLowerCase().includes(resultFilter.city.toLowerCase());
      const scoreOk = result.score_pertinence >= resultFilter.minScore;
      const statusOk = resultFilter.status === 'all'
        ? showIgnoredResults || result.statut_commercial !== 'ignored'
        : result.statut_commercial === resultFilter.status;
      const typeOk = !resultFilter.type || result.annonce?.type_de_bien?.toLowerCase().includes(resultFilter.type.toLowerCase());
      const budgetOk = budgetMax === undefined || (result.annonce?.price || 0) <= budgetMax;
      return cityOk && scoreOk && statusOk && typeOk && budgetOk;
    });

    return [...filtered].sort((a, b) => {
      if (resultFilter.sort === 'recent') return new Date(b.date_matching).getTime() - new Date(a.date_matching).getTime();
      if (resultFilter.sort === 'price') return (a.annonce?.price || 0) - (b.annonce?.price || 0);
      if (resultFilter.sort === 'surface') return (b.annonce?.size || 0) - (a.annonce?.size || 0);
      return b.score_pertinence - a.score_pertinence;
    });
  }, [results, resultFilter, showIgnoredResults, toNumber]);

  const ignoredResultsCount = useMemo(
    () => results.filter(result => result.statut_commercial === 'ignored').length,
    [results]
  );

  const stats = {
    activeAlerts: alerts.filter(alert => alert.statut === 'active').length,
    matches: results.length,
    bestScore: results[0]?.score_pertinence || 0,
    unread: notifications.filter(notification => !notification.read_at).length,
  };

  const updateForm = <K extends keyof SmartAlertFormData>(key: K, value: SmartAlertFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateCriteria = <K extends keyof SmartAlertFormData['options_avancees']>(
    key: K,
    value: SmartAlertFormData['options_avancees'][K]
  ) => {
    setForm(prev => ({
      ...prev,
      options_avancees: { ...prev.options_avancees, [key]: value },
    }));
  };

  const toggleDpeAccepted = (dpe: string) => {
    const selected = form.options_avancees.dpeAccepted.includes(dpe);
    const nextValues = selected
      ? form.options_avancees.dpeAccepted.filter(value => value !== dpe)
      : [...form.options_avancees.dpeAccepted, dpe];

    updateCriteria('dpeAccepted', dpeOptions.filter(value => nextValues.includes(value)));
  };

  const updateScoreWeight = (key: keyof ScoreWeights, value: number) => {
    updateCriteria('scoreWeights', {
      ...scoreWeights,
      [key]: Math.max(0, Math.min(100, value)),
    });
  };

  const resetScoreWeights = () => {
    updateCriteria('scoreWeights', defaultScoreWeights);
  };

  const handleCreateClient = async () => {
    if (!clientForm.first_name.trim() || !clientForm.last_name.trim()) {
      toast.error('Prénom et nom client obligatoires');
      return;
    }
    const client = await createClient(clientForm);
    updateForm('client_id', client.id);
    setClientForm({ first_name: '', last_name: '', email: '', phone: '', notes: '' });
    setShowClientForm(false);
  };

  const handleNaturalLanguage = () => {
    const text = form.options_avancees.naturalLanguage || '';
    if (!text.trim()) {
      toast.error('Ajoute une recherche en langage naturel');
      return;
    }
    const parsed = parseNaturalLanguageCriteria(text);
    const parsedOptions = parsed.options_avancees || defaultSmartAlertCriteria;
    const summary = [
      parsed.ville ? `Ville: ${parsed.ville}` : null,
      parsed.type_de_bien ? `Type: ${parsed.type_de_bien}` : null,
      parsed.prix_max ? `Budget max: ${formatPrice(parsed.prix_max)}` : null,
      parsed.surface_min ? `Surface min: ${parsed.surface_min} m²` : null,
      parsed.bedrooms_min ? `Chambres min: ${parsed.bedrooms_min}` : null,
      parsedOptions.exterior === 'required' ? 'Extérieur obligatoire' : null,
      parsedOptions.positiveKeywords?.length ? `Mots-clés: ${keywordString(parsedOptions.positiveKeywords)}` : null,
      parsedOptions.forbiddenWorks?.length ? `Exclus: ${parsedOptions.forbiddenWorks.join(', ')}` : null,
    ].filter((item): item is string => Boolean(item));

    setForm(prev => ({
      ...prev,
      ...parsed,
      nom_alerte: parsed.ville || parsed.type_de_bien
        ? `${parsed.type_de_bien || prev.type_de_bien || 'Recherche'} ${parsed.ville || prev.ville || ''}`.trim()
        : prev.nom_alerte,
      options_avancees: {
        ...prev.options_avancees,
        ...(parsed.options_avancees || {}),
        scoreWeights: prev.options_avancees.scoreWeights,
      },
    }));
    setGeneratedSummary(summary);
    toast.success(summary.length ? `${summary.length} critère(s) généré(s)` : 'Texte enregistré, aucun critère automatique détecté');
  };

  const handleSaveAndRun = async () => {
    try {
      const alert = await saveAlert(form, editingAlertId || undefined);
      setEditingAlertId(null);
      setSelectedAlertId(alert.id);

      if (alert.statut === 'active') {
        try {
          await runMatching(alert);
          setActiveTab('results');
        } catch (err: any) {
          toast.error(err.message || "Recherche enregistrée, mais l'analyse n'a pas pu se lancer");
          setActiveTab('saved');
        }
      } else {
        setActiveTab('saved');
      }
    } catch (err: any) {
      toast.error(err.message || "Impossible d'enregistrer la recherche");
    }
  };

  const handlePreview = async () => {
    try {
      await runMatching(form);
      setActiveTab('results');
    } catch (err: any) {
      toast.error(err.message || "Impossible de prévisualiser les matches");
    }
  };

  const handleSavedAlertRun = async () => {
    if (!selectedAlert) {
      toast.error('Sélectionne une recherche sauvegardée');
      return;
    }
    try {
      await runMatching(selectedAlert);
      setActiveTab('results');
    } catch (err: any) {
      toast.error(err.message || "Impossible de lancer l'analyse");
    }
  };

  const handleNewSearch = () => {
    setEditingAlertId(null);
    setForm(initialForm);
    setGeneratedSummary([]);
    setActiveTab('new');
  };

  const handleEditAlert = (alert: SmartAlert) => {
    setEditingAlertId(alert.id);
    setSelectedAlertId(alert.id);
    setForm(alertToForm(alert));
    setGeneratedSummary([]);
    setActiveTab('new');
  };

  const handleDuplicateAlert = async (alert: SmartAlert) => {
    const duplicated = await duplicateAlert(alert);
    setEditingAlertId(duplicated.id);
    setForm(alertToForm(duplicated));
    setGeneratedSummary([]);
    setActiveTab('new');
  };

  const handleArchiveAlert = async (alert: SmartAlert) => {
    if (!window.confirm(`Archiver "${alert.nom_alerte}" ?`)) return;
    await updateAlertStatus(alert.id, 'archived');
  };

  const handleDeleteAlert = async (alert: SmartAlert) => {
    if (!window.confirm(`Supprimer définitivement "${alert.nom_alerte}" et ses résultats ?`)) return;
    await deleteAlert(alert.id);
  };

  const handleOpenSource = async (result: AlertMatchResult) => {
    if (!result.annonce) return;
    await updateResultStatus(result.id, 'viewed');
    window.open(result.annonce.url, '_blank');
  };

  const handleOpenInternal = async (result: AlertMatchResult) => {
    if (!result.annonce) return;
    await updateResultStatus(result.id, 'viewed');
    window.open(`/pige/${result.annonce.id}`, '_blank');
  };

  const handleCopyOutreach = async (result: AlertMatchResult, mode: 'email' | 'sms') => {
    setGeneratingMessageId(`${result.id}-${mode}`);
    try {
      const message = await prepareOutreachMessage(result, mode);
      await navigator.clipboard.writeText(message);
      toast.success(mode === 'email' ? 'Email copié' : 'Message WhatsApp/SMS copié');
    } catch (err: any) {
      toast.error(err.message || 'Impossible de préparer le message');
    } finally {
      setGeneratingMessageId(null);
    }
  };

  const handleIgnoreResult = async (resultId: string) => {
    await updateResultStatus(resultId, 'ignored');
    toast.success('Annonce ignorée');
  };

  const handleRestoreIgnoredResult = async (resultId: string) => {
    await updateResultStatus(resultId, 'new');
    toast.success('Annonce réactivée');
  };

  const handleNotificationOpen = (notification: typeof notifications[number]) => {
    const alerteId = notification.contenu.alerte_id;
    if (alerteId) setSelectedAlertId(alerteId);
    void toggleNotificationRead(notification.id, true);
    setActiveTab('results');
  };

  const renderResultCard = (result: AlertMatchResult) => {
    const annonce = result.annonce;
    const badge = getSmartAlertBadge(result.score_pertinence);
    if (!annonce) return null;

    return (
      <article key={result.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" data-gsap-reveal>
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="h-40 w-full overflow-hidden rounded-xl bg-gray-100 lg:w-56">
            {annonce.image_urls ? (
              <img
                src={Array.isArray(annonce.image_urls) ? annonce.image_urls[0] : annonce.image_urls.split(',')[0]}
                alt={annonce.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">Pas de photo</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-xs font-bold ${badge.tone}`}>{badge.label}</span>
                  <span className="rounded-full bg-secondary-100 px-2 py-1 text-xs font-semibold text-secondary-700">{annonce.source}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">{resultStatusLabels[result.statut_commercial] || result.statut_commercial}</span>
                </div>
                <h3 className="line-clamp-2 text-lg font-bold text-secondary-900">{annonce.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-secondary-600">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{annonce.city}</span>
                  <span>{formatPrice(annonce.price)}</span>
                  <span>{annonce.size} m²</span>
                  <span>{annonce.rooms} pièces</span>
                  {annonce.bedrooms ? <span>{annonce.bedrooms} chambres</span> : null}
                  {annonce.dpe ? <span>DPE {annonce.dpe}</span> : null}
                </div>
              </div>

              <div className="rounded-2xl bg-secondary-900 px-4 py-3 text-white">
                <p className="text-xs font-semibold text-primary-200">Score</p>
                <p className="text-3xl font-black">{result.score_pertinence}<span className="text-sm font-semibold text-white/70">/100</span></p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-secondary-600">{result.resume}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {scoreBreakdownLabels.map(item => {
                const value = Number(result.score_breakdown?.[item.key] || 0);
                return (
                  <div key={item.key} className="rounded-xl border border-gray-100 bg-gray-50 p-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-secondary-600">
                      <span className="truncate">{item.label}</span>
                      <span>{value}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(100, value)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-emerald-700">Points forts</p>
                <ul className="space-y-1 text-sm text-emerald-900">
                  {(result.points_forts.length ? result.points_forts : ['Annonce à qualifier']).map(point => <li key={point}>• {point}</li>)}
                </ul>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-amber-700">Points à vérifier</p>
                <ul className="space-y-1 text-sm text-amber-900">
                  {(result.points_faibles.length ? result.points_faibles : ['Aucun écart majeur détecté']).map(point => <li key={point}>• {point}</li>)}
                </ul>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => handleOpenInternal(result)} className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-secondary-700 hover:bg-gray-50">
                <Home className="mr-2 h-4 w-4" /> Fiche interne
              </button>
              <button onClick={() => handleOpenSource(result)} className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-secondary-700 hover:bg-gray-50">
                <ExternalLink className="mr-2 h-4 w-4" /> Source
              </button>
              <button onClick={() => addFavorite(annonce.id, result.id)} className="inline-flex items-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <Heart className="mr-2 h-4 w-4" /> Favori
              </button>
              <button onClick={() => addToFollowUp(annonce.id, result.id)} className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Ajouter au suivi
              </button>
              <button onClick={() => addToFollowUp(annonce.id, result.id, 'to_call')} className="inline-flex items-center rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800">
                <CalendarClock className="mr-2 h-4 w-4" /> Créer rappel
              </button>
              <button onClick={() => updateResultStatus(result.id, 'sent')} className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-secondary-700 hover:bg-gray-50">
                <Send className="mr-2 h-4 w-4" /> Marquer envoyée
              </button>
              <button onClick={() => handleIgnoreResult(result.id)} className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-secondary-500 hover:bg-gray-50">
                <XCircle className="mr-2 h-4 w-4" /> Ignorer
              </button>
              {result.statut_commercial === 'ignored' ? (
                <button onClick={() => handleRestoreIgnoredResult(result.id)} className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                  <RotateCcw className="mr-2 h-4 w-4" /> Réactiver
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => handleCopyOutreach(result, 'email')}
                disabled={generatingMessageId === `${result.id}-email`}
                className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-secondary-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Mail className="mr-2 h-4 w-4" />
                {generatingMessageId === `${result.id}-email` ? 'Préparation...' : 'Copier email'}
              </button>
              <button
                onClick={() => handleCopyOutreach(result, 'sms')}
                disabled={generatingMessageId === `${result.id}-sms`}
                className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-secondary-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {generatingMessageId === `${result.id}-sms` ? 'Préparation...' : 'Copier WhatsApp'}
              </button>
              <button onClick={() => updateResultStatus(result.id, 'sent')} className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-secondary-700 hover:bg-gray-50">
                <Copy className="mr-2 h-4 w-4" /> Marquer envoyé
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div ref={pageRef} className="space-y-6">
      <PageHeader
        eyebrow="Moteur de matching"
        title="Alertes intelligentes"
        description="Crée une recherche client, score les annonces en ligne et transforme les meilleurs matches en actions commerciales."
        actions={
          <>
            <button
              onClick={handleNewSearch}
              className="inline-flex items-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle recherche
            </button>
            <button
              onClick={handleSavedAlertRun}
              disabled={matching || !selectedAlert}
              className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-secondary-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <Radar className="mr-2 h-4 w-4" />
              Lancer l'analyse
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard title="Recherches actives" value={stats.activeAlerts} icon={Target} tone="primary" />
        <MetricCard title="Annonces matchées" value={stats.matches} icon={Sparkles} tone="success" />
        <MetricCard title="Meilleur score" value={`${stats.bestScore}%`} icon={Star} tone="warning" />
        <MetricCard title="Notifications" value={stats.unread} icon={Bell} tone="danger" />
      </div>

      <SurfacePanel className="p-4 lg:p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'new', label: 'Nouvelle recherche' },
              { id: 'results', label: 'Résultats matchés', count: results.length },
              { id: 'saved', label: 'Mes recherches', count: alerts.length },
              { id: 'history', label: 'Historique', count: notifications.length },
            ]}
          />
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        </div>

        {activeTab === 'new' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div className="space-y-5">
              {editingAlertId && (
                <div className="flex flex-col gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold">Modification de la recherche sauvegardée</span>
                  <button onClick={handleNewSearch} className="inline-flex items-center rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm font-bold text-primary-800">
                    <Plus className="mr-2 h-4 w-4" />
                    Nouvelle recherche
                  </button>
                </div>
              )}
              <section className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary-600" />
                  <h2 className="text-lg font-bold text-secondary-900">Recherche en langage naturel</h2>
                </div>
                <textarea
                  value={form.options_avancees.naturalLanguage || ''}
                  onChange={event => updateCriteria('naturalLanguage', event.target.value)}
                  className={`${inputClass} min-h-24 resize-none`}
                  placeholder="Je cherche pour un couple une maison autour de Troyes, minimum 100 m², avec jardin, 3 chambres, budget max 230 000 €, proche école et sans gros travaux."
                />
                <button onClick={handleNaturalLanguage} className="mt-3 inline-flex items-center rounded-xl bg-secondary-900 px-4 py-2 text-sm font-bold text-white">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Générer les critères
                </button>
                {generatedSummary.length > 0 && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Critères appliqués</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {generatedSummary.map(item => (
                        <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Nom de la recherche</label>
                  <input className={inputClass} value={form.nom_alerte} onChange={event => updateForm('nom_alerte', event.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Type de recherche</label>
                  <select className={inputClass} value={form.type_recherche} onChange={event => updateForm('type_recherche', event.target.value)}>
                    <option value="résidence_principale">Résidence principale</option>
                    <option value="investissement_locatif">Investissement locatif</option>
                    <option value="marchand_de_biens">Marchand de biens</option>
                    <option value="chasse_immobiliere">Chasse immobilière</option>
                    <option value="recherche_agence">Recherche agence</option>
                    <option value="recherche_personnelle">Recherche personnelle</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Client associé</label>
                  <div className="flex gap-2">
                    <select className={inputClass} value={form.client_id || ''} onChange={event => updateForm('client_id', event.target.value || undefined)}>
                      <option value="">Recherche interne</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.first_name} {client.last_name}</option>
                      ))}
                    </select>
                    <button onClick={() => setShowClientForm(value => !value)} className="rounded-xl border border-gray-200 px-3 text-secondary-700 hover:bg-gray-50">
                      <UserPlus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Statut</label>
                    <select className={inputClass} value={form.statut} onChange={event => updateForm('statut', event.target.value as SmartAlertFormData['statut'])}>
                      <option value="active">Active</option>
                      <option value="paused">En pause</option>
                      <option value="archived">Archivée</option>
                      <option value="project">Projet</option>
                      <option value="abandoned">Abandonné</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Priorité</label>
                    <select className={inputClass} value={form.priorite} onChange={event => updateForm('priorite', event.target.value as SmartAlertFormData['priorite'])}>
                      <option value="low">Faible</option>
                      <option value="normal">Normale</option>
                      <option value="high">Haute</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>
              </section>

              {showClientForm && (
                <section className="grid grid-cols-1 gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4 md:grid-cols-2">
                  <input className={inputClass} placeholder="Prénom" value={clientForm.first_name} onChange={event => setClientForm(prev => ({ ...prev, first_name: event.target.value }))} />
                  <input className={inputClass} placeholder="Nom" value={clientForm.last_name} onChange={event => setClientForm(prev => ({ ...prev, last_name: event.target.value }))} />
                  <input className={inputClass} placeholder="Email" value={clientForm.email} onChange={event => setClientForm(prev => ({ ...prev, email: event.target.value }))} />
                  <input className={inputClass} placeholder="Téléphone" value={clientForm.phone} onChange={event => setClientForm(prev => ({ ...prev, phone: event.target.value }))} />
                  <textarea className={`${inputClass} md:col-span-2`} placeholder="Notes client" value={clientForm.notes} onChange={event => setClientForm(prev => ({ ...prev, notes: event.target.value }))} />
                  <button onClick={handleCreateClient} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white md:col-span-2">Créer le client</button>
                </section>
              )}

              <section className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-3">
                <div>
                  <label className={labelClass}>Ville principale</label>
                  <input className={inputClass} value={form.ville} onChange={event => updateForm('ville', event.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Codes postaux</label>
                  <input className={inputClass} value={form.postal_codes.join(', ')} onChange={event => updateForm('postal_codes', parseList(event.target.value))} />
                </div>
                <div>
                  <label className={labelClass}>Rayon km</label>
                  <input className={inputClass} type="number" value={form.radius_km} onChange={event => updateForm('radius_km', toNumber(event.target.value) || 0)} />
                </div>
                <div>
                  <label className={labelClass}>Communes acceptées</label>
                  <input className={inputClass} value={form.options_avancees.acceptedCities.join(', ')} onChange={event => updateCriteria('acceptedCities', parseList(event.target.value))} />
                </div>
                <div>
                  <label className={labelClass}>Communes exclues</label>
                  <input className={inputClass} value={form.options_avancees.excludedCities.join(', ')} onChange={event => updateCriteria('excludedCities', parseList(event.target.value))} />
                </div>
                <div>
                  <label className={labelClass}>Importance localisation</label>
                  <select className={inputClass} value={form.options_avancees.locationImportance} onChange={event => updateCriteria('locationImportance', event.target.value as SmartAlertFormData['options_avancees']['locationImportance'])}>
                    <option value="low">Souple</option>
                    <option value="medium">Importante</option>
                    <option value="high">Forte</option>
                    <option value="required">Obligatoire</option>
                  </select>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-4">
                <div>
                  <label className={labelClass}>Type de bien</label>
                  <select className={inputClass} value={form.type_de_bien} onChange={event => updateForm('type_de_bien', event.target.value)}>
                    <option value="">Tous</option>
                    <option>Maison</option>
                    <option>Appartement</option>
                    <option>Immeuble</option>
                    <option>Terrain</option>
                    <option>Local commercial</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Budget max</label>
                  <input className={inputClass} type="number" value={form.prix_max || ''} onChange={event => updateForm('prix_max', toNumber(event.target.value))} />
                </div>
                <div>
                  <label className={labelClass}>Surface min</label>
                  <input className={inputClass} type="number" value={form.surface_min || ''} onChange={event => updateForm('surface_min', toNumber(event.target.value))} />
                </div>
                <div>
                  <label className={labelClass}>Chambres min</label>
                  <input className={inputClass} type="number" value={form.bedrooms_min || ''} onChange={event => updateForm('bedrooms_min', toNumber(event.target.value))} />
                </div>
                <div>
                  <label className={labelClass}>Jardin / extérieur</label>
                  <select className={inputClass} value={form.options_avancees.exterior} onChange={event => updateCriteria('exterior', event.target.value as SmartAlertFormData['options_avancees']['exterior'])}>
                    <option value="required">Obligatoire</option>
                    <option value="preferred">Souhaité</option>
                    <option value="any">Peu importe</option>
                    <option value="not_wanted">Non souhaité</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>DPE acceptés</label>
                  <details className="group relative">
                    <summary className={`${inputClass} flex cursor-pointer list-none items-center justify-between gap-2`}>
                      <span className={form.options_avancees.dpeAccepted.length ? 'text-secondary-900' : 'text-secondary-400'}>
                        {form.options_avancees.dpeAccepted.length ? form.options_avancees.dpeAccepted.join(', ') : 'Choisir les DPE'}
                      </span>
                      <span className="text-xs font-black text-secondary-400 transition group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="absolute z-20 mt-2 w-full rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                      {dpeOptions.map(dpe => (
                        <label key={dpe} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-secondary-700 hover:bg-primary-50">
                          <input
                            type="checkbox"
                            checked={form.options_avancees.dpeAccepted.includes(dpe)}
                            onChange={() => toggleDpeAccepted(dpe)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          DPE {dpe}
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
                <div>
                  <label className={labelClass}>Mode</label>
                  <select
                    className={inputClass}
                    value={form.options_avancees.searchMode}
                    onChange={event => {
                      const mode = event.target.value as SmartAlertFormData['options_avancees']['searchMode'];
                      updateCriteria('searchMode', mode);
                      updateForm('matching_threshold', thresholdForMode(mode));
                    }}
                  >
                    <option value="strict">Strict</option>
                    <option value="balanced">Équilibré</option>
                    <option value="opportunity">Opportunité</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Seuil score</label>
                  <input className={inputClass} type="number" min={0} max={100} value={form.matching_threshold} onChange={event => updateForm('matching_threshold', toNumber(event.target.value) || 0)} />
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Mots-clés recherchés</label>
                  <input className={inputClass} value={keywordString(form.options_avancees.positiveKeywords)} onChange={event => updateCriteria('positiveKeywords', keywordList(event.target.value))} />
                </div>
                <div>
                  <label className={labelClass}>Mots-clés exclus</label>
                  <input className={inputClass} value={keywordString(form.options_avancees.negativeKeywords)} onChange={event => updateCriteria('negativeKeywords', keywordList(event.target.value, 'high'))} />
                </div>
                <div>
                  <label className={labelClass}>Type vendeur</label>
                  <select className={inputClass} value={form.options_avancees.sellerType} onChange={event => updateCriteria('sellerType', event.target.value as SmartAlertFormData['options_avancees']['sellerType'])}>
                    <option value="all">Tout</option>
                    <option value="particulier">Particulier uniquement</option>
                    <option value="pro">Professionnel uniquement</option>
                    <option value="both">Particulier + professionnel</option>
                    <option value="off_market">Off-market</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Types secondaires</label>
                  <input className={inputClass} value={form.options_avancees.secondaryTypes.join(', ')} onChange={event => updateCriteria('secondaryTypes', parseList(event.target.value))} />
                </div>
                <div>
                  <label className={labelClass}>Garage / parking</label>
                  <select
                    className={inputClass}
                    value={String(form.options_avancees.parking?.garage || 'any')}
                    onChange={event => updateCriteria('parking', { ...form.options_avancees.parking, garage: event.target.value as WeightedKeyword['importance'] | 'any' })}
                  >
                    <option value="any">Peu importe</option>
                    <option value="medium">Souhaité</option>
                    <option value="high">Important</option>
                    <option value="required">Obligatoire</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Prix au m² investisseur max</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={form.options_avancees.investor?.maxPricePerSqm || ''}
                    onChange={event => updateCriteria('investor', {
                      ...(form.options_avancees.investor || { enabled: false, potential: [] }),
                      enabled: Boolean(event.target.value),
                      maxPricePerSqm: toNumber(event.target.value),
                    })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Signaux investisseur</label>
                  <input
                    className={inputClass}
                    value={(form.options_avancees.investor?.potential || []).join(', ')}
                    onChange={event => updateCriteria('investor', {
                      ...(form.options_avancees.investor || { enabled: false }),
                      enabled: parseList(event.target.value).length > 0 || Boolean(form.options_avancees.investor?.maxPricePerSqm),
                      potential: parseList(event.target.value),
                    })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Fréquence</label>
                  <select className={inputClass} value={form.frequence_analyse} onChange={event => updateForm('frequence_analyse', event.target.value as SmartAlertFormData['frequence_analyse'])}>
                    <option value="realtime">Temps réel</option>
                    <option value="hourly">Toutes les heures</option>
                    <option value="twice_daily">2 fois par jour</option>
                    <option value="daily">1 fois par jour</option>
                    <option value="manual">Manuel uniquement</option>
                  </select>
                </div>
              </section>

              <div className="flex flex-wrap gap-3">
                <button onClick={handleSaveAndRun} disabled={matching} className="inline-flex items-center rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50">
                  <Radar className="mr-2 h-4 w-4" />
                  {editingAlertId ? 'Mettre à jour et lancer' : 'Enregistrer et lancer'}
                </button>
                <button onClick={handlePreview} disabled={matching} className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-secondary-700 shadow-sm hover:bg-gray-50 disabled:opacity-50">
                  <Eye className="mr-2 h-4 w-4" />
                  Prévisualiser les matches
                </button>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl bg-secondary-900 p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-primary-200">Aperçu recherche</p>
                <h2 className="mt-2 text-2xl font-black">{form.nom_alerte}</h2>
                <div className="mt-4 space-y-3 text-sm text-white/80">
                  <p><strong className="text-white">Zone:</strong> {form.ville || 'Non définie'} + {form.radius_km} km</p>
                  <p><strong className="text-white">Budget:</strong> {formatPrice(form.prix_max)}</p>
                  <p><strong className="text-white">Bien:</strong> {form.type_de_bien || 'Tous types'} · {form.surface_min || 0} m² min · {form.bedrooms_min || 0} chambres min</p>
                  <p><strong className="text-white">Seuil:</strong> {form.matching_threshold}% · {form.frequence_analyse}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center text-sm font-bold text-secondary-900">
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Pondération personnalisée
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-4 text-secondary-500">
                      Ajuste les points selon les priorités du client.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetScoreWeights}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-secondary-600 hover:bg-gray-50"
                  >
                    Reset
                  </button>
                </div>

                <div className={`mb-2 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                  scoreWeightTotal === 100
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-800'
                }`}>
                  Total: {scoreWeightTotal} pts
                  {scoreWeightTotal !== 100 && (
                    <span className="ml-1 font-semibold">Score normalisé.</span>
                  )}
                </div>

                <div className="space-y-2">
                  {scoreWeightItems.map(item => (
                    <div key={item.key} className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-secondary-900">{item.label}</p>
                          <p className="truncate text-[11px] text-secondary-500">{item.helper}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            className="h-8 w-12 rounded-lg border border-gray-200 bg-white px-1.5 text-right text-xs font-bold text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                            type="number"
                            min={0}
                            max={100}
                            value={scoreWeights[item.key]}
                            onChange={event => updateScoreWeight(item.key, toNumber(event.target.value) || 0)}
                          />
                          <span className="text-[11px] font-bold text-secondary-500">pts</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        value={scoreWeights[item.key]}
                        onChange={event => updateScoreWeight(item.key, toNumber(event.target.value) || 0)}
                        className="mt-1 h-1.5 w-full accent-primary-600"
                        aria-label={`Poids ${item.label}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-7">
              <div>
                <label className={labelClass}>Score minimum</label>
                <input className={inputClass} type="number" value={resultFilter.minScore} onChange={event => setResultFilter(prev => ({ ...prev, minScore: toNumber(event.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelClass}>Ville</label>
                <input className={inputClass} value={resultFilter.city} onChange={event => setResultFilter(prev => ({ ...prev, city: event.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Statut</label>
                <select className={inputClass} value={resultFilter.status} onChange={event => setResultFilter(prev => ({ ...prev, status: event.target.value }))}>
                  <option value="all">Tous</option>
                  <option value="new">Nouveau</option>
                  <option value="viewed">Consulté</option>
                  <option value="sent">Envoyé</option>
                  <option value="ignored">Ignoré</option>
                  <option value="favorite">Favori</option>
                  <option value="followed">Suivi</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <input className={inputClass} value={resultFilter.type} onChange={event => setResultFilter(prev => ({ ...prev, type: event.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Budget max</label>
                <input className={inputClass} type="number" value={resultFilter.budgetMax} onChange={event => setResultFilter(prev => ({ ...prev, budgetMax: event.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Tri</label>
                <select className={inputClass} value={resultFilter.sort} onChange={event => setResultFilter(prev => ({ ...prev, sort: event.target.value }))}>
                  <option value="score">Meilleur score</option>
                  <option value="recent">Plus récent</option>
                  <option value="price">Prix croissant</option>
                  <option value="surface">Surface décroissante</option>
                </select>
              </div>
              <button onClick={handleSavedAlertRun} disabled={matching || !selectedAlert} className="self-end rounded-xl bg-secondary-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                <ArrowUpDown className="mr-2 inline h-4 w-4" />
                {matching ? 'Analyse...' : 'Relancer'}
              </button>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-secondary-900">Visibilité des annonces ignorées</p>
                <p className="text-sm text-secondary-600">
                  Affiche aussi les annonces déjà ignorées pour cette alerte intelligente.
                </p>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2 sm:min-w-72">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-secondary-800">Afficher les ignorées</p>
                  <p className="text-xs text-secondary-500">{ignoredResultsCount} annonce(s) ignorée(s) sur cette alerte</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showIgnoredResults}
                  onClick={() => setShowIgnoredResults(value => !value)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                    showIgnoredResults ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      showIgnoredResults ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>

            {matching || loading ? (
              <LoadingSkeleton itemClassName="h-56 rounded-2xl" />
            ) : filteredResults.length === 0 ? (
              <EmptyState icon={Search} title="Aucun match affiché" description="Lance une analyse ou assouplis les filtres de résultats." />
            ) : (
              <div className="space-y-4">
                {filteredResults.map(renderResultCard)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="space-y-4">
            {loading ? (
              <LoadingSkeleton itemClassName="h-24 rounded-2xl" />
            ) : alerts.length === 0 ? (
              <EmptyState icon={Radar} title="Aucune recherche sauvegardée" description="Crée une première alerte intelligente pour commencer à scorer les annonces." />
            ) : alerts.map(alert => {
              const isSelected = alert.id === selectedAlertId;
              return (
                <article
                  key={alert.id}
                  className={`w-full rounded-2xl border p-4 text-left transition ${isSelected ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <button
                      onClick={() => {
                        setSelectedAlertId(alert.id);
                        setActiveTab('results');
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <h3 className="text-lg font-bold text-secondary-900">{alert.nom_alerte}</h3>
                      <p className="mt-1 text-sm text-secondary-600">
                        {alert.client ? `${alert.client.first_name} ${alert.client.last_name} · ` : ''}
                        {alert.ville || 'Zone libre'} + {alert.radius_km} km · {formatPrice(alert.prix_max)} · seuil {alert.matching_threshold}%
                      </p>
                    </button>
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-secondary-100 px-3 py-1 text-secondary-700">{alert.statut}</span>
                      <span className="rounded-full bg-primary-100 px-3 py-1 text-primary-800">{alert.priorite}</span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">Dernière analyse: {formatDate(alert.last_matching_date)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => handleEditAlert(alert)} className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-secondary-700 hover:bg-gray-50">
                      <Edit3 className="mr-2 h-4 w-4" /> Modifier
                    </button>
                    <button
                      onClick={() => updateAlertStatus(alert.id, alert.statut === 'active' ? 'paused' : 'active')}
                      disabled={alert.statut === 'archived' || alert.statut === 'abandoned'}
                      className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-secondary-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {alert.statut === 'active' ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                      {alert.statut === 'active' ? 'Pause' : 'Reprendre'}
                    </button>
                    <button onClick={() => handleDuplicateAlert(alert)} className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-secondary-700 hover:bg-gray-50">
                      <RotateCcw className="mr-2 h-4 w-4" /> Dupliquer
                    </button>
                    <button onClick={() => handleArchiveAlert(alert)} disabled={alert.statut === 'archived'} className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 disabled:opacity-50">
                      <Archive className="mr-2 h-4 w-4" /> Archiver
                    </button>
                    <button onClick={() => handleDeleteAlert(alert)} className="inline-flex items-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                      <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <EmptyState icon={Bell} title="Aucune notification" description="Les nouveaux matches au-dessus du seuil apparaîtront ici." />
            ) : notifications.map(notification => (
              <div key={notification.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-secondary-900">{notification.contenu.title || 'Notification alerte'}</p>
                  <p className="mt-1 text-sm text-secondary-600">{notification.contenu.message || 'Nouvelle activité de matching'}</p>
                  <p className="mt-1 text-xs text-secondary-400">{formatDate(notification.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleNotificationOpen(notification)}
                    className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-secondary-700 hover:bg-gray-50"
                  >
                    <FileText className="mr-2 h-4 w-4" /> Voir résultats
                  </button>
                  <button
                    onClick={() => notification.read_at ? toggleNotificationRead(notification.id, false) : markNotificationRead(notification.id)}
                    className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-secondary-700"
                  >
                    {notification.read_at ? 'Marquer non lue' : 'Marquer lue'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfacePanel>
    </div>
  );
};

export default SmartAlerts;
