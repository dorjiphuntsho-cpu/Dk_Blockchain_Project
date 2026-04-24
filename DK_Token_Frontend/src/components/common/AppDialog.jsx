import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react';

function AppDialog({ open, title, children, actions, onClose, maxWidth = 'sm' }) {
  const widthClasses = {
    xs: 'max-w-sm',
    sm: 'max-w-lg',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <Transition appear as={Fragment} show={open}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <DialogBackdrop className="fixed inset-0 bg-black/60 transition duration-100 ease-out data-[closed]:opacity-0" />
        <div className="fixed inset-0 overflow-y-auto p-4 md:p-8">
          <div className="flex min-h-full items-center justify-center">
            <DialogPanel className={`w-full ${widthClasses[maxWidth] || widthClasses.sm} overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0`}>
              <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
                <DialogTitle className="text-base font-medium text-white">{title}</DialogTitle>
                <button
                  className="rounded-md p-2 text-zinc-500 transition hover:bg-zinc-900/10 hover:text-zinc-200"
                  onClick={onClose}
                  type="button"
                >
                  <XMarkIcon className="size-4" />
                </button>
              </div>
              <div className="px-5 py-4 text-zinc-300">{children}</div>
              {actions ? <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 bg-zinc-950/70 px-5 py-3">{actions}</div> : null}
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default AppDialog;
