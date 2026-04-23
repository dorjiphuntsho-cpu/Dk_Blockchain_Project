import {
  Grid,
  Skeleton,
  Stack,
} from '@mui/material';
import ApprovalOutlinedIcon from '@mui/icons-material/ApprovalOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined';
import ReportGmailerrorredOutlinedIcon from '@mui/icons-material/ReportGmailerrorredOutlined';
import RuleFolderOutlinedIcon from '@mui/icons-material/RuleFolderOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AuditActivityPanel from '../../components/dashboard/AuditActivityPanel';
import DashboardMetricGrid from '../../components/dashboard/DashboardMetricGrid';
import RecentRequestsTable from '../../components/dashboard/RecentRequestsTable';
import RequestListPanel from '../../components/dashboard/RequestListPanel';
import ErrorState from '../../components/common/ErrorState';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/common/PageSection';
import WalletConnectCard from '../../components/wallet/WalletConnectCard';
import useAuth from '../../hooks/useAuth';
import { auditLogsApi } from '../../modules/auditLogs/auditLogs.api';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { REQUEST_STATUSES, ROLES } from '../../utils/constants';

function DashboardSkeleton() {
  return (
    <Stack spacing={3.5}>
      <Stack spacing={1.25}>
        <Skeleton height={20} width={120} />
        <Skeleton height={42} width={320} />
        <Skeleton height={22} width="55%" />
      </Stack>
      <Grid container spacing={2.5}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, xl: 3 }}>
            <Skeleton height={148} variant="rounded" />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Skeleton height={420} variant="rounded" />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            <Skeleton height={240} variant="rounded" />
            <Skeleton height={240} variant="rounded" />
          </Stack>
        </Grid>
      </Grid>
    </Stack>
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

  const pageCopy = useMemo(() => {
    switch (dashboardRole) {
      case ROLES.ADMIN:
        return {
          eyebrow: 'Admin Overview',
          title: 'Dashboard',
          subtitle: 'Monitor workflow volume, on-chain pending requests, and recent control activity across the portal.',
          recentTitle: 'Latest Token Requests',
          recentSubtitle: 'Newest requests across makers, approvals, and execution stages.',
        };
      case ROLES.MAKER:
        return {
          eyebrow: 'Maker Workspace',
          title: 'Dashboard',
          subtitle: 'Track your drafts, submissions, and requests that need revision or follow-up.',
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
          subtitle: 'Focus on ready requests, queue depth, and execution outcomes.',
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
          metric('total', 'Total Requests', summary.totalRequests ?? 0, 'Across all visible workflows', <PlaylistAddCheckOutlinedIcon fontSize="small" />, 'primary.main'),
          metric('pending', 'Pending Approvals', summary.pendingApprovals ?? 0, 'Waiting for checker action', <PendingActionsOutlinedIcon fontSize="small" />, 'warning.main'),
          metric('ready', 'On-chain Pending', summary.onChainPending ?? summary.readyForExecution ?? 0, 'Approved and queued for browser signing', <FactCheckOutlinedIcon fontSize="small" />, 'secondary.main'),
          metric('failed', 'Failed', summary.failedRequests ?? 0, 'Need operational follow-up', <ReportGmailerrorredOutlinedIcon fontSize="small" />, 'error.main'),
        ];
      case ROLES.MAKER:
        return [
          metric('drafts', 'Drafts', state.draftCount, 'Still editable by you', <AssignmentOutlinedIcon fontSize="small" />, 'primary.main'),
          metric('pending', 'Pending Review', summary.pendingApprovals ?? 0, 'Submitted and awaiting a checker', <PendingActionsOutlinedIcon fontSize="small" />, 'warning.main'),
          metric('rejected', 'Rejected', state.rejectedCount, 'Need revision before resubmission', <RuleFolderOutlinedIcon fontSize="small" />, 'error.main'),
          metric('ready', 'On-chain Pending', summary.onChainPending ?? summary.readyForExecution ?? 0, 'Approved and awaiting browser signing', <ApprovalOutlinedIcon fontSize="small" />, 'secondary.main'),
        ];
      case ROLES.CHECKER:
        return [
          metric('pending', 'Pending Approvals', summary.pendingApprovals ?? 0, 'Requests waiting in your queue', <PendingActionsOutlinedIcon fontSize="small" />, 'warning.main'),
          metric('ready', 'On-chain Pending', summary.onChainPending ?? summary.readyForExecution ?? 0, 'Requests you approved into browser signing', <AssignmentTurnedInOutlinedIcon fontSize="small" />, 'primary.main'),
          metric('reviewed', 'Reviewed Recently', state.reviewedCount, 'Latest decisions linked to you', <TaskAltOutlinedIcon fontSize="small" />, 'secondary.main'),
          metric('failed', 'Failed Downstream', summary.failedRequests ?? 0, 'Approved items that later failed execution', <ReportGmailerrorredOutlinedIcon fontSize="small" />, 'error.main'),
        ];
      case ROLES.EXECUTOR:
        return [
          metric('ready', 'On-chain Pending', summary.onChainPending ?? summary.readyForExecution ?? 0, 'Immediately actionable requests', <FactCheckOutlinedIcon fontSize="small" />, 'secondary.main'),
          metric('executed', 'Executed', summary.executedRequests ?? 0, 'Successfully recorded outcomes', <CheckCircleOutlineOutlinedIcon fontSize="small" />, 'success.main'),
          metric('failed', 'Failed', summary.failedRequests ?? 0, 'Need retry or investigation', <ReportGmailerrorredOutlinedIcon fontSize="small" />, 'error.main'),
        ];
      default:
        return [];
    }
  }, [dashboardRole, overview, state.draftCount, state.rejectedCount, state.reviewedCount]);

  const recentRows = useMemo(() => {
    if (dashboardRole === ROLES.CHECKER) {
      return state.reviewed.length ? state.reviewed : (overview?.pendingApprovals || []);
    }

    if (dashboardRole === ROLES.EXECUTOR) {
      return state.readyQueue;
    }

    return overview?.recentRequests || [];
  }, [dashboardRole, overview, state.reviewed, state.readyQueue, state.approvedQueue]);

  if (error) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <Stack spacing={3.5} sx={{ width: '100%', minWidth: 0 }}>
      <PageHeader eyebrow={pageCopy.eyebrow} subtitle={pageCopy.subtitle} title={pageCopy.title} />

      <PageSection>
        <DashboardMetricGrid items={metrics} />
      </PageSection>

      <Grid container spacing={3.25}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <PageSection subtitle={pageCopy.recentSubtitle} title={pageCopy.recentTitle}>
            <RecentRequestsTable
              onRowClick={(row) => navigate(`/token-requests/${row.id}`)}
              rows={recentRows}
            />
          </PageSection>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.25}>
            {dashboardRole === ROLES.ADMIN ? (
              <>
                <RequestListPanel
                  actionLabel="View on-chain queue"
                  actionTo="/ready-for-execution"
                  emptyText="No on-chain pending requests are waiting right now."
                  items={state.readyQueue}
                  onSelect={(row) => navigate(`/token-requests/${row.id}`)}
                  subtitle="Requests already approved and waiting for browser signing or result recording."
                  title="On-chain Queue"
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
                  actionLabel="View on-chain queue"
                  actionTo="/ready-for-execution"
                  emptyText="Nothing is waiting in the on-chain pending queue."
                  items={state.readyQueue}
                  onSelect={(row) => navigate(`/token-requests/${row.id}`)}
                  subtitle="Requests ready for browser signing and result recording."
                  title="On-chain Queue"
                />
                <WalletConnectCard />
              </>
            ) : null}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default DashboardPage;
