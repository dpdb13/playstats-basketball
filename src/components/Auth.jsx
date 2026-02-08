import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PlayStatsIcon from './PlayStatsIcon';

export default function Auth() {
  const { signIn, signUp, resetPassword } = useAuth();
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (showReset) {
        await resetPassword(email);
        setMessage(t.resetEmailSent);
        setShowReset(false);
      } else if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setMessage(t.accountCreated);
      }
    } catch (err) {
      const msg = err.message || t.unexpectedError;
      if (msg.includes('Invalid login credentials')) {
        setError(t.wrongCredentials);
      } else if (msg.includes('User already registered')) {
        setError(t.emailRegistered);
      } else if (msg.includes('Password should be at least')) {
        setError(t.passwordMinLength);
      } else if (msg.includes('Unable to validate email')) {
        setError(t.invalidEmail);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (showReset) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 md:p-10 border-2 border-orange-500 max-w-md w-full">
          <div className="flex items-center justify-center gap-2 mb-6">
            <PlayStatsIcon className="w-8 h-8 text-orange-500" />
            <h1 className="text-xl sm:text-2xl font-black text-orange-400">PlayStats Basketball</h1>
          </div>

          <h2 className="text-lg font-bold text-center mb-6 text-slate-300">{t.resetPassword}</h2>

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4 text-sm text-red-300">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-emerald-900/50 border border-emerald-500 rounded-lg p-3 mb-4 text-sm text-emerald-300">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">{t.emailLabel}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                placeholder="tu@email.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-400 py-3 rounded-lg font-bold text-lg disabled:opacity-50"
            >
              {loading ? t.sending : t.sendRecoveryEmail}
            </button>
          </form>

          <button
            onClick={() => { setShowReset(false); setError(''); setMessage(''); }}
            className="w-full mt-4 text-slate-400 hover:text-white text-sm"
          >
            {t.backToLogin}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 md:p-10 border-2 border-orange-500 max-w-md w-full">
        <div className="flex items-center justify-center gap-2 mb-6">
          <PlayStatsIcon className="w-8 h-8 text-orange-500" />
          <h1 className="text-xl sm:text-2xl font-black text-orange-400">PlayStats Basketball</h1>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-slate-700 rounded-lg p-1">
          <button
            onClick={() => { setIsLogin(true); setError(''); setMessage(''); }}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${isLogin ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t.signIn}
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); setMessage(''); }}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${!isLogin ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t.signUp}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4 text-sm text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-emerald-900/50 border border-emerald-500 rounded-lg p-3 mb-4 text-sm text-emerald-300">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">{t.emailLabel}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">{t.passwordLabel}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              placeholder={t.minSixChars}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-400 py-3 rounded-lg font-bold text-lg disabled:opacity-50"
          >
            {loading ? t.loading : isLogin ? t.enter : t.createAccount}
          </button>
        </form>

        {isLogin && (
          <button
            onClick={() => { setShowReset(true); setError(''); setMessage(''); }}
            className="w-full mt-4 text-slate-400 hover:text-white text-sm"
          >
            {t.forgotPassword}
          </button>
        )}
      </div>
    </div>
  );
}
