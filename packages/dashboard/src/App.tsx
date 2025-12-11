import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { AppInitializer } from './components/AppInitializer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Dashboard } from './pages/Dashboard';
import { SessionView } from './pages/SessionView';
import { IncidentsPage } from './pages/IncidentsPage';
import { RulebookEditor } from './pages/RulebookEditor';
import { ReportsPage } from './pages/ReportsPage';
import { LoginPage } from './pages/LoginPage';
import { EventsPage } from './pages/EventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { DiscordSettingsPage } from './pages/DiscordSettingsPage';
import ProtestsPage from './pages/ProtestsPage';
import AuditLogPage from './pages/AuditLogPage';

export function App() {
    return (
        <AppInitializer>
            <BrowserRouter>
                <Routes>
                    {/* Public route */}
                    <Route path="/login" element={<LoginPage />} />

                    {/* Protected routes */}
                    <Route path="/" element={
                        <ProtectedRoute>
                            <MainLayout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<Dashboard />} />
                        <Route path="session/:sessionId" element={<SessionView />} />
                        <Route path="incidents" element={<IncidentsPage />} />
                        <Route path="rulebooks" element={<RulebookEditor />} />
                        <Route path="reports" element={<ReportsPage />} />

                        {/* Events */}
                        <Route path="seasons/:seasonId/events" element={<EventsPage />} />
                        <Route path="events/:eventId" element={<EventDetailPage />} />

                        {/* Discord Settings */}
                        <Route path="leagues/:leagueId/discord" element={<DiscordSettingsPage />} />

                        {/* Protests & Appeals (P0 Core) */}
                        <Route path="protests" element={<ProtestsPage />} />

                        {/* Audit Log (P0 Core) */}
                        <Route path="audit" element={<AuditLogPage />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AppInitializer>
    );
}

