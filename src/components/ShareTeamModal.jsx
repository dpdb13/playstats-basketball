import { useState } from 'react';
import { X, Copy, Check, RefreshCw } from 'lucide-react';
import { useTeam } from '../context/TeamContext';

export default function ShareTeamModal({ team, onClose }) {
  const { regenerateInviteCode } = useTeam();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const inviteUrl = `${window.location.origin}/playstats-basketball/?join=${team.invite_code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback para navegadores sin clipboard API
      const input = document.createElement('input');
      input.value = inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await regenerateInviteCode(team.id);
    } catch {
      // ignore
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-5 border-2 border-orange-500 max-w-sm w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-orange-400">Compartir equipo</h3>
          <button onClick={onClose} className="p-1 bg-gray-700 rounded-lg hover:bg-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-300 mb-4">
          Comparte este enlace para que otros se unan a <strong>{team.name}</strong>:
        </p>

        <div className="bg-gray-700 rounded-lg p-3 mb-4 break-all text-sm text-gray-200">
          {inviteUrl}
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={handleCopy}
            className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 ${copied ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
        </div>

        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
          Generar nuevo codigo
        </button>
      </div>
    </div>
  );
}
