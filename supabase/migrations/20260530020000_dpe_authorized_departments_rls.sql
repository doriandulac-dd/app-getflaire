/*
  # DPE prospection access by authorized departments

  Allows authenticated users to read DPE rows only for departments listed in
  public.users.departements_autorises. Stored user scopes may be department
  names such as `Aube` while DPE rows usually store codes such as `10`.
*/

create or replace function public.normalize_department_scope(value text)
returns text
language plpgsql
immutable
as $$
declare
  raw_value text := btrim(coalesce(value, ''));
  normalized text;
begin
  if raw_value = '' then
    return '';
  end if;

  if upper(raw_value) in ('2A', '2B') then
    return upper(raw_value);
  end if;

  if raw_value ~ '^[0-9]+$' then
    return nullif(ltrim(raw_value, '0'), '');
  end if;

  normalized := regexp_replace(
    lower(translate(
      raw_value,
      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝŸýÿ',
      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYYyy'
    )),
    '[^a-z0-9]+',
    '',
    'g'
  );

  return case
    when normalized = 'ain' then '1'
    when normalized = 'aisne' then '2'
    when normalized = 'allier' then '3'
    when normalized = 'alpesdehauteprovence' then '4'
    when normalized = 'hautesalpes' then '5'
    when normalized = 'alpesmaritimes' then '6'
    when normalized = 'ardeche' then '7'
    when normalized = 'ardennes' then '8'
    when normalized = 'ariege' then '9'
    when normalized = 'aube' then '10'
    when normalized = 'aude' then '11'
    when normalized = 'aveyron' then '12'
    when normalized = 'bouchesdurhone' then '13'
    when normalized = 'calvados' then '14'
    when normalized = 'cantal' then '15'
    when normalized = 'charente' then '16'
    when normalized = 'charentemaritime' then '17'
    when normalized = 'cher' then '18'
    when normalized = 'correze' then '19'
    when normalized = 'cotedor' then '21'
    when normalized = 'cotesdarmor' then '22'
    when normalized = 'creuse' then '23'
    when normalized = 'dordogne' then '24'
    when normalized = 'doubs' then '25'
    when normalized = 'drome' then '26'
    when normalized = 'eure' then '27'
    when normalized = 'eureetloir' then '28'
    when normalized = 'finistere' then '29'
    when normalized = 'gard' then '30'
    when normalized = 'hautegaronne' then '31'
    when normalized = 'gers' then '32'
    when normalized = 'gironde' then '33'
    when normalized = 'herault' then '34'
    when normalized = 'illeetvilaine' then '35'
    when normalized = 'indre' then '36'
    when normalized = 'indreetloire' then '37'
    when normalized = 'isere' then '38'
    when normalized = 'jura' then '39'
    when normalized = 'landes' then '40'
    when normalized = 'loiretcher' then '41'
    when normalized = 'loire' then '42'
    when normalized = 'hauteloire' then '43'
    when normalized = 'loireatlantique' then '44'
    when normalized = 'loiret' then '45'
    when normalized = 'lot' then '46'
    when normalized = 'lotetgaronne' then '47'
    when normalized = 'lozere' then '48'
    when normalized = 'maineetloire' then '49'
    when normalized = 'manche' then '50'
    when normalized = 'marne' then '51'
    when normalized = 'hautemarne' then '52'
    when normalized = 'mayenne' then '53'
    when normalized = 'meurtheetmoselle' then '54'
    when normalized = 'meuse' then '55'
    when normalized = 'morbihan' then '56'
    when normalized = 'moselle' then '57'
    when normalized = 'nievre' then '58'
    when normalized = 'nord' then '59'
    when normalized = 'oise' then '60'
    when normalized = 'orne' then '61'
    when normalized = 'pasdecalais' then '62'
    when normalized = 'puydedome' then '63'
    when normalized = 'pyreneesatlantiques' then '64'
    when normalized = 'hautespyrenees' then '65'
    when normalized = 'pyreneesorientales' then '66'
    when normalized = 'basrhin' then '67'
    when normalized = 'hautrhin' then '68'
    when normalized = 'rhone' then '69'
    when normalized = 'hautesaone' then '70'
    when normalized = 'saoneetloire' then '71'
    when normalized = 'sarthe' then '72'
    when normalized = 'savoie' then '73'
    when normalized = 'hautesavoie' then '74'
    when normalized = 'paris' then '75'
    when normalized = 'seinemaritime' then '76'
    when normalized = 'seineetmarne' then '77'
    when normalized = 'yvelines' then '78'
    when normalized = 'deuxsevres' then '79'
    when normalized = 'somme' then '80'
    when normalized = 'tarn' then '81'
    when normalized = 'tarnetgaronne' then '82'
    when normalized = 'var' then '83'
    when normalized = 'vaucluse' then '84'
    when normalized = 'vendee' then '85'
    when normalized = 'vienne' then '86'
    when normalized = 'hautevienne' then '87'
    when normalized = 'vosges' then '88'
    when normalized = 'yonne' then '89'
    when normalized = 'territoiredebelfort' then '90'
    when normalized = 'essonne' then '91'
    when normalized = 'hautsdeseine' then '92'
    when normalized = 'seinesaintdenis' then '93'
    when normalized = 'valdemarne' then '94'
    when normalized = 'valdoise' then '95'
    when normalized = 'guadeloupe' then '971'
    when normalized = 'martinique' then '972'
    when normalized = 'guyane' then '973'
    when normalized = 'lareunion' then '974'
    when normalized = 'mayotte' then '976'
    when normalized = 'corsedusud' then '2A'
    when normalized = 'hautecorse' then '2B'
    else normalized
  end;
end;
$$;

alter table public.dpe enable row level security;

grant select on public.dpe to authenticated;

drop policy if exists "dpe_select_authorized_departments" on public.dpe;

create policy "dpe_select_authorized_departments"
on public.dpe
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    cross join unnest(coalesce(u.departements_autorises, '{}'::text[])) as allowed(departement)
    where u.id = auth.uid()
      and public.normalize_department_scope(dpe.departement)
        = public.normalize_department_scope(allowed.departement)
  )
);
