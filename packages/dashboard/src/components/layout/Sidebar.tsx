import { NavLink } from 'react-router-dom';

const navItems = [
    { to: '/', label: 'Dashboard', icon: '🏠' },
    { to: '/incidents', label: 'Incidents', icon: '⚠️' },
    { to: '/rulebooks', label: 'Rulebooks', icon: '📖' },
    { to: '/reports', label: 'Reports', icon: '📊' },
];

export function Sidebar() {
    return (
        <aside className="w-64 bg-slate-800/50 border-r border-slate-700/50 flex flex-col">
            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive
                                ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                            }`
                        }
                    >
                        <span className="text-lg">{item.icon}</span>
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Session quick actions */}
            <div className="p-4 border-t border-slate-700/50">
                <button className="w-full btn btn-primary flex items-center justify-center gap-2">
                    <span>🏁</span>
                    <span>New Session</span>
                </button>
            </div>
        </aside>
    );
}
