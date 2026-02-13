/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import { useState, useEffect, useCallback } from "react";
import { Bell, Shield, Database, Loader2, AlertCircle, CheckCircle, Palette } from "lucide-react";
import { SettingSection, ToggleSetting } from "../components/settings/SettingsComponents";
import { ApiKeySettings } from "../components/settings/ApiKeySettings";
import { ThemeSettings } from "../components/settings/ThemeSettings";
import { settingsApi } from "../api";
import { getNotificationsEnabled, setNotificationsEnabled } from "../components/ui/Toast";

export const SettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [toastEnabled, setToastEnabled] = useState(getNotificationsEnabled);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await settingsApi.getUserSettings();
      setSettings(data);
    } catch (err) {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateSetting = useCallback(async (field, value) => {
    const prev = settings;
    setSettings((s) => ({ ...s, [field]: value }));
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await settingsApi.updateUserSettings({ [field]: value });
      setSettings(updated);
      setSuccessMessage("Setting saved");
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      setSettings(prev);
      setError("Failed to save setting");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  }, [settings]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-16">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-slate-400">Manage your preferences and configurations</p>
        </div>
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center text-rose-400">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <p className="flex-1 font-medium">{error}</p>
          <button
            onClick={loadSettings}
            className="ml-4 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-slate-400">Manage your preferences and configurations</p>
        </div>
        {saving && (
          <div className="flex items-center text-sm text-slate-400">
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            Saving...
          </div>
        )}
        {successMessage && !saving && (
          <div className="flex items-center text-sm text-green-400">
            <CheckCircle className="w-4 h-4 mr-1.5" />
            {successMessage}
          </div>
        )}
        {error && settings && !saving && (
          <div className="flex items-center text-sm text-rose-400">
            <AlertCircle className="w-4 h-4 mr-1.5" />
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance / Theme */}
        <div className="lg:col-span-2">
          <SettingSection
            icon={Palette}
            title="Appearance"
            description="Choose a theme for the interface"
          >
            <ThemeSettings />
          </SettingSection>
        </div>

        {/* Notifications */}
        <SettingSection
          icon={Bell}
          title="Notifications"
          description="Configure how you receive alerts"
        >
          <div className="divide-y divide-slate-800">
            <ToggleSetting
              label="Email Notifications"
              description="Receive email alerts for critical failures"
              checked={settings.email_notifications}
              onChange={(val) => updateSetting("email_notifications", val)}
            />
            <ToggleSetting
              label="Slack Integration"
              description="Send alerts to your Slack channel"
              checked={settings.slack_integration}
              onChange={(val) => updateSetting("slack_integration", val)}
            />
            <ToggleSetting
              label="Evaluation Toast Notifications"
              description="Show pop-up notifications when trace evaluations complete"
              checked={toastEnabled}
              onChange={(val) => {
                setToastEnabled(val);
                setNotificationsEnabled(val);
              }}
            />
          </div>
        </SettingSection>

        {/* Security */}
        <SettingSection
          icon={Shield}
          title="Security"
          description="Manage security and access settings"
        >
          <div className="divide-y divide-slate-800">
            <ToggleSetting
              label="Two-Factor Authentication"
              description="Add an extra layer of security"
              checked={settings.two_factor_auth}
              onChange={(val) => updateSetting("two_factor_auth", val)}
            />
            <ToggleSetting
              label="Audit Logging"
              description="Log all administrative actions"
              checked={settings.audit_logging}
              onChange={(val) => updateSetting("audit_logging", val)}
            />
          </div>
        </SettingSection>

        {/* Data Settings */}
        <SettingSection
          icon={Database}
          title="Data Settings"
          description="Configure data retention and storage"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Data Retention Period
              </label>
              <select
                value={settings.data_retention_days}
                onChange={(e) =>
                  updateSetting("data_retention_days", parseInt(e.target.value, 10))
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>
        </SettingSection>

        {/* API Keys */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
            <ApiKeySettings />
          </div>
        </div>
      </div>
    </div>
  );
};
