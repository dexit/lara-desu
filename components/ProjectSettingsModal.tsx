
import React, { useState } from 'react';
import { X, Settings, ShieldCheck, Key, Package, UserCheck, Activity, Image as ImageIcon, Archive, Type, HeartPulse, Webhook, LayoutDashboard, CreditCard, Users } from 'lucide-react';
import { ProjectSettings, AVAILABLE_PACKAGES } from '../types';

interface ProjectSettingsModalProps {
  settings: ProjectSettings;
  onClose: () => void;
  onSave: (settings: ProjectSettings) => void;
}

const iconMap: Record<string, React.ReactNode> = {
    breeze: <UserCheck size={20} className="text-blue-500" />,
    filamentAdmin: <LayoutDashboard size={20} className="text-amber-500" />,
    cashier: <CreditCard size={20} className="text-indigo-500" />,
    tenancy: <Users size={20} className="text-pink-500" />,
    sanctum: <Key size={20} className="text-slate-500" />,
    spatiePermissions: <ShieldCheck size={20} className="text-green-500" />,
    spatieActivityLog: <Activity size={20} className="text-yellow-500" />,
    spatieMediaLibrary: <ImageIcon size={20} className="text-purple-500" />,
    spatieBackup: <Archive size={20} className="text-red-500" />,
    spatieSluggable: <Type size={20} className="text-pink-500" />,
    spatieHealth: <HeartPulse size={20} className="text-cyan-500" />,
    spatieWebhookClient: <Webhook size={20} className="text-orange-500" />,
    spatieWebhookServer: <Webhook size={20} className="text-orange-500" />,
};

export default function ProjectSettingsModal({ settings, onClose, onSave }: ProjectSettingsModalProps) {
    const [localSettings, setLocalSettings] = useState<ProjectSettings>(settings);

    const handleToggle = (type: 'authentication' | 'packages' | 'saas', key: string) => {
        setLocalSettings(prev => ({
            ...prev,
            [type]: {
                // @ts-ignore
                ...prev[type],
                // @ts-ignore
                [key]: !prev[type][key],
            }
        }));
    };

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };

    const renderPackageOption = (pkgKey: keyof typeof AVAILABLE_PACKAGES) => {
        const pkg = AVAILABLE_PACKAGES[pkgKey];
        let stateKey: 'authentication' | 'packages' | 'saas' = 'packages';
        
        if (pkg.category === 'Authentication') stateKey = 'authentication';
        else if (pkg.category === 'SaaS') stateKey = 'saas';

        // @ts-ignore
        const isChecked = localSettings[stateKey][pkg.id];

        return (
            <label key={pkg.id} className="flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all bg-white dark:bg-slate-800 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/20">
                {iconMap[pkg.id] || <Package size={20} className="text-slate-400 mt-1" />}
                <div className="flex-1">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{pkg.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{pkg.description}</div>
                </div>
                <input 
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(stateKey, pkg.id)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-900 mt-0.5"
                />
            </label>
        );
    }

    return (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-[90vh] max-h-[800px] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
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
                <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
                    
                    {/* SaaS Section */}
                    <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                        <h4 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-2 flex items-center gap-2">
                            <LayoutDashboard size={18} /> SaaS Starter Kit
                        </h4>
                        <p className="text-xs text-indigo-700 dark:text-indigo-400 mb-4">
                            Instantly scaffold a commercial-grade application stack.
                        </p>
                        <div className="space-y-3">
                            {renderPackageOption('FILAMENT')}
                            {renderPackageOption('CASHIER')}
                            {renderPackageOption('TENANCY')}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Authentication</h4>
                         <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Bootstrap your application with a complete authentication system.
                        </p>
                        <div className="space-y-3">
                            {renderPackageOption('BREEZE')}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Spatie Packages</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Select from a curated list of the best Spatie packages.
                        </p>
                        <div className="space-y-3">
                            {Object.keys(AVAILABLE_PACKAGES)
                                .filter(key => AVAILABLE_PACKAGES[key as keyof typeof AVAILABLE_PACKAGES].category === 'Packages')
                                .map(pkgKey => renderPackageOption(pkgKey as keyof typeof AVAILABLE_PACKAGES))
                            }
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
