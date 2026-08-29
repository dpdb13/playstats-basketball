import { useState, useEffect } from 'react';
import { X, Copy, Check, RefreshCw, ChevronDown, ChevronUp, Shield, Eye, Edit3, Trash2, Users } from 'lucide-react';
import { useTeam } from '../context/TeamContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    return true;
  }
}

const LINK_STYLES = {
  blue: {
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    btn: 'bg-blue-600 hover:bg-blue-500',
  },
  emerald: {
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    btn: 'bg-emerald-600 hover:bg-emerald-500',
  }
};

function LinkSection({ label, description, url, color, onCopy, copied, onRegenerate, regenerating }) {
  const { t } = useTranslation();
  const styles = LINK_STYLES[color] || LINK_STYLES.blue;
  return (
    <div className={`bg-slate-700/50 rounded-lg p-3 border ${styles.border}`}>
      <div className="flex items-center gap-2 mb-1">
        {color === 'blue' ? <Edit3 className="w-4 h-4 text-blue-400" /> : <Eye className="w-4 h-4 text-emerald-400" />}
        <span className={`text-sm font-bold ${styles.text}`}>{label}</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">{description}</p>
      <div className="bg-slate-800 rounded px-2 py-1.5 mb-2 break-all text-[11px] text-slate-300 font-mono">
        {url}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCopy}
          className={`flex-1 py-1.5 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 ${copied ? 'bg-emerald-600' : styles.btn}`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t.copied : t.copyLink}
        </button>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="p-1.5 bg-slate-600 hover:bg-slate-500 rounded-lg disabled:opacity-50"
          title={t.generateNewCode}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}

const ROLE_COLORS = {
  owner: 'text-orange-400 bg-orange-500/20',
  editor: 'text-blue-400 bg-blue-500/20',
  viewer: 'text-emerald-400 bg-emerald-500/20'
};

const ROLE_LABELS = {
  owner: (t) => t.owner,
  editor: (t) => t.editor,
  viewer: (t) => t.viewer
};

