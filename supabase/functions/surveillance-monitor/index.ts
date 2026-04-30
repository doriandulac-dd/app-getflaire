import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

type Annonce = {
  id: string
  price: number
  en_ligne: boolean
  supprimee: boolean
  updated_at: string | null
  // ... tes autres champs
}

type Surveillance = {
  id: string
  user_id: string
  annonce_id: string
  date_surveillance: string
  annonces: Annonce
}

type Modification = {
  type_modification: 'prix_change' | 'mise_hors_ligne' | 'mise_en_ligne' | 'suppression'
  ancienne_valeur: string | null
  nouvelle_valeur: string
  date_modification: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔍 Démarrage du monitoring des surveillances...')

    // 1) Récupérer toutes les surveillances actives + l’annonce (join)
    const { data: surveillances, error: surveillancesError } = await supabase
      .from('surveillances')
      .select(`
        id,
        user_id,
        annonce_id,
        date_surveillance,
        annonces!inner(
          id,
          price,
          en_ligne,
          supprimee,
          updated_at
        )
      `)
      .eq('active', true) as unknown as { data: Surveillance[] | null, error: any }

    if (surveillancesError) throw surveillancesError

    const list = surveillances ?? []
    console.log(`📊 ${list.length} surveillances actives trouvées`)

    let totalModifications = 0

    // 2) Boucle surveillance → détecter modifications
    for (const surveillance of list) {
      const annonce = surveillance.annonces
      if (!annonce) continue

      // a) Dernière trace enregistrée (on lit 1 seule ligne, tri desc)
      const { data: lastHistory, error: lastHistoryErr } = await supabase
        .from('surveillance_historique')
        .select('*')
        .eq('surveillance_id', surveillance.id)
        .order('date_modification', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastHistoryErr) {
        console.error(`Erreur lastHistory (surv ${surveillance.id})`, lastHistoryErr)
      }

      const modifications: Modification[] = []

      // b) PRIX
      // si on n'a pas d'historique → snapshot initial
      if (!lastHistory) {
        modifications.push({
          type_modification: 'prix_change',
          ancienne_valeur: null,
          nouvelle_valeur: String(annonce.price),
          date_modification: surveillance.date_surveillance,
        })
      } else {
        // si la dernière modif n'était pas un "prix_change", on compare l'état courant au last price connu
        // NB: si tu veux garder l'historique précis des prix, idéalement stocke le dernier prix *dans* l’historique prix.
        const lastWasPriceChange = lastHistory.type_modification === 'prix_change'
        const lastPriceKnown = lastWasPriceChange
          ? Number(lastHistory.nouvelle_valeur ?? NaN)
          : Number(lastHistory.ancienne_valeur ?? NaN)

        // fallback : si NaN, on utilise 0
        const lastPrice = Number.isFinite(lastPriceKnown) ? lastPriceKnown : 0

        if (Number(annonce.price) !== lastPrice) {
          modifications.push({
            type_modification: 'prix_change',
            ancienne_valeur: String(lastPrice),
            nouvelle_valeur: String(annonce.price),
            date_modification: annonce.updated_at || new Date().toISOString(),
          })
        }
      }

      // c) STATUT EN LIGNE / SUPPRESSION
      // Déterminer le "dernier état en ligne" à partir du dernier historique
      // Par défaut, on considère "en_ligne" si aucune info (au lancement)
      const lastType = lastHistory?.type_modification as Modification['type_modification'] | undefined
      const lastStateOnline =
        !lastType ? true
        : lastType === 'mise_en_ligne' ? true
        : lastType === 'mise_hors_ligne' ? false
        : lastType === 'suppression' ? false
        : true

      // suppression prioritaire
      if (annonce.supprimee && lastType !== 'suppression') {
        modifications.push({
          type_modification: 'suppression',
          ancienne_valeur: lastStateOnline ? 'active' : 'hors_ligne',
          nouvelle_valeur: 'supprimee',
          date_modification: annonce.updated_at || new Date().toISOString(),
        })
      } else if (!annonce.en_ligne && lastStateOnline && lastType !== 'mise_hors_ligne') {
        modifications.push({
          type_modification: 'mise_hors_ligne',
          ancienne_valeur: 'en_ligne',
          nouvelle_valeur: 'hors_ligne',
          date_modification: annonce.updated_at || new Date().toISOString(),
        })
      } else if (annonce.en_ligne && !lastStateOnline && lastType !== 'mise_en_ligne') {
        modifications.push({
          type_modification: 'mise_en_ligne',
          ancienne_valeur: lastType === 'suppression' ? 'supprimee' : 'hors_ligne',
          nouvelle_valeur: 'en_ligne',
          date_modification: annonce.updated_at || new Date().toISOString(),
        })
      }

      // d) (Optionnel) Titre/description: il faudrait stocker l’ancienne version pour comparer proprement.

      // 3) Insertion dédupliquée
      for (const modification of modifications) {
        const alreadyExists = await existsExactModification(
          supabase,
          surveillance.id,
          modification.type_modification,
          modification.date_modification
        )
        if (alreadyExists) continue

        const { error: insertError } = await supabase
          .from('surveillance_historique')
          .insert({
            surveillance_id: surveillance.id,
            annonce_id: surveillance.annonce_id,
            ...modification,
            detecte_le: new Date().toISOString(),
          })

        if (insertError) {
          console.error('Erreur insertion historique:', insertError)
          continue
        }

        totalModifications++
        console.log(`✅ Modif ${modification.type_modification} pour annonce ${surveillance.annonce_id}`)

        // 4) Notifications selon préférences
        await createNotification(supabase, surveillance, modification).catch((e) =>
          console.error('Notif error:', e)
        )
      }
    }

    console.log(`🎉 Monitoring terminé. ${totalModifications} nouvelles modifications détectées.`)

    return new Response(
      JSON.stringify({
        success: true,
        surveillances_checked: list.length,
        modifications_detected: totalModifications,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Erreur lors du monitoring:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

async function existsExactModification(
  supabase: SupabaseClient,
  surveillance_id: string,
  type_modification: Modification['type_modification'],
  date_modification: string
) {
  const { data, error } = await supabase
    .from('surveillance_historique')
    .select('id')
    .eq('surveillance_id', surveillance_id)
    .eq('type_modification', type_modification)
    .eq('date_modification', date_modification)
    .maybeSingle()

  if (error) {
    console.error('existsExactModification error:', error)
  }
  return Boolean(data)
}

async function createNotification(
  supabase: SupabaseClient,
  surveillance: Surveillance,
  modification: Modification
) {
  // 1) Récup préférences
  const { data: settings } = await supabase
    .from('surveillance_settings')
    .select('*')
    .eq('user_id', surveillance.user_id)
    .maybeSingle()

  const userSettings = settings || {
    notifications_email: true,
    notifications_app: true,
    frequence_email: 'immediate', // défaut raisonnable
    types_modifications: ['prix_change', 'status_change', 'mise_hors_ligne'] // NB: tu n’as pas 'status_change' ailleurs → garde les 3 que tu utilises
  }

  // Harmonisation: si "status_change" est attendu, on le mappe à tes types concrets
  const concreteStatusTypes: Modification['type_modification'][] = ['mise_hors_ligne', 'mise_en_ligne', 'suppression']
  const shouldNotify =
    userSettings.types_modifications.includes(modification.type_modification) ||
    (userSettings.types_modifications.includes('status_change') &&
      concreteStatusTypes.includes(modification.type_modification))

  if (!shouldNotify) return

  const notificationContent = {
    type: modification.type_modification,
    annonce_id: surveillance.annonce_id,
    surveillance_id: surveillance.id,
    ancienne_valeur: modification.ancienne_valeur,
    nouvelle_valeur: modification.nouvelle_valeur,
    date_modification: modification.date_modification,
  }

  const notifications: any[] = []

  if (userSettings.notifications_app) {
    notifications.push({
      user_id: surveillance.user_id,
      surveillance_id: surveillance.id,
      annonce_id: surveillance.annonce_id,
      type_notification: 'in_app',
      contenu: notificationContent,
      envoye: false,
    })
  }

  if (userSettings.notifications_email && userSettings.frequence_email === 'immediate') {
    notifications.push({
      user_id: surveillance.user_id,
      surveillance_id: surveillance.id,
      annonce_id: surveillance.annonce_id,
      type_notification: 'email',
      contenu: notificationContent,
      envoye: false,
    })
  }

  if (notifications.length) {
    const { error } = await supabase
      .from('surveillance_notifications')
      .insert(notifications)

    if (error) {
      console.error('Erreur création notifications:', error)
    }
  }
}