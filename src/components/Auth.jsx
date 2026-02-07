import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PlayStatsIcon from './PlayStatsIcon';

export default function Auth() {
  const { signIn, signUp, resetPassword } = useAuth();
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
        setMessage('Te hemos enviado un email para restablecer tu contrasena');
        setShowReset(false);
      } else if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setMessage('Cuenta creada correctamente');
      }
    } catch (err) {
      const msg = err.message || 'Error desconocido';
      if (msg.includes('Invalid login credentials')) {
        setError('Email o contrasena incorrectos');
      } else if (msg.includes('User already registered')) {
        setError('Este email ya esta registrado');
      } else if (msg.includes('Password should be at least')) {
        setError('La contrasena debe tener al menos 6 caracteres');
      } else if (msg.includes('Unable to validate email')) {
        setError('Email no valido');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (showReset) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-6 sm:p-8 md:p-10 border-2 border-orange-500 max-w-md w-full">
          <div className="flex items-center justify-center gap-2 mb-6">
            <PlayStatsIcon className="w-8 h-8 text-orange-500" />
            <h1 className="text-xl sm:text-2xl font-black text-orange-400">PlayStats Basketball</h1>
          </div>

          <h2 className="text-lg font-bold text-center mb-6 text-gray-300">Restablecer contrasena</h2>

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4 text-sm text-red-300">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-900/50 border border-green-500 rounded-lg p-3 mb-4 text-sm text-green-300">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                placeholder="tu@email.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-400 py-3 rounded-lg font-bold text-lg disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar email de recuperacion'}
            </button>
          </form>

          <button
            onClick={() => { setShowReset(false); setError(''); setMessage(''); }}
            className="w-full mt-4 text-gray-400 hover:text-white text-sm"
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-6 sm:p-8 md:p-10 border-2 border-orange-500 max-w-md w-full">
        <div className="flex items-center justify-center gap-2 mb-6">
          <PlayStatsIcon className="w-8 h-8 text-orange-500" />
          <h1 className="text-xl sm:text-2xl font-black text-orange-400">PlayStats Basketball</h1>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => { setIsLogin(true); setError(''); setMessage(''); }}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${isLogin ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Iniciar Sesion
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); setMessage(''); }}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${!isLogin ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Registrarse
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4 text-sm text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-900/50 border border-green-500 rounded-lg p-3 mb-4 text-sm text-green-300">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              placeholder="Minimo 6 caracteres"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-400 py-3 rounded-lg font-bold text-lg disabled:opacity-50"
          >
            {loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        {isLogin && (
          <button
            onClick={() => { setShowReset(true); setError(''); setMessage(''); }}
            className="w-full mt-4 text-gray-400 hover:text-white text-sm"
          >
            He olvidado mi contrasena
          </button>
        )}
      </div>
    </div>
  );
}
