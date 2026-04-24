import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

import { truncateMiddle } from '../../utils/format';

function formatHoldingCount(count) {
  return `${count} token${count === 1 ? '' : 's'}`;
}

function getTokenPresentation(balance, tokenMetadataMap) {
  const tokenMetadata = tokenMetadataMap[balance.mintAddress] || {};

  return {
    name: tokenMetadata.name || tokenMetadata.symbol || 'Managed Token',
    subtitle: tokenMetadata.symbol ? `Token - ${tokenMetadata.symbol}` : 'Token',
  };
}

function WalletBalanceShowcase({
  balances = [],
  emptyDescription,
  emptyTitle = 'No token balances',
  showWalletAddress = false,
  tokenMetadataMap = {},
  walletAddress = '',
  walletLabel = '',
}) {
  if (!balances.length) {
    return (
      <Paper
        sx={{
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 4,
          p: 3,
          background: 'linear-gradient(180deg, rgba(243,246,251,0.7) 0%, rgba(255,255,255,0.95) 100%)',
        }}
      >
        <Stack spacing={1}>
          <Typography variant="h6">{emptyTitle}</Typography>
          <Typography color="text.secondary">
            {emptyDescription}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      {walletLabel || walletAddress ? (
        <Card
          sx={{
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 18px 38px rgba(15, 23, 42, 0.06)',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.03) 0%, rgba(255,255,255,0.98) 70%)',
          }}
        >
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Stack spacing={0.75}>
                <Typography sx={{ fontWeight: 700 }} variant="h6">
                  {walletLabel || 'Wallet Holdings'}
                </Typography>
                {showWalletAddress && walletAddress ? (
                  <Typography color="text.secondary" variant="body2">
                    {truncateMiddle(walletAddress, 16, 12)}
                  </Typography>
                ) : null}
              </Stack>
              <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1}>
                <Chip
                  label={formatHoldingCount(balances.length)}
                  sx={{
                    fontWeight: 700,
                    backgroundColor: 'rgba(30, 64, 175, 0.08)',
                    color: 'primary.dark',
                  }}
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Grid container spacing={2}>
        {balances.map((balance) => {
          const tokenPresentation = getTokenPresentation(balance, tokenMetadataMap);

          return (
            <Grid key={balance.tokenAccountAddress || balance.mintAddress} size={{ xs: 12, md: 6, xl: 4 }}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    px: 2.5,
                    py: 2,
                    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(14, 165, 233, 0.04) 100%)',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                    <Stack spacing={0.5}>
                      <Typography color="text.secondary" variant="caption">
                        {tokenPresentation.subtitle}
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }} variant="body1">
                        {tokenPresentation.name}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {truncateMiddle(balance.mintAddress, 14, 12)}
                      </Typography>
                    </Stack>
                    <Chip
                      label={`${balance.amount}`}
                      sx={{
                        alignSelf: 'flex-start',
                        fontWeight: 800,
                        backgroundColor: 'rgba(255,255,255,0.88)',
                      }}
                    />
                  </Stack>
                </Box>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography color="text.secondary" variant="body2">
                        Decimals
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }} variant="body2">
                        {balance.decimals}
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography color="text.secondary" variant="body2">
                        Raw Amount
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }} variant="body2">
                        {balance.rawAmount}
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack spacing={0.5}>
                      <Typography color="text.secondary" variant="body2">
                        Token Account
                      </Typography>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                        {balance.tokenAccountAddress}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}

export default WalletBalanceShowcase;
