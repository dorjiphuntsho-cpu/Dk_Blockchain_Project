import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { Fragment } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { cn } from '../../utils/cn';

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
        <label className="block space-y-2">
          {props.label ? <span className="text-sm font-medium text-zinc-200">{props.label}</span> : null}
          <Listbox
            multiple={multiple}
            onChange={(value) => field.onChange(value)}
            value={field.value ?? (multiple ? [] : null)}
          >
            <div className="relative">
              <Listbox.Button
                className={cn(
                  'flex min-h-10 w-full items-center justify-between rounded-lg border bg-zinc-950 px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2',
                  fieldState.error
                    ? 'border-rose-500/40 focus:border-rose-400 focus:ring-rose-500/20'
                    : 'border-white/10 focus:border-white/15 focus:ring-white/20',
                )}
              >
                <span className="block min-w-0 flex-1 truncate text-zinc-100">
                  {multiple
                    ? (field.value?.length
                      ? field.value.map((item) => getOptionLabel(item)).join(', ')
                      : (props.placeholder || 'Select options'))
                    : (field.value ? getOptionLabel(field.value) : (props.placeholder || 'Select an option'))}
                </span>
                <ChevronUpDownIcon className="size-4 text-zinc-500" />
              </Listbox.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Listbox.Options className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-white/10 bg-zinc-900/95 p-1 text-sm text-zinc-200 shadow-xl backdrop-blur focus:outline-none">
                  {options.map((option) => {
                    const selected = multiple
                      ? (field.value || []).some((value) => isOptionEqualToValue(option, value))
                      : field.value && isOptionEqualToValue(option, field.value);

                    return (
                      <Listbox.Option
                        className={({ active }) => cn(
                          'group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm',
                          active ? 'bg-zinc-900/10 text-white' : 'text-zinc-300',
                        )}
                        key={option.value || getOptionLabel(option)}
                        value={option}
                      >
                        <span className="truncate">{getOptionLabel(option)}</span>
                        {selected ? <CheckIcon className="size-4 text-zinc-300" /> : null}
                      </Listbox.Option>
                    );
                  })}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
          {fieldState.error?.message ? <span className="text-xs text-rose-400">{fieldState.error.message}</span> : null}
        </label>
      )}
    />
  );
}

export default FormAutocomplete;
