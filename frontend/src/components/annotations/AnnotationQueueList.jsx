import React, { useState, useEffect } from 'react';
import { Plus, ListTodo, Play, Trash2, Users, CheckCircle2, Clock, BarChart3 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { annotationsApi } from '../../api';

export const AnnotationQueueList = ({ onQueueSelect, scoreConfigs = [] }) => {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadQueues();
  }, []);

  const loadQueues = async () => {
    try {
      const data = await annotationsApi.getAnnotationQueues();
      setQueues(data);
    } catch (error) {
      console.error('Failed to load queues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (queueId) => {
    if (!confirm('Deactivate this annotation queue?')) return;
    try {
      await annotationsApi.deleteAnnotationQueue(queueId);
      loadQueues();
    } catch (error) {
      console.error('Failed to delete queue:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-slate-500">Loading annotation queues...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-white">Annotation Queues</h3>
          <p className="text-sm text-slate-400">Organize traces for human review</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} disabled={scoreConfigs.length === 0}>
          <Plus className="w-4 h-4 mr-2" />
          New Queue
        </Button>
      </div>

      {scoreConfigs.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-amber-400 text-sm">
          Create score configurations first before creating annotation queues.
        </div>
      )}

      {queues.length === 0 ? (
        <Card className="p-8 text-center">
          <ListTodo className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-white mb-2">No Annotation Queues</h4>
          <p className="text-slate-400 mb-4">Create queues to organize traces for human review.</p>
          <Button onClick={() => setShowCreateModal(true)} disabled={scoreConfigs.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Queue
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {queues.map((queue) => (
            <Card key={queue.id} hover className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <ListTodo className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{queue.name}</h4>
                    {queue.description && (
                      <p className="text-sm text-slate-400">{queue.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  {/* Progress Stats */}
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1 text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span>{queue.pending_items || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-amber-400">
                      <BarChart3 className="w-4 h-4" />
                      <span>{queue.in_progress_items || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{queue.completed_items || 0}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-24">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${queue.progress_percentage || 0}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-1 text-center">
                      {Math.round(queue.progress_percentage || 0)}%
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => onQueueSelect?.(queue)}
                      disabled={(queue.pending_items || 0) + (queue.in_progress_items || 0) === 0}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </Button>
                    <button
                      onClick={() => handleDelete(queue.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Score Config Tags */}
              {queue.score_config_ids?.length > 0 && (
                <div className="mt-3 flex items-center space-x-2">
                  <span className="text-xs text-slate-500">Scoring:</span>
                  {queue.score_config_ids.map((configId) => {
                    const config = scoreConfigs.find(c => c.id === configId);
                    return config ? (
                      <span
                        key={configId}
                        className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded"
                      >
                        {config.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create Queue Modal */}
      <CreateQueueModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        scoreConfigs={scoreConfigs}
        onSave={() => {
          loadQueues();
          setShowCreateModal(false);
        }}
      />
    </div>
  );
};

const CreateQueueModal = ({ isOpen, onClose, scoreConfigs, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    score_config_ids: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        score_config_ids: [],
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await annotationsApi.createAnnotationQueue(formData);
      onSave();
    } catch (error) {
      console.error('Failed to create queue:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleScoreConfig = (configId) => {
    setFormData((prev) => ({
      ...prev,
      score_config_ids: prev.score_config_ids.includes(configId)
        ? prev.score_config_ids.filter((id) => id !== configId)
        : [...prev.score_config_ids, configId],
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Annotation Queue"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !formData.name || formData.score_config_ids.length === 0}
          >
            {saving ? 'Creating...' : 'Create Queue'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Queue Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Customer Support Review, RAG Quality Check"
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What is this queue for?"
            rows={2}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Score Configs */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Score Configurations *
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Select which scores annotators will assign to each item
          </p>
          <div className="space-y-2">
            {scoreConfigs.map((config) => (
              <label
                key={config.id}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                  formData.score_config_ids.includes(config.id)
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.score_config_ids.includes(config.id)}
                  onChange={() => toggleScoreConfig(config.id)}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="font-medium text-white">{config.name}</div>
                  {config.description && (
                    <div className="text-xs text-slate-400 mt-0.5">{config.description}</div>
                  )}
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  formData.score_config_ids.includes(config.id)
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-slate-600'
                }`}>
                  {formData.score_config_ids.includes(config.id) && (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default AnnotationQueueList;
