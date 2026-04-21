import {
  Box,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import EmptyState from './EmptyState';
import ErrorState from './ErrorState';

function AppTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  pagination,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
  minWidth = 960,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters or create a new record.',
}) {
  if (error) {
    return (
      <Paper>
        <ErrorState description={error} onAction={onRetry} />
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        overflow: 'hidden',
        backgroundColor: alpha('#ffffff', 0.92),
      }}
    >
      {loading ? <LinearProgress /> : null}
      <TableContainer
        sx={{
          maxHeight: pagination ? undefined : 640,
          overflowX: 'auto',
        }}
      >
        <Table stickyHeader sx={{ minWidth }}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align || 'left'}
                  sx={column.headerSx}
                  width={column.width}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {!rows.length ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyState description={emptyDescription} title={emptyTitle} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  hover
                  key={row.id || row.key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    '&:hover': {
                      backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.03),
                    },
                  }}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      align={column.align || 'left'}
                      onClick={column.disableRowClick ? (event) => event.stopPropagation() : undefined}
                      sx={{ verticalAlign: 'middle', ...column.sx }}
                    >
                      <Box
                        sx={{
                          minHeight: 22,
                          display: 'flex',
                          alignItems: column.align === 'right' ? 'flex-end' : 'center',
                          justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        {column.render ? column.render(row) : row[column.key]}
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {pagination ? (
        <TablePagination
          component="div"
          count={pagination.totalItems}
          onPageChange={(_event, nextPage) => onPageChange(nextPage + 1)}
          onRowsPerPageChange={(event) => onRowsPerPageChange(Number(event.target.value))}
          page={Math.max((pagination.page || 1) - 1, 0)}
          rowsPerPage={pagination.limit || 10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          sx={{
            borderTop: `1px solid ${alpha('#0f172a', 0.05)}`,
            backgroundColor: alpha('#ffffff', 0.82),
          }}
        />
      ) : null}
    </Paper>
  );
}

export default AppTable;
