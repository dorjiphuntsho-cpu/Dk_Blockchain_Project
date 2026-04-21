import {
  Autocomplete,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
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
import usePagination from '../../hooks/usePagination';
import { usersApi } from '../../modules/users/users.api';
import { ROLE_OPTIONS } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';

function UsersPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { page, limit, setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({ search: '', isActive: '' });
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [rolesDialogUser, setRolesDialogUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);

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
      { key: 'email', label: 'Email', sx: { color: 'text.secondary' } },
      {
        key: 'roles',
        label: 'Roles',
        render: (row) => (
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {row.roles.map((role) => (
              <Chip key={role} label={role} sx={{ backgroundColor: 'primary.light', color: 'primary.dark' }} />
            ))}
          </Stack>
        ),
      },
      {
        key: 'isActive',
        label: 'Status',
        render: (row) => (
          <Chip
            label={row.isActive ? 'Active' : 'Inactive'}
            sx={{
              backgroundColor: row.isActive ? 'success.light' : 'grey.200',
              color: row.isActive ? 'success.main' : 'text.secondary',
            }}
          />
        ),
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (row) => (
          <Typography color="text.secondary" variant="body2">
            {formatDateTime(row.createdAt)}
          </Typography>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'right',
        disableRowClick: true,
        render: (row) => (
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => navigate(`/users/${row.id}`)} size="small" variant="text">View</Button>
            <Button onClick={() => {
              setRolesDialogUser(row);
              setSelectedRoles(ROLE_OPTIONS.filter((option) => row.roles.includes(option.value)));
            }} size="small" variant="text">
              Roles
            </Button>
            <Button color={row.isActive ? 'error' : 'success'} onClick={() => setSelectedUser(row)} size="small" variant="outlined">
              {row.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </Stack>
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
    <Stack spacing={3}>
      <PageHeader
        action={{ label: 'Create User', onClick: () => navigate('/users/new') }}
        subtitle="Manage users, status, and role assignments."
        title="Users"
      />

      <SearchFilters>
        <TextField
          label="Search"
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          value={filters.search}
        />
        <TextField
          label="Status"
          onChange={(event) => setFilters((current) => ({ ...current, isActive: event.target.value }))}
          select
          value={filters.isActive}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
        <Button
          onClick={() => setFilters({ search: '', isActive: '' })}
          variant="outlined"
        >
          Reset Filters
        </Button>
      </SearchFilters>

      <AppTable
        columns={columns}
        error={error}
        loading={loading}
        onRowClick={(row) => navigate(`/users/${row.id}`)}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        pagination={pagination}
        onRetry={loadUsers}
        rows={users}
      />

      <ConfirmDialog
        confirmLabel={selectedUser?.isActive ? 'Deactivate' : 'Activate'}
        description={`This will ${selectedUser?.isActive ? 'deactivate' : 'activate'} ${selectedUser?.fullName}.`}
        onClose={() => setSelectedUser(null)}
        onConfirm={async () => {
          await usersApi.updateStatus(selectedUser.id, !selectedUser.isActive);
          enqueueSnackbar('User status updated', { variant: 'success' });
          setSelectedUser(null);
          loadUsers();
        }}
        open={Boolean(selectedUser)}
        title="Confirm Status Change"
      />

      <AppDialog
        actions={
          <>
            <Button onClick={() => setRolesDialogUser(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                await usersApi.assignRoles(rolesDialogUser.id, selectedRoles.map((role) => role.value));
                enqueueSnackbar('Roles assigned successfully', { variant: 'success' });
                setRolesDialogUser(null);
                loadUsers();
              }}
              variant="contained"
            >
              Save Roles
            </Button>
          </>
        }
        onClose={() => setRolesDialogUser(null)}
        open={Boolean(rolesDialogUser)}
        title="Assign Roles"
      >
        <Autocomplete
          disableCloseOnSelect
          multiple
          onChange={(_event, value) => setSelectedRoles(value)}
          options={ROLE_OPTIONS}
          renderInput={(params) => <TextField {...params} label="Roles" />}
          value={selectedRoles}
        />
      </AppDialog>
    </Stack>
  );
}

export default UsersPage;
