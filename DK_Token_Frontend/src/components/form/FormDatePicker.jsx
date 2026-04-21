import { Controller, useFormContext } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

function FormDatePicker({ name, ...props }) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <DatePicker
          {...props}
          value={field.value || null}
          onChange={field.onChange}
          slotProps={{
            textField: {
              fullWidth: true,
              error: Boolean(fieldState.error),
              helperText: fieldState.error?.message,
            },
          }}
        />
      )}
    />
  );
}

export default FormDatePicker;
