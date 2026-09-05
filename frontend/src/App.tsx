import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, homeFor, useAuth } from './app/AuthContext';
import { ToastProvider } from './app/ToastContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import type { Role } from './lib/types';

import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ContactsPage } from './pages/masters/ContactsPage';
import { ContactFormPage } from './pages/masters/ContactFormPage';
import { ProductsPage } from './pages/masters/ProductsPage';
import { ProductFormPage } from './pages/masters/ProductFormPage';
import { AnalyticFormPage, AnalyticsPage } from './pages/masters/AnalyticsPage';
import { AccountFormPage, AccountsPage } from './pages/masters/AccountsPage';
import { JournalFormPage, JournalsPage } from './pages/masters/JournalsPage';
import { JournalEntriesPage, JournalEntryFormPage } from './pages/masters/JournalEntriesPage';
import { BudgetsPage } from './pages/budgets/BudgetsPage';
import { BudgetFormPage } from './pages/budgets/BudgetFormPage';
import { PurchaseOrdersPage } from './pages/purchase/PurchaseOrdersPage';
import { PurchaseOrderFormPage } from './pages/purchase/PurchaseOrderFormPage';
import { VendorBillsPage } from './pages/purchase/VendorBillsPage';
import { VendorBillFormPage } from './pages/purchase/VendorBillFormPage';
import { SalesOrdersPage } from './pages/sales/SalesOrdersPage';
import { SalesOrderFormPage } from './pages/sales/SalesOrderFormPage';
import { CustomerInvoicesPage } from './pages/sales/CustomerInvoicesPage';
import { CustomerInvoiceFormPage } from './pages/sales/CustomerInvoiceFormPage';
import { PaymentFormPage, PaymentsPage } from './pages/payments/PaymentsPage';
import { ProfitAndLossPage } from './pages/reports/ProfitAndLossPage';
import { BalanceSheetPage } from './pages/reports/BalanceSheetPage';
import { BudgetAnalyticReportPage, BudgetReportPage } from './pages/reports/BudgetReportPage';
import { StockReportPage } from './pages/reports/StockReportPage';
import { PortalPage } from './pages/portal/PortalPage';
import { CreateUserPage, UsersPage } from './pages/users/UsersPage';

/** Client side mirror of the server role checks. */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

/** Signed in users never see the auth screens again. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Checking your session..." />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading..." />;
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

const BACK_OFFICE: Role[] = ['ADMIN', 'ACCOUNTANT'];

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />

            <Route
              path="/login"
              element={
                <PublicOnly>
                  <LoginPage />
                </PublicOnly>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnly>
                  <SignupPage />
                </PublicOnly>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicOnly>
                  <ForgotPasswordPage />
                </PublicOnly>
              }
            />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route
              path="/portal"
              element={
                <RequireRole roles={['CONTACT']}>
                  <PortalPage />
                </RequireRole>
              }
            />

            <Route
              element={
                <RequireRole roles={BACK_OFFICE}>
                  <Layout />
                </RequireRole>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Sales */}
              <Route path="/sales/orders" element={<SalesOrdersPage />} />
              <Route path="/sales/orders/new" element={<SalesOrderFormPage />} />
              <Route path="/sales/orders/:id" element={<SalesOrderFormPage />} />
              <Route path="/sales/invoices" element={<CustomerInvoicesPage />} />
              <Route path="/sales/invoices/new" element={<CustomerInvoiceFormPage />} />
              <Route path="/sales/invoices/:id" element={<CustomerInvoiceFormPage />} />
              <Route path="/sales/receipts" element={<PaymentsPage kind="RECEIVE" />} />
              <Route path="/sales/receipts/new" element={<PaymentFormPage kind="RECEIVE" />} />

              {/* Purchase */}
              <Route path="/purchase/orders" element={<PurchaseOrdersPage />} />
              <Route path="/purchase/orders/new" element={<PurchaseOrderFormPage />} />
              <Route path="/purchase/orders/:id" element={<PurchaseOrderFormPage />} />
              <Route path="/purchase/bills" element={<VendorBillsPage />} />
              <Route path="/purchase/bills/new" element={<VendorBillFormPage />} />
              <Route path="/purchase/bills/:id" element={<VendorBillFormPage />} />
              <Route path="/purchase/payments" element={<PaymentsPage kind="SEND" />} />
              <Route path="/purchase/payments/new" element={<PaymentFormPage kind="SEND" />} />

              {/* Account */}
              <Route path="/account/contacts" element={<ContactsPage />} />
              <Route path="/account/contacts/new" element={<ContactFormPage />} />
              <Route path="/account/contacts/:id" element={<ContactFormPage />} />
              <Route path="/account/products" element={<ProductsPage />} />
              <Route path="/account/products/new" element={<ProductFormPage />} />
              <Route path="/account/products/:id" element={<ProductFormPage />} />
              <Route path="/account/analytics" element={<AnalyticsPage />} />
              <Route path="/account/analytics/new" element={<AnalyticFormPage />} />
              <Route path="/account/analytics/:id" element={<AnalyticFormPage />} />
              <Route path="/account/budgets" element={<BudgetsPage />} />
              <Route path="/account/budgets/new" element={<BudgetFormPage />} />
              <Route path="/account/budgets/:id" element={<BudgetFormPage />} />
              <Route path="/account/chart-of-accounts" element={<AccountsPage />} />
              <Route path="/account/chart-of-accounts/new" element={<AccountFormPage />} />
              <Route path="/account/chart-of-accounts/:id" element={<AccountFormPage />} />
              <Route path="/account/journals" element={<JournalsPage />} />
              <Route path="/account/journals/new" element={<JournalFormPage />} />
              <Route path="/account/journals/:id" element={<JournalFormPage />} />
              <Route path="/account/journal-entries" element={<JournalEntriesPage />} />
              <Route path="/account/journal-entries/new" element={<JournalEntryFormPage />} />
              <Route path="/account/journal-entries/:id" element={<JournalEntryFormPage />} />

              {/* Report */}
              <Route path="/report/balance-sheet" element={<BalanceSheetPage />} />
              <Route path="/report/profit-and-loss" element={<ProfitAndLossPage />} />
              <Route path="/report/budget" element={<BudgetReportPage />} />
              <Route path="/report/stock" element={<StockReportPage />} />
              <Route
                path="/report/budget-analytic/:analyticId"
                element={<BudgetAnalyticReportPage />}
              />

              {/* Admin only */}
              <Route
                path="/users"
                element={
                  <RequireRole roles={['ADMIN']}>
                    <UsersPage />
                  </RequireRole>
                }
              />
              <Route
                path="/users/new"
                element={
                  <RequireRole roles={['ADMIN']}>
                    <CreateUserPage />
                  </RequireRole>
                }
              />
            </Route>

            <Route path="*" element={<Landing />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
