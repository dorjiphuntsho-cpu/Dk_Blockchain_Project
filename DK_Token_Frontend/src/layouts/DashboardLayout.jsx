import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import useAppStore from '../app/store';
import SidebarItem from '../components/common/SidebarItem';
import useAuth from '../hooks/useAuth';
import { NAV_ITEMS, ROUTE_TITLES } from '../utils/constants';
import { getInitials } from '../utils/format';
import { hasRole } from '../utils/permissions';

const DRAWER_WIDTH = 270;
const COLLAPSED_DRAWER_WIDTH = 92;
const NAV_ICONS = {
  dashboard: <DashboardOutlinedIcon fontSize="small" />,
  request: <DescriptionOutlinedIcon fontSize="small" />,
  myRequests: <AssignmentOutlinedIcon fontSize="small" />,
  approvals: <FactCheckOutlinedIcon fontSize="small" />,
  execution: <PlayCircleOutlineOutlinedIcon fontSize="small" />,
  users: <GroupsOutlinedIcon fontSize="small" />,
  wallets: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
  logs: <ReceiptLongOutlinedIcon fontSize="small" />,
};

function getTitle(pathname) {
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname];
  }

  if (pathname.startsWith('/users/')) {
    return 'User Details';
  }

  if (pathname.startsWith('/wallets/')) {
    return 'Wallet Details';
  }

  if (pathname.startsWith('/token-requests/')) {
    return 'Token Request Details';
  }

  return 'Admin Portal';
}

function getSection(pathname) {
  const match = NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  return match?.section || 'Overview';
}

function DashboardLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('lg'));
  const { user, logout } = useAuth();
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen, toggleSidebar } = useAppStore();
  const [anchorEl, setAnchorEl] = useState(null);
  const currentDrawerWidth = isDesktop ? (sidebarCollapsed ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH) : DRAWER_WIDTH;

  const navigationItems = useMemo(
    () => NAV_ITEMS.filter((item) => hasRole(user, item.roles)),
    [user],
  );
  const navigationGroups = useMemo(
    () => navigationItems.reduce((groups, item) => {
      const section = item.section || 'General';
      groups[section] = groups[section] || [];
      groups[section].push(item);
      return groups;
    }, {}),
    [navigationItems],
  );
  const currentTitle = getTitle(pathname);
  const currentSection = getSection(pathname);

  const drawerContent = (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5}>
          <Box
            sx={{
              alignItems: 'center',
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              display: 'inline-flex',
              height: 42,
              justifyContent: 'center',
              minWidth: 42,
            }}
          >
            <DashboardOutlinedIcon fontSize="small" />
          </Box>
          {!sidebarCollapsed || !isDesktop ? (
            <Stack spacing={0.5}>
              <Typography variant="h6">Token Admin Portal</Typography>
              <Typography color="text.secondary" variant="body2">
                Off-chain operations console
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 2 }}>
        {Object.entries(navigationGroups).map(([section, items]) => (
          <Box key={section} sx={{ mb: 2.5 }}>
            {!sidebarCollapsed || !isDesktop ? (
              <Typography color="text.secondary" sx={{ mb: 1, px: 1.5 }} variant="caption">
                {section}
              </Typography>
            ) : null}
            <List disablePadding sx={{ display: 'grid', gap: 0.75 }}>
              {items.map((item) => (
                <SidebarItem
                  collapsed={sidebarCollapsed && isDesktop}
                  icon={NAV_ICONS[item.icon]}
                  key={item.path}
                  label={item.label}
                  onClick={() => setMobileSidebarOpen(false)}
                  path={item.path}
                  selected={pathname === item.path || pathname.startsWith(`${item.path}/`)}
                />
              ))}
            </List>
          </Box>
        ))}
      </Box>
      <Divider />
      <Box sx={{ mt: 'auto', p: 2.5 }}>
        {!sidebarCollapsed || !isDesktop ? (
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1}>
              {(user?.roles || []).slice(0, 2).map((role) => (
                <Chip key={role} label={role} size="small" sx={{ backgroundColor: 'primary.light', color: 'primary.dark' }} />
              ))}
            </Stack>
            <Typography color="text.secondary" variant="body2">
              Signed in as {user?.fullName}
            </Typography>
          </Stack>
        ) : (
          <Stack alignItems="center">
            <Chip label={user?.roles?.[0] || 'USER'} size="small" sx={{ backgroundColor: 'primary.light', color: 'primary.dark' }} />
          </Stack>
        )}
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {isDesktop ? (
        <Drawer
          sx={{
            width: currentDrawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: currentDrawerWidth,
              overflowX: 'hidden',
              transition: 'width 0.2s ease',
            },
          }}
          PaperProps={{
            sx: {
              borderRight: (theme) => `1px solid ${theme.palette.divider}`,
            },
          }}
          open
          variant="permanent"
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          ModalProps={{ keepMounted: true }}
          onClose={() => setMobileSidebarOpen(false)}
          open={mobileSidebarOpen}
          PaperProps={{
            sx: {
              width: DRAWER_WIDTH,
              borderRight: (theme) => `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          width: { lg: `calc(100% - ${currentDrawerWidth}px)` },
          overflowX: 'hidden',
        }}
      >
        <AppBar
          color="inherit"
          elevation={0}
          position="sticky"
          sx={{
            backdropFilter: 'blur(12px)',
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Toolbar sx={{ gap: 2, minHeight: 72 }}>
            <IconButton onClick={isDesktop ? toggleSidebar : () => setMobileSidebarOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
              <Typography color="text.secondary" variant="caption">
                {currentSection} / {currentTitle}
              </Typography>
              <Typography noWrap variant="subtitle1">
                Solana testnet token management
              </Typography>
            </Stack>
            <Stack alignItems="center" direction="row" spacing={1}>
              <Chip label="Testnet Ready" size="small" sx={{ display: { xs: 'none', md: 'inline-flex' } }} />
              <Chip
                label={user?.roles?.[0] || 'USER'}
                size="small"
                sx={{ backgroundColor: 'primary.light', color: 'primary.dark' }}
              />
              <IconButton onClick={(event) => setAnchorEl(event.currentTarget)}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>{getInitials(user?.fullName)}</Avatar>
              </IconButton>
            </Stack>
          </Toolbar>
        </AppBar>

        <Menu
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          open={Boolean(anchorEl)}
        >
          <MenuItem
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Logout
          </MenuItem>
        </Menu>

        <Box
          sx={{
            p: { xs: 2, md: 3.5, xl: 4 },
            width: '100%',
            maxWidth: '100%',
            overflowX: 'hidden',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default DashboardLayout;
