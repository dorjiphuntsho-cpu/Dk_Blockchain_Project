import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import AppDialog from '../../components/common/AppDialog';
import AppTable from '../../components/common/AppTable';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { usersApi } from '../../modules/users/users.api';
import { ROLE_OPTIONS } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/error';

function UserDetailsPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [savingUserStatus, setSavingUserStatus] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

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
    <div className="space-y-6">
      <PageHeader subtitle="View profile, roles, linked wallets, and current status." title={user.fullName} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">Profile</h2>
              <p className="text-sm text-zinc-400">Status, identity, and role assignments for this account.</p>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-zinc-500">Email</dt>
                <dd className="text-zinc-200">{user.email}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Status</dt>
                <dd className="text-zinc-200">{user.isActive ? 'Active' : 'Inactive'}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Created</dt>
                <dd className="text-zinc-200">{formatDateTime(user.createdAt)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <Badge key={role} tone="blue">{role}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setRoleDialogOpen(true)} variant="outline">Assign Roles</Button>
              <Button
                disabled={savingUserStatus}
                onClick={async () => {
                  try {
                    setSavingUserStatus(true);
                    await usersApi.updateStatus(user.id, !user.isActive);
                    enqueueSnackbar('User status updated', { variant: 'success' });
                    loadUser();
                  } catch (statusError) {
                    enqueueSnackbar(getErrorMessage(statusError, 'Unable to update user status'), { variant: 'error' });
                  } finally {
                    setSavingUserStatus(false);
                  }
                }}
                variant={user.isActive ? 'danger' : 'secondary'}
              >
                {savingUserStatus ? 'Saving...' : (user.isActive ? 'Deactivate' : 'Activate')}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-white">Linked Wallets</h2>
            <p className="text-sm text-zinc-400">Wallet records currently associated with this user.</p>
          </div>
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
        </div>
      </div>

      <AppDialog
        actions={(
          <>
            <Button onClick={() => setRoleDialogOpen(false)} variant="outline">Cancel</Button>
            <Button
              disabled={savingRoles}
              onClick={async () => {
                try {
                  setSavingRoles(true);
                  await usersApi.assignRoles(user.id, selectedRoles.map((role) => role.value));
                  enqueueSnackbar('Roles updated', { variant: 'success' });
                  setRoleDialogOpen(false);
                  loadUser();
                } catch (rolesError) {
                  enqueueSnackbar(getErrorMessage(rolesError, 'Unable to update roles'), { variant: 'error' });
                } finally {
                  setSavingRoles(false);
                }
              }}
              variant="secondary"
            >
              {savingRoles ? 'Saving...' : 'Save'}
            </Button>
          </>
        )}
        onClose={() => setRoleDialogOpen(false)}
        open={roleDialogOpen}
        title="Assign Roles"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">Add one or more roles to this user.</p>
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
      </AppDialog>
    </div>
  );
}

export default UserDetailsPage;
