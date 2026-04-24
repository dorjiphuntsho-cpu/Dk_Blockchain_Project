import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import AppDialog from '../../components/common/AppDialog';
import AppTable from '../../components/common/AppTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import usePagination from '../../hooks/usePagination';
import { usersApi } from '../../modules/users/users.api';
import { ROLE_OPTIONS } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/error';

function UsersPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({ search: '', isActive: '' });
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [rolesDialogUser, setRolesDialogUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [statusChanging, setStatusChanging] = useState(false);
  const [rolesSaving, setRolesSaving] = useState(false);

  async function loadUsers() {
    try {
      setLoading(true);
      setError('');
      const response = await usersApi.list({ ...filters, ...paginationQuery });
      setUsers(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [filters, paginationQuery.page, paginationQuery.limit]);

  const columns = useMemo(
    () => [
      { key: 'fullName', label: 'Full Name' },
      { key: 'email', label: 'Email', render: (row) => <span className="text-zinc-400">{row.email}</span> },
      {
        key: 'roles',
        label: 'Roles',
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.roles.map((role) => (
              <Badge key={role} tone="blue">{role}</Badge>
            ))}
          </div>
        ),
      },
      {
        key: 'isActive',
        label: 'Status',
        render: (row) => <Badge tone={row.isActive ? 'emerald' : 'slate'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>,
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (row) => <span className="text-zinc-400">{formatDateTime(row.createdAt)}</span>,
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'right',
        disableRowClick: true,
        render: (row) => (
          <div className="flex justify-end gap-2">
            <Button onClick={() => navigate(`/users/${row.id}`)} size="sm" variant="ghost">View</Button>
            <Button
              onClick={() => {
                setRolesDialogUser(row);
                setSelectedRoles(ROLE_OPTIONS.filter((option) => row.roles.includes(option.value)));
              }}
              size="sm"
              variant="outline"
            >
              Roles
            </Button>
            <Button
              onClick={() => setSelectedUser(row)}
              size="sm"
              variant={row.isActive ? 'danger' : 'secondary'}
            >
              {row.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        ),
      },
    ],
    [navigate],
  );

  if (loading && !users.length) {
    return <LoadingScreen message="Loading users..." />;
  }

  if (error && !users.length) {
    return <ErrorState description={error} onAction={loadUsers} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        action={{ label: 'Create User', onClick: () => navigate('/users/new') }}
        subtitle="Manage users, status, and role assignments."
        title="Users"
      />

      <SearchFilters
        actions={(
          <Button onClick={() => setFilters({ search: '', isActive: '' })} variant="outline">
            Reset Filters
          </Button>
        )}
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Search</span>
          <Input
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            value={filters.search}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Status</span>
          <Select
            onChange={(event) => setFilters((current) => ({ ...current, isActive: event.target.value }))}
            value={filters.isActive}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </label>
      </SearchFilters>

      <AppTable
        columns={columns}
        error={error}
        loading={loading}
        onPageChange={setPage}
        onRetry={loadUsers}
        onRowClick={(row) => navigate(`/users/${row.id}`)}
        onRowsPerPageChange={setLimit}
        pagination={pagination}
        rows={users}
      />

      <ConfirmDialog
        confirmLabel={selectedUser?.isActive ? 'Deactivate' : 'Activate'}
        description={`This will ${selectedUser?.isActive ? 'deactivate' : 'activate'} ${selectedUser?.fullName}.`}
        isLoading={statusChanging}
        onClose={() => setSelectedUser(null)}
        onConfirm={async () => {
          try {
            setStatusChanging(true);
            await usersApi.updateStatus(selectedUser.id, !selectedUser.isActive);
            enqueueSnackbar('User status updated', { variant: 'success' });
            setSelectedUser(null);
            loadUsers();
          } catch (statusError) {
            enqueueSnackbar(getErrorMessage(statusError, 'Unable to update user status'), { variant: 'error' });
          } finally {
            setStatusChanging(false);
          }
        }}
        open={Boolean(selectedUser)}
        title="Confirm Status Change"
      />

      <AppDialog
        actions={(
          <>
            <Button onClick={() => setRolesDialogUser(null)} variant="outline">Cancel</Button>
            <Button
              disabled={rolesSaving}
              onClick={async () => {
                try {
                  setRolesSaving(true);
                  await usersApi.assignRoles(rolesDialogUser.id, selectedRoles.map((role) => role.value));
                  enqueueSnackbar('Roles assigned successfully', { variant: 'success' });
                  setRolesDialogUser(null);
                  loadUsers();
                } catch (rolesError) {
                  enqueueSnackbar(getErrorMessage(rolesError, 'Unable to assign roles'), { variant: 'error' });
                } finally {
                  setRolesSaving(false);
                }
              }}
              variant="secondary"
            >
              {rolesSaving ? 'Saving...' : 'Save Roles'}
            </Button>
          </>
        )}
        onClose={() => setRolesDialogUser(null)}
        open={Boolean(rolesDialogUser)}
        title="Assign Roles"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">Choose one or more roles for this user.</p>
          <div className="space-y-2">
            <span className="text-sm font-medium text-zinc-200">Roles</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLE_OPTIONS.map((option) => {
                const checked = selectedRoles.some((role) => role.value === option.value);
                return (
                  <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5" key={option.value}>
                    <input
                      checked={checked}
                      className="rounded border-white/10 bg-zinc-950 text-white focus:ring-white/20"
                      onChange={(event) => {
                        setSelectedRoles((current) => (event.target.checked
                          ? [...current, option]
                          : current.filter((role) => role.value !== option.value)));
                      }}
                      type="checkbox"
                    />
                    <span className="text-sm text-zinc-200">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </AppDialog>
    </div>
  );
}

export default UsersPage;
