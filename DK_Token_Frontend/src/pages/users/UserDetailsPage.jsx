import {
  Autocomplete,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import AppDialog from '../../components/common/AppDialog';
import AppTable from '../../components/common/AppTable';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import { usersApi } from '../../modules/users/users.api';
import { ROLE_OPTIONS } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';

function UserDetailsPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);

  async function loadUser() {
    setLoading(true);
    const response = await usersApi.getById(id);
    setUser(response.data);
    setSelectedRoles(ROLE_OPTIONS.filter((option) => response.data.roles.includes(option.value)));
    setLoading(false);
  }

  useEffect(() => {
    loadUser();
  }, [id]);

  if (loading) {
    return <LoadingScreen message="Loading user details..." />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="View profile, roles, linked wallets, and current status." title={user.fullName} />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h6">Profile</Typography>
                <Typography>Email: {user.email}</Typography>
                <Typography>Status: {user.isActive ? 'Active' : 'Inactive'}</Typography>
                <Typography>Created: {formatDateTime(user.createdAt)}</Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {user.roles.map((role) => (
                    <Chip key={role} label={role} />
                  ))}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => setRoleDialogOpen(true)} variant="outlined">Assign Roles</Button>
                  <Button
                    color={user.isActive ? 'error' : 'success'}
                    onClick={async () => {
                      await usersApi.updateStatus(user.id, !user.isActive);
                      enqueueSnackbar('User status updated', { variant: 'success' });
                      loadUser();
                    }}
                    variant="contained"
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <AppTable
            columns={[
              { key: 'walletAddress', label: 'Wallet Address' },
              { key: 'label', label: 'Label' },
              { key: 'isPrimary', label: 'Primary', render: (row) => (row.isPrimary ? 'Yes' : 'No') },
              { key: 'isActive', label: 'Status', render: (row) => (row.isActive ? 'Active' : 'Inactive') },
            ]}
            pagination={null}
            rows={user.wallets || []}
          />
        </Grid>
      </Grid>

      <AppDialog
        actions={
          <>
            <Button onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                await usersApi.assignRoles(user.id, selectedRoles.map((role) => role.value));
                enqueueSnackbar('Roles updated', { variant: 'success' });
                setRoleDialogOpen(false);
                loadUser();
              }}
              variant="contained"
            >
              Save
            </Button>
          </>
        }
        onClose={() => setRoleDialogOpen(false)}
        open={roleDialogOpen}
        title="Assign Roles"
      >
        <Stack spacing={2}>
          <Typography color="text.secondary">
            Add one or more roles to this user.
          </Typography>
          <Autocomplete
            disableCloseOnSelect
            multiple
            onChange={(_event, value) => setSelectedRoles(value)}
            options={ROLE_OPTIONS}
            renderInput={(params) => <TextField {...params} label="Roles" />}
            value={selectedRoles}
          />
        </Stack>
      </AppDialog>
    </Stack>
  );
}

export default UserDetailsPage;
