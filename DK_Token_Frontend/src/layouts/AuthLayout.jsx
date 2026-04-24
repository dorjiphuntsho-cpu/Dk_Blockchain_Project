import { Outlet } from 'react-router-dom';

function AuthLayout() {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-zinc-900/90 p-6 shadow-panel backdrop-blur md:p-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
