import type { Annonce, CommercialProfileSettings } from '../types';

const normalize = (value?: string | null) => (value || '').trim();
const normalizeBoolean = (value?: boolean | null) => value === true;

const getSellerName = (annonce: Annonce) => {
  const sourceData = annonce.source_data;
  if (!sourceData || typeof sourceData !== 'object') return '';

  const candidateKeys = ['contact_name', 'contactName', 'nom_contact', 'seller_name', 'owner_name', 'name'];
  for (const key of candidateKeys) {
    const value = (sourceData as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return '';
};

const buildOpening = (tone: CommercialProfileSettings['tone']) => {
  switch (tone) {
    case 'premium':
      return "Bonjour, je vous appelle au sujet de votre annonce. Je voulais vous apporter un retour de marché clair et utile.";
    case 'direct':
      return "Bonjour, je vous appelle pour votre annonce immobilière. Je vais aller droit au but pour vous faire gagner du temps.";
    case 'conseil':
    default:
      return "Bonjour, je vous appelle à propos de votre annonce. Mon objectif est surtout de vous apporter un conseil concret sur la mise en vente.";
  }
};

const buildValueAngle = (profile: CommercialProfileSettings | undefined, annonce: Annonce) => {
  const specialty = normalize(profile?.specialty);
  const zone = normalize(profile?.zone);
  const promise = normalize(profile?.promise);
  const networkName = normalize(profile?.network_name);
  const agencyName = normalize(profile?.agency_name);
  const positioning = normalize(profile?.positioning);
  const propertyType = normalize(annonce.type_de_bien) || 'bien';
  const city = normalize(annonce.city);

  const parts = [];
  if (agencyName && normalizeBoolean(profile?.is_agency)) parts.push(`j'accompagne les vendeurs avec ${agencyName}`);
  else if (networkName) parts.push(`je suis rattaché au réseau ${networkName}`);
  if (specialty) parts.push(`je travaille surtout ${specialty}`);
  if (zone) parts.push(`sur le secteur ${zone}`);
  if (!specialty && city) parts.push(`sur ${city}`);
  if (positioning) parts.push(positioning);
  if (promise) parts.push(promise);
  if (!promise) parts.push(`avec un retour concret sur la demande actuelle pour ce type de ${propertyType.toLowerCase()}`);

  return parts.join(', ');
};

export type OutreachSuggestion = {
  title: string;
  angle?: string;
  body: string;
};

export const generateCallScripts = (
  annonce: Annonce,
  profile?: CommercialProfileSettings
) => {
  const sellerName = getSellerName(annonce);
  const introName = sellerName ? `${sellerName}, ` : '';
  const opening = buildOpening(profile?.tone);
  const valueAngle = buildValueAngle(profile, annonce);
  const propertyLabel = `${annonce.type_de_bien || 'bien'} à ${annonce.city || 'votre secteur'}`;
  const objectionHook = normalize(profile?.common_objections);
  const callInstructions = normalize(profile?.call_instructions);
  const preferredApproaches = normalize(profile?.preferred_approaches);
  const guidance = callInstructions ? ` ${callInstructions}` : '';
  const approachHint = preferredApproaches ? ` L'axe à garder en tête: ${preferredApproaches}.` : '';

  return [
    {
      title: 'Approche estimation',
      angle: 'Estimation',
      body: `${introName}${opening} Je vous contacte pour votre ${propertyLabel}. ${valueAngle}. Si vous voulez, je peux déjà vous partager ce que les acquéreurs regardent en priorité sur ce type de bien et ce qui peut faire gagner du temps à la vente.${guidance}${approachHint}`,
    },
    {
      title: 'Approche qualification vendeur',
      angle: 'Qualification',
      body: `${introName}${opening} Je voulais simplement comprendre où vous en êtes dans votre projet pour votre ${propertyLabel}. L’idée n’est pas de vous faire perdre du temps, mais de voir si un regard pro peut vous aider à mieux positionner votre annonce et vos prochains contacts.${guidance}${approachHint}`,
    },
    {
      title: 'Approche objection douce',
      angle: 'Objection',
      body: `${introName}${opening} Beaucoup de vendeurs me disent au départ "${objectionHook || "je préfère d’abord essayer seul"}". C’est justement pour ça que je propose un échange court et utile, sans engagement, pour voir si vous avez déjà tous les signaux pour vendre dans de bonnes conditions.${guidance}${approachHint}`,
    },
  ];
};

export const generateSmsSuggestions = (
  annonce: Annonce,
  profile?: CommercialProfileSettings
) => {
  const specialty = normalize(profile?.specialty);
  const promise = normalize(profile?.promise);
  const signature = normalize(profile?.sms_signature);
  const networkName = normalize(profile?.network_name);
  const agencyName = normalize(profile?.agency_name);
  const smsInstructions = normalize(profile?.sms_instructions);
  const city = normalize(annonce.city);
  const propertyType = normalize(annonce.type_de_bien).toLowerCase() || 'bien';
  const sellerName = getSellerName(annonce);
  const prefix = sellerName ? `Bonjour ${sellerName}, ` : 'Bonjour, ';
  const identity = agencyName && normalizeBoolean(profile?.is_agency)
    ? ` pour ${agencyName}`
    : networkName
      ? ` via le réseau ${networkName}`
      : '';
  const instruction = smsInstructions ? ` ${smsInstructions}` : '';
  const sign = signature ? ` ${signature}` : '';

  return [
    {
      title: 'SMS conseil',
      angle: 'Conseil',
      body: `${prefix}je vous contacte au sujet de votre annonce ${propertyType} à ${city}${identity}. ${promise || "Je peux vous partager quelques retours utiles sur la demande actuelle et les points qui déclenchent le plus d'appels."}${instruction}${sign}`,
    },
    {
      title: 'SMS reprise de contact',
      angle: 'Reprise de contact',
      body: `${prefix}je me permets un message rapide pour votre annonce ${propertyType} à ${city}${identity}. ${specialty ? `Je travaille surtout ${specialty}. ` : ''}Si vous le souhaitez, je peux vous faire un retour simple sur le positionnement de votre bien.${instruction}${sign}`,
    },
    {
      title: 'SMS estimation',
      angle: 'Estimation',
      body: `${prefix}concernant votre annonce ${propertyType} à ${city}${identity}, je peux vous proposer un échange court pour vous donner un avis marché et les attentes des acquéreurs en ce moment.${instruction}${sign}`,
    },
  ];
};
