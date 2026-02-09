/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React from "react";
import { Bell, Shield, Database, Key, Save } from "lucide-react";
import { Button } from "../components/ui/Button";
import { SettingSection, ToggleSetting } from "../components/settings/SettingsComponents";

export const SettingsPage = () => {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-slate-400">Manage your preferences and configurations</p>
        </div>
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
              checked={true}
              onChange={() => { }}
              disabled
            />
            <ToggleSetting
              label="Slack Integration"
              description="Send alerts to your Slack channel"
              checked={false}
              onChange={() => { }}
              disabled
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
              checked={true}
              onChange={() => { }}
              disabled
            />
            <ToggleSetting
              label="Audit Logging"
              description="Log all administrative actions"
              checked={true}
              onChange={() => { }}
              disabled
            />
          </div>
        </SettingSection>

        {/* Data Settings */}
        <SettingSection
          icon={Database}
          title="Data Settings"
          description="Configure data retention and storage"
        >
          <div className="space-y-4 opacity-50 pointer-events-none">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Data Retention Period</label>
              <select className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                <option>30 days</option>
                <option>60 days</option>
              </select>
            </div>
          </div>
        </SettingSection>

        {/* API Keys */}
        <SettingSection
          icon={Key}
          title="API Keys"
          description="Manage your API access tokens"
        >
          <div className="space-y-4 opacity-50 pointer-events-none">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Production Key</div>
                <div className="text-xs text-slate-500 font-mono">sk-prod-****-****-****</div>
              </div>
              <Button variant="ghost" size="sm" disabled>Regenerate</Button>
            </div>
          </div>
        </SettingSection>
      </div>
    </div>
  );
};
