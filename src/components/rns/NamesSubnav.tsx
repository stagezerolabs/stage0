import { NavLink } from 'react-router-dom';

const items = [
  { to: '/domains', label: 'Register' },
  { to: '/domains/marketplace', label: 'Marketplace' },
];

export default function NamesSubnav() {
  return (
    <nav className="names-subnav" aria-label="Names navigation">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/domains'}
          className={({ isActive }) => `names-subnav-link ${isActive ? 'is-active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
