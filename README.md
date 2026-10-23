# GetFlaire App

Application React côté navigateur, construite avec Vite et React Router.

## Développement local

Utiliser Node.js 24 LTS (`.nvmrc`), puis installer les versions verrouillées :

```sh
nvm use
npm ci
cp -n .env.example .env
```

Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env`, puis lancer `npm run dev`.
Ces variables sont publiques dans le navigateur : utiliser uniquement une clé publique/anon, jamais une clé de service.

## Vérifications avant intégration

```sh
npm run typecheck
npm run lint
npm run build
npm audit
npm audit --omit=dev
```

`typecheck` vérifie explicitement les projets TypeScript de l'application et de Vite. La compilation Vite seule ne vérifie pas les types. `npm run check` enchaîne types, lint et compilation et s'arrête au premier échec.

`npm run preview -- --host 127.0.0.1` permet de vérifier localement le résultat de la compilation. Les routes authentifiées nécessitent une session et un profil applicatif Supabase.

Conserver `package-lock.json` avec toute modification de dépendances ; utiliser `npm ci` pour reproduire l'installation examinée.
