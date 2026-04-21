import { Box, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { NavLink } from 'react-router-dom';

function SidebarItem({ collapsed, icon, label, path, selected, onClick }) {
  const item = (
    <ListItemButton
      component={NavLink}
      onClick={onClick}
      selected={selected}
      sx={(theme) => ({
        minHeight: 42,
        px: collapsed ? 1.25 : 1.5,
        gap: 1.25,
        position: 'relative',
        '&.Mui-selected': {
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
          color: theme.palette.primary.dark,
          '& .MuiListItemIcon-root': {
            color: theme.palette.primary.main,
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 2,
            backgroundColor: theme.palette.primary.main,
          },
        },
      })}
      to={path}
    >
      <ListItemIcon
        sx={{
          color: 'text.secondary',
          minWidth: 0,
          justifyContent: 'center',
        }}
      >
        {icon}
      </ListItemIcon>
      {!collapsed ? (
        <ListItemText
          primary={label}
          primaryTypographyProps={{
            fontSize: '0.9rem',
            fontWeight: selected ? 700 : 500,
          }}
        />
      ) : null}
    </ListItemButton>
  );

  if (collapsed) {
    return (
      <Tooltip placement="right" title={label}>
        {item}
      </Tooltip>
    );
  }

  return item;
}

export default SidebarItem;
