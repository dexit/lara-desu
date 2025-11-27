import React, { useState } from 'react';
import { X, Settings, ShieldCheck, Key, Package, UserCheck, Activity, Image as ImageIcon, Archive, Type, HeartPulse, Webhook } from 'lucide-react';
import { ProjectSettings, AVAILABLE_PACKAGES } from '../types';

interface ProjectSettingsModalProps {
  settings: ProjectSettings;
  onClose: () => void;
  onSave: (settings: ProjectSettings) => void;
}

const iconMap: Record<string, React.ReactNode> = {
    breeze: <UserCheck size={20} className="text-blue-500" />,
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

    const handleToggle = (type: 'authentication' | 'packages', key: string) => {
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
        const isAuth = pkg.category === 'Authentication';
        const stateKey = isAuth ? 'authentication' : 'packages';
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
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-[90vh] max-h-[700px] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800