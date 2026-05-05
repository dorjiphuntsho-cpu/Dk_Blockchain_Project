import { Outlet } from 'react-router-dom';

function PortalAuthLayout() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_24%),linear-gradient(180deg,_#07110f_0%,_#0a0f16_48%,_#111827_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-emerald-400/10 bg-zinc-950/75 shadow-2xl backdrop-blur">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden border-r border-white/10 p-10 lg:block">
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                  BTN User Portal
                </div>
                <h1 className="mt-6 max-w-md text-4xl font-semibold tracking-tight text-white">
                  Buy, sell, and transfer BTN without entering the admin console.
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
                  This customer space is isolated from operations dashboards and intended for direct retail flows using CID and DK Bank MPIN.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  ['Buy BTN', 'Move money into DK Bank and request BTN issuance against your customer flow.'],
                  ['Sell BTN', 'Start a sell instruction and route proceeds to your linked bank account.'],
                  ['Transfer BTN', 'Send BTN directly to another registered beneficiary account.'],
                ].map(([title, description]) => (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" key={title}>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-md">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PortalAuthLayout;
