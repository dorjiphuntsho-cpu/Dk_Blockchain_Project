import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react';

function AppDrawer({ open, title, children, onClose, anchor = 'right' }) {
  const justifyClass = anchor === 'left' ? 'justify-start' : 'justify-end';
  const enterFrom = anchor === 'left' ? '-translate-x-full' : 'translate-x-full';

  return (
    <Transition appear as={Fragment} show={open}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <DialogBackdrop className="fixed inset-0 bg-black/60 transition duration-100 ease-out data-[closed]:opacity-0" />
        <div className="fixed inset-0 overflow-hidden">
          <div className={`flex h-full ${justifyClass}`}>
            <TransitionChild
              as={Fragment}
              enter="transform transition ease-out duration-200"
              enterFrom={enterFrom}
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo={enterFrom}
            >
              <DialogPanel className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-zinc-900 shadow-2xl md:max-w-lg">
                <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
                  <DialogTitle className="text-base font-semibold text-white">{title}</DialogTitle>
                  <button
                    className="rounded-md p-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                    onClick={onClose}
                    type="button"
                  >
                    <XMarkIcon className="size-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm text-zinc-300">{children}</div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default AppDrawer;
