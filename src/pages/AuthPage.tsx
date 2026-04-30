import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import '../styles/auth.css';

const AuthPage: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ 
    nom: '', 
    prenom: '', 
    email: '', 
    password: '',
    telephone: '',
    profileType: 'independant' as 'independant' | 'agence',
    nomAgence: '',
    siren: ''
  });
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

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
        toast.success('Connexion réussie');
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

    // Validation pour les agences
    if (signupData.profileType === 'agence' && !signupData.nomAgence) {
      toast.error('Le nom de l\'agence est obligatoire');
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
        toast.error(error.message || 'Erreur lors de l\'inscription');
      } else {
        toast.success('Inscription réussie');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className={`auth-container ${isActive ? 'active' : ''}`}>
        {/* Login Form */}
        <div className="form-box login">
          <form onSubmit={handleLoginSubmit}>
            <img src="/GetFlaire logo long hd 2000*500-min.png" alt="Logo" className="h-12 mx-auto mb-6" />
            <h1>Connexion</h1>
            <div className="input-box">
              <input
                type="email"
                placeholder="Email"
                value={loginData.email}
                onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                required
                disabled={loading}
              />
              <i className="bx bxs-envelope"></i>
            </div>
            <div className="input-box">
              <input
                type="password"
                placeholder="Mot de passe"
                value={loginData.password}
                onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                required
                disabled={loading}
              />
              <i className="bx bxs-lock-alt"></i>
            </div>
            <div className="forgot-link">
              <a href="#">Mot de passe oublié ?</a>
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        {/* Register Form */}
        <div className="form-box register">
          <form onSubmit={handleSignupSubmit}>
            <img src="/GetFlaire logo long hd 2000*500-min.png" alt="Logo" className="h-12 mx-auto mb-6" />
            <h1>Inscription</h1>
            
            {/* Profile Type Selection */}
            <div className="input-box">
              <label className="block text-sm font-medium text-secondary-700 mb-2">Type de profil</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="profileType"
                    value="independant"
                    checked={signupData.profileType === 'independant'}
                    onChange={(e) => setSignupData(prev => ({ ...prev, profileType: e.target.value as 'independant' | 'agence' }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    disabled={loading}
                  />
                  <span className="ml-2 text-sm text-secondary-700">Indépendant</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="profileType"
                    value="agence"
                    checked={signupData.profileType === 'agence'}
                    onChange={(e) => setSignupData(prev => ({ ...prev, profileType: e.target.value as 'independant' | 'agence' }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    disabled={loading}
                  />
                  <span className="ml-2 text-sm text-secondary-700">Agence</span>
                </label>
              </div>
            </div>

            <div className="input-box">
              <input
                type="text"
                placeholder="Prénom"
                value={signupData.prenom}
                onChange={(e) => setSignupData(prev => ({ ...prev, prenom: e.target.value }))}
                required
                disabled={loading}
              />
              <i className="bx bxs-user"></i>
            </div>
            <div className="input-box">
              <input
                type="text"
                placeholder="Nom"
                value={signupData.nom}
                onChange={(e) => setSignupData(prev => ({ ...prev, nom: e.target.value }))}
                required
                disabled={loading}
              />
              <i className="bx bxs-user"></i>
            </div>
            <div className="input-box">
              <input
                type="email"
                placeholder="Email"
                value={signupData.email}
                onChange={(e) => setSignupData(prev => ({ ...prev, email: e.target.value }))}
                required
                disabled={loading}
              />
              <i className="bx bxs-envelope"></i>
            </div>
            <div className="input-box">
              <input
                type="tel"
                placeholder="Téléphone (optionnel)"
                value={signupData.telephone}
                onChange={(e) => setSignupData(prev => ({ ...prev, telephone: e.target.value }))}
                disabled={loading}
              />
              <i className="bx bxs-phone"></i>
            </div>
            
            {/* Champs spécifiques aux agences */}
            {signupData.profileType === 'agence' && (
              <>
                <div className="input-box">
                  <input
                    type="text"
                    placeholder="Nom de l'agence *"
                    value={signupData.nomAgence}
                    onChange={(e) => setSignupData(prev => ({ ...prev, nomAgence: e.target.value }))}
                    required
                    disabled={loading}
                  />
                  <i className="bx bxs-buildings"></i>
                </div>
                <div className="input-box">
                  <input
                    type="text"
                    placeholder="SIREN (optionnel)"
                    value={signupData.siren}
                    onChange={(e) => setSignupData(prev => ({ ...prev, siren: e.target.value }))}
                    disabled={loading}
                  />
                  <i className="bx bxs-id-card"></i>
                </div>
              </>
            )}
            
            <div className="input-box">
              <input
                type="password"
                placeholder="Mot de passe"
                value={signupData.password}
                onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                required
                disabled={loading}
              />
              <i className="bx bxs-lock-alt"></i>
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Inscription...' : 'S\'inscrire'}
            </button>
          </form>
        </div>

        {/* Toggle Box */}
        <div className="toggle-box">
          <div className="toggle-panel toggle-left">
            <h1>Bonjour !</h1>
            <p>Vous n'avez pas de compte ?</p>
            <button 
              className="btn register-btn" 
              onClick={() => setIsActive(true)}
              disabled={loading}
            >
              S'inscrire
            </button>
          </div>

          <div className="toggle-panel toggle-right">
            <h1>Bon retour !</h1>
            <p>Vous avez déjà un compte ?</p>
            <button 
              className="btn login-btn" 
              onClick={() => setIsActive(false)}
              disabled={loading}
            >
              Se connecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
