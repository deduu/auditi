import React, { useState, useEffect } from 'react';
import { Key, Plus, Copy, Check, Trash2, AlertTriangle } from 'lucide-react';
import client from '../../api/client';

export function ApiKeySettings() {
    const [keys, setKeys] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [createdKey, setCreatedKey] = useState(null);
    const [copied, setCopied] = useState(false);
    const [creating, setCreating] = useState(false);
    const [revoking, setRevoking] = useState(null);

    const fetchKeys = async () => {
        try {
            const data = await client.get('/api-keys');
            setKeys(data);
        } catch (err) {
            console.error('Failed to fetch API keys:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleCreate = async () => {
        if (!newKeyName.trim()) return;
        setCreating(true);
        try {
            const data = await client.post('/api-keys', { name: newKeyName.trim() });
            setCreatedKey(data);
            setNewKeyName('');
            fetchKeys();
        } catch (err) {
            console.error('Failed to create API key:', err);
        } finally {
            setCreating(false);
        }
    };

    const handleCopy = async (text) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRevoke = async (keyId) => {
        setRevoking(keyId);
        try {
            await client.delete(`/api-keys/${keyId}`);
            fetchKeys();
        } catch (err) {
            console.error('Failed to revoke API key:', err);
        } finally {
            setRevoking(null);
        }
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setCreatedKey(null);
        setNewKeyName('');
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Never';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Key className="w-5 h-5 text-blue-400" />
                        API Keys
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                        Manage API keys for SDK authentication. Keys are used with <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code>
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create Key
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-slate-400">Loading...</div>
            ) : keys.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/30 border border-slate-800 rounded-lg">
                    <Key className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No API keys yet</p>
                    <p className="text-sm text-slate-500 mt-1">Create one to start sending traces from the SDK</p>
                </div>
            ) : (
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-900/50 text-left">
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Name</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Key Prefix</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Created</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Last Used</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {keys.map((key) => (
                                <tr key={key.id} className="hover:bg-slate-900/30">
                                    <td className="px-4 py-3 text-sm text-white font-medium">{key.name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">{key.key_prefix}...</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{formatDate(key.created_at)}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{formatDate(key.last_used_at)}</td>
                                    <td className="px-4 py-3">
                                        {key.is_active ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400">Active</span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400">Revoked</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {key.is_active && (
                                            <button
                                                onClick={() => handleRevoke(key.id)}
                                                disabled={revoking === key.id}
                                                className="text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                                title="Revoke key"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create / Show Key Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeCreateModal}>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        {createdKey ? (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white">API Key Created</h3>
                                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>Copy this key now. It will not be shown again.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-slate-800 px-3 py-2.5 rounded-lg text-sm text-white font-mono break-all">
                                        {createdKey.key}
                                    </code>
                                    <button
                                        onClick={() => handleCopy(createdKey.key)}
                                        className="shrink-0 p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                                    </button>
                                </div>
                                <button
                                    onClick={closeCreateModal}
                                    className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white">Create API Key</h3>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Key Name</label>
                                    <input
                                        type="text"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        placeholder="e.g., Production, Development"
                                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={closeCreateModal}
                                        className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreate}
                                        disabled={!newKeyName.trim() || creating}
                                        className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                                    >
                                        {creating ? 'Creating...' : 'Generate Key'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
