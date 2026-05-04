
import React, { useState } from 'react';
import { X, Settings, ShieldCheck, Key, Package, UserCheck, Activity, Image as ImageIcon, Archive, Type, HeartPulse, Webhook, LayoutDashboard, CreditCard, Users, Zap, Binary, Layers, Terminal, BookOpen, Bug } from 'lucide-react';
import { ProjectSettings, AVAILABLE_PACKAGES } from '../types';

interface ProjectSettingsModalProps {
  settings: ProjectSettings;
  onClose: () => void;
  onSave: (settings: ProjectSettings) => void;
}

const iconMap: Record<string, React.ReactNode> = {
    breeze: <UserCheck size={20} className="text-blue-500" />,
    socialite: <Users size={20} className="text-orange-500" />,
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
    const [activeTab, setActiveTab] = useState<'stack' | 'saas' | 'packages' | 'api'>('stack');

    const handleToggle = (type: keyof ProjectSettings, key: string) => {
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

    const handleNumberChange = (key: 'rateLimitRequests' | 'rateLimitPeriod', value: number) => {
        setLocalSettings(prev => ({
            ...prev,
            api: {
                ...prev.api,
                [key]: value
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
            <label key={pkg.id} className="flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/20">
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
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex">
                
                {/* Sidebar */}
                <div className="w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-1">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6 px-2">
                        <Settings className="text-indigo-500" />
                        Settings
                    </h3>
                    
                    {[
                        { id: 'stack', icon: Layers, label: 'Tech Stack' },
                        { id: 'saas', icon: LayoutDashboard, label: 'SaaS & Admin' },
                        { id: 'packages', icon: Package, label: 'Packages' },
                        { id: 'api', icon: Zap, label: 'API & DevTools' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        
                        {activeTab === 'stack' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Frontend Stack</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {['blade', 'livewire', 'inertia-vue', 'inertia-react'].map(stack => (
                                            <label key={stack} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${localSettings.frontend.stack === stack ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200'}`}>
                                                <input 
                                                    type="radio" 
                                                    name="stack" 
                                                    value={stack}
                                                    checked={localSettings.frontend.stack === stack}
                                                    onChange={() => setLocalSettings({...localSettings, frontend: { ...localSettings.frontend, stack: stack as any }})}
                                                    className="text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <div className="capitalize font-bold text-slate-700 dark:text-slate-200">
                                                    {stack.replace('-', ' ')}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Authentication</h4>
                                    <div className="space-y-3">
                                        {renderPackageOption('BREEZE')}
                                        {renderPackageOption('SOCIALITE')}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'saas' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-900/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                    <h4 className="font-bold text-indigo-900 dark:text-indigo-200 mb-2 flex items-center gap-2">
                                        <LayoutDashboard className="text-indigo-500" />
                                        Filament Admin Panel
                                    </h4>
                                    <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4 opacity-80">
                                        The gold standard for Laravel admin panels. We generate complete Filament Resources, Forms, and Tables based on your schema.
                                    </p>
                                    <label className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg w-fit border border-indigo-200 dark:border-indigo-800 cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={localSettings.saas.filamentAdmin}
                                            onChange={() => handleToggle('saas', 'filamentAdmin')}
                                            className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="font-bold text-slate-800 dark:text-white">Enable Filament PHP</span>
                                    </label>
                                </div>

                                <h4 className="text-lg font-bold text-slate-800 dark:text-white">SaaS Modules</h4>
                                <div className="space-y-3">
                                    {renderPackageOption('CASHIER')}
                                    {renderPackageOption('TENANCY')}
                                </div>
                            </div>
                        )}

                        {activeTab === 'packages' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Ecosystem Packages</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    {Object.keys(AVAILABLE_PACKAGES)
                                        .filter(key => AVAILABLE_PACKAGES[key as keyof typeof AVAILABLE_PACKAGES].category === 'Packages')
                                        .map(pkgKey => renderPackageOption(pkgKey as keyof typeof AVAILABLE_PACKAGES))
                                    }
                                </div>
                            </div>
                        )}

                        {activeTab === 'api' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                        <Zap className="text-yellow-500" /> API Configuration
                                    </h4>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rate Limit</label>
                                            <input 
                                                type="number"
                                                min="1"
                                                value={localSettings.api.rateLimitRequests}
                                                onChange={(e) => handleNumberChange('rateLimitRequests', parseInt(e.target.value))}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Period (Min)</label>
                                            <input 
                                                type="number"
                                                min="1"
                                                value={localSettings.api.rateLimitPeriod}
                                                onChange={(e) => handleNumberChange('rateLimitPeriod', parseInt(e.target.value))}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                            <Binary size={18} className="text-indigo-500" />
                                            <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">Generate DTOs</span>
                                            <input type="checkbox" checked={localSettings.api.generateDtos} onChange={() => handleToggle('api', 'generateDtos')} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                        </label>
                                        <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                            <BookOpen size={18} className="text-green-500" />
                                            <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">Generate API Docs (Scramble)</span>
                                            <input type="checkbox" checked={localSettings.api.generateDocs} onChange={() => handleToggle('api', 'generateDocs')} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Developer Tools</h4>
                                    <div className="grid grid-cols-1 gap-3">
                                         <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                            <Activity size={18} className="text-cyan-500" />
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-slate-800 dark:text-white">Laravel Telescope</div>
                                                <div className="text-xs text-slate-500">Local debug assistant.</div>
                                            </div>
                                            <input type="checkbox" checked={localSettings.devTools.telescope} onChange={() => handleToggle('devTools', 'telescope')} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                        </label>
                                        <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                            <Bug size={18} className="text-red-500" />
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-slate-800 dark:text-white">Laravel Debugbar</div>
                                                <div className="text-xs text-slate-500">Profiler for debugging.</div>
                                            </div>
                                            <input type="checkbox" checked={localSettings.devTools.debugbar} onChange={() => handleToggle('devTools', 'debugbar')} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                        </label>
                                        <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                            <Terminal size={18} className="text-purple-500" />
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-slate-800 dark:text-white">Pest PHP</div>
                                                <div className="text-xs text-slate-500">Elegant testing framework.</div>
                                            </div>
                                            <input type="checkbox" checked={localSettings.testing.pest} onChange={() => handleToggle('testing', 'pest')} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
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
        </div>
    );
}
