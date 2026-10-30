import { Routes, Route, Navigate, useParams, Link } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Home from './pages/Home.jsx'
import ProductPage from './pages/ProductPage.jsx'
import RequestPage from './pages/RequestPage.jsx'
import RequestStatus from './pages/RequestStatus.jsx'

import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminRequests from './pages/admin/AdminRequests.jsx'
import AdminRequestDetail from './pages/admin/AdminRequestDetail.jsx'
import AdminCodes from './pages/admin/AdminCodes.jsx'
import AdminProducts from './pages/admin/AdminProducts.jsx'
import AdminProductForm from './pages/admin/AdminProductForm.jsx'
import AdminRequirements from './pages/admin/AdminRequirements.jsx'
import AdminSettings from './pages/admin/AdminSettings.jsx'
import AdminLegacyOrders from './pages/admin/AdminLegacyOrders.jsx'

const Public = ({ children }) => <><Navbar />{children}<Footer /></>
const OldCheckout = () => { const { slug } = useParams(); return <Navigate to={`/request/${slug}`} replace /> }

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Public><Home /></Public>} />
      <Route path="/product/:slug" element={<Public><ProductPage /></Public>} />
      <Route path="/request/:slug" element={<Public><RequestPage /></Public>} />
      <Route path="/request-status" element={<Public><RequestStatus /></Public>} />
      <Route path="/request-status/:ref" element={<Public><RequestStatus /></Public>} />

      {/* পুরনো পেমেন্ট-যুগের লিংকের জন্য Redirect (Bookmark ভাঙবে না) */}
      <Route path="/checkout/:slug" element={<OldCheckout />} />
      <Route path="/track-order" element={<Navigate to="/request-status" replace />} />
      <Route path="/order/:orderCode" element={<Navigate to="/request-status" replace />} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="requests/:id" element={<AdminRequestDetail />} />
        <Route path="codes" element={<AdminCodes />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="products/new" element={<AdminProductForm />} />
        <Route path="products/:id/edit" element={<AdminProductForm />} />
        <Route path="requirements" element={<AdminRequirements />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="legacy-orders" element={<AdminLegacyOrders />} />
        <Route path="orders" element={<Navigate to="/admin/legacy-orders" replace />} />
        <Route path="orders/:id" element={<Navigate to="/admin/legacy-orders" replace />} />
      </Route>

      <Route path="*" element={<Public><main className="container section center"><h2>৪০৪ — পেজটি খুঁজে পাওয়া যায়নি</h2><Link to="/" className="btn mt-16">হোমে ফিরে যান</Link></main></Public>} />
    </Routes>
  )
}
