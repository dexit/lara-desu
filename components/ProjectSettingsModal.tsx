import React, { useState } from 'react';
import { X, Settings, ShieldCheck, Key } from 'lucide-react';
import { ProjectSettings, AVAILABLE_PACKAGES } from '../types';

interface ProjectSettingsModalProps {
  settings: ProjectSettings;
  onClose: () => void;
  onSave: (settings: ProjectSettings) => void;
}

export default function ProjectSettingsModal({ settings, onClose, onSave }: ProjectSettingsModalProps) {
    const [localSettings, setLocalSettings] = useState<ProjectSettings>(settings);

    const handlePackageToggle = (packageName: 'sanctum' | 'spatiePermissions') => {
        setLocalSettings(prev => ({
            ...prev,
            packages: {
                ...prev.packages,
                [packageName]: !prev.packages[packageName]
            }
        }));
    };

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };

    return (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Settings className="text-indigo-500" />
                        Project Settings
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Laravel Packages</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Select common packages to include in your project. The required boilerplate code will be automatically generated.
                        </p>
                        <div className="space-y-3">
                            {/* Sanctum */}
                            <label className="flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all bg-white dark:bg-slate-800 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/20">
                                <Key size={20} className="text-slate-400 mt-1" />
                                <div className="flex-1">
                                    <div className="font-bold text-slate-900 dark:text-white text-sm">{AVAILABLE_PACKAGES.SANCTUM.name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{AVAILABLE_PACKAGES.SANCTUM.description}</div>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={localSettings.packages.sanctum}
                                    onChange={() => handlePackageToggle('sanctum')}
                                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-900 mt-0.5"
                                />
                            </label>

                            {/* Spatie Permissions */}
                            <label className="flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all bg-white dark:bg-slate-800 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/20">
                                <ShieldCheck size={20} className="text-slate-400 mt-1" />
                                <div className="flex-1">
                                    <div className="font-bold text-slate-900 dark:text-white text-sm">{AVAILABLE_PACKAGES.SPATIE_PERMISSIONS.name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{AVAILABLE_PACKAGES.SPATIE_PERMISSIONS.description}</div>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={localSettings.packages.spatiePermissions}
                                    onChange={() => handlePackageToggle('spatiePermissions')}
                                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-900 mt-0.5"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
