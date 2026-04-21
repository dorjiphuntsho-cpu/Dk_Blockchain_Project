import { Controller, useFormContext } from 'react-hook-form';
import { MenuItem, TextField } from '@mui/material';

function FormSelect({ name, options = [], helperText, ...props }) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          error={Boolean(fieldState.error)}
          fullWidth
          helperText={fieldState.error?.message || helperText}
          select
          value={field.value ?? ''}
          {...props}
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}

export default FormSelect;
