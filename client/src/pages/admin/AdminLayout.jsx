import { NavLink, Outlet } from 'react-router';
import { Boxes, LayoutDashboard, Package, Store, Users } from 'lucide-react';

export default function AdminLayout() {
  return (
    <div className="admin">
      <aside className="admin-nav">
        <strong className="admin-title">Admin</strong>
        <NavLink to="/admin" end><LayoutDashboard size={18} /> Dashboard</NavLink>
        <NavLink to="/admin/orders"><Package size={18} /> Orders</NavLink>
        <NavLink to="/admin/products"><Boxes size={18} /> Products</NavLink>
        <NavLink to="/admin/customers"><Users size={18} /> Customers</NavLink>
        <NavLink to="/" className="admin-back"><Store size={18} /> View store</NavLink>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}
