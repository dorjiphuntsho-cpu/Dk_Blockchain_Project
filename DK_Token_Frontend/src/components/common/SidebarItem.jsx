import { NavLink } from 'react-router-dom';

import { cn } from '../../utils/cn';

function SidebarItem({ collapsed, icon, label, path, selected, onClick }) {
  return (
    <NavLink
      className={cn(
        'group relative flex min-h-9 items-center gap-2 rounded-md px-2 py-2 text-sm transition',
        collapsed ? 'justify-center' : '',
        selected
          ? 'bg-zinc-900/10 text-white'
          : 'text-zinc-400 hover:bg-zinc-900/5 hover:text-white',
      )}
      onClick={onClick}
      title={collapsed ? label : undefined}
      to={path}
    >
      {selected ? <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-emerald-400" /> : null}
      <span className={cn('shrink-0', selected ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300')}>{icon}</span>
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </NavLink>
  );
}

export default SidebarItem;
