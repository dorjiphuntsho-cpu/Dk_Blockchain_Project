import { Controller, useFormContext } from 'react-hook-form';
import { TextField } from '@mui/material';

function FormTextField({ name, helperText, ...props }) {
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
          value={field.value ?? ''}
          {...props}
        />
      )}
    />
  );
}

export default FormTextField;
