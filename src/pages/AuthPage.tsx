import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  Sparkles,
  User,
} from 'lucide-react';
import { gsap, revealUp } from '../lib/animations';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import '../styles/auth.css';

type AuthMode = 'login' | 'signup';
type ProfileType = 'independant' | 'agence';

const VALUE_POINTS = [
  {
    title: 'Pige plus rapide',
    description: 'Reperez les bonnes opportunites plus vite avec une interface claire et actionnable.',
  },
  {
    title: 'Suivi intelligent',
    description: 'Centralisez vos alertes, votre pipeline et les signaux a ne pas manquer.',
  },
  {
    title: 'Pensé pour le terrain',
    description: 'Une experience plus fluide pour les independants comme pour les agences.',
  },
];

const AuthPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>(location.pathname === '/signup' ? 'signup' : 'login');
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    telephone: '',
    profileType: 'independant' as ProfileType,
    nomAgence: '',
    siren: '',
  });
  const [loading, setLoading] = useState(false);

  const scopeRef = useRef<HTMLDivElement | null>(null);
  const formShellRef = useRef<HTMLDivElement | null>(null);
  const loginPanelRef = useRef<HTMLFormElement | null>(null);
  const signupPanelRef = useRef<HTMLFormElement | null>(null);
  const agencyFieldsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAuthMode(location.pathname === '/signup' ? 'signup' : 'login');
  }, [location.pathname]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          desktop: '(min-width: 1024px)',
          mobile: '(max-width: 1023px)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { desktop, reduceMotion } = context.conditions as {
            desktop: boolean;
            mobile: boolean;
            reduceMotion: boolean;
          };

          if (reduceMotion) {
            gsap.set('[data-auth-brand]', { opacity: 1, x: 0 });
            gsap.set('[data-auth-card]', { opacity: 1, y: 0 });
            gsap.set('[data-auth-stagger]', { opacity: 1, y: 0 });
            gsap.set('[data-auth-orb]', { opacity: 1 });
            return;
          }

          const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
          intro
            .from('[data-auth-brand]', {
              x: desktop ? -32 : 0,
              autoAlpha: 0,
              duration: 0.8,
            })
            .from(
              '[data-auth-stagger]',
              {
                y: 22,
                autoAlpha: 0,
                duration: 0.7,
                stagger: 0.1,
              },
              desktop ? '-=0.45' : '-=0.2'
            )
            .from(
              '[data-auth-card]',
              {
                y: 26,
                autoAlpha: 0,
                duration: 0.75,
              },
              desktop ? '-=0.55' : '-=0.35'
            )
            .from(
              '[data-auth-orb]',
              {
                scale: 0.92,
                autoAlpha: 0,
                duration: 1.1,
                stagger: 0.12,
              },
              0.08
            );

          gsap.to('[data-auth-float="slow"]', {
            y: -16,
            x: 10,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            duration: 6,
          });

          gsap.to('[data-auth-float="fast"]', {
            y: 14,
            x: -12,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            duration: 4.8,
          });
        }
      );

      return () => mm.revert();
    },
    { scope: scopeRef }
  );

  useGSAP(
    () => {
      if (!loginPanelRef.current || !signupPanelRef.current) return;

      const activePanel = authMode === 'login' ? loginPanelRef.current : signupPanelRef.current;
      const inactivePanel = authMode === 'login' ? signupPanelRef.current : loginPanelRef.current;

      gsap.killTweensOf([activePanel, inactivePanel]);
      gsap.set(inactivePanel, { pointerEvents: 'none' });
      gsap.set(activePanel, { pointerEvents: 'auto' });

      const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.32 } });
      tl.to(inactivePanel, {
        autoAlpha: 0,
        x: authMode === 'login' ? 24 : -24,
      }).fromTo(
        activePanel,
        {
          autoAlpha: 0,
          x: authMode === 'login' ? -24 : 24,
        },
        {
          autoAlpha: 1,
          x: 0,
        },
        '-=0.1'
      );
    },
    { scope: formShellRef, dependencies: [authMode], revertOnUpdate: true }
  );

  useGSAP(
    () => {
      if (!agencyFieldsRef.current) return;

      if (signupData.profileType === 'agence') {
        gsap.set(agencyFieldsRef.current, { display: 'grid' });
        revealUp(agencyFieldsRef.current, { y: 16, duration: 0.35 });
        return;
      }

      gsap.to(agencyFieldsRef.current, {
        autoAlpha: 0,
        y: -10,
        duration: 0.2,
        onComplete: () => {
          if (agencyFieldsRef.current) {
            gsap.set(agencyFieldsRef.current, { display: 'none' });
          }
        },
      });
    },
    { dependencies: [signupData.profileType], scope: scopeRef, revertOnUpdate: true }
  );

  const switchMode = (nextMode: AuthMode) => {
    if (loading || nextMode === authMode) return;
    navigate(nextMode === 'login' ? '/login' : '/signup');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(loginData.email, loginData.password);
      if (error) {
        toast.error(error.message || 'Erreur de connexion');
      } else {
        toast.success('Connexion reussie');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupData.nom || !signupData.prenom || !signupData.email || !signupData.password) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (signupData.profileType === 'agence' && !signupData.nomAgence) {
      toast.error("Le nom de l'agence est obligatoire");
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUp(signupData.email, signupData.password, {
        nom: signupData.nom,
        prenom: signupData.prenom,
        telephone: signupData.telephone,
        profileType: signupData.profileType,
        nomAgence: signupData.nomAgence,
        siren: signupData.siren,
      });

      if (error) {
        toast.error(error.message || "Erreur lors de l'inscription");
      } else {
        toast.success('Inscription reussie');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={scopeRef} className="auth-page relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="auth-grid absolute inset-0 opacity-70" />
      <div
        data-auth-orb
        data-auth-float="slow"
        className="auth-orb auth-orb-primary absolute -left-16 top-12 h-48 w-48 rounded-full blur-3xl"
      />
      <div
        data-auth-orb
        data-auth-float="fast"
        className="auth-orb auth-orb-secondary absolute right-0 top-0 h-64 w-64 rounded-full blur-3xl"
      />
      <div
        data-auth-orb
        data-auth-float="slow"
        className="auth-orb auth-orb-accent absolute bottom-8 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl items-stretch overflow-hidden rounded-[32px] border border-white/60 bg-white/18 shadow-[0_30px_120px_rgba(15,23,42,0.22)] backdrop-blur-xl">
        <section
          data-auth-brand
          className="relative hidden overflow-hidden border-r border-white/10 bg-[linear-gradient(160deg,#102138_0%,#1B263B_48%,#0f172a_100%)] px-7 py-8 text-white lg:flex lg:w-[41%] lg:flex-col lg:justify-between xl:w-[38%] xl:px-9"
        >
          <div className="auth-panel-shine absolute inset-0 opacity-90" />
          <div className="auth-panel-noise absolute inset-0 opacity-20" />

          <div className="relative z-10">
            <img
              data-auth-stagger
              src="/GetFlaire logo long hd 2000*500-min.png"
              alt="GetFlaire"
              className="h-12 w-auto"
            />
          </div>

          <div className="relative z-10 max-w-md xl:max-w-lg">
            <div
              data-auth-stagger
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur"
            >
              <Sparkles className="h-4 w-4 text-primary-300" />
              Une interface plus rapide pour vos opportunites immobilières
            </div>
            <h1
              data-auth-stagger
              className="max-w-md font-['Poppins'] text-3xl font-semibold leading-[1.05] text-white [text-shadow:0_10px_28px_rgba(15,23,42,0.45)] xl:max-w-lg xl:text-[3.35rem]"
            >
              Le cockpit GetFlaire pour accelerer votre prospection.
            </h1>
            <p data-auth-stagger className="mt-5 max-w-lg text-[15px] leading-7 text-slate-200 xl:text-[1.05rem]">
              Centralisez la pige, les alertes et le suivi client dans une experience plus nette,
              plus rapide et plus sereine au quotidien.
            </p>

            <div className="mt-8 grid gap-3">
              {VALUE_POINTS.map((point) => (
                <div
                  key={point.title}
                  data-auth-stagger
                  className="rounded-3xl border border-white/10 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-2xl bg-primary-400/20 p-2 text-primary-200">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">{point.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{point.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            data-auth-stagger
            className="relative z-10 flex items-center justify-between rounded-3xl border border-white/10 bg-white/10 px-5 py-4 text-sm text-slate-200 backdrop-blur-sm"
          >
            <span>Concu pour independants et agences</span>
            <span className="inline-flex items-center gap-2 font-medium text-white">
              Experience premium
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </section>

        <section className="relative flex min-h-[760px] flex-1 items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,252,0.95))] px-4 py-8 sm:px-8 lg:px-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(255,178,63,0.18),transparent_65%)]" />

          <div
            data-auth-card
            className="relative z-10 w-full max-w-3xl rounded-[28px] border border-white/80 bg-white/88 p-4 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6 lg:p-8 xl:max-w-[760px]"
          >
            <div className="mb-8 flex flex-col gap-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 shadow-inner">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        authMode === 'login'
                          ? 'bg-white text-secondary-900 shadow-sm'
                          : 'text-secondary-500 hover:text-secondary-800'
                      }`}
                    >
                      Connexion
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        authMode === 'signup'
                          ? 'bg-white text-secondary-900 shadow-sm'
                          : 'text-secondary-500 hover:text-secondary-800'
                      }`}
                    >
                      Inscription
                    </button>
                  </div>
                  <h2 className="mt-5 font-['Poppins'] text-3xl font-semibold text-secondary-900">
                    {authMode === 'login' ? 'Bon retour sur GetFlaire' : 'Creez votre espace GetFlaire'}
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-secondary-600">
                    {authMode === 'login'
                      ? 'Connectez-vous pour retrouver vos alertes, votre pige et votre suivi commercial.'
                      : 'Inscrivez-vous pour configurer votre espace de travail et commencer a prospecter plus efficacement.'}
                  </p>
                </div>

                <div className="hidden rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-right sm:block">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary-700">
                    GetFlaire Pro
                  </p>
                  <p className="mt-1 text-sm text-secondary-600">Plus fluide. Plus clair. Plus rapide.</p>
                </div>
              </div>

              <div className="grid gap-3 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-secondary-600 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary-600" />
                  Pige et alertes centralisees
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary-600" />
                  Experience adaptee au terrain
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary-600" />
                  Interface premium et rapide
                </div>
              </div>
            </div>

            <div ref={formShellRef} className="relative min-h-[530px]">
              <form
                ref={loginPanelRef}
                onSubmit={handleLoginSubmit}
                className="absolute inset-0 flex flex-col gap-5"
                aria-hidden={authMode !== 'login'}
              >
                <div className="grid gap-5">
                  <AuthField
                    icon={Mail}
                    label="Adresse email"
                    type="email"
                    placeholder="vous@exemple.fr"
                    value={loginData.email}
                    onChange={(value) => setLoginData((prev) => ({ ...prev, email: value }))}
                    disabled={loading}
                    autoComplete="email"
                  />
                  <AuthField
                    icon={Lock}
                    label="Mot de passe"
                    type="password"
                    placeholder="Votre mot de passe"
                    value={loginData.password}
                    onChange={(value) => setLoginData((prev) => ({ ...prev, password: value }))}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-secondary-500">Connexion securisee a votre espace.</span>
                  <button
                    type="button"
                    className="font-medium text-primary-700 transition hover:text-primary-800"
                    onClick={() => toast('Le parcours de reinitialisation sera ajoute prochainement.')}
                  >
                    Mot de passe oublie ?
                  </button>
                </div>

                <button
                  type="submit"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-secondary-900 px-6 text-base font-semibold text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-secondary-800 disabled:translate-y-0 disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? 'Connexion en cours...' : 'Se connecter'}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="mt-auto rounded-3xl border border-primary-100 bg-primary-50/80 p-4 text-sm text-secondary-700">
                  Vous n’avez pas encore de compte ?
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="ml-2 font-semibold text-primary-700 transition hover:text-primary-800"
                  >
                    Creer mon espace
                  </button>
                </div>
              </form>

              <form
                ref={signupPanelRef}
                onSubmit={handleSignupSubmit}
                className="absolute inset-0 flex flex-col gap-5"
                aria-hidden={authMode !== 'signup'}
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-3 block text-sm font-medium text-secondary-700">Type de profil</label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ProfileCard
                        active={signupData.profileType === 'independant'}
                        title="Independant"
                        description="Pour les professionnels en solo."
                        icon={Briefcase}
                        onClick={() =>
                          setSignupData((prev) => ({
                            ...prev,
                            profileType: 'independant',
                            nomAgence: '',
                            siren: '',
                          }))
                        }
                      />
                      <ProfileCard
                        active={signupData.profileType === 'agence'}
                        title="Agence"
                        description="Pour une equipe ou une structure etablie."
                        icon={Building2}
                        onClick={() =>
                          setSignupData((prev) => ({
                            ...prev,
                            profileType: 'agence',
                          }))
                        }
                      />
                    </div>
                  </div>

                  <AuthField
                    icon={User}
                    label="Prenom"
                    type="text"
                    placeholder="Camille"
                    value={signupData.prenom}
                    onChange={(value) => setSignupData((prev) => ({ ...prev, prenom: value }))}
                    disabled={loading}
                    autoComplete="given-name"
                  />
                  <AuthField
                    icon={User}
                    label="Nom"
                    type="text"
                    placeholder="Martin"
                    value={signupData.nom}
                    onChange={(value) => setSignupData((prev) => ({ ...prev, nom: value }))}
                    disabled={loading}
                    autoComplete="family-name"
                  />
                  <AuthField
                    icon={Mail}
                    label="Adresse email"
                    type="email"
                    placeholder="vous@exemple.fr"
                    value={signupData.email}
                    onChange={(value) => setSignupData((prev) => ({ ...prev, email: value }))}
                    disabled={loading}
                    autoComplete="email"
                  />
                  <AuthField
                    icon={Phone}
                    label="Telephone"
                    type="tel"
                    placeholder="06 00 00 00 00"
                    value={signupData.telephone}
                    onChange={(value) => setSignupData((prev) => ({ ...prev, telephone: value }))}
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>

                <div ref={agencyFieldsRef} className="hidden gap-5 md:grid-cols-2">
                  <AuthField
                    icon={Building2}
                    label="Nom de l'agence"
                    type="text"
                    placeholder="GetFlaire Immo"
                    value={signupData.nomAgence}
                    onChange={(value) => setSignupData((prev) => ({ ...prev, nomAgence: value }))}
                    disabled={loading}
                  />
                  <AuthField
                    icon={Briefcase}
                    label="SIREN"
                    type="text"
                    placeholder="Optionnel"
                    value={signupData.siren}
                    onChange={(value) => setSignupData((prev) => ({ ...prev, siren: value }))}
                    disabled={loading}
                  />
                </div>

                <AuthField
                  icon={Lock}
                  label="Mot de passe"
                  type="password"
                  placeholder="Choisissez un mot de passe"
                  value={signupData.password}
                  onChange={(value) => setSignupData((prev) => ({ ...prev, password: value }))}
                  disabled={loading}
                  autoComplete="new-password"
                />

                <button
                  type="submit"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-6 text-base font-semibold text-white shadow-[0_18px_45px_rgba(255,178,63,0.34)] transition hover:-translate-y-0.5 hover:bg-primary-600 disabled:translate-y-0 disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? 'Creation du compte...' : "S'inscrire"}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="mt-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-secondary-700">
                  Vous avez deja un compte ?
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="ml-2 font-semibold text-secondary-900 transition hover:text-primary-700"
                  >
                    Me connecter
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

type AuthFieldProps = {
  autoComplete?: string;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
  value: string;
};

const AuthField: React.FC<AuthFieldProps> = ({
  autoComplete,
  disabled,
  icon: Icon,
  label,
  onChange,
  placeholder,
  type,
  value,
}) => (
  <label className="block">
    <span className="mb-2 block text-sm font-medium text-secondary-700">{label}</span>
    <span className="group relative flex items-center">
      <span className="pointer-events-none absolute left-4 text-secondary-400 transition group-focus-within:text-primary-600">
        <Icon className="h-4 w-4" />
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-[15px] text-secondary-900 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition placeholder:text-secondary-400 focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
      />
    </span>
  </label>
);

type ProfileCardProps = {
  active: boolean;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  title: string;
};

const ProfileCard: React.FC<ProfileCardProps> = ({ active, description, icon: Icon, onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-3xl border p-4 text-left transition ${
      active
        ? 'border-primary-300 bg-primary-50 shadow-[0_14px_32px_rgba(255,178,63,0.16)]'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
    }`}
  >
    <div className="flex items-start gap-3">
      <div
        className={`rounded-2xl p-2 ${
          active ? 'bg-primary-500 text-white' : 'bg-slate-100 text-secondary-600'
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-secondary-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-secondary-600">{description}</p>
      </div>
    </div>
  </button>
);

export default AuthPage;
