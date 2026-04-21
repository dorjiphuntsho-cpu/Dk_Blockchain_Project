import { Box, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { NavLink } from 'react-router-dom';

function SidebarItem({ collapsed, icon, label, path, selected, onClick }) {
  const item = (
    <ListItemButton
      component={NavLink}
      onClick={onClick}
      selected={selected}
      sx={(theme) => ({
        minHeight: 46,
        px: collapsed ? 1.5 : 1.75,
        gap: 1.5,
        position: 'relative',
        '&.Mui-selected': {
          backgroundColor: theme.palette.primary.light,
          color: theme.palette.primary.dark,
          '& .MuiListItemIcon-root': {
            color: theme.palette.primary.main,
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 10,
            bottom: 10,
            width: 3,
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
            fontSize: '0.92rem',
            fontWeight: selected ? 700 : 600,
          }}
        />
      ) : null}
      {selected ? (
        <Box
          sx={{
            ml: 'auto',
            width: 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: 'primary.main',
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
