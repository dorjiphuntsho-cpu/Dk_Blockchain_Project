import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { Children, Fragment, forwardRef, isValidElement, useMemo } from 'react';

import { cn } from '../../utils/cn';
import {
  dropdownListboxButtonClass,
  dropdownListboxOptionClass,
  dropdownListboxOptionsClass,
} from '../../utils/dropdownStyles';

function normalizeOptions(children) {
  return Children.toArray(children)
    .filter(Boolean)
    .map((child, index) => {
      if (!isValidElement(child)) {
        return null;
      }

      const { value = '', disabled = false, children: optionLabel } = child.props || {};
      const label = typeof optionLabel === 'string' || typeof optionLabel === 'number'
        ? optionLabel
        : Children.toArray(optionLabel).join('');

      return {
        disabled,
        key: child.key ?? `${value ?? 'option'}-${index}`,
        label,
        value,
      };
    })
    .filter(Boolean);
}

const Select = forwardRef(function Select(
  { children, className, disabled = false, name, onBlur, onChange, value, ...props },
  ref,
) {
  const options = useMemo(() => normalizeOptions(children), [children]);
  const selectedOption = options.find((option) => String(option.value) === String(value ?? '')) || options[0] || null;

  function handleChange(nextValue) {
    if (onChange) {
      onChange({
        target: {
          name,
          value: nextValue,
        },
      });
    }
  }

  return (
    <div className="relative">
      <input
        hidden
        name={name}
        onBlur={onBlur}
        ref={ref}
        readOnly
        value={selectedOption?.value ?? ''}
      />
      <Listbox disabled={disabled} onChange={handleChange} value={selectedOption?.value ?? ''}>
        <div className="relative">
          <ListboxButton
            className={cn(
              dropdownListboxButtonClass,
              'w-full',
              disabled ? 'cursor-not-allowed opacity-60' : '',
              className,
            )}
            {...props}
          >
            <span className="block truncate pr-6 text-left">{selectedOption?.label ?? ''}</span>
            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/60" />
          </ListboxButton>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <ListboxOptions className={`${dropdownListboxOptionsClass} left-0 right-0 top-full origin-top`}>
              {options.map((option) => (
                <ListboxOption
                  className={({ selected }) => cn(
                    dropdownListboxOptionClass,
                    option.disabled ? 'cursor-not-allowed opacity-50' : '',
                    selected ? 'text-white' : '',
                  )}
                  disabled={option.disabled}
                  key={option.key}
                  value={option.value}
                >
                  {({ selected }) => (
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{option.label}</span>
                      {selected ? <CheckIcon className="size-4 text-white/70" /> : null}
                    </div>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
});

export default Select;
