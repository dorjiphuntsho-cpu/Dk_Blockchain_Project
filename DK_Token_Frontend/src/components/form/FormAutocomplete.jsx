import { Controller, useFormContext } from 'react-hook-form';
import { Autocomplete, TextField } from '@mui/material';

function FormAutocomplete({
  name,
  options = [],
  getOptionLabel = (option) => option.label || '',
  isOptionEqualToValue = (option, value) => option.value === value.value,
  multiple = false,
  ...props
}) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Autocomplete
          {...props}
          isOptionEqualToValue={isOptionEqualToValue}
          getOptionLabel={getOptionLabel}
          multiple={multiple}
          onChange={(_event, value) => field.onChange(value)}
          options={options}
          value={field.value ?? (multiple ? [] : null)}
          renderInput={(params) => (
            <TextField
              {...params}
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message}
              label={props.label}
            />
          )}
        />
      )}
    />
  );
}

export default FormAutocomplete;
