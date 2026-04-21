import { Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import { requestTypeConfig, statusConfig } from '../../utils/requestStatus';

function StatusChip({ value, kind = 'status' }) {
  const theme = useTheme();
  const config = kind === 'type' ? requestTypeConfig[value] : statusConfig[value];
  const tone = config?.tone || 'neutral';

  const toneStyles = {
    neutral: {
      bg: alpha(theme.palette.grey[700], 0.1),
      color: theme.palette.grey[700],
    },
    warning: {
      bg: alpha(theme.palette.warning.main, 0.14),
      color: theme.palette.warning.main,
    },
    primary: {
      bg: alpha(theme.palette.primary.main, 0.12),
      color: theme.palette.primary.main,
    },
    secondary: {
      bg: alpha(theme.palette.secondary.main, 0.12),
      color: theme.palette.secondary.main,
    },
    success: {
      bg: alpha(theme.palette.success.main, 0.12),
      color: theme.palette.success.main,
    },
    error: {
      bg: alpha(theme.palette.error.main, 0.12),
      color: theme.palette.error.main,
    },
    rejected: {
      bg: alpha(theme.palette.error.dark, 0.14),
      color: theme.palette.error.dark,
    },
    burn: {
      bg: alpha(theme.palette.warning.main, 0.14),
      color: '#b45309',
    },
  };

  const styles = toneStyles[tone] || toneStyles.neutral;

  return (
    <Chip
      icon={kind === 'status' ? <FiberManualRecordIcon sx={{ fontSize: 12 }} /> : undefined}
      label={config?.label || value}
      size="small"
      sx={{
        backgroundColor: styles.bg,
        color: styles.color,
        fontWeight: 700,
        minWidth: kind === 'status' ? 154 : 98,
        justifyContent: 'flex-start',
        '& .MuiChip-icon': {
          color: styles.color,
          mr: 0.75,
          ml: 1,
        },
      }}
    />
  );
}

export default StatusChip;
