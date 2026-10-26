import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { ApiError } from "./api/client";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAdmin, RequireAuth, RequireProject } from "./auth/guards";
import { AppLayout } from "./components/layout/AppLayout";
import { ThemeProvider } from "./context/ThemeProvider";
import { ToastProvider } from "./context/ToastProvider";
import { AccountPage } from "./pages/AccountPage";
import { LogsPage } from "./pages/admin/LogsPage";
import { OverviewPage } from "./pages/admin/OverviewPage";
import { ProjectsPage } from "./pages/admin/ProjectsPage";
import { SsoPage } from "./pages/admin/SsoPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { WebhooksPage } from "./pages/admin/WebhooksPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { NewTicketPage } from "./pages/NewTicketPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TicketPage } from "./pages/TicketPage";
import { TicketsPage } from "./pages/TicketsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Inutile de réessayer une erreur client (404, 403…) : seules les pannes réseau/serveur le méritent.
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<RequireAuth />}>
                  <Route element={<AppLayout />}>
                    <Route element={<RequireProject />}>
                      <Route index element={<DashboardPage />} />
                      <Route path="tickets" element={<TicketsPage />} />
                      <Route path="tickets/new" element={<NewTicketPage />} />
                    </Route>
                    <Route path="tickets/:ticketId" element={<TicketPage />} />
                    <Route path="account" element={<AccountPage />} />
                    <Route path="admin" element={<RequireAdmin />}>
                      <Route index element={<Navigate to="overview" replace />} />
                      <Route path="overview" element={<OverviewPage />} />
                      <Route path="users" element={<UsersPage />} />
                      <Route path="projects" element={<ProjectsPage />} />
                      <Route path="sso" element={<SsoPage />} />
                      <Route path="webhooks" element={<WebhooksPage />} />
                      <Route path="logs" element={<LogsPage />} />
                    </Route>
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
