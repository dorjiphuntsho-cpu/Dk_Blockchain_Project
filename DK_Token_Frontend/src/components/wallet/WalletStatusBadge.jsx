import { Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

function WalletStatusBadge({ connected, address }) {
  const theme = useTheme();

  return (
    <Chip
      label={connected ? `Connected: ${address}` : 'Wallet not connected'}
      sx={{
        backgroundColor: connected ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.grey[700], 0.1),
        color: connected ? theme.palette.success.main : theme.palette.text.secondary,
      }}
    />
  );
}

export default WalletStatusBadge;
