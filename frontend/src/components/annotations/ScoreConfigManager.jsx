import React, { useState, useEffect } from 'react';
import { Plus, Settings, Trash2, Archive, Hash, ToggleLeft, List } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { annotationsApi } from '../../api';

const DATA_TYPE_ICONS = {
  numerical: Hash,
  categorical: List,
  binary: ToggleLeft,
};

const DATA_TYPE_LABELS = {
  numerical: 'Numerical (0-1 scale)',
  categorical: 'Categorical (predefined options)',
  binary: 'Binary (Yes/No)',
};

export const ScoreConfigManager = ({ onConfigSelect }) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const data = await annotationsApi.getScoreConfigs();
      setConfigs(data);
    } catch (error) {
      console.error('Failed to load score configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (configId) => {
    if (!confirm('Archive this score configuration?')) return;
    try {
      await annotationsApi.deleteScoreConfig(configId);
      loadConfigs();
    } catch (error) {
      console.error('Failed to delete config:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-slate-500">Loading score configurations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-white">Score Configurations</h3>
          <p className="text-sm text-slate-400">Define scoring criteria for human annotation</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Config
        </Button>
      </div>

      {configs.length === 0 ? (
        <Card className="p-8 text-center">
          <Settings className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-white mb-2">No Score Configurations</h4>
          <p className="text-slate-400 mb-4">Create score configs to define how you want to evaluate traces.</p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Config
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {configs.map((config) => {
            const Icon = DATA_TYPE_ICONS[config.data_type] || Hash;
            return (
              <Card
                key={config.id}
                hover
                className="cursor-pointer"
                onClick={() => onConfigSelect?.(config)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{config.name}</h4>
                      <p className="text-xs text-slate-400">{DATA_TYPE_LABELS[config.data_type]}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(config.id);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
                {config.description && (
                  <p className="mt-3 text-sm text-slate-400 line-clamp-2">{config.description}</p>
                )}
                <div className="mt-3 flex items-center space-x-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    config.annotation_level === 'both' ? 'bg-purple-500/20 text-purple-400' :
                    config.annotation_level === 'trace' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {config.annotation_level === 'both' ? 'Trace & Span' :
                     config.annotation_level === 'trace' ? 'Trace only' : 'Span only'}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <ScoreConfigModal
        isOpen={showCreateModal || !!editingConfig}
        onClose={() => {
          setShowCreateModal(false);
          setEditingConfig(null);
        }}
        config={editingConfig}
        onSave={() => {
          loadConfigs();
          setShowCreateModal(false);
          setEditingConfig(null);
        }}
      />
    </div>
  );
};

const ScoreConfigModal = ({ isOpen, onClose, config, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    data_type: 'numerical',
    min_value: 0,
    max_value: 1,
    categories: [
      { value: 1, label: 'Poor' },
      { value: 2, label: 'Fair' },
      { value: 3, label: 'Good' },
      { value: 4, label: 'Excellent' },
    ],
    binary_labels: { true_label: 'Yes', false_label: 'No' },
    annotation_level: 'both',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        name: config.name || '',
        description: config.description || '',
        data_type: config.data_type || 'numerical',
        min_value: config.min_value ?? 0,
        max_value: config.max_value ?? 1,
        categories: config.categories || [
          { value: 1, label: 'Poor' },
          { value: 2, label: 'Fair' },
          { value: 3, label: 'Good' },
          { value: 4, label: 'Excellent' },
        ],
        binary_labels: config.binary_labels || { true_label: 'Yes', false_label: 'No' },
        annotation_level: config.annotation_level || 'both',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        data_type: 'numerical',
        min_value: 0,
        max_value: 1,
        categories: [
          { value: 1, label: 'Poor' },
          { value: 2, label: 'Fair' },
          { value: 3, label: 'Good' },
          { value: 4, label: 'Excellent' },
        ],
        binary_labels: { true_label: 'Yes', false_label: 'No' },
        annotation_level: 'both',
      });
    }
  }, [config, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        data_type: formData.data_type,
        annotation_level: formData.annotation_level,
      };

      if (formData.data_type === 'numerical') {
        payload.min_value = formData.min_value;
        payload.max_value = formData.max_value;
      } else if (formData.data_type === 'categorical') {
        payload.categories = formData.categories;
      } else if (formData.data_type === 'binary') {
        payload.binary_labels = formData.binary_labels;
      }

      if (config) {
        await annotationsApi.updateScoreConfig(config.id, payload);
      } else {
        await annotationsApi.createScoreConfig(payload);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    const nextValue = Math.max(...formData.categories.map(c => c.value), 0) + 1;
    setFormData({
      ...formData,
      categories: [...formData.categories, { value: nextValue, label: '' }],
    });
  };

  const removeCategory = (index) => {
    setFormData({
      ...formData,
      categories: formData.categories.filter((_, i) => i !== index),
    });
  };

  const updateCategory = (index, field, value) => {
    const updated = [...formData.categories];
    updated[index] = { ...updated[index], [field]: field === 'value' ? parseInt(value) : value };
    setFormData({ ...formData, categories: updated });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={config ? 'Edit Score Configuration' : 'Create Score Configuration'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !formData.name}>
            {saving ? 'Saving...' : config ? 'Update' : 'Create'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Accuracy, Helpfulness, Relevance"
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
            placeholder="What does this score measure?"
            rows={2}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Data Type */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Score Type</label>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(DATA_TYPE_LABELS).map(([type, label]) => {
              const Icon = DATA_TYPE_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, data_type: type })}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    formData.data_type === type
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${formData.data_type === type ? 'text-blue-400' : 'text-slate-400'}`} />
                  <div className={`text-sm font-medium ${formData.data_type === type ? 'text-white' : 'text-slate-300'}`}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Type-specific config */}
        {formData.data_type === 'numerical' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Min Value</label>
              <input
                type="number"
                step="0.1"
                value={formData.min_value}
                onChange={(e) => setFormData({ ...formData, min_value: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Max Value</label>
              <input
                type="number"
                step="0.1"
                value={formData.max_value}
                onChange={(e) => setFormData({ ...formData, max_value: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {formData.data_type === 'categorical' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Categories</label>
            <div className="space-y-2">
              {formData.categories.map((cat, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={cat.value}
                    onChange={(e) => updateCategory(index, 'value', e.target.value)}
                    className="w-20 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Value"
                  />
                  <input
                    type="text"
                    value={cat.label}
                    onChange={(e) => updateCategory(index, 'label', e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Label"
                  />
                  <button
                    type="button"
                    onClick={() => removeCategory(index)}
                    className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addCategory}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                + Add Category
              </button>
            </div>
          </div>
        )}

        {formData.data_type === 'binary' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">True Label</label>
              <input
                type="text"
                value={formData.binary_labels.true_label}
                onChange={(e) => setFormData({
                  ...formData,
                  binary_labels: { ...formData.binary_labels, true_label: e.target.value }
                })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">False Label</label>
              <input
                type="text"
                value={formData.binary_labels.false_label}
                onChange={(e) => setFormData({
                  ...formData,
                  binary_labels: { ...formData.binary_labels, false_label: e.target.value }
                })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Annotation Level */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Annotation Level</label>
          <select
            value={formData.annotation_level}
            onChange={(e) => setFormData({ ...formData, annotation_level: e.target.value })}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="both">Both Trace & Span</option>
            <option value="trace">Trace only</option>
            <option value="span">Span only</option>
          </select>
        </div>
      </form>
    </Modal>
  );
};

export default ScoreConfigManager;