export default function ShareTeamModal({ team, onClose }) {
  const { regenerateInviteCode, regenerateViewerCode, getTeamMembers, updateMemberRole, removeMember } = useTeam();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [copiedEditor, setCopiedEditor] = useState(false);
  const [copiedViewer, setCopiedViewer] = useState(false);
  const [regeneratingEditor, setRegeneratingEditor] = useState(false);
  const [regeneratingViewer, setRegeneratingViewer] = useState(false);

  const [members, setMembers] = useState([]);
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);

  const viewerCode = team.team_settings?.viewer_invite_code;
  const editorUrl = `${window.location.origin}/playstats-basketball/?join=${team.invite_code}`;
  const viewerUrl = viewerCode ? `${window.location.origin}/playstats-basketball/?view=${viewerCode}` : null;

  // Load members when section is expanded
  useEffect(() => {
    if (!membersExpanded || members.length > 0) return;
    loadMembers();
  }, [membersExpanded]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const data = await getTeamMembers(team.id);
      setMembers(data);
    } catch {
      // ignore
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCopyEditor = () => {
    copyToClipboard(editorUrl);
    setCopiedEditor(true);
    setTimeout(() => setCopiedEditor(false), 2000);
  };

  const handleCopyViewer = () => {
    if (viewerUrl) {
      copyToClipboard(viewerUrl);
      setCopiedViewer(true);
      setTimeout(() => setCopiedViewer(false), 2000);
    }
  };

  const handleRegenerateEditor = async () => {
    setRegeneratingEditor(true);
    try {
      await regenerateInviteCode(team.id);
    } catch { /* ignore */ }
    setRegeneratingEditor(false);
  };

  const handleRegenerateViewer = async () => {
    setRegeneratingViewer(true);
    try {
      await regenerateViewerCode(team.id);
    } catch { /* ignore */ }
    setRegeneratingViewer(false);
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await updateMemberRole(team.id, memberId, newRole);
      setMembers(prev => prev.map(m => m.user_id === memberId ? { ...m, role: newRole } : m));
    } catch { /* ignore */ }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await removeMember(team.id, memberId);
      setMembers(prev => prev.filter(m => m.user_id !== memberId));
      setMemberToRemove(null);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-5 border-2 border-orange-500 max-w-sm md:max-w-md w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-orange-400">{t.shareTeam}</h3>
          <button onClick={onClose} className="p-1 bg-slate-700 rounded-lg hover:bg-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editor link section */}
        <div className="space-y-3 mb-4">
          <LinkSection
            label={t.editorAccess}
            description={t.editorLinkDesc}
            url={editorUrl}
            color="blue"
            onCopy={handleCopyEditor}
            copied={copiedEditor}
            onRegenerate={handleRegenerateEditor}
            regenerating={regeneratingEditor}
          />

          {/* Viewer link section */}
          {viewerUrl ? (
            <LinkSection
              label={t.viewerAccess}
              description={t.viewerLinkDesc}
              url={viewerUrl}
              color="emerald"
              onCopy={handleCopyViewer}
              copied={copiedViewer}
              onRegenerate={handleRegenerateViewer}
              regenerating={regeneratingViewer}
            />
          ) : (
            <button
              onClick={handleRegenerateViewer}
              disabled={regeneratingViewer}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 flex items-center justify-center gap-2 border border-dashed border-slate-500 disabled:opacity-50"
            >
              <Eye className="w-4 h-4" />
              {regeneratingViewer ? t.loading : `+ ${t.viewerAccess}`}
            </button>
          )}
        </div>

        {/* Members section */}
        <div className="border-t border-slate-700 pt-3">
          <button
            onClick={() => setMembersExpanded(prev => !prev)}
            className="w-full flex items-center justify-between py-1 group"
          >
            <span className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> {t.teamMembers}
            </span>
            {membersExpanded
              ? <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-white" />
              : <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white" />
            }
          </button>

          {membersExpanded && (
            <div className="mt-2 space-y-1.5">
              {loadingMembers ? (
                <div className="text-center py-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto"></div>
                </div>
              ) : members.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">{t.noData}</p>
              ) : (
                members.map(m => {
                  const isMe = m.user_id === user?.id;
                  const isOwnerMember = m.role === 'owner';
                  const canManage = !isMe && !isOwnerMember;

                  return (
                    <div key={m.user_id} className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {m.email}
                          {isMe && <span className="text-xs text-slate-400 ml-1">{t.you}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ROLE_COLORS[m.role] || ROLE_COLORS.viewer}`}>
                        {ROLE_LABELS[m.role]?.(t) || m.role}
                      </span>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRoleChange(m.user_id, m.role === 'editor' ? 'viewer' : 'editor')}
                            className="p-1 bg-slate-600 hover:bg-slate-500 rounded"
                            title={t.changeRole}
                          >
                            <Shield className="w-3 h-3 text-slate-300" />
                          </button>
                          <button
                            onClick={() => setMemberToRemove(m)}
                            className="p-1 bg-red-900/50 hover:bg-red-800/50 rounded"
                            title={t.removeMember}
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm remove member modal */}
      {memberToRemove && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-800 rounded-xl p-5 border-2 border-red-500 max-w-xs w-full">
            <h4 className="text-sm font-bold text-red-400 mb-3">{t.removeMember}</h4>
            <p className="text-sm text-slate-300 mb-4">
              {t.confirmRemoveMember(memberToRemove.email)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRemoveMember(memberToRemove.user_id)}
                className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-lg font-bold text-sm"
              >
                {t.removeMember}
              </button>
              <button
                onClick={() => setMemberToRemove(null)}
                className="flex-1 bg-slate-600 hover:bg-slate-500 py-2 rounded-lg font-bold text-sm"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
