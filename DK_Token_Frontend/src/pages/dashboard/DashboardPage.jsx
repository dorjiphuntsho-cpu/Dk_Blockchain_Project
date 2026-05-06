import {
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentChartBarIcon,
  ExclamationCircleIcon,
  InboxStackIcon,
  PencilSquareIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AuditActivityPanel from '../../components/dashboard/AuditActivityPanel';
import DashboardMetricGrid from '../../components/dashboard/DashboardMetricGrid';
import RecentRequestsTable from '../../components/dashboard/RecentRequestsTable';
import RequestListPanel from '../../components/dashboard/RequestListPanel';
import ReserveBalancePanel from '../../components/cbs/ReserveBalancePanel';
import ErrorState from '../../components/common/ErrorState';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/common/PageSection';
import WalletConnectCard from '../../components/wallet/WalletConnectCard';
import useAuth from '../../hooks/useAuth';
import { auditLogsApi } from '../../modules/auditLogs/auditLogs.api';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { REQUEST_STATUSES, ROLES } from '../../utils/constants';
import { formatAmount } from '../../utils/format';

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-80 animate-pulse rounded bg-white/10" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-28 animate-pulse rounded-lg border border-white/10 bg-zinc-900" key={index} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="h-80 animate-pulse rounded-lg border border-white/10 bg-zinc-900" />
        <div className="space-y-4">
          <div className="h-48 animate-pulse rounded-lg border border-white/10 bg-zinc-900" />
          <div className="h-48 animate-pulse rounded-lg border border-white/10 bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}

function getPrimaryRole(user) {
  if (user?.roles?.includes(ROLES.ADMIN)) return ROLES.ADMIN;
  if (user?.roles?.includes(ROLES.MAKER)) return ROLES.MAKER;
  if (user?.roles?.includes(ROLES.CHECKER)) return ROLES.CHECKER;
  if (user?.roles?.includes(ROLES.EXECUTOR)) return ROLES.EXECUTOR;
  return null;
}

function metric(key, label, value, subtitle, icon, accent) {
  return { key, label, value, subtitle, icon, accent };
}

function DashboardPage() {
  const [state, setState] = useState({
    overview: null,
    drafts: [],
    draftCount: 0,
    rejected: [],
    rejectedCount: 0,
    reviewed: [],
    reviewedCount: 0,
    approvedQueue: [],
    readyQueue: [],
    auditTrail: [],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const dashboardRole = useMemo(() => getPrimaryRole(user), [user]);

  useEffect(() => {
    async function load() {
      if (!user?.id) {
        return;
      }

      try {
        setLoading(true);
        setError('');

        const overviewPromise = tokenRequestsApi.dashboard();
        const requestsByStatus = (status, extra = {}) => tokenRequestsApi.list({ page: 1, limit: 5, status, ...extra });

        const calls = [overviewPromise];

        if (dashboardRole === ROLES.ADMIN) {
          calls.push(
            requestsByStatus(REQUEST_STATUSES.ON_CHAIN_PENDING),
            auditLogsApi.list({ page: 1, limit: 5 }),
          );
        } else if (dashboardRole === ROLES.MAKER) {
          calls.push(
            requestsByStatus(REQUEST_STATUSES.DRAFT, { makerUserId: user.id }),
            requestsByStatus(REQUEST_STATUSES.REJECTED, { makerUserId: user.id }),
          );
        } else if (dashboardRole === ROLES.CHECKER) {
          calls.push(tokenRequestsApi.list({ page: 1, limit: 5, checkerUserId: user.id }));
        } else if (dashboardRole === ROLES.EXECUTOR) {
          calls.push(requestsByStatus(REQUEST_STATUSES.ON_CHAIN_PENDING));
        }

        const results = await Promise.all(calls);
        const [overviewResponse, ...rest] = results;

        const nextState = {
          overview: overviewResponse.data,
          drafts: [],
          draftCount: 0,
          rejected: [],
          rejectedCount: 0,
          reviewed: [],
          reviewedCount: 0,
          approvedQueue: [],
          readyQueue: [],
          auditTrail: overviewResponse.data?.auditTrail || [],
        };

        if (dashboardRole === ROLES.ADMIN) {
          nextState.readyQueue = rest[0]?.data?.items || [];
          nextState.auditTrail = rest[1]?.data?.items || [];
        } else if (dashboardRole === ROLES.MAKER) {
          nextState.drafts = rest[0]?.data?.items || [];
          nextState.draftCount = rest[0]?.data?.pagination?.totalItems || 0;
          nextState.rejected = rest[1]?.data?.items || [];
          nextState.rejectedCount = rest[1]?.data?.pagination?.totalItems || 0;
        } else if (dashboardRole === ROLES.CHECKER) {
          nextState.reviewed = rest[0]?.data?.items || [];
          nextState.reviewedCount = rest[0]?.data?.pagination?.totalItems || 0;
        } else if (dashboardRole === ROLES.EXECUTOR) {
          nextState.readyQueue = rest[0]?.data?.items || [];
        }

        setState(nextState);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [dashboardRole, user?.id]);

  const overview = state.overview;
  const settlementSummary = overview?.settlementSummary || null;
  const reserveSummary = overview?.issuerReserveBalance || null;
  const tokenSummary = overview?.tokenSummary || null;
  const tokenSymbol = tokenSummary?.symbol || 'BTN';
  const reserveBalanceMetricValue = reserveSummary?.inquiry?.availableBalance != null
    ? `${reserveSummary.inquiry.currencyCode || reserveSummary.reserveAccount?.currency || 'BTN'} ${formatAmount(reserveSummary.inquiry.availableBalance)}`
    : 'Unavailable';
  const circulationMetricValue = tokenSummary?.inCirculationDisplay != null
    ? `${formatAmount(tokenSummary.inCirculationDisplay)} ${tokenSymbol}`
    : 'Unavailable';
  const distributorMetricValue = tokenSummary?.distributionInventory?.displayAmount != null
    ? `${formatAmount(tokenSummary.distributionInventory.displayAmount)} ${tokenSymbol}`
    : 'Unavailable';

  const pageCopy = useMemo(() => {
    switch (dashboardRole) {
      case ROLES.ADMIN:
        return {
          eyebrow: 'Admin Overview',
          title: 'Dashboard',
          subtitle: 'Monitor request volume, review queues, and recent control activity across the portal.',
          recentTitle: 'Latest Token Requests',
          recentSubtitle: 'Newest requests across makers, approvals, and execution stages.',
        };
      case ROLES.MAKER:
        return {
          eyebrow: 'Maker Workspace',
          title: 'Dashboard',
          subtitle: 'Track drafts, submissions, and requests that need revision or follow-up.',
          recentTitle: 'My Recent Requests',
          recentSubtitle: 'The most recent requests you created across the workflow.',
        };
      case ROLES.CHECKER:
        return {
          eyebrow: 'Checker Queue',
          title: 'Dashboard',
          subtitle: 'Focus on the approval queue, review throughput, and recently processed requests.',
          recentTitle: 'Recently Reviewed Requests',
          recentSubtitle: 'Requests you reviewed or that still need checker attention.',
        };
      case ROLES.EXECUTOR:
        return {
          eyebrow: 'Execution Desk',
          title: 'Dashboard',
          subtitle: 'Focus on requests in progress, queue depth, and execution outcomes.',
          recentTitle: 'Execution Activity',
          recentSubtitle: 'Requests currently moving toward on-chain execution.',
        };
      default:
        return {
          eyebrow: 'Overview',
          title: 'Dashboard',
          subtitle: 'Operational overview of token requests, approvals, and execution readiness.',
          recentTitle: 'Recent Requests',
          recentSubtitle: 'Recent workflow activity.',
        };
    }
  }, [dashboardRole]);

  const metrics = useMemo(() => {
    const summary = overview?.summary || {};

    switch (dashboardRole) {
      case ROLES.ADMIN:
        return [
          metric('circulation', 'In circulation', circulationMetricValue, 'Minted supply outside the distributor wallet', <CheckCircleIcon className="size-4" />, 'success.main'),
          metric('distributor', 'In distributor', distributorMetricValue, 'BTN currently parked in the distributor wallet', <ClipboardDocumentCheckIcon className="size-4" />, 'secondary.main'),
          metric('reserve', 'Reserve balance', reserveBalanceMetricValue, 'DK Bank issuer reserve account', <DocumentChartBarIcon className="size-4" />, 'success.main'),
          metric('total', 'Total requests', summary.totalRequests ?? 0, 'Across all visible workflows', <DocumentChartBarIcon className="size-4" />, 'primary.main'),
          metric('pending', 'Pending approvals', summary.pendingApprovals ?? 0, 'Waiting for checker action', <ClockIcon className="size-4" />, 'warning.main'),
          metric('ready', 'In progress', summary.onChainPending ?? summary.readyForExecution ?? 0, 'Still syncing wallet and chain state', <InboxStackIcon className="size-4" />, 'secondary.main'),
          metric('failed', 'Failed', summary.failedRequests ?? 0, 'Need operational follow-up', <ExclamationCircleIcon className="size-4" />, 'error.main'),
        ];
      case ROLES.MAKER:
        return [
          metric('circulation', 'In circulation', circulationMetricValue, 'Minted supply outside the distributor wallet', <CheckCircleIcon className="size-4" />, 'success.main'),
          metric('distributor', 'In distributor', distributorMetricValue, 'BTN currently parked in the distributor wallet', <ClipboardDocumentCheckIcon className="size-4" />, 'secondary.main'),
          metric('reserve', 'Reserve balance', reserveBalanceMetricValue, 'Available reserve before issuer-backed minting', <DocumentChartBarIcon className="size-4" />, 'success.main'),
          metric('drafts', 'Drafts', state.draftCount, 'Still editable by you', <PencilSquareIcon className="size-4" />, 'primary.main'),
          metric('pending', 'Pending review', summary.pendingApprovals ?? 0, 'Submitted and awaiting a checker', <ClockIcon className="size-4" />, 'warning.main'),
          metric('rejected', 'Rejected', state.rejectedCount, 'Need revision before resubmission', <XCircleIcon className="size-4" />, 'error.main'),
          metric('ready', 'In progress', summary.onChainPending ?? summary.readyForExecution ?? 0, 'Still syncing wallet or chain confirmation', <InboxStackIcon className="size-4" />, 'secondary.main'),
        ];
      case ROLES.CHECKER:
        return [
          metric('circulation', 'In circulation', circulationMetricValue, 'Minted supply outside the distributor wallet', <CheckCircleIcon className="size-4" />, 'success.main'),
          metric('distributor', 'In distributor', distributorMetricValue, 'BTN currently parked in the distributor wallet', <ClipboardDocumentCheckIcon className="size-4" />, 'secondary.main'),
          metric('reserve', 'Reserve balance', reserveBalanceMetricValue, 'Reference balance before approving mint requests', <DocumentChartBarIcon className="size-4" />, 'success.main'),
          metric('pending', 'Pending approvals', summary.pendingApprovals ?? 0, 'Requests waiting in your queue', <ClockIcon className="size-4" />, 'warning.main'),
          metric('ready', 'In progress', summary.onChainPending ?? summary.readyForExecution ?? 0, 'Still settling after wallet approval', <InboxStackIcon className="size-4" />, 'primary.main'),
          metric('reviewed', 'Reviewed recently', state.reviewedCount, 'Latest decisions linked to you', <ClipboardDocumentCheckIcon className="size-4" />, 'secondary.main'),
          metric('failed', 'Failed downstream', summary.failedRequests ?? 0, 'Approved items that later failed execution', <ExclamationCircleIcon className="size-4" />, 'error.main'),
        ];
      case ROLES.EXECUTOR:
        return [
          metric('circulation', 'In circulation', circulationMetricValue, 'Minted supply outside the distributor wallet', <CheckCircleIcon className="size-4" />, 'success.main'),
          metric('distributor', 'In distributor', distributorMetricValue, 'BTN currently parked in the distributor wallet', <ClipboardDocumentCheckIcon className="size-4" />, 'secondary.main'),
          metric('reserve', 'Reserve balance', reserveBalanceMetricValue, 'Current DK Bank issuer reserve position', <DocumentChartBarIcon className="size-4" />, 'success.main'),
          metric('ready', 'In progress', summary.onChainPending ?? summary.readyForExecution ?? 0, 'Still settling between wallet and backend capture', <InboxStackIcon className="size-4" />, 'secondary.main'),
          metric('executed', 'Executed', summary.executedRequests ?? 0, 'Successfully recorded outcomes', <CheckCircleIcon className="size-4" />, 'success.main'),
          metric('failed', 'Failed', summary.failedRequests ?? 0, 'Need retry or investigation', <ExclamationCircleIcon className="size-4" />, 'error.main'),
        ];
      default:
        return [];
    }
  }, [circulationMetricValue, dashboardRole, distributorMetricValue, overview, reserveBalanceMetricValue, state.draftCount, state.rejectedCount, state.reviewedCount]);

  const settlementMetrics = useMemo(() => {
    if (!(dashboardRole === ROLES.ADMIN || dashboardRole === ROLES.EXECUTOR) || !settlementSummary) {
      return [];
    }

    return [
      metric('settlements-total', 'Total settlements', settlementSummary.totalSettlements ?? 0, 'Across reserve mint, BTN transfer, and BIPS fallback', <DocumentChartBarIcon className="size-4" />, 'primary.main'),
      metric('settlements-mints', 'Reserve mint', settlementSummary.reserveMintCount ?? 0, 'Issuer-backed mint and replenishment activity', <CheckCircleIcon className="size-4" />, 'success.main'),
      metric('settlements-transfer', 'BTN transfer', settlementSummary.btnTransferCount ?? 0, 'Treasury-to-treasury direct settlement', <InboxStackIcon className="size-4" />, 'secondary.main'),
      metric('settlements-fiat', 'Fiat fallback', settlementSummary.fiatFallbackCount ?? 0, 'BIPS-routed transfer and redemption volume', <ClockIcon className="size-4" />, 'warning.main'),
      metric('settlements-pending', 'Pending reconciliation', settlementSummary.pendingReconciliationCount ?? 0, 'Still waiting on final BIPS confirmation', <ClockIcon className="size-4" />, 'warning.main'),
      metric('settlements-manual', 'Manual review', settlementSummary.manualReviewCount ?? 0, 'Need operator intervention', <ExclamationCircleIcon className="size-4" />, 'warning.main'),
      metric('settlements-failed', 'Failed settlements', settlementSummary.failedSettlementCount ?? 0, 'Closed with failure state', <XCircleIcon className="size-4" />, 'error.main'),
    ];
  }, [dashboardRole, settlementSummary]);

  const recentRows = useMemo(() => {
    if (dashboardRole === ROLES.CHECKER) {
      return state.reviewed.length ? state.reviewed : (overview?.pendingApprovals || []);
    }

    if (dashboardRole === ROLES.EXECUTOR) {
      return state.readyQueue;
    }

    return overview?.recentRequests || [];
  }, [dashboardRole, overview, state.reviewed, state.readyQueue]);

  if (error) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader eyebrow={pageCopy.eyebrow} subtitle={pageCopy.subtitle} title={pageCopy.title} />

      <PageSection title="DK Bank Reserve Balance" subtitle="Live fiat reserve balance linked to DK Bank for BTN minting support.">
        <ReserveBalancePanel
          data={reserveSummary?.bank ? reserveSummary : null}
          error={reserveSummary?.warning || ''}
          title="DK Bank Fiat Reserve"
          subtitle="This is the linked DK Bank reserve account balance used as the fiat reference for BTN minting."
        />
      </PageSection>

      <PageSection>
        <DashboardMetricGrid items={metrics} />
      </PageSection>

      {settlementMetrics.length ? (
        <PageSection title="Settlement Metrics" subtitle="Operational view of reserve issuance and fiat fallback progression.">
          <DashboardMetricGrid items={settlementMetrics} />
        </PageSection>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="min-w-0">
          <PageSection subtitle={pageCopy.recentSubtitle} title={pageCopy.recentTitle}>
            <RecentRequestsTable
              onRowClick={(row) => navigate(`/token-requests/${row.id}`)}
              rows={recentRows}
            />
          </PageSection>
        </div>

        <div className="space-y-4">
            {dashboardRole === ROLES.ADMIN ? (
              <>
                <RequestListPanel
                  emptyText="No in-progress requests need attention right now."
                  items={state.readyQueue}
                  onSelect={(row) => navigate(`/token-requests/${row.id}`)}
                  subtitle="Requests still settling wallet submission, approval capture, or backend reconciliation."
                  title="In Progress"
                />
                <RequestListPanel
                  actionLabel="View settlements"
                  actionTo="/settlements"
                  emptyText="No fiat fallback settlements are waiting for reconciliation."
                  items={overview?.pendingSettlementReconciliation || []}
                  onSelect={(row) => navigate(`/settlements/${row.id}`)}
                  subtitle="BIPS-routed settlements still pending final confirmation or manual review."
                  title="Settlement Reconciliation"
                />
                <AuditActivityPanel items={state.auditTrail} />
              </>
            ) : null}

            {dashboardRole === ROLES.MAKER ? (
              <>
                <RequestListPanel
                  actionLabel="View my requests"
                  actionTo="/my-requests"
                  emptyText="No draft requests are open right now."
                  items={state.drafts}
                  onSelect={(row) => navigate(`/token-requests/${row.id}`)}
                  subtitle="Draft requests you can still edit before submission."
                  title="Draft Requests"
                />
                <RequestListPanel
                  actionLabel="View my requests"
                  actionTo="/my-requests"
                  emptyText="No rejected requests need revision right now."
                  items={state.rejected}
                  onSelect={(row) => navigate(`/token-requests/${row.id}`)}
                  subtitle="Rejected requests that need revision before resubmission."
                  title="Needs Revision"
                />
              </>
            ) : null}

            {dashboardRole === ROLES.CHECKER ? (
              <>
                <RequestListPanel
                  actionLabel="Open approvals"
                  actionTo="/pending-approvals"
                  emptyText="Nothing is waiting in the approval queue."
                  items={overview?.pendingApprovals || []}
                  onSelect={(row) => navigate(`/token-requests/${row.id}`)}
                  subtitle="Requests currently waiting for checker action."
                  title="Approval Queue"
                />
                <RequestListPanel
                  emptyText="No recently reviewed requests are available."
                  items={state.reviewed}
                  onSelect={(row) => navigate(`/token-requests/${row.id}`)}
                  subtitle="Latest requests where you are recorded as the checker."
                  title="Recently Reviewed"
                />
              </>
            ) : null}

            {dashboardRole === ROLES.EXECUTOR ? (
              <>
                <RequestListPanel
                  emptyText="Nothing is still settling right now."
                  items={state.readyQueue}
                  onSelect={(row) => navigate(`/token-requests/${row.id}`)}
                  subtitle="Requests still waiting on wallet capture or backend reconciliation."
                  title="In Progress"
                />
                <RequestListPanel
                  actionLabel="View settlements"
                  actionTo="/settlements"
                  emptyText="No BIPS settlements are waiting for reconciliation."
                  items={overview?.pendingSettlementReconciliation || []}
                  onSelect={(row) => navigate(`/settlements/${row.id}`)}
                  subtitle="Fiat fallback settlements still awaiting downstream confirmation."
                  title="Settlement Queue"
                />
                <WalletConnectCard />
              </>
            ) : null}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
