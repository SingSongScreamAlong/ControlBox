import { useAuthStore } from '../../stores/auth.store';
import { useNavigate } from 'react-router-dom';

export function Header() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <header className="bg-slate-800/80 border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center justify-between h-16 px-6">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">C</span>
                    </div>
                    <div>
                        <h1 className="font-semibold text-white">ControlBox</h1>
                        <p className="text-xs text-slate-400">Race Control Dashboard</p>
                    </div>
                </div>

                {/* Session indicator + User menu */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm text-slate-300">No Active Session</span>
                    </div>

                    {/* User menu */}
                    <div className="flex items-center gap-3 border-l border-slate-600 pl-4">
                        <div className="text-right">
                            <p className="text-sm text-white font-medium">
                                {user?.displayName || 'User'}
                            </p>
                            <p className="text-xs text-slate-400">
                                {user?.isSuperAdmin ? 'Super Admin' : 'Admin'}
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1.5 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
                            title="Sign out"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
