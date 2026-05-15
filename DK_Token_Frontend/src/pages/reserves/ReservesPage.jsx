import { useCallback, useEffect, useMemo, useState } from 'react';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import { reservesApi } from '../../modules/reserves/reserves.api';
import { formatDateTime } from '../../utils/date';
import { formatAmount } from '../../utils/format';

function ReservesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReserves = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await reservesApi.listTransactions();
      setRows(response.data);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load reserves.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReserves();
  }, [loadReserves]);

  const totals = useMemo(() => rows.reduce((accumulator, row) => {
    const amount = Number(row.amount || 0);
    if (row.type === 'CREDIT') {
      accumulator.incoming += amount;
    }
    if (row.type === 'DEBIT') {
      accumulator.outgoing += amount;
    }
    return accumulator;
  }, { incoming: 0, outgoing: 0 }), [rows]);

  const columns = useMemo(() => [
    {
      key: 'createdAt',
      label: 'Date',
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'type',
      label: 'Flow',
      render: (row) => (
        <Badge tone={row.type === 'CREDIT' ? 'emerald' : 'rose'}>
          {row.type === 'CREDIT' ? 'Incoming' : 'Outgoing'}
        </Badge>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => (
        <span className={row.type === 'CREDIT' ? 'text-emerald-300' : 'text-rose-300'}>
          {`${row.type === 'CREDIT' ? '+' : '-'}${formatAmount(row.amount)} ${row.currency || ''}`.trim()}
        </span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
    },
    {
      key: 'fundingBank',
      label: 'Funding Bank',
      render: (row) => {
        if (row.source !== 'BUY') {
          return '-';
        }

        if (row.fundingBankName && row.fundingBankCode) {
          return `${row.fundingBankName} (${row.fundingBankCode})`;
        }

        return row.fundingBankName || row.fundingBankCode || '-';
      },
    },
    {
      key: 'referenceId',
      label: 'Reference',
      render: (row) => row.referenceId || '-',
    },
  ], []);

  if (loading && !rows.length) {
    return <LoadingScreen message="Loading reserves..." />;
  }

  if (error && !rows.length) {
    return <ErrorState description={error} onAction={loadReserves} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reserves"
        subtitle="Track money entering and leaving reserve accounts across BUY, SELL, and fiat fallback TRANSFER flows."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-300/80">Incoming Money</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-300">
            +{formatAmount(totals.incoming)} BTN
          </div>
        </Card>
        <Card className="border-rose-500/20 bg-rose-500/5">
          <div className="text-xs font-medium uppercase tracking-wide text-rose-300/80">Outgoing Money</div>
          <div className="mt-2 text-2xl font-semibold text-rose-300">
            -{formatAmount(totals.outgoing)} BTN
          </div>
        </Card>
      </div>

      <AppTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={loadReserves}
        minWidth={760}
        emptyTitle="No reserve transactions found"
        emptyDescription="Reserve inflow and outflow transactions will appear here after BUY, SELL, or fiat fallback TRANSFER activity."
      />
    </div>
  );
}

export default ReservesPage;
