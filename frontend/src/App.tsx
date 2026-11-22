import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createBrowserRouter, Link, Navigate, RouterProvider, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { PanelLayout, RequireAccountType, SiteLayout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { ApiError } from './lib/api';
import { AccountPage } from './features/account/AccountPage';
import { MyApplicationsPage } from './features/applications/MyApplicationsPage';
import { ComparePage } from './features/artist/Compatibility';
import { MyProfilePage } from './features/artist/MyProfilePage';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, UnsubscribePage, VerifyEmailPage } from './features/auth/AuthPages';
import { HelpPage, PrivacyPage, TermsPage } from './features/legal/LegalPages';
import { NotificationPreferencesPage, NotificationsPage } from './features/notifications/NotificationPages';
import { BandPage, BandsPage } from './features/bands/BandPages';
import { BookingPage, BookingsPage } from './features/bookings/BookingPages';
import { DashboardPage, InvitationsPage, PanelMenuPage, SchedulePage } from './features/dashboard/DashboardPages';
import { ArtistPublicPage } from './features/marketplace/ArtistPublicPage';
import { MarketplacePage } from './features/marketplace/MarketplacePage';
import { VenuePublicPage, VenuesPage } from './features/marketplace/VenuePages';
import { OpportunitiesPage, OpportunityPage } from './features/opportunities/OpportunityPages';
import { EventManagePage, IndependentEventsPage, NewEventPage, NewIndependentEventPage } from './features/venues/EventPages';
import { MyVenuesPage, VenueManagePage } from './features/venues/VenuePages';

const artistOnly = (el: ReactNode) => <RequireAccountType type="ARTIST">{el}</RequireAccountType>;
const contractorOnly = (el: ReactNode) => <RequireAccountType type="CONTRACTOR">{el}</RequireAccountType>;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => !(err instanceof ApiError && [401, 403, 404].includes(err.status)) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

/** Move o foco para o título da página a cada navegação (leitores de tela). */
function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const h = document.querySelector<HTMLElement>('main h1');
    h?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="wrap page">
      <div className="empty">
        <strong>Página não encontrada</strong>
        <Link className="btn sm" to="/">
          Ir para o início
        </Link>
      </div>
    </div>
  );
}

function Root() {
  return (
    <>
      <RouteFocus />
      <SiteLayout />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <MarketplacePage /> },
      // "/artistas" sem perfil: a busca de artistas e bandas é a página inicial.
      { path: '/artistas', element: <Navigate to="/" replace /> },
      { path: '/artistas/:slug', element: <ArtistPublicPage /> },
      { path: '/oportunidades', element: <OpportunitiesPage /> },
      { path: '/oportunidades/:eventId', element: <OpportunityPage /> },
      { path: '/casas', element: <VenuesPage /> },
      { path: '/casas/:slug', element: <VenuePublicPage /> },
      { path: '/entrar', element: <LoginPage /> },
      { path: '/cadastro', element: <RegisterPage /> },
      { path: '/esqueci-senha', element: <ForgotPasswordPage /> },
      { path: '/redefinir-senha', element: <ResetPasswordPage /> },
      { path: '/verificar-email', element: <VerifyEmailPage /> },
      { path: '/notificacoes/descadastrar', element: <UnsubscribePage /> },
      { path: '/privacidade', element: <PrivacyPage /> },
      { path: '/termos', element: <TermsPage /> },
      { path: '/ajuda', element: <HelpPage /> },
      {
        path: '/painel',
        element: <PanelLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'convites', element: <InvitationsPage /> },
          { path: 'notificacoes', element: <NotificationsPage /> },
          { path: 'notificacoes/preferencias', element: <NotificationPreferencesPage /> },
          { path: 'perfil', element: artistOnly(<MyProfilePage />) },
          { path: 'bandas', element: artistOnly(<BandsPage />) },
          { path: 'bandas/:bandId', element: artistOnly(<BandPage />) },
          { path: 'casas', element: contractorOnly(<MyVenuesPage />) },
          { path: 'casas/:orgId', element: contractorOnly(<VenueManagePage />) },
          { path: 'casas/:orgId/eventos/novo', element: contractorOnly(<NewEventPage />) },
          { path: 'eventos', element: contractorOnly(<IndependentEventsPage />) },
          { path: 'eventos/novo', element: contractorOnly(<NewIndependentEventPage />) },
          { path: 'eventos/:eventId', element: <EventManagePage /> },
          { path: 'candidaturas', element: artistOnly(<MyApplicationsPage />) },
          { path: 'negociacoes', element: <BookingsPage /> },
          { path: 'negociacoes/:bookingId', element: <BookingPage /> },
          { path: 'agenda', element: <SchedulePage /> },
          { path: 'comparar', element: artistOnly(<ComparePage />) },
          { path: 'conta', element: <AccountPage /> },
          { path: 'menu', element: <PanelMenuPage /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
