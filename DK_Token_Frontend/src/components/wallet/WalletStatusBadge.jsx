import { Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

function WalletStatusBadge({ connected, address, walletName, mismatch }) {
  const theme = useTheme();
  const colorKey = mismatch ? 'warning' : connected ? 'success' : 'default';
  const colorMap = {
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    default: theme.palette.text.secondary,
  };

  return (
    <Chip
      label={
        connected
          ? `${walletName || 'Wallet'}: ${address}`
          : 'Wallet not connected'
      }
      sx={{
        backgroundColor: alpha(colorMap[colorKey], 0.12),
        color: colorMap[colorKey],
      }}
    />
  );
}

export default WalletStatusBadge;
