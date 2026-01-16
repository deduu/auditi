import React, { useState } from "react";
import { Settings, Bell, Shield, Database, Key, Users, Globe, Save } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const SettingSection = ({ icon: Icon, title, description, children }) => (
  <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>
    </div>
    <div className="p-6">{children}</div>
  </Card>
);

const ToggleSetting = ({ label, description, defaultChecked = false }) => {
  const [enabled, setEnabled] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-blue-600" : "bg-slate-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
};

export const SettingsPage = () => {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-slate-400">Manage your preferences and configurations</p>
        </div>
        <Button variant="primary">
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              defaultChecked={true}
            />
            <ToggleSetting
              label="Slack Integration"
              description="Send alerts to your Slack channel"
              defaultChecked={false}
            />
            <ToggleSetting
              label="Daily Summary"
              description="Get a daily digest of agent performance"
              defaultChecked={true}
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
              defaultChecked={true}
            />
            <ToggleSetting
              label="API Rate Limiting"
              description="Limit API requests to prevent abuse"
              defaultChecked={true}
            />
            <ToggleSetting
              label="Audit Logging"
              description="Log all administrative actions"
              defaultChecked={true}
            />
          </div>
        </SettingSection>

        {/* API Configuration */}
        <SettingSection
          icon={Key}
          title="API Configuration"
          description="Manage API keys and endpoints"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">API Endpoint</label>
              <input
                type="text"
                defaultValue="https://api.example.com/v1"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">API Key</label>
              <input
                type="password"
                defaultValue="sk-xxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
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
              <label className="block text-sm font-medium text-slate-400 mb-1">Data Retention Period</label>
              <select className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                <option>30 days</option>
                <option>60 days</option>
                <option>90 days</option>
                <option>1 year</option>
              </select>
            </div>
            <div className="divide-y divide-slate-800">
              <ToggleSetting
                label="Auto-Archive"
                description="Automatically archive old conversations"
                defaultChecked={true}
              />
            </div>
          </div>
        </SettingSection>
      </div>
    </div>
  );
};
