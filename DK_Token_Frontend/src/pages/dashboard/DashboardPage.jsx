import {
  Box,
  Grid,
  Link,
  List,
  ListItemButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import ApprovalOutlinedIcon from '@mui/icons-material/ApprovalOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined';
import ReportGmailerrorredOutlinedIcon from '@mui/icons-material/ReportGmailerrorredOutlined';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import AppTable from '../../components/common/AppTable';
import DashboardCard from '../../components/common/DashboardCard';
import ErrorState from '../../components/common/ErrorState';
import InfoPanel from '../../components/common/InfoPanel';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/common/PageSection';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import WalletConnectCard from '../../components/wallet/WalletConnectCard';
import useAuth from '../../hooks/useAuth';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { REQUEST_STATUSES, ROLES } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { formatAmount, truncateMiddle } from '../../utils/format';

const summaryConfig = [
  // { key: 'totalRequests', label: 'Total Requests', icon: <PlaylistAddCheckOutlinedIcon fontSize="small" />, accent: 'primary.main' },
  { key: 'pendingApprovals', label: 'Pending Approvals', icon: <PendingActionsOutlinedIcon fontSize="small" />, accent: 'warning.main' },
  { key: 'approvedRequests', label: 'Approved', icon: <ApprovalOutlinedIcon fontSize="small" />, accent: 'primary.main' },
  // { key: 'readyForExecution', label: 'Ready for Execution', icon: <FactCheckOutlinedIcon fontSize="small" />, accent: 'secondary.main' },
  { key: 'executedRequests', label: 'Executed', icon: <CheckCircleOutlineOutlinedIcon fontSize="small" />, accent: 'success.main' },
  { key: 'failedRequests', label: 'Failed', icon: <ReportGmailerrorredOutlinedIcon fontSize="small" />, accent: 'error.main' },
];

function DashboardSkeleton() {
  return (
    <Stack spacing={3.5}>
      <Stack spacing={1.25}>
        <Skeleton height={20} width={120} />
        <Skeleton height={42} width={320} />
        <Skeleton height={22} width="55%" />
      </Stack>
      <Grid container spacing={2.5}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, xl: 2 }}>
            <Skeleton height={152} variant="rounded" />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Skeleton height={420} variant="rounded" />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <Skeleton height={260} variant="rounded" />
            <Skeleton height={260} variant="rounded" />
            <Skeleton height={210} variant="rounded" />
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const response = await tokenRequestsApi.dashboard();
        setData(response.data);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const roleCopy = useMemo(() => {
    if (user?.roles.includes(ROLES.ADMIN)) {
      return {
        // eyebrow: 'Overview',
        // subtitle: 'Monitor approvals, execution readiness, and administrative activity across the full off-chain workflow.',
        recentTitle: 'Recent Token Requests',
      };
    }

    if (user?.roles.includes(ROLES.MAKER)) {
      return {
        eyebrow: 'Maker Workspace',
        subtitle: 'Track your drafts, submitted requests, and approval progress without leaving the workflow context.',
        recentTitle: 'My Recent Requests',
      };
    }

    if (user?.roles.includes(ROLES.CHECKER)) {
      return {
        eyebrow: 'Checker Queue',
        subtitle: 'Focus on pending approvals, review outcomes, and the requests that still require your decision.',
        recentTitle: 'Recently Updated Requests',
      };
    }

    if (user?.roles.includes(ROLES.EXECUTOR)) {
      return {
        eyebrow: 'Execution Desk',
        subtitle: 'Stay on top of requests approved for execution and record transaction outcomes with clear status visibility.',
        recentTitle: 'Execution Activity',
      };
    }

    return {
      eyebrow: 'Overview',
      subtitle: 'Operational overview of token requests, approvals, and execution readiness.',
      recentTitle: 'Recent Token Requests',
    };
  }, [user]);

  const summarySubtext = useMemo(() => ({
    totalRequests: user?.roles.includes(ROLES.MAKER) ? 'Requests owned by you' : 'Visible within your workspace',
    pendingApprovals: `${data?.summary?.pendingApprovals ?? 0} awaiting decision`,
    approvedRequests: `${data?.summary?.readyForExecution ?? 0} close to execution`,
    readyForExecution: `${data?.summary?.executedRequests ?? 0} already completed`,
    executedRequests: 'Successfully recorded on the workflow',
    failedRequests: 'Execution attempts that need follow-up',
  }), [data, user]);

  const readyForExecutionItems = useMemo(() => {
    const recent = data?.recentRequests || [];
    return recent.filter((request) =>
      [REQUEST_STATUSES.APPROVED, REQUEST_STATUSES.READY_FOR_EXECUTION].includes(request.status),
    ).slice(0, 5);
  }, [data]);

  const summaryCards = useMemo(() => {
    const priority = user?.roles.includes(ROLES.MAKER)
      ? ['totalRequests', 'pendingApprovals', 'approvedRequests', 'readyForExecution', 'executedRequests', 'failedRequests']
      : user?.roles.includes(ROLES.CHECKER)
        ? ['pendingApprovals', 'approvedRequests', 'totalRequests', 'readyForExecution', 'executedRequests', 'failedRequests']
        : user?.roles.includes(ROLES.EXECUTOR)
          ? ['readyForExecution', 'approvedRequests', 'executedRequests', 'failedRequests', 'totalRequests', 'pendingApprovals']
          : ['totalRequests', 'pendingApprovals', 'readyForExecution', 'approvedRequests', 'executedRequests', 'failedRequests'];

    return priority
      .map((key) => summaryConfig.find((item) => item.key === key))
      .filter(Boolean);
  }, [user]);

  const showWalletReadiness = user?.roles.includes(ROLES.ADMIN) || user?.roles.includes(ROLES.EXECUTOR);
  const showPendingPanel = user?.roles.includes(ROLES.ADMIN) || user?.roles.includes(ROLES.CHECKER) || user?.roles.includes(ROLES.MAKER);
  const pendingPanelTitle = user?.roles.includes(ROLES.MAKER) ? 'Awaiting Review' : 'Pending Approvals';
  const pendingPanelSubtitle = user?.roles.includes(ROLES.MAKER)
    ? 'Requests you submitted that still need checker action.'
    : 'Requests still waiting for a checker decision.';
  const showReadyPanel = user?.roles.includes(ROLES.ADMIN) || user?.roles.includes(ROLES.EXECUTOR) || readyForExecutionItems.length > 0;

  if (error) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <Stack spacing={3.5} sx={{ width: '100%', minWidth: 0 }}>
      <PageHeader
        eyebrow={roleCopy.eyebrow}
        title="Dashboard"
        subtitle={roleCopy.subtitle}
      />

      <PageSection>
        <Box
          sx={{
            display: 'grid',
            gap: 1.75,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
              xl: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          {summaryCards.map((item) => (
            <DashboardCard
              key={item.key}
              accent={item.accent}
              icon={item.icon}
              label={item.label}
              subtitle={summarySubtext[item.key]}
              value={data?.summary?.[item.key] ?? 0}
            />
          ))}
        </Box>
      </PageSection>

      <Grid container spacing={3.25}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <PageSection
            subtitle="Recent activity across the token request lifecycle."
            title={roleCopy.recentTitle}
          >
            <AppTable
              columns={[
                {
                  key: 'id',
                  label: 'Request ID',
                  width: 170,
                  render: (row) => (
                    <Link
                      component={RouterLink}
                      sx={{ fontWeight: 700, textDecoration: 'none' }}
                      to={`/token-requests/${row.id}`}
                    >
                      {truncateMiddle(row.id, 10, 5)}
                    </Link>
                  ),
                },
                {
                  key: 'requestType',
                  label: 'Type',
                  width: 120,
                  render: (row) => <TypeChip value={row.requestType} />,
                },
                {
                  key: 'amount',
                  label: 'Amount',
                  align: 'right',
                  width: 120,
                  render: (row) => formatAmount(row.amount),
                },
                {
                  key: 'status',
                  label: 'Status',
                  width: 180,
                  render: (row) => <StatusChip value={row.status} />,
                },
                {
                  key: 'createdAt',
                  label: 'Created',
                  width: 180,
                  render: (row) => (
                    <Typography color="text.secondary" variant="body2">
                      {formatDateTime(row.createdAt)}
                    </Typography>
                  ),
                },
              ]}
              emptyDescription="Recent request activity will appear here once token operations are created."
              minWidth={760}
              onRowClick={(row) => navigate(`/token-requests/${row.id}`)}
              pagination={null}
              rows={data?.recentRequests || []}
            />
          </PageSection>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.25}>
            {showPendingPanel ? (
              <InfoPanel
                action={
                  data?.pendingApprovals?.length ? (
                    <Link component={RouterLink} sx={{ fontWeight: 700, textDecoration: 'none' }} to={user?.roles.includes(ROLES.MAKER) ? '/my-requests' : '/pending-approvals'}>
                      View queue
                    </Link>
                  ) : null
                }
                subtitle={pendingPanelSubtitle}
                title={pendingPanelTitle}
              >
                <List disablePadding sx={{ display: 'grid', gap: 1 }}>
                  {(data?.pendingApprovals || []).length ? (
                    (data?.pendingApprovals || []).slice(0, 4).map((request) => (
                      <ListItemButton
                        key={request.id}
                        onClick={() => navigate(`/token-requests/${request.id}`)}
                        sx={{ alignItems: 'flex-start', px: 1.25, py: 1 }}
                      >
                        <Stack spacing={1.05} sx={{ width: '100%' }}>
                          <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                            <Typography sx={{ fontWeight: 700 }} variant="body2">
                              {truncateMiddle(request.id, 10, 5)}
                            </Typography>
                            <StatusChip value={request.status} />
                          </Stack>
                          <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                            <TypeChip value={request.requestType} />
                            <Typography color="text.secondary" variant="body2">
                              {formatAmount(request.amount)}
                            </Typography>
                          </Stack>
                        </Stack>
                      </ListItemButton>
                    ))
                  ) : (
                    <Typography color="text.secondary" variant="body2">
                      No requests currently need approval.
                    </Typography>
                  )}
                </List>
              </InfoPanel>
            ) : null}

            {showReadyPanel ? (
              <InfoPanel
                action={
                  readyForExecutionItems.length ? (
                    <Link component={RouterLink} sx={{ fontWeight: 700, textDecoration: 'none' }} to="/ready-for-execution">
                      View execution desk
                    </Link>
                  ) : null
                }
                subtitle="Approved and execution-ready requests that may require the next operational step."
                title="Ready for Execution"
              >
                <List disablePadding sx={{ display: 'grid', gap: 1 }}>
                  {readyForExecutionItems.length ? (
                    readyForExecutionItems.slice(0, 4).map((request) => (
                      <ListItemButton
                        key={request.id}
                        onClick={() => navigate(`/token-requests/${request.id}`)}
                        sx={{ alignItems: 'flex-start', px: 1.25, py: 1 }}
                      >
                        <Stack spacing={1.2} sx={{ width: '100%' }}>
                          <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                            <Typography sx={{ fontWeight: 700 }} variant="body2">
                              {truncateMiddle(request.id, 10, 5)}
                            </Typography>
                            <StatusChip value={request.status} />
                          </Stack>
                          <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                            <TypeChip value={request.requestType} />
                            <Typography color="text.secondary" variant="body2">
                              {formatAmount(request.amount)}
                            </Typography>
                          </Stack>
                        </Stack>
                      </ListItemButton>
                    ))
                  ) : (
                    <Typography color="text.secondary" variant="body2">
                      Nothing is waiting at the execution stage right now.
                    </Typography>
                  )}
                </List>
              </InfoPanel>
            ) : null}

            {showWalletReadiness ? <WalletConnectCard /> : null}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default DashboardPage;
