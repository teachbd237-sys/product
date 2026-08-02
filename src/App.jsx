import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import ProductPage from './pages/ProductPage.jsx'
import Checkout from './pages/Checkout.jsx'
import OrderTracking from './pages/OrderTracking.jsx'
import PurchaseStatus from './pages/PurchaseStatus.jsx'

import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminProducts from './pages/admin/AdminProducts.jsx'
import AdminProductForm from './pages/admin/AdminProductForm.jsx'
import AdminOrders from './pages/admin/AdminOrders.jsx'
import AdminOrderDetail from './pages/admin/AdminOrderDetail.jsx'
import AdminSettings from './pages/admin/AdminSettings.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function App() {
  return (
    <>
      <Routes>
        {/* Public / Customer facing pages */}
        <Route path="/" element={<><Navbar /><Home /><Footer /></>} />
        <Route path="/product/:slug" element={<><Navbar /><ProductPage /><Footer /></>} />
        <Route path="/checkout/:slug" element={<><Navbar /><Checkout /><Footer /></>} />
        <Route path="/track-order" element={<><Navbar /><OrderTracking /><Footer /></>} />
        <Route path="/order/:orderCode" element={<><Navbar /><PurchaseStatus /><Footer /></>} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id/edit" element={<AdminProductForm />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<><Navbar /><div className="container section"><h2>404 — Page খুঁজে পাওয়া যায়নি</h2></div><Footer /></>} />
      </Routes>
    </>
  )
}
